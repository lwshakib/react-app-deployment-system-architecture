/**
 * Winston Logging Configuration.
 * This module sets up a centralized logger for the build container, 
 * supporting console output and file-based persistence for different log levels.
 */

import winston from "winston";

/**
 * Custom log levels for the application.
 * Lower numbers indicate higher priority/severity.
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

// Define a type for our support log levels
type LogLevel = keyof typeof levels;

/**
 * Determines the current log level.
 * @returns The active log level (defaults to 'debug' for maximum visibility in containers)
 */
const level = (): LogLevel => {
  return "debug"; 
};

/**
 * Mapping of log levels to colors for console output.
 */
const colors: Record<LogLevel, string> = {
  error: "red",
  warn: "yellow",
  info: "blue",
  debug: "white",
};

// Apply colors to Winston for prettier console logs
winston.addColors(colors);

/**
 * Defines the format for log entries.
 * Combines timestamps, colorization, and a custom template.
 */
const format = winston.format.combine(
  // Use a short timestamp for readability
  winston.format.timestamp({ format: "HH:mm:ss" }),
  // Colorize the entire log line based on the level
  winston.format.colorize({ all: true }),
  // custom print function: [HH:mm:ss] LEVEL: Message
  winston.format.printf((info) => {
    const { timestamp, level, message } = info;
    return `[${timestamp}] ${level}: ${String(message)}`;
  })
);

/**
 * Define where logs should be sent (transports).
 */
const transports = [
  // Output everything to the console (standard output)
  new winston.transports.Console(),
  // Persist errors to a dedicated error file
  new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  // Persist informational logs (and above) to an info file
  new winston.transports.File({ filename: "logs/info.log", level: "info" }),
];

/**
 * Initialize the Winston logger instance.
 */
const logger = winston.createLogger({
  level: level(), // Set minimum level to log
  levels,         // Use our custom levels
  format,         // Use our custom format
  transports,     // Use our defined transports
});

// Export the logger as the default for use throughout the application
export default logger;
