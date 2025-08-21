import { getShards, registerChannelAndShard } from "@/services/channelShards";
import { DistributedKey } from "@/lib/distributedKey";
import { verifyRequestToken } from "@/lib/grants_jwt";
import { HandlerProps } from "@/types/handlerProps";
import { waitUntil } from "cloudflare:workers";

/**
 * Background operations interface for type safety and documentation
 */
interface BackgroundOperationParams {
  /** Environment bindings and variables */
  env: HandlerProps["env"];
  /** Project identifier for the channel */
  projectId: string;
  /** Base distributed ID without location hint */
  distributedId: string;
  /** Location-aware distributed ID for this shard */
  distributedIdWithLocationHint: string;
  /** Location hint for regional routing */
  locationHint: string;
  /** Log tag for consistent logging */
  logTag: string;
}

/**
 * Helper function to handle background operations that don't need to block the response.
 *
 * This function is designed to run asynchronously using waitUntil to extend the Worker's
 * execution lifetime beyond the request lifecycle. It handles critical infrastructure
 * operations that ensure proper shard coordination and registration.
 *
 * Background operations include:
 * - Redis registration of channels and shards for service discovery
 * - Updating shard information in localStorage across all channel instances
 * - Cross-region shard coordination for message broadcasting
 * - Cleanup and maintenance tasks that can happen after response is sent
 *
 * Using waitUntil ensures these operations complete even if the client disconnects
 * early, improving reliability for critical infrastructure operations.
 *
 * @param params - Background operation parameters
 * @returns Promise that resolves when all background operations complete
 */
async function handleBackgroundOperations(
  params: BackgroundOperationParams,
): Promise<void> {
  const {
    env,
    projectId,
    distributedId,
    distributedIdWithLocationHint,
    locationHint,
    logTag,
  } = params;
  try {
    // Register the shard and distributedId in the redis cache
    console.log(
      `${logTag} [Background] Registering channel and shard in Redis...`,
    );
    const registrationResult = await registerChannelAndShard(
      env,
      projectId,
      distributedIdWithLocationHint,
      locationHint,
    );
    console.log(
      `${logTag} [Background] registerChannelAndShard result:`,
      registrationResult,
    );

    if (!registrationResult) {
      console.error(
        `${logTag} [Background] Failed to register channel and shard in Redis`,
      );
      return;
    }

    // Register the shards in the localStorage of the channel
    // Note: don't use distributedIdWithLocationHint, because it's scoped to the location hint
    console.log(
      `${logTag} [Background] Fetching available shards for distributedId:`,
      distributedId,
    );
    const availableShards = await getShards(env, distributedId);
    console.log(`${logTag} [Background] Available shards:`, availableShards);

    // Update all shards with the latest shard information
    // This ensures each channel instance has the complete shard topology for cross-region broadcasting
    const shardUpdatePromises = availableShards.map(async (shard) => {
      try {
        const shardStub = env.CHANNEL.getByName(shard);
        console.log(
          `${logTag} [Background] Setting shards in localStorage for shard:`,
          shard,
        );
        await shardStub.setShardsInLocalStorage(availableShards);
        console.log(
          `${logTag} [Background] Successfully updated shard:`,
          shard,
        );
      } catch (error) {
        console.error(
          `${logTag} [Background] Failed to update shard ${shard}:`,
          error,
        );
        // Don't throw - continue with other shards
      }
    });

    await Promise.all(shardUpdatePromises);

    console.log(
      `${logTag} [Background] All background operations completed successfully`,
    );
  } catch (error) {
    console.error(
      `${logTag} [Background] Error in background operations:`,
      error,
    );
    // Background errors don't affect the main response, but we log them for debugging
  }
}

/**
 * Grant extraction result interface for type safety
 */
interface GrantExtraction {
  /** The extracted grant token */
  grant: string;
  /** Source of the grant (query or header) */
  source: "query" | "header";
}

/**
 * Extract grant token from request query parameters or headers.
 *
 * The WebSocket constructor in browsers does not support custom headers,
 * so grants can be provided via query parameter or X-Erebus-Grant header.
 *
 * @param request - Incoming HTTP request
 * @returns Grant extraction result or null if not found
 */
function extractGrantToken(request: Request): GrantExtraction | null {
  const url = new URL(request.url);

  // Try query parameter first (most common for WebSocket connections)
  const queryGrant = url.searchParams.get("grant");
  if (queryGrant?.trim()) {
    return { grant: queryGrant.trim(), source: "query" };
  }

  // Fall back to header (for API clients that support custom headers)
  const headerGrant = request.headers.get("X-Erebus-Grant");
  if (headerGrant?.trim()) {
    return { grant: headerGrant.trim(), source: "header" };
  }

  return null;
}

/**
 * Create standardized error response with proper content type and structure.
 *
 * @param message - Error message to return
 * @param status - HTTP status code
 * @returns Formatted error response
 */
function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ error: message, timestamp: new Date().toISOString() }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    },
  );
}

/**
 * Main PubSub WebSocket connection handler.
 *
 * This function handles the complete WebSocket connection lifecycle:
 * 1. Grant token extraction and validation
 * 2. Distributed routing and shard coordination
 * 3. Background operations for shard management
 * 4. Request forwarding to the appropriate Durable Object
 *
 * @param props - Handler properties including request, environment, and location hint
 * @returns HTTP response for WebSocket upgrade or error response
 */
