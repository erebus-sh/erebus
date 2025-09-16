// Type definition for our logger interface
interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
  trace(message: string, meta?: any): void;
  success(message: string, meta?: any): void;
  fail(message: string, meta?: any): void;
  ready(message: string, meta?: any): void;
  start(message: string, meta?: any): void;
  log(message: string, meta?: any): void;
}

// Production no-op logger - all methods are empty functions
const noOpLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
  debug: () => {},
  trace: () => {},
  success: () => {},
  fail: () => {},
  ready: () => {},
  start: () => {},
  log: () => {},
};

// Export only no-op logger for published packages
export const logger: Logger = noOpLogger;
