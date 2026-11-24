import type { RequestHandler } from "express";
import type ioredisType from "ioredis";
import type { Model, SortOrder } from "mongoose";
import "express";

declare global {
  namespace Express {
    interface Request {
      /**
       * Fields used by `?search=` (set with partialFilterMiddlewares). Declared exactly as in 1.4.x so apps that
       * declare it themselves still compile; { path, refFields } entries are stored here too at runtime.
       */
      partialFilter: string[];
      /** Extra mongo filter AND-ed into every xmcrud query for this request (e.g. role scoping) */
      scopeFilter?: Record<string, unknown>;
    }
  }
}

// partial search field: a path, or a reference path with the referenced fields to search in
export type PartialFilterField = string | { path: string; refFields?: string[] };

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
  /** `?limit=0` returns every document, as in earlier versions (default: true). Set false to apply the default limit instead. */
  allowNoLimit?: boolean;
  /** Maximum allowed skip (default: 1_000_000) */
  maxSkip?: number;
  /** Fields clients may request with `?select=`. When omitted, any field except `+field` (forced hidden fields) is allowed. */
  allowedSelect?: string[];
  /** Paths clients may request with `?populate=` (e.g. ["author", "author.company"]). When omitted, only root paths that exist in the schema are allowed. */
  allowedPopulate?: string[];
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type TFilter = { [key: string]: any };

export type FilterHelperOptions = {
  /** Query keys to ignore (e.g. a key you build your own condition for) */
  exclude?: string[];
  /** Ready-made search condition (from buildSearchCondition). Replaces the built-in `search` handling; null means no search condition. */
  searchCondition?: Record<string, unknown> | null;
};

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
  /** Middlewares for `POST /delete-many` (independent of removeMany). */
  removeManyPost?: RequestHandler[];
};

export interface IGenerateCrudRoutes<T> extends GlobalControllerOptions<T> {
  basePath?: string;
  middlewares?: CrudMiddlewares;
}
