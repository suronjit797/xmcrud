import { RequestHandler } from "express";
import { Model, SortOrder } from "mongoose";

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
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
};

export type CrudOptions<T> = {
  ModelName: Model<T>;
  name: string;
  basePath?: string;
  middlewares?: CrudMiddlewares;
};
