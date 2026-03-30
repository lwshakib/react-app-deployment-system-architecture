/**
 * Async Request Handler Wrapper.
 * A higher-order function that wraps asynchronous Express route handlers
 * to automatically catch errors and pass them to the next() middleware.
 * This eliminates the need for repeated try-catch blocks in route logic.
 */

import { Request, Response, NextFunction } from "express";

// Type definition for an asynchronous Express request handler
type RequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Wraps a promise-returning function and catches any rejections.
 * @param requestHandler - An async function representing the route logic
 * @returns A standard Express middleware function
 */
export const asyncHandler = (requestHandler: RequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Resolve the promise from the request handler and forward errors to the global error handler
    Promise.resolve(requestHandler(req, res, next)).catch((err) => next(err));
  };
};
