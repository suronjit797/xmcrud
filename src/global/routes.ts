import express, { RequestHandler, Router } from "express";
import generatecurdController from "./controller"; // path to your globalController
import { Model } from "mongoose";
import type ioredisType from "ioredis";

type curdMiddlewares = {
  create?: RequestHandler[];
  getAll?: RequestHandler[];
  getSingle?: RequestHandler[];
  update?: RequestHandler[];
  updateMany?: RequestHandler[];
  remove?: RequestHandler[];
  removeMany?: RequestHandler[];
};

export const generatecurdRoutes = <T>({
  mongooseModel,
  name,
  basePath = "",
  middlewares = {},
  ioredis,
  cachedTime,
}: {
  mongooseModel: Model<T>;
  name: string;
  basePath?: string;
  middlewares?: curdMiddlewares;
  ioredis?: ioredisType;
  cachedTime?: number;
}): Router => {
  const controller = generatecurdController(mongooseModel, name, ioredis, cachedTime);
  const router = express.Router();

  router.get(`${basePath}/`, ...(middlewares.getAll || []), controller.getAll);
  router.post(`${basePath}/`, ...(middlewares.create || []), controller.create);
  router.put(`${basePath}/`, ...(middlewares.updateMany || []), controller.updateMany);
  router.patch(`${basePath}/delete-many`, ...(middlewares.updateMany || []), controller.updateMany);
  router.delete(`${basePath}/update-many`, ...(middlewares.removeMany || []), controller.removeMany);

  router.get(`${basePath}/:id`, ...(middlewares.getSingle || []), controller.getSingle);
  router.put(`${basePath}/:id`, ...(middlewares.update || []), controller.update);
  router.patch(`${basePath}/:id`, ...(middlewares.update || []), controller.update);
  router.delete(`${basePath}/:id`, ...(middlewares.remove || []), controller.remove);

  return router;
};
