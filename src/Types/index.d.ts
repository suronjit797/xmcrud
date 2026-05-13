import { PaginationConfig } from "./index.d";
import { RequestHandler } from "express";
import type ioredisType from "ioredis";
import { Model, SortOrder } from "mongoose";
import "express";

declare global {
  namespace Express {
    interface Request {
      partialFilter: string[];
    }
  }
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

export type IPagination = {
  page: number;
  limit: number;
  skip: number;
  sortCondition: ISortCondition;
  populate?: string | Record<string>;
  select?: string;
};

export type PaginationConfig = {
  maxLimit?: number;
  maxSkip?: number;
};

export type TFilter = { [key: string]: object };

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
export type curdMiddlewares = {
  create?: RequestHandler[];
  getAll?: RequestHandler[];
  getSingle?: RequestHandler[];
  update?: RequestHandler[];
  updateMany?: RequestHandler[];
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
  removeManyPost?: RequestHandler[];
};

export interface IGenerateCrudRoutes<T> extends GlobalControllerOptions<T> {
  basePath?: string;
  middlewares?: curdMiddlewares;
  paginationConfig?: PaginationConfig;
}
