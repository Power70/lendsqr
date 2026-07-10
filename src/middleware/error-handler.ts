import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../shared/errors/app-error';
import { logger } from '../shared/logger/logger';

interface ErrorBody {
  status: 'error';
  code: string;
  message: string;
  request_id?: string;
}

function errorBody(code: string, message: string, requestId: unknown): ErrorBody {
  const body: ErrorBody = { status: 'error', code, message };
  if (requestId !== undefined) {
    body.request_id = String(requestId);
  }
  return body;
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res
    .status(404)
    .json(errorBody('ROUTE_NOT_FOUND', `Route ${req.method} ${req.path} does not exist`, req.id));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const log = req.log ?? logger;

  if (err instanceof AppError && err.isOperational) {
    // Handled anomaly, not a bug — warn keeps the error level page-worthy
    log.warn({ code: err.code, httpStatus: err.httpStatus }, err.message);
    res.status(err.httpStatus).json(errorBody(err.code, err.message, req.id));
    return;
  }

  // Unexpected: full details to the log, opaque response to the client
  log.error({ err }, 'unhandled error');
  res
    .status(500)
    .json(
      errorBody('INTERNAL_SERVER_ERROR', 'Something went wrong. Please try again later.', req.id),
    );
};
