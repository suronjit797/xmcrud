import express, { type Router as ExpressRouter } from "express";
import generateCrudController from "./controller";
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
  const path = basePath.replace(/\/+$/, "");

  router.get(`${path}/`, ...(middlewares.getAll || []), controller.getAll);
  router.post(`${path}/`, ...(middlewares.create || []), controller.create);
  router.put(`${path}/update-many`, ...(middlewares.updateMany || []), controller.updateMany);
  router.patch(`${path}/update-many`, ...(middlewares.updateMany || []), controller.updateMany);
  router.delete(`${path}/delete-many`, ...(middlewares.removeMany || []), controller.removeMany);
  router.post(`${path}/delete-many`, ...(middlewares.removeManyPost || []), controller.removeManyPost);

  router.get(`${path}/:id`, ...(middlewares.getSingle || []), controller.getSingle);
  router.put(`${path}/:id`, ...(middlewares.update || []), controller.update);
  router.patch(`${path}/:id`, ...(middlewares.update || []), controller.update);
  router.delete(`${path}/:id`, ...(middlewares.remove || []), controller.remove);

  return router;
};
