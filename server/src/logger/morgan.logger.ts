import morgan, { type StreamOptions } from "morgan";
import logger from "./winston.logger";
import { NODE_ENV } from "../envs";

// Winston-compatible stream for Morgan
const stream: StreamOptions = {
  // Use the HTTP severity level
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

const skip = (): boolean => {
  const env = NODE_ENV;
  return env !== "development";
};

// Fully-typed Morgan middleware
const morganMiddleware = morgan(
  ":remote-addr :method :url :status - :response-time ms",
  {
    stream,
    skip,
  }
);

export default morganMiddleware;
