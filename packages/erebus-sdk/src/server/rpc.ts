import { hc } from "hono/client";

// Import only the routes type, not the entire app with server dependencies
import type { AppType as ServerRoutes } from "./app";

// Re-export the AppType for client usage
export type AppType = ServerRoutes;

/**
 * Creates an RPC client for communicating with the Erebus server
 * This function can be safely imported by client-side code
 */
export const createRpcClient = (baseUrl: string) => {
  return hc<AppType>(baseUrl);
};
