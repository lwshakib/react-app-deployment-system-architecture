import winston from "winston";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof levels;

const level = (): LogLevel => {
  return "debug"; // Build containers usually need full debug visibility
};

const colors: Record<LogLevel, string> = {
  error: "red",
  warn: "yellow",
  info: "blue",
  debug: "white",
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: "HH:mm:ss" }),
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
];

const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
});

export default logger;
