import { WsErrors as SharedWsErrors } from "@repo/shared/enums/wserrors";

// Re-export as a local value to satisfy bundlers/dts processing
export const WsErrors = SharedWsErrors;
export type WsErrors = typeof SharedWsErrors;
