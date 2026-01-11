import { NextFunction, Request, RequestHandler, Response } from "express";
import { TPayload } from "../Types";

export interface Logger {
  errorLogger: (message: string, meta?: Record<string, any>) => void;
  successLogger: (message: string, meta?: Record<string, any>) => void;
}

// api error for send error with message and status
export class ApiError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// response formate
export const sendResponse = <T>(res: Response, status: number, payload: TPayload<T>, logger?: Logger) => {
  const { success, message, data, meta } = payload;
  const response: TPayload<T> = { success, message };

  if (meta) response.meta = meta;
  if (data !== undefined) response.data = data;

  if (logger?.successLogger) {
    logger.successLogger(`[${status}] ${message}`, { dataId: typeof data === "object" ? (data as Record<string, any>)?._id : null });
  }

  return res.status(status).json(response);
};

export const partialFilterMiddlewares =
  (keys: string[]): RequestHandler =>
  (req, res, next) => {
    req.partialFilter = keys;
    next();
  };

export const handleError = (error: unknown, next: NextFunction, logger?: Logger, name?: string) => {
  if (logger?.errorLogger) {
    const message = error instanceof Error ? error.message : String(error);
    logger.errorLogger(name ? `(${name}) ${message}` : message);
  }
  next(error);
};

export const notFoundMiddleware: RequestHandler = (req, res) => {
  res.status(404).send({
    success: false,
    message: "Route not found",
    errorMessages: [
      {
        path: req.originalUrl,
        message: "Route not found",
      },
    ],
  });
};
