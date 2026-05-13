/**
 * Global Error Handling Middleware.
 * This middleware catches all errors passed to next() in the application and
 * formats them into a standardized JSON response structure.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError";
import logger from "../logger/winston.logger";
import { NODE_ENV } from "../envs";

/**
 * Standard Express Error Handler Middleware.
 * Catches both operational (ApiError) and unexpected system errors.
 */
const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // Wrap unexpected errors into our custom ApiError class for structured output
  if (!(error instanceof ApiError)) {
    // Default to 500 Internal Server Error if no status code is present
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    // Construct the error with the original stack trace for debugging
    error = new ApiError(statusCode, message, err?.errors || [], err.stack);
  }

  // Pre-formatted JSON response body
  const response = {
    ...error, // Include custom error properties
    message: error.message,
    // Sensitive stack traces are only exposed in development mode
    ...(NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  // Log the error concisely using the centralized Winston logger
  logger.error(
    `${req.method} ${req.url} - ${error.statusCode} - ${error.message}`
  );

  // Send the standardized error response to the client
  res.status(error.statusCode).json(response);
};

export { errorHandler };
