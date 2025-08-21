/**
 * These are application level errors as specified in the WebSocket protocol
 * from 4000 to 4999. Can be for private use.
 * - https://datatracker.ietf.org/doc/html/rfc6455#section-7.4.2
 */
export enum WsErrors {
  BadRequest = 4400,
  Unauthorized = 4401,
  Forbidden = 4403,
  NotFound = 4404,
  MethodNotAllowed = 4405,
  NotAcceptable = 4406,
  RequestTimeout = 4408,
  Conflict = 4409,
  PreconditionFailed = 4412,
}
