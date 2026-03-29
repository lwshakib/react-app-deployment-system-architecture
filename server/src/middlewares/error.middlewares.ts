import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";
import logger from "../logger/winston.logger";
import { ApiError } from "../utils/ApiError";

/**
 * This middleware is responsible for catching errors from any request handler
 * wrapped inside {@link asyncHandler}.
 */
const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let error: ApiError;

  // Normalize any thrown value into an ApiError instance
  if (err instanceof ApiError) {
    error = err;
  } else {
    // Best-effort extraction from unknown error shapes
    const maybeErr = err as Partial<{
      statusCode: number;
      message: string;
      errors: unknown[];
      stack: string;
    }>;

    // Preserve original behavior:
    // - If a statusCode exists on the error, default to 400
    // - Otherwise, use 500
    const statusCode = maybeErr?.statusCode ? 400 : 500;
    const message = maybeErr?.message ?? "Something went wrong";

    error = new ApiError(
      statusCode,
      message,
      maybeErr?.errors ?? [],
      maybeErr?.stack
    );
  }

  // Shape the response; include stack only in development
  const response: Record<string, unknown> = {
    ...error,
    message: error.message,
    ...(process.env.NODE_ENV === "development" ? { stack: error.stack } : {}),
  };

  logger.error(`${error.message}`);

  return res.status(error.statusCode).json(response);
};

export { errorHandler };
