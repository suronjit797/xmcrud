import { generateCrudRoutes, partialFilterMiddlewares, notFoundMiddleware } from "xmcrud";
import {{ModelName}}Model from "./{{name}}.model";
import { Router } from "express"

// partialFilterItems:    only key from model (type: string)
// name:                  name must be same as path name for caching functionality 
// ioredis:               Redis are optional if need redis caching
// middlewares:           middlewares are optional for each auto generated routes
// notFoundMiddleware:    notFoundMiddleware for disabled access to end user

const partialFilterItems = [""];
const {{name}}Router = Router()

const curdRouter =  generateCrudRoutes({
  mongooseModel: {{ModelName}}Model,
  name: "{{name}}",
  // ioredis: redis,
  middlewares: {
    getAll: [partialFilterMiddlewares(partialFilterItems)],
    updateMany: [notFoundMiddleware],
    removeMany: [notFoundMiddleware],
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
{{name}}Router.use(curdRouter)

export default {{name}}Router;
