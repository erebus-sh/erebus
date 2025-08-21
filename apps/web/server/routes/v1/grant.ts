import { Hono } from "hono";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { grantRequestSchema } from "@repo/schemas/request/grantChannelRequest";
import { sign } from "@/lib/jwt";
import { zValidator } from "@hono/zod-validator";
import { Grant, Access } from "@repo/schemas/grant";
import { ConvexError } from "convex/values";
import { ratelimit } from "@/lib/ratelimit";
import { redis } from "@/lib/redis";
import { sha256 } from "@/utils/hash";

export const grantRoute = new Hono();

// Allow "*" for topics, otherwise only letters, numbers, and underscores
const TOPIC_RE = /^([A-Za-z0-9_]+|\*)$/;

// Channel names can still use the original pattern
const CHANNEL_RE = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * Determines the most permissive scope between two access levels
 */
function getMostPermissive(scope1: string, scope2: string): string {
  if (scope1 === Access.ReadWrite || scope2 === Access.ReadWrite) {
    return Access.ReadWrite;
  }
  if (scope1 === Access.Write || scope2 === Access.Write) {
    return Access.Write;
  }
  if (scope1 === Access.Read || scope2 === Access.Read) {
    return Access.Read;
  }
  return scope1; // fallback
}

/**
 * Normalizes and deduplicates topics, choosing the most permissive scope for duplicates
 */
function normalizeTopics(topics: any[]): any[] {
  const topicMap = new Map<string, string>();

  for (const topic of topics) {
    const existing = topicMap.get(topic.topic);
    if (existing) {
      topicMap.set(topic.topic, getMostPermissive(existing, topic.scope));
    } else {
      topicMap.set(topic.topic, topic.scope);
    }
  }

  // Sort by topic name for consistent ordering
  return Array.from(topicMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([topic, scope]) => ({ topic, scope }));
}

/**
 * Generates a SHA-256 hash of the grant request parameters to enable caching.
 * This allows us to serve identical grant requests from cache without regenerating JWTs.
 *
 * Note: expiresAt is intentionally excluded from the hash to handle cases where
 * expiration times may differ slightly between requests for the same grant.
 */
async function hashGrantRequest(
  secretKey: string,
  channel: string,
  topics: { topic: string; scope: string }[],
  userId: string,
): Promise<string> {
  // Normalize topics to ensure consistent hashing regardless of input order or duplicates
  const normalizedTopics = normalizeTopics(topics);

  const grantKey = JSON.stringify({
    secretKey,
    channel,
    topics: normalizedTopics,
    userId,
  });

  return await sha256(grantKey);
}

/**
 * Attempts to retrieve a cached grant JWT for the given request parameters.
 * Returns the JWT if found, null otherwise.
 */
async function getCachedGrant(hash: string): Promise<string | null> {
  try {
    return await redis.get(`v1:grant:${hash}`);
  } catch {
    return null;
  }
}

/**
 * Caches a grant JWT with a TTL based on the grant's expiration time.
 * The cache TTL is set to match the grant's lifetime to ensure consistency.
 */
async function setCachedGrant(
  hash: string,
  jwt: string,
  ttlSeconds: number,
): Promise<void> {
  try {
    await redis.set(`v1:grant:${hash}`, jwt, { ex: ttlSeconds });
  } catch {
    // Fail silently if caching fails - not critical to the operation
  }
}

