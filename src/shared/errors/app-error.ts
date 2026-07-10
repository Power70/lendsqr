/**
 * Operational errors carry an HTTP status and a stable machine-readable code;
 * the global error handler is the only place they become HTTP responses.
 * Anything that is NOT an AppError is treated as an unexpected bug: logged
 * with its stack and returned to the client as an opaque 500.
 */
export class AppError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly code: string,
    message: string,
    readonly isOperational: boolean = true,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, message);
  }

  static unauthorized(code: string, message: string): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(code: string, message: string): AppError {
    return new AppError(403, code, message);
  }

  static notFound(code: string, message: string): AppError {
    return new AppError(404, code, message);
  }

  static conflict(code: string, message: string): AppError {
    return new AppError(409, code, message);
  }

  static unprocessable(code: string, message: string): AppError {
    return new AppError(422, code, message);
  }

  static serviceUnavailable(code: string, message: string): AppError {
    return new AppError(503, code, message);
  }
}
