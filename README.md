# expressjs-helper

A lightweight helper library for building Express.js routes, controllers, and Redis-enhanced middleware with optional Redis (ioredis) support.

## Features

- Generic CRUD controller for Mongoose models
- Express.js route and controller helpers
- Optional Redis caching for improved performance
- TypeScript support with included types
- Query filtering and pagination helpers

## Installation

```bash
npm install expressjs-helper
# or
yarn add expressjs-helper
```

> **Peer dependencies:**  
> You must install compatible versions of `express`, `mongoose`, and `ioredis` (optional) in your project.

```bash
npm install express mongoose ioredis
```

## Usage

### 1. Basic Controller Example

```typescript
import express from "express";
import mongoose from "mongoose";
import globalController from "expressjs-helper/dist/global/controller";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String }));

const userController = globalController(UserModel, "user");

const app = express();
app.use(express.json());

app.post("/users", userController.create);
app.get("/users", userController.getAll);
app.get("/users/:id", userController.getSingle);
app.put("/users/:id", userController.update);
app.delete("/users/:id", userController.remove);
app.delete("/users", userController.removeMany);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### 2. Basic Router Example

```typescript
import express from "express";
import mongoose from "mongoose";
import globalController from "expressjs-helper/dist/global/controller";

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
POST: /api/users/delete-many    => delete many users together
POST: /api/users                => create user
GET: /api/users                 => get all users
GET: /api/users/:id             => get user by id
PUT: /api/users/:id             => update user by id
DELETE: /api/users/:id          => delete user by id

*/

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

### With Redis Caching (Optional)

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

### Helpers

- **filterHelper**: Builds MongoDB filters from query parameters.
- **paginationHelper**: Handles pagination and sorting from query parameters.
- **sendResponse**: Standardizes API responses.
- **ApiError**: Custom error class for API errors.

## TypeScript

Type definitions are included. Import types from:

```typescript
import { IMeta } from "expressjs-helper/dist/Types/types";
```


## Contributing

Pull requests and issues are welcome!  
<!-- See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. -->

## License

MIT © Suronjit Pal

## Links

- [GitHub Repository](https://github.com/suronjit797/expressjs-helper)
- [Report Issues](https://github.com/suronjit797/expressjs-helper/issues)
