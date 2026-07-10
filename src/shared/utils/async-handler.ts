import type { NextFunction, Request, RequestHandler, Response } from 'express';

// Express 4 does not forward rejected promises to the error middleware;
// every async route handler must be wrapped with this.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
