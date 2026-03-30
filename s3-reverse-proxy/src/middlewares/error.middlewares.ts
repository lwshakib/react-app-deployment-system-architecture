/**
 * Centralized Error Handling Middleware.
 * This middleware catches all errors passed to next() and formats them into 
 * a consistent API response structure.
 */

import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError";
import logger from "../logger/winston.logger";
import { NODE_ENV } from "../envs";

/**
 * Global Error Handler for Express.
 * Catches both operational (ApiError) and unexpected programming errors.
 */
export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  // If the error is not an instance of our custom ApiError class, 
  // wrap it into one for consistent processing.
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    // Create new ApiError while preserving the original stack trace and error details
    error = new ApiError(statusCode, message, err?.errors || [], err.stack);
  }

  // Prepare the standardized JSON response body
  const response = {
    success: false,
    message: error.message,
    // Only include the stack trace in development mode for security reasons
    ...(NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  // Log the error concisely using Winston
  logger.error(
    `${req.method} ${req.url} - ${error.statusCode} - ${error.message}`
  );

  // Send the error response to the client
  res.status(error.statusCode).json(response);
};
