import winston from "winston";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

type LogLevel = keyof typeof levels;

const level = (): LogLevel => {
  const env = process.env.NODE_ENV ?? "development";
  return env === "development" ? "debug" : "warn";
};

const colors: Record<LogLevel, string> = {
  error: "red",
  warn: "yellow",
  info: "blue",
  http: "magenta",
  debug: "white",
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message } = info;
    return `[${timestamp}] ${level}: ${String(message)}`;
  })
);

const transports = [
  new winston.transports.Console(),
  new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  new winston.transports.File({ filename: "logs/info.log", level: "info" }),
  new winston.transports.File({ filename: "logs/http.log", level: "http" }),
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
