import { generateCrudRoutes, partialFilterMiddlewares, notFoundMiddleware } from "xmcrud";
import {{ModelName}}Model from "./{{name}}.model";
import { Router } from "express"


const partialFilterItems = [""]; // only key from model (type: string)

const {{name}}Router = Router()

const curdRouter =  generateCrudRoutes({
  mongooseModel: {{ModelName}}Model,
  name: "{{name}}",    //! name same as route name
  // ioredis: redis,  // optional if has redis in app
  middlewares: {
    getAll: [partialFilterMiddlewares(partialFilterItems)],
    // getSingle: [],  // middlewares are optional
    // create: [],  // middlewares are optional
    // update: [],  // middlewares are optional
    // remove: [],  // middlewares are optional
    // updateMany: [notFoundMiddleware],  // middlewares are optional  //notFoundMiddleware for disabled access to end user
    // removeMany: [notFoundMiddleware],  // middlewares are optional  //notFoundMiddleware for disabled access to end user
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
