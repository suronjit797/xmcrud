import express, { type Router as ExpressRouter } from "express";
import generateCrudController from "./controller"; // path to your globalController
import { IGenerateCrudRoutes } from "../Types";

export const generateCrudRoutes = <T>({
  mongooseModel,
  name,
  basePath = "",
  middlewares = {},
  ioredis,
  cachedTime,
  logger,
  protectedFields,
  invalidateCache,
  paginationConfig,
}: IGenerateCrudRoutes<T>): ExpressRouter => {
  const controller = generateCrudController({ mongooseModel, name, ioredis, cachedTime, logger, protectedFields, invalidateCache, paginationConfig });
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