export async function pubsub(props: HandlerProps): Promise<Response> {
  const logTag = "[pubsub]";

  console.log(
    `${logTag} Received request with locationHint: ${props.locationHint}`,
  );

  // Extract grant token from query or header
  const grantResult = extractGrantToken(props.request);
  if (!grantResult) {
    console.warn(
      `${logTag} No grant token provided in query parameter or X-Erebus-Grant header`,
    );
    return createErrorResponse(
      "Unauthorized: Grant token required in query parameter or X-Erebus-Grant header",
      401,
    );
  }

  const { grant, source } = grantResult;
  console.log(
    `${logTag} Grant token extracted from ${source}: ${grant.substring(0, 100)}...`,
  );

  // Verify the grant token signature and extract claims
  console.log(`${logTag} Verifying grant token...`);
  const verifiedGrant = await verifyRequestToken(
    grant,
    props.env.PUBLIC_KEY_JWK,
  );
  if (!verifiedGrant) {
    console.warn(
      `${logTag} Invalid grant token - signature verification failed`,
    );
    return createErrorResponse(
      "Unauthorized: Invalid grant token signature",
      401,
    );
  }

  console.log(
    `${logTag} Grant token verified successfully - projectId: ${verifiedGrant.project_id}, ` +
      `channel: ${verifiedGrant.channel}`,
  );

  /**
   * Generate distributed routing keys for shard coordination.
   *
   * Each Durable Object represents an isolated "shard" (a scoped execution and storage unit)
   * for a specific channel in a specific region. We use a structured distributed key to
   * deterministically route and isolate resources at scale.
   *
   * The key format ensures:
   * - Global uniqueness across all projects and channels
   * - Efficient sharding and load distribution
   * - Fine-grained multitenant separation
   * - Location-aware routing for reduced latency
   */
  const distributedId = DistributedKey.stringify({
    projectId: verifiedGrant.project_id,
    resource: verifiedGrant.channel,
    resourceType: "channel",
    version: "v1",
  });
  console.log(`${logTag} Computed base distributedId: ${distributedId}`);

  const distributedIdWithLocationHint = DistributedKey.appendLocationHint(
    distributedId,
    props.locationHint,
  );
  console.log(
    `${logTag} Computed location-aware distributedId: ${distributedIdWithLocationHint}`,
  );

  /**
   * Create a `DurableObjectId` for an instance of the `Channel`
   * class named "foo". Requests from all Workers to the instance named
   * "foo" will go to a single globally unique Durable Object instance.
   *
   * read more about data location:
   * https://developers.cloudflare.com/durable-objects/reference/data-location/
   */
  const stub = props.env.CHANNEL.getByName(distributedIdWithLocationHint);
  console.log(
    `${logTag} Created Durable Object stub with locationHint:`,
    props.locationHint,
  );

  /**
   * Schedule background operations using waitUntil to extend the Worker's execution lifetime.
   * These operations will continue running even after the response is sent to the client,
   * ensuring reliable completion of critical infrastructure tasks like Redis registration
   * and shard management.
   *
   * Performance Note:
   * Currently, this executes O(n) operations for every connection (including reconnections),
   * making calls to Redis and all Durable Object shards. For high-scale deployments,
   * consider implementing:
   * - Connection pooling and caching mechanisms
   * - Debounced shard updates with change detection
   * - Lazy shard discovery and registration
   */
  waitUntil(
    handleBackgroundOperations({
      env: props.env,
      projectId: verifiedGrant.project_id,
      distributedId,
      distributedIdWithLocationHint,
      locationHint: props.locationHint,
      logTag,
    }),
  );

  /**
   * Forward the request to the Durable Object with location hint.
   *
   * The location hint header enables the DO to:
   * - Store its location for shard coordination
   * - Filter itself out of cross-region broadcasts
   * - Optimize message routing decisions
   */
  console.log(
    `${logTag} Forwarding request to Durable Object with location hint: ${props.locationHint}`,
  );

  try {
    // Clone the request and add the location hint header
    const forwardedRequest = new Request(props.request, {
      headers: new Headers(props.request.headers),
    });
    forwardedRequest.headers.set("x-location-hint", props.locationHint);

    /**
     * Forward to the Durable Object for WebSocket handling.
     *
     * At this point:
     * - Grant token has been verified and is valid
     * - Background shard coordination is running asynchronously
     * - Request is routed to the correct regional shard
     *
     * The DO will handle:
     * - WebSocket upgrade and hibernation setup
     * - Message processing and topic subscriptions
     * - Local and cross-region message broadcasting
     */
    console.log(`${logTag} Invoking Durable Object stub.fetch()...`);
    const response = await stub.fetch(forwardedRequest);

    console.log(
      `${logTag} Response received from Durable Object (status: ${response.status})`,
    );
    return response;
  } catch (error) {
    console.error(
      `${logTag} Error forwarding request to Durable Object:`,
      error,
    );
    return createErrorResponse(
      "Internal Server Error: Failed to establish connection",
      500,
    );
  }
}
