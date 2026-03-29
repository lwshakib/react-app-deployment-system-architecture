import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";
import logger from "../logger/winston.logger";

/**
 * @description Centralized Error Handler Middleware
 */
const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = err;

  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || "Something went wrong";
    error = new ApiError(statusCode, message, err?.errors || [], err.stack);
  }

  const response = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  logger.error(
    `${req.method} ${req.url} - ${error.statusCode} - ${error.message}`
  );

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
