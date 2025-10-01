import { DistributedKey } from "@/lib/distributedKey";
import { verifyRequestToken } from "@/lib/grants_jwt";
import { HandlerProps } from "@/types/handlerProps";
import { MessageBody } from "@repo/schemas/messageBody";

/**
 * Response interface for topic history API
 */
export interface TopicHistoryResponse {
  items: MessageBody[];
  nextCursor: string | null;
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
 * Extract grant token from request query parameters or headers.
 *
 * The HTTP API supports grants via query parameter or X-Erebus-Grant header.
 *
 * @param request - Incoming HTTP request
 * @returns Grant token or null if not found
 */
function extractGrantToken(request: Request): string | null {
  const url = new URL(request.url);

  // Try query parameter first
  const queryGrant = url.searchParams.get("grant");
  if (queryGrant?.trim()) {
    return queryGrant.trim();
  }

  // Fall back to header
  const headerGrant = request.headers.get("X-Erebus-Grant");
  if (headerGrant?.trim()) {
    return headerGrant.trim();
  }

  return null;
}

/**
 * HTTP GET handler for topic history API.
 *
 * Endpoint: GET /v1/pubsub/topics/:topicName/history
 *
 * Query Parameters:
 * - grant: JWT grant token (required, contains channel name)
 * - cursor: ULID sequence for pagination (optional)
 * - limit: Number of messages to return, 1-1000 (optional, default 50)
 * - direction: "forward" or "backward" (optional, default "backward")
 *
 * This handler:
 * 1. Extracts and verifies the grant token (which contains channel name)
 * 2. Extracts topic from URL path
 * 3. Parses pagination parameters
 * 4. Routes to appropriate Durable Object using location hint
 * 5. Fetches historical messages with cursor-based pagination
 * 6. Returns JSON response with items and nextCursor
 *
 * @param props - Handler properties including request, environment, and location hint
 * @returns HTTP response with paginated message history or error
 */
export async function getTopicHistory(props: HandlerProps): Promise<Response> {
  const logTag = "[history]";
  const url = new URL(props.request.url);

  console.log(`${logTag} Received history request: ${url.pathname}`);

  // Extract grant token
  const grant = extractGrantToken(props.request);
  if (!grant) {
    console.warn(
      `${logTag} No grant token provided in query parameter or X-Erebus-Grant header`,
    );
    return createErrorResponse(
      "Unauthorized: Grant token required in query parameter or X-Erebus-Grant header",
      401,
    );
  }

  console.log(`${logTag} Grant token extracted: ${grant.substring(0, 100)}...`);

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
    `${logTag} Grant token verified - projectId: ${verifiedGrant.project_id}, channel: ${verifiedGrant.channel}`,
  );

  // Extract topic name from URL path
  const pathMatch = url.pathname.match(
    /\/v1\/pubsub\/topics\/([^/]+)\/history/,
  );
  if (!pathMatch) {
    console.warn(`${logTag} Invalid URL path format: ${url.pathname}`);
    return createErrorResponse("Invalid URL path format", 400);
  }

  const topicName = pathMatch[1];

  console.log(
    `${logTag} Extracting history for channel: ${verifiedGrant.channel}, topic: ${topicName}`,
  );

  // Parse query parameters
  const cursor = url.searchParams.get("cursor") || null;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const directionParam = url.searchParams.get("direction") || "backward";
  const direction =
    directionParam === "forward" || directionParam === "backward"
      ? directionParam
      : "backward";

  // Validate limit
  if (Number.isNaN(limit) || limit < 1 || limit > 1000) {
    console.warn(`${logTag} Invalid limit parameter: ${limitParam}`);
    return createErrorResponse(
      "Invalid limit: must be between 1 and 1000",
      400,
    );
  }

  console.log(
    `${logTag} Query params - cursor: ${cursor}, limit: ${limit}, direction: ${direction}`,
  );

  // Build distributed ID with location hint (same pattern as WebSocket connections)
  const distributedId = DistributedKey.stringify({
    projectId: verifiedGrant.project_id,
    resource: verifiedGrant.channel,
    resourceType: "channel",
    version: "v1",
  });

  const distributedIdWithLocationHint = DistributedKey.appendLocationHint(
    distributedId,
    props.locationHint,
  );

  console.log(
    `${logTag} Routing to Durable Object: ${distributedIdWithLocationHint}`,
  );

  try {
    // Get Durable Object stub
    const stub = props.env.CHANNEL.getByName(distributedIdWithLocationHint);

    // Call getTopicHistory method on the Durable Object
    const result = await stub.getTopicHistory(
      verifiedGrant.project_id,
      verifiedGrant.channel,
      topicName,
      cursor,
      limit,
      direction,
    );

    console.log(
      `${logTag} Retrieved ${result.items.length} messages, nextCursor: ${result.nextCursor}`,
    );

    // Return JSON response
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error(`${logTag} Error fetching history:`, error);
    return createErrorResponse(
      "Internal Server Error: Failed to fetch message history",
      500,
    );
  }
}
