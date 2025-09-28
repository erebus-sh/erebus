/**
 * Options to customize subscription behavior.
 */
export interface SubscribeOptions {
  /**
   * If true, the server will attempt to deliver missed messages
   * (i.e., messages sent while the client was offline) over the websocket.
   * Defaults to false.
   */
  streamOldMessages?: boolean;
}
