// ========== SERVER APP ==========
export {
  createApp,
  type AppVars,
  type AppType,
  type AuthorizeServer,
} from "./app";

// ========== RPC CLIENT ==========
export { createRpcClient } from "./rpc";
export type { AppType as RpcAppType } from "./rpc";

// ========== ADAPTERS ==========
export * from "./adapter/next";
export {
  createAdapter as createGenericAdapter,
  type Authorize as ServerAuthorize,
  type FireWebhook,
} from "./adapter/genericAdapter";
