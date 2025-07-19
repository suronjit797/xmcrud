import { Response } from "express";
import { TPayload } from "../Types";

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
export const sendResponse = <T>(res: Response, status: number, payload: TPayload<T>) => {
  const { success, message, data, meta } = payload;
  const response: TPayload<T> = { success, message };

  if (meta) response.meta = meta;
  if (data !== undefined) response.data = data;

  return res.status(status).json(response);
};
