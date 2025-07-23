# express easy CURD

A lightweight helper library for building Express.js routes, controllers, and Redis-enhanced middleware with optional Redis (ioredis) support. Make CURD operation easily

## Features

- Generic CRUD controller for Mongoose models
- Express.js route and controller helpers
- Optional Redis caching for improved performance
- TypeScript support with included types
- Query filtering and pagination helpers

## Installation

```bash
npm install express-easy-curd
# or
yarn add express-easy-curd
```

> **Peer dependencies:**  
> You must install compatible versions of `express`, `mongoose`, and `ioredis` (optional) in your project.

```bash
npm install express mongoose ioredis express-easy-curd
# or
yarn add express mongoose ioredis express-easy-curd
```

## Usage

### 1. Basic Controller Example

```typescript
import express from "express";
import mongoose from "mongoose";
import { generateCurdController } from "express-easy-curd";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String }));

const userController = generateCurdController(UserModel, "User");

const app = express();
app.use(express.json());

app.get("/users", userController.getAll);
app.post("/users", userController.create);
app.put("/users", userController.create);
/* or */
app.patch("/users", userController.create);
app.delete("/users", userController.removeMany);

app.get("/users/:id", userController.getSingle);
app.put("/users/:id", userController.update);
/* or */
app.patch("/users/:id", userController.update);
app.delete("/users/:id", userController.remove);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

## ⚠️ Warning

> **Use proper validation for `removeMany` and `updateMany` routes** to avoid unintended data loss or modification.

### 2. Basic Router Example

```typescript
import express from "express";
import mongoose from "mongoose";
import { generateCrudRoutes } from "express-easy-curd";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String }));

const curdRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users", //optional
});

const app = express();
app.use(express.json());

app.use("/api", curdRouter);

/* 
Same result as no 1. It will generate                
GET: /api/users                             => get all users
POST: /api/users                            => create user
PUT: /api/users?name=suronjit797            => update many users together by filter (query params)
PATCH: /api/users?name=suronjit797          => update many users together by filter (query params)
DELETE: /api/users?name=suronjit797         => delete many users together by filter (query params)

//dynamic routes
GET: /api/users/:id                         => get user by id
PUT: /api/users/:id                         => update user by id
PATCH: /api/users/:id                       => update user by id
DELETE: /api/users/:id                      => delete user by id

*/

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### 3. With Redis Caching (Optional)

```typescript
import Redis from "ioredis";
const ioredis = new Redis();

const userController = globalController(UserModel, "user", ioredis);

//or
const curdRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users"  //optional
  ioredis: ioredis    //optional
});
```

### 4. Helpers

- **filterHelper**: Builds MongoDB filters from query parameters.
- **paginationHelper**: Handles pagination and sorting from query parameters.
- **sendResponse**: Standardizes API responses.
- **ApiError**: Custom error class for API errors.

## TypeScript

Type definitions are included. Import types from:

```typescript
import { IMeta } from "express-easy-curd/dist/Types/types";
```

## Contributing

Pull requests and issues are welcome!

<!-- See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. -->

## License

MIT © Suronjit Pal (suronjit797)

## Links

- [GitHub Repository](https://github.com/suronjit797/express-easy-curd)
- [Report Issues](https://github.com/suronjit797/express-easy-curd/issues)