grantRoute.post(
  "/grant-channel",
  zValidator("json", grantRequestSchema),
  async (c) => {
    // Get the validated, typed request body
    const { secret_key, channel, topics, userId, expiresAt } =
      c.req.valid("json");

    // Format validation first (cheap checks)
    if (!CHANNEL_RE.test(channel)) {
      return c.json(
        {
          error:
            "Invalid channel format. Only letters, numbers, dots, underscores, colons, and hyphens are allowed.",
        },
        400,
      );
    }

    if (topics.length === 0) {
      return c.json({ error: "At least one topic is required" }, 400);
    }

    if (topics.length > 64) {
      return c.json(
        {
          error:
            "Connecting to more than 64 topics at once is inefficient. Please reduce the number of topics in this grant.",
        },
        400,
      );
    }

    for (const topic of topics) {
      if (!TOPIC_RE.test(topic.topic)) {
        return c.json(
          {
            error: `Invalid topic format: ${topic.topic}. Only letters, numbers, dots, underscores, colons, and hyphens are allowed.`,
          },
          400,
        );
      }
    }

    // Check for required env variable
    if (process.env.PRIVATE_KEY_JWK === undefined) {
      return c.json(
        {
          error:
            "Server misconfiguration: missing PRIVATE_KEY_JWK. Please contact the administrator.",
        },
        500,
      );
    }

    /*
     * Check cache for existing grant with identical parameters (excluding expiresAt)
     * before hitting Convex database.
     */
    const grantHash = await hashGrantRequest(
      await sha256(secret_key),
      channel,
      topics,
      userId,
    );
    const cachedJwt = await getCachedGrant(grantHash);

    if (cachedJwt) {
      /**
       * Cache hit detected - returning existing grant without rate limiting.
       * This optimization prevents redundant rate limiting for identical grant requests,
       * as the core grant parameters (project, channel, topics, user) are the same.
       * This improves performance for repeated requests while maintaining security boundaries.
       *
       * TODO: Consider updating the expiration time of cached grants when a newer
       * expiration is requested, allowing for dynamic TTL extension.
       */
      c.header("X-Erebus-Grant-Cache", "HIT");

      return c.json({ grant_jwt: cachedJwt });
    }

    // Resolve project first (authentication)
    let projectId: string;
    try {
      // Fetch projectId from Convex query
      projectId = await fetchQuery(api.keys.query.getProjectIdByKey, {
        secret_key,
      });
    } catch (error: unknown) {
      if (error instanceof ConvexError) {
        return c.json(
          {
            error: `Access denied: ${error.message}. Please check your credentials and try again.`,
          },
          401,
        );
      }
      return c.json(
        {
          error:
            "An unexpected server error occurred while processing your grant request. Please try again later or contact support.",
        },
        500,
      );
    }

    // Validate projectId structure
    if (typeof projectId !== "string" || !projectId) {
      return c.json(
        {
          error:
            "Unable to resolve project for the provided secret key. Please verify your key and try again.",
        },
        401,
      );
    }

    /**
     * Enforce a rate limit scoped to project and user: each specific (projectId, userId) can only request up to 5 grants within a 2-hour window.
     * This helps prevent abuse and ensures fair usage of the grant system while keeping limits scoped to the correct tenant.
     */
    let limitOk = true;
    let reset = Date.now();
    let remaining = 0;
    let hasRateLimitData = false;
    try {
      const {
        success,
        reset: resetTime,
        remaining: remainingCount,
      } = await ratelimit.limit(`grant:${projectId}:${userId}`);
      limitOk = success;
      reset = resetTime;
      remaining = remainingCount;
      hasRateLimitData = true;
    } catch {
      // Fail-open if rate limiter is unavailable
      limitOk = true;
    }

    // Only set rate limit headers when we have real values
    if (hasRateLimitData) {
      const retrySec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
      c.header("X-RateLimit-Limit", "5/2h");
      c.header("X-RateLimit-Remaining", String(remaining));
      c.header("X-RateLimit-Reset", String(Math.floor(reset / 1000)));

      if (!limitOk) {
        c.header("Retry-After", String(retrySec));
        return c.json(
          {
            error: `Rate limited: you have reached the maximum of 5 grant requests allowed within 2 hours. Please wait before trying again.`,
          },
          429,
        );
      }
    }

    // TTL validation and clamping (use seconds consistently)
    const now = Math.floor(Date.now() / 1000); // current time in seconds
    const MAX_TTL = 2 * 60 * 60; // 2 hours in seconds
    const MIN_TTL = 10 * 60; // 10 minutes in seconds

    const wantExp = typeof expiresAt === "number" ? expiresAt : now + MAX_TTL;
    const exp = Math.max(now + MIN_TTL, Math.min(wantExp, now + MAX_TTL));

    // Validate expiresAt is a valid number if provided
    if (typeof expiresAt === "number") {
      if (!Number.isFinite(expiresAt)) {
        return c.json(
          {
            error:
              "Expiration must be a valid number (unix timestamp in seconds).",
          },
          400,
        );
      }
    }

    // Expose the effective TTL via headers
    const effectiveTTL = 5 * 60; // 5 minutes
    c.header("X-Erebus-Grant-TTL", String(effectiveTTL));
    c.header("X-Erebus-Grant-Expires-At", String(exp));
    c.header("X-Erebus-Grant-Cache", "MISS");

    // Normalize topics for the final grant (deduplicate and sort)
    const normalizedTopics = normalizeTopics(topics);

    // Create grant with consistent time units (seconds)
    const grant: Grant = {
      project_id: projectId,
      channel,
      topics: normalizedTopics,
      userId,
      issuedAt: now,
      expiresAt: exp,
    };
    const jwt = await sign(grant, process.env.PRIVATE_KEY_JWK);

    // Cache the newly generated grant with TTL matching the grant's expiration
    await setCachedGrant(grantHash, jwt, effectiveTTL);

    return c.json({ grant_jwt: jwt });
  },
);

/**
 * TODO:
 * Later for analytics, we will count number of grants per user and per channel.
 */
