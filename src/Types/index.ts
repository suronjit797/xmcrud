import type { RequestHandler } from "express";
import type ioredisType from "ioredis";
import type { Model, SortOrder } from "mongoose";
import "express";

declare global {
  namespace Express {
    interface Request {
      partialFilter?: string[];
    }
  }
}

// logger
export interface Logger {
  errorLogger: (message: string, meta?: Record<string, any>) => void;
  successLogger: (message: string, meta?: Record<string, any>) => void;
}

// response types
export type IMeta = {
  total: number;
  limit: number;
  page: number;
};

export type TPayload<T> = {
  success: boolean;
  message: string;
  meta?: IMeta;
  data?: T;
};

// query types
export type ISortCondition = { [key: string]: SortOrder };

export type TPopulateOption = { path: string; populate?: TPopulateOption[] };

export type IPagination = {
  page: number;
  limit: number;
  skip: number;
  sortCondition: ISortCondition;
  populate: TPopulateOption[];
  select: string;
};

export type PaginationConfig = {
  /** Maximum allowed `limit` (default: 100) */
  maxLimit?: number;
  /** Maximum allowed skip (default: 1_000_000) */
  maxSkip?: number;
  /** Fields clients may request with `?select=`. When omitted, any field except `+field` (forced hidden fields) is allowed. */
  allowedSelect?: string[];
  /** Paths clients may request with `?populate=` (e.g. ["author", "author.company"]). When omitted, only root paths that exist in the schema are allowed. */
  allowedPopulate?: string[];
};

export type TFilter = { [key: string]: unknown };

export type RecordUnknown = Record<string, unknown>;

export interface GlobalControllerOptions<TType> {
  mongooseModel: Model<TType>;
  name: string;
  ioredis?: ioredisType;
  cachedTime?: number;
  logger?: Logger;
  protectedFields?: readonly string[];
  invalidateCache?: string[];
  paginationConfig?: PaginationConfig;
}

export interface GlobalControllerReturn {
  create: RequestHandler;
  getAll: RequestHandler;
  getSingle: RequestHandler;
  update: RequestHandler;
  updateMany: RequestHandler;
  remove: RequestHandler;
  removeMany: RequestHandler;
  removeManyPost: RequestHandler;
}

// routes
export type CrudMiddlewares = {
  create?: RequestHandler[];
  getAll?: RequestHandler[];
  getSingle?: RequestHandler[];
  update?: RequestHandler[];
  updateMany?: RequestHandler[];
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
  /** Middlewares for `POST /delete-many`. Falls back to `removeMany` when omitted. */
  removeManyPost?: RequestHandler[];
};

export interface IGenerateCrudRoutes<T> extends GlobalControllerOptions<T> {
  basePath?: string;
  middlewares?: CrudMiddlewares;
}
