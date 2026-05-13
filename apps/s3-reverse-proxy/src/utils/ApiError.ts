/**
 * Custom API Error Class.
 * Extends the built-in Error class to provide structured error responses 
 * including HTTP status codes and additional error metadata.
 */
export class ApiError extends Error {
  // The HTTP status code (e.g., 404, 500)
  readonly statusCode: number;
  // Placeholder for data, typically null for errors
  readonly data: null;
  // Always false to indicate a failure in the response
  readonly success: false;
  // Array of specific error details (e.g., validation messages)
  readonly errors: unknown[];

  /**
   * @param statusCode - The HTTP status code for the error
   * @param message - A human-readable description of the error
   * @param errors - An array of additional error details
   * @param stack - The error stack trace (optional)
   */
  constructor(
    statusCode: number,
    message: string = "Something went wrong",
    errors: unknown[] = [],
    stack: string = ""
  ) {
    // Initialize the parent Error class with the message
    super(message);

    this.statusCode = statusCode;
    this.data = null;
    this.success = false;
    this.errors = errors;

    // Handle the stack trace
    if (stack) {
      // If a stack is provided (e.g., from a caught error), use it
      this.stack = stack;
    } else {
      // Otherwise, capture the current stack trace, excluding this constructor call
      Error.captureStackTrace(this, this.constructor);
    }
  }
}
