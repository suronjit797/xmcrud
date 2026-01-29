import { Model } from "mongoose";
import type ioredisType from "ioredis";
import { Logger } from "../helpers/globalHelper";
import { RequestHandler } from "express";

// controller
export interface GlobalControllerOptions<TType> {
  mongooseModel: Model<TType>;
  name: string;
  ioredis?: ioredisType;
  cachedTime?: number;
  logger?: Logger;
  protectedFields?: readonly string[];
  invalidateCache?: string[];
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
}
