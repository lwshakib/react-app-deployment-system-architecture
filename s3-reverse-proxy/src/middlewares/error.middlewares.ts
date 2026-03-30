import { Request, Response, NextFunction, ErrorRequestHandler } from "express";
import { ApiError } from "../utils/ApiError";
import logger from "../logger/winston.logger";
import { NODE_ENV } from "../envs.js";

/**
 * @description Centralized Error Handler Middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, err?.errors || [], err.stack);
  }

  const response = {
    success: false,
    message: error.message,
    ...(NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  logger.error(
    `${req.method} ${req.url} - ${error.statusCode} - ${error.message}`
  );

  res.status(error.statusCode).json(response);
};
