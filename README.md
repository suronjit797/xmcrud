# 🚀 express-easy-curd

A lightweight helper library for building Express.js routes, controllers, and Redis-enhanced middleware. Simplify your CURD operations with flexible APIs, built-in helpers, and optional caching.

> ⚡ Build scalable REST APIs in minutes with Express and Mongoose.

npx easy-curd add user

---

<h2 id="table-of-contents">📚 Table of Contents</h2>

- [Installation](#installation)
- [Tutorials](#tutorials)
- [Features](#features)
- [Usage](#usage)
  - [1. Controller Example](#1-controller-example)
  - [2. Router Example](#2-router-example)
  - [3. With Redis Caching (Optional)](#3-with-redis-caching-optional)
- [Helpers](#helpers)
- [Query Operators](#query-operators)
- [TypeScript Support](#typescript-support)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

---

<h2 id="tutorials">🎥 Tutorials</h2>

[![Watch the tutorial](https://img.youtube.com/vi/oPjdKeG4ppE/0.jpg)](https://www.youtube.com/watch?v=oPjdKeG4ppE)

---

<h2 id="features">✨ Features</h2>

- ✅ Generic CURD controller for Mongoose models
- ✅ Auto-generated Express routes
- ✅ Optional Redis caching via `ioredis`
- ✅ Query filtering and pagination helpers
- ✅ TypeScript support with included types
- ✅ Partial search and dynamic filtering

---

<h2 id="installation">📦 Installation</h2>

```bash
npm install express-easy-curd
# or
yarn add express-easy-curd
```

> **Peer dependencies:**
> You must install compatible versions of `express`, `mongoose`, and optionally `ioredis`.

```bash
npm install express mongoose ioredis
```

---

<h2 id="usage">🚀 Usage</h2>

### <h3 id="1-controller-example">1. Controller Example</h3>

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudController } from "express-easy-curd";

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

### <h3 id="2-router-example">2. Router Example</h3>

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudRoutes } from "express-easy-curd";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String, age: Number }));

const curdRouter = generateCrudRoutes({
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
app.use("/api", curdRouter);
```

**Generated Routes:**

| Method | Path                                      | Description       |
| ------ | ----------------------------------------- | ----------------- |
| GET    | `/api/users`                              | Get all users     |
| POST   | `/api/users`                              | Create user       |
| PUT    | `/api/users?name=suronjit797`             | Update many users |
| PATCH  | `/api/users/update-many?name=suronjit797` | Update many users |
| DELETE | `/api/users/delete-many?name=suronjit797` | Delete many users |
| GET    | `/api/users/:id`                          | Get user by ID    |
| PUT    | `/api/users/:id`                          | Update user by ID |
| PATCH  | `/api/users/:id`                          | Update user by ID |
| DELETE | `/api/users/:id`                          | Delete user by ID |

---

### <h3 id="3-with-redis-caching-optional">3. With Redis Caching (Optional)</h3>

```ts
import Redis from "ioredis";
const redisClient = new Redis();

const userController = generateCrudController(UserModel, "User", redisClient, 600);

const curdRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  ioredis: redisClient,
  cachedTime: 600, // in seconds (default: 600 = 10 minutes)
});
```

---

<h2 id="helpers">🧰 Helpers</h2>

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

<h2 id="query-operators">🔍 Query Operators</h2>

Use Mongoose-style operators in query strings:

| Operator  | Query Param |
| --------- | ----------- |
| `$gt`     | `_gt`       |
| `$lt`     | `_lt`       |
| `$gte`    | `_gte`      |
| `$lte`    | `_lte`      |
| `$ne`     | `_ne`       |
| `$in`     | `_in`       |
| `$nin`    | `_nin`      |
| `$regex`  | `_regex`    |
| `$exists` | `_exists`   |

Example:

```
GET /users?age_gt=10&name=suronjit797&search=item
```

---

<h2 id="typescript-support">🧑‍💻 TypeScript Support</h2>

Type definitions are included:

```ts
import { IMeta } from "express-easy-curd/dist/Types/types";
```

---

<h2 id="contributing">🤝 Contributing</h2>

Pull requests and issues are welcome!

<!-- See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. -->

---

<h2 id="license">📜 License</h2>

MIT © Suronjit Pal ([@suronjit797](https://github.com/suronjit797))

---

<h2 id="links">🔗 Links</h2>

- [GitHub Repository](https://github.com/suronjit797/express-easy-curd)
- [Report Issues](https://github.com/suronjit797/express-easy-curd/issues)
- [YouTube Tutorial](https://www.youtube.com/watch?v=oPjdKeG4ppE)

```

```
