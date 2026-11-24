import { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";
import { Logger, TPayload } from "../Types";

export type { Logger };

export interface SendResponseParams<T> {
  res: Response;
  req: Request;
  status: number;
  payload: TPayload<T>;
  logger?: Logger;
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

// response format
export const sendResponse = <T>({ res, req, status, payload, logger }: SendResponseParams<T>) => {
  const { success, message, data, meta } = payload;
  const response: TPayload<T> = { success, message };

  if (meta) response.meta = meta;
  if (data !== undefined) response.data = data;

  if (logger?.successLogger) {
    logger.successLogger(`[${status}] ${message}`, {
      dataId: data && typeof data === "object" ? (data as Record<string, any>)?._id : null,
    });
  }

  return res.status(status).json(response);
};

export const partialFilterMiddlewares =
  (keys: string[]): RequestHandler =>
  (req, res, next) => {
    req.partialFilter = keys.filter(Boolean);
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

// global error handler: register after all routes with app.use(errorHandler)
export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let statusCode = 500;
  let message = "Something went wrong";
  let errorMessages: { path: string; message: string }[] = [];

  if (error instanceof ApiError) {
    statusCode = error.statusCode;
    message = error.message;
    errorMessages = [{ path: "", message }];
  } else if (error?.name === "ValidationError" && error.errors) {
    statusCode = 400;
    message = "Validation error";
    errorMessages = Object.values(error.errors as Record<string, { path: string; message: string }>).map((e) => ({
      path: e.path,
      message: e.message,
    }));
  } else if (error?.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${error.path}`;
    errorMessages = [{ path: error.path, message }];
  } else if (error?.name === "StrictPopulateError") {
    statusCode = 400;
    message = error.message;
    errorMessages = [{ path: error.path || "populate", message }];
  } else if (error?.code === 11000) {
    statusCode = 409;
    message = "Duplicate value";
    errorMessages = Object.keys(error.keyValue || {}).map((path) => ({ path, message: `${path} already exists` }));
  } else if (error?.type === "entity.parse.failed") {
    statusCode = 400;
    message = "Invalid JSON body";
    errorMessages = [{ path: "", message }];
  }

  res.status(statusCode).json({
    success: false,
    message,
    errorMessages,
    ...(process.env.NODE_ENV === "development" && error?.stack ? { stack: error.stack } : {}),
  });
};

// remove protected fields from an update body, including inside update operators ($set, $inc, $unset, ...)
export const stripProtectedFields = (body: unknown, fields: readonly string[]): Record<string, any> => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};

  const isProtected = (key: string) => fields.some((field) => key === field || key.startsWith(`${field}.`));

  return Object.entries(body as Record<string, any>).reduce((acc: Record<string, any>, [key, value]) => {
    if (key.startsWith("$")) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        const cleaned = Object.fromEntries(
          // $rename's value is the target field name, so check it too
          Object.entries(value).filter(([k, v]) => !isProtected(k) && !(key === "$rename" && typeof v === "string" && isProtected(v))),
        );
        if (Object.keys(cleaned).length) acc[key] = cleaned;
      }
      return acc;
    }
    if (!isProtected(key)) acc[key] = value;
    return acc;
  }, {});
};
