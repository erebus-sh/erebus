// ========== SERVER APP ==========
export {
  createApp,
  startAuthServer,
  type AppVars,
  type AppType,
  type AuthorizeServer,
} from "./app";

// ========== RPC CLIENT ==========
export { createRpcClient } from "./rpc";
export type { AppType as RpcAppType } from "./rpc";

// ========== ADAPTERS ==========
export * from "./adapter/next";
