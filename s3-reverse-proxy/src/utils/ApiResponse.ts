/**
 * Standard API Response Class.
 * Used to format all successful API responses into a consistent structure.
 */
class ApiResponse {
  // The HTTP status code (e.g., 200, 201)
  statusCode: number;
  // The primary data payload of the response
  data: any;
  // A human-readable message for the client
  message: string;
  // Boolean indicating if the request was successful (true for status < 400)
  success: boolean;

  /**
   * @param statusCode - HTTP status code
   * @param data - Response payload
   * @param message - Descriptive message (default: "Success")
   */
  constructor(statusCode: number, data: any, message = "Success") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    // Automatically set success to true for success and redirection codes (1xx, 2xx, 3xx)
    this.success = statusCode < 400;
  }
}

export { ApiResponse };
