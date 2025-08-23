// TODO: later no barrel exports
export { ErebusPubSubClient } from "./client/core/pubsub/ErebusPubSub";
export type {
  ErebusOptions,
  Unsubscribe,
  MessageMeta,
  AckCallback,
  AckResponse,
  AckSuccess,
  AckError,
  PendingPublish,
} from "./client/core/types";
export {
  NotConnectedError,
  BackpressureError,
  AuthError,
} from "./client/core/errors";
