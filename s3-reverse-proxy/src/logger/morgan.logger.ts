import morgan, { type StreamOptions } from "morgan";
import logger from "./winston.logger";

const stream: StreamOptions = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};

const skip = (): boolean => {
  const env = process.env.NODE_ENV ?? "development";
  return env !== "development";
};

const morganMiddleware = morgan(
  ":remote-addr :method :url :status - :response-time ms",
  {
    stream,
    skip,
  }
);

export default morganMiddleware;
