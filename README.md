

# 🚀 express-easy-crud

A lightweight helper library for building Express.js routes, controllers, and Redis-enhanced middleware. Simplify your CRUD operations with flexible APIs, built-in helpers, and optional caching.

> ⚡ Build scalable REST APIs in minutes with Express and Mongoose.

---

## 📚 Table of Contents

- [Installation](#installation)
- [Tutorials](#tutorials)
- [Features](#features)
- [Usage](#usage)
  - [Controller Example](#1-controller-example)
  - [Router Example](#2-router-example)
  - [Redis Caching](#3-with-redis-caching-optional)
- [Helpers](#helpers)
- [Query Operators](#query-operators)
- [TypeScript Support](#typescript-support)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

---

## 🎥 Tutorials

[![Watch the tutorial](https://img.youtube.com/vi/oPjdKeG4ppE/0.jpg)](https://www.youtube.com/watch?v=oPjdKeG4ppE)

---

## ✨ Features

- ✅ Generic CRUD controller for Mongoose models
- ✅ Auto-generated Express routes
- ✅ Optional Redis caching via `ioredis`
- ✅ Query filtering and pagination helpers
- ✅ TypeScript support with included types
- ✅ Partial search and dynamic filtering

---

## 📦 Installation

```bash
npm install express-easy-crud
# or
yarn add express-easy-crud
```

> **Peer dependencies:**  
> You must install compatible versions of `express`, `mongoose`, and optionally `ioredis`.

```bash
npm install express mongoose ioredis
```

---

## 🚀 Usage

### 1. Controller Example

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudController } from "express-easy-crud";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String }));

const userController = generateCrudController(UserModel, "User");

const app = express();
app.use(express.json());

app.get("/users", userController.getAll);
app.post("/users", userController.create);
app.put("/users", userController.updateMany);
app.patch("/users/update-many", userController.updateMany);
app.delete("/users/delete-many", userController.removeMany);

app.get("/users/:id", userController.getSingle);
app.put("/users/:id", userController.update);
app.patch("/users/:id", userController.update);
app.delete("/users/:id", userController.remove);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
```

> ⚠️ **Warning:** Use proper validation for `removeMany` and `updateMany` to avoid unintended data loss.

---

### 2. Router Example

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudRoutes } from "express-easy-crud";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String, age: Number }));

const crudRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  middlewares: {
    getAll: [...middlewares],
    create: [...middlewares],
    removeMany: [...middlewares],
    updateMany: [...middlewares],
    getSingle: [...middlewares],
    update: [...middlewares],
    remove: [...middlewares],
  },
});

const app = express();
app.use(express.json());
app.use("/api", crudRouter);
```

**Generated Routes:**

| Method | Path | Description |
|--------|------|-------------|
| GET    | `/api/users` | Get all users |
| POST   | `/api/users` | Create user |
| PUT    | `/api/users?name=suronjit797` | Update many users |
| PATCH  | `/api/users/update-many?name=suronjit797` | Update many users |
| DELETE | `/api/users/delete-many?name=suronjit797` | Delete many users |
| GET    | `/api/users/:id` | Get user by ID |
| PUT    | `/api/users/:id` | Update user by ID |
| PATCH  | `/api/users/:id` | Update user by ID |
| DELETE | `/api/users/:id` | Delete user by ID |

---

### 3. With Redis Caching (Optional)

```ts
import Redis from "ioredis";
const redisClient = new Redis();

const userController = generateCrudController(UserModel, "User", redisClient, 600);

const crudRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  ioredis: redisClient,
  cachedTime: 600, // in seconds (default: 600 = 10 minutes)
});
```

---

## 🧰 Helpers

- `filterHelper(req.query, partialKeys, model)` – Builds MongoDB filters from query params
- `paginationHelper(req.query)` – Handles pagination and sorting
- `sendResponse(res, data)` – Standardizes API responses
- `ApiError` – Custom error class
- `partialFilterMiddlewares(keys)` – Enables partial search on string fields

```ts
const pagination = paginationHelper(req.query);
const filter = filterHelper(req.query, req.partialFilter || [], new UserModel());

const UserRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  middlewares: {
    getAll: [partialFilterMiddlewares(["name", "email"])],
  },
});
```

---

## 🔍 Query Operators

Use Mongoose-style operators in query strings:

| Operator | Query Param |
|----------|-------------|
| `$gt`    | `_gt`       |
| `$lt`    | `_lt`       |
| `$gte`   | `_gte`      |
| `$lte`   | `_lte`      |
| `$ne`    | `_ne`       |
| `$in`    | `_in`       |
| `$nin`   | `_nin`      |
| `$regex` | `_regex`    |
| `$exists`| `_exists`   |

Example:

```
GET /users?age_gt=10&name=suronjit797&search=item
```

---

## 🧑‍💻 TypeScript Support

Type definitions are included:

```ts
import { IMeta } from "express-easy-crud/dist/Types/types";
```

---

## 🤝 Contributing

Pull requests and issues are welcome!

<!-- See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. -->

---

## 📜 License

MIT © Suronjit Pal ([@suronjit797](https://github.com/suronjit797))

---

## 🔗 Links

- [GitHub Repository](https://github.com/suronjit797/express-easy-curd)
- [Report Issues](https://github.com/suronjit797/express-easy-curd/issues)
- [YouTube Tutorial](https://www.youtube.com/watch?v=oPjdKeG4ppE)

```
