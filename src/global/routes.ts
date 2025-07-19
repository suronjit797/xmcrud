import express, { Router } from "express";
import generateCurdController from "./controller"; // path to your globalController
import { CrudOptions } from "../Types/types";

export const generateCrudRoutes = <T>({ mongooseModel, name, basePath = "", middlewares = {}, ioredis }: CrudOptions<T>): Router => {
  const controller = generateCurdController(mongooseModel, name, ioredis);
  const router = express.Router();

  router.post(`${basePath}/`, ...(middlewares.create || []), controller.create);
  router.get(`${basePath}/`, ...(middlewares.getAll || []), controller.getAll);
  router.post(`${basePath}/delete-many`, ...(middlewares.removeMany || []), controller.removeMany);

  router.get(`${basePath}/:id`, ...(middlewares.getSingle || []), controller.getSingle);
  router.put(`${basePath}/:id`, ...(middlewares.update || []), controller.update);
  router.delete(`${basePath}/:id`, ...(middlewares.remove || []), controller.remove);

  return router;
};
