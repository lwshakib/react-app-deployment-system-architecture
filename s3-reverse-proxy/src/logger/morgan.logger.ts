/**
 * Morgan HTTP Request Logger Middleware.
 * This module integrates Morgan with Winston to ensure all incoming HTTP 
 * requests are logged using our centralized logging system.
 */

import morgan, { type StreamOptions } from "morgan";
import logger from "./winston.logger";

/**
 * Define a custom stream for Morgan.
 * Instead of writing to process.stdout, it forwards logs to Winston's .http() level.
 */
const stream: StreamOptions = {
  write: (message: string): void => {
    // Trim the message to remove trailing newlines added by Morgan
    logger.http(message.trim());
  },
};

/**
 * Determine if logging should be skipped.
 * Currently configured to skip logging in non-development environments to reduce noise,
 * though this can be adjusted for production auditing.
 */
const skip = (): boolean => {
  const env = process.env.NODE_ENV ?? "development";
  return env !== "development";
};

/**
 * Initialize Morgan middleware.
 * format: ':remote-addr :method :url :status - :response-time ms'
 * stream: Our custom Winston stream
 * skip: Our skip logic based on the environment
 */
const morganMiddleware = morgan(
  ":remote-addr :method :url :status - :response-time ms",
  {
    stream,
    skip,
  }
);

// Export as the default middleware for Express
export default morganMiddleware;
