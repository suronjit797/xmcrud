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
  populate?: string;
};

export type TFilter = { [key: string]: object };

export type CrudMiddlewares = {
  create?: RequestHandler[];
  getAll?: RequestHandler[];
  getSingle?: RequestHandler[];
  update?: RequestHandler[];
  updateMany?: RequestHandler[];
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
};

export type CrudOptions<T> = {
  mongooseModel: Model<T>;
  name: string;
  basePath?: string;
  middlewares?: CrudMiddlewares;
  ioredis?: ioredisType;
};
