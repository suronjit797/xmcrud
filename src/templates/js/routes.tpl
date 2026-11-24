import { generateCrudRoutes, partialFilterMiddlewares, notFoundMiddleware } from "xmcrud";
import {{ModelName}}Model from "./{{name}}.model";
import { Router } from "express"

// partialFilterItems:    only key from model (type: string)
// name:                  cache namespace for this module (use it in other modules' invalidateCache)
// ioredis:               Redis are optional if need redis caching
// middlewares:           middlewares are optional for each auto generated routes
// notFoundMiddleware:    disables a route (removeMany = DELETE /delete-many, removeManyPost = POST /delete-many)

const partialFilterItems = []; // e.g. ["name", "email"]
const {{name}}Router = Router()

const crudRouter =  generateCrudRoutes({
  mongooseModel: {{ModelName}}Model,
  name: "{{name}}",
  // ioredis: redis,
  // invalidateCache: []
  middlewares: {
    getAll: [partialFilterMiddlewares(partialFilterItems)],
    updateMany: [notFoundMiddleware],
    removeMany: [notFoundMiddleware],
    removeManyPost: [notFoundMiddleware],
    // create: [],
    // update: [],
    // remove: [],
    // getSingle: [],
  },
});

// Other custom routes

// {{name}}Router.get('/test', async (req, res) => {
//   const data = await {{ModelName}}Model.find()
//   res.send(data)
// })



// must be end of router 
{{name}}Router.use(crudRouter)

export default {{name}}Router;
