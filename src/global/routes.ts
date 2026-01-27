import express, { RequestHandler, Router } from "express";
import generateCrudController from "./controller"; // path to your globalController
import { Model } from "mongoose";
import type ioredisType from "ioredis";
import { Logger } from "../helpers/globalHelper";

type curdMiddlewares = {
  create?: RequestHandler[];
  getAll?: RequestHandler[];
  getSingle?: RequestHandler[];
  update?: RequestHandler[];
  updateMany?: RequestHandler[];
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
  removeManyPost?: RequestHandler[];
};

export interface IOptions<T> {
  mongooseModel: Model<T>;
  name: string;
  basePath?: string;
  middlewares?: curdMiddlewares;
  ioredis?: ioredisType;
  cachedTime?: number;
  logger?: Logger;
  protectedFields?: string[];
}

export const generateCrudRoutes = <T>({
  mongooseModel,
  name,
  basePath = "",
  middlewares = {},
  ioredis,
  cachedTime,
  logger,
  protectedFields,
}: IOptions<T>): Router => {
  const controller = generateCrudController({ model: mongooseModel, name, ioredis, cachedTime, logger, protectedFields });
  const router = express.Router();

  router.get(`${basePath}/`, ...(middlewares.getAll || []), controller.getAll);
  router.post(`${basePath}/`, ...(middlewares.create || []), controller.create);
  router.put(`${basePath}/update-many`, ...(middlewares.updateMany || []), controller.updateMany);
  router.patch(`${basePath}/update-many`, ...(middlewares.updateMany || []), controller.updateMany);
  router.delete(`${basePath}/delete-many`, ...(middlewares.removeMany || []), controller.removeMany);
  router.post(`${basePath}/delete-many`, ...(middlewares.removeManyPost || []), controller.removeManyPost);

  router.get(`${basePath}/:id`, ...(middlewares.getSingle || []), controller.getSingle);
  router.put(`${basePath}/:id`, ...(middlewares.update || []), controller.update);
  router.patch(`${basePath}/:id`, ...(middlewares.update || []), controller.update);
  router.delete(`${basePath}/:id`, ...(middlewares.remove || []), controller.remove);

  return router;
};
