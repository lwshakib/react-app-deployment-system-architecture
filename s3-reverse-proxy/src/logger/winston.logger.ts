/**
 * Winston Centered Logger Configuration.
 * This module provides a unified logging interface for the reverse proxy,
 * including console colorization and file-based log persistence.
 */

import winston from "winston";
import { NODE_ENV } from "../envs.js";

/**
 * Log severity levels.
 * 0 (error) is the highest priority, 4 (debug) is the lowest.
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
} as const;

// Define a type for our supported log levels
type LogLevel = keyof typeof levels;

/**
 * Dynamically determines the active log level based on the environment.
 * @returns 'debug' in development for full visibility, 'warn' in production to reduce noise.
 */
const level = (): LogLevel => {
  const env = NODE_ENV ?? "development";
  return env === "development" ? "debug" : "warn";
};

/**
 * Color mapping for each log level when outputting to the console.
 */
const colors: Record<LogLevel, string> = {
  error: "red",
  warn: "yellow",
  info: "blue",
  http: "magenta",
  debug: "white",
};

// Apply custom colors to Winston
winston.addColors(colors);

/**
 * Defines the log format: [Timestamp] LEVEL: Message
 */
const format = winston.format.combine(
  // Use a detailed timestamp format
  winston.format.timestamp({ format: "DD MMM, YYYY - HH:mm:ss:ms" }),
  // Colorize the entire log line for the console
  winston.format.colorize({ all: true }),
  // Custom print template
  winston.format.printf((info) => {
    const { timestamp, level, message } = info;
    return `[${timestamp}] ${level}: ${String(message)}`;
  })
);

/**
 * Defines the output destinations for logs.
 */
const transports = [
  // Always output to the console
  new winston.transports.Console(),
  // Save errors to error.log
  new winston.transports.File({ filename: "logs/error.log", level: "error" }),
  // Save general info logs to info.log
  new winston.transports.File({ filename: "logs/info.log", level: "info" }),
  // Save HTTP request logs to http.log
  new winston.transports.File({ filename: "logs/http.log", level: "http" }),
];

/**
 * Initialize the primary logger instance.
 */
const logger = winston.createLogger({
  level: level(), // Min level to log
  levels,         // Custom severity hierarchy
  format,         // Custom string formatting
  transports,     // Custom output destinations
});

// Export the logger for application-wide use
export default logger;
