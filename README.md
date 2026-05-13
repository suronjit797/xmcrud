# ⚡ XMCRUD — Express + Mongoose CRUD Made Easy

[![npm version](https://img.shields.io/npm/v/xmcrud.svg?style=flat&color=blue)](https://www.npmjs.com/package/xmcrud)
[![downloads](https://img.shields.io/npm/dt/xmcrud.svg?color=green)](https://www.npmjs.com/package/xmcrud)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![YouTube](https://img.shields.io/badge/Watch_Tutorial-red?logo=youtube&logoColor=white)](https://www.youtube.com/watch?v=oPjdKeG4ppE)

---

A **lightweight Express.js utility** that helps you build **CRUD routes, controllers, and advanced query handlers** with Mongoose — in seconds.  
Includes optional **Redis caching** support for blazing-fast APIs.

> 🚀 Build scalable REST APIs in minutes with Express, Mongoose, and optional Redis.

---

## 🚀 CLI Quick Start

Generate a full CRUD module (model, controller, and router) instantly:

```bash
npm install xmcrud
# or
yarn add xmcrud
```

```bash
npx xmcrud add user
```

This will generate:

```
src/
 └── app/
     └── user/
        ├── user.model.ts
        ├── user.interface.ts
        ├── user.controller.ts
        ├── user.middleware.ts
        ├── user.route.ts
        ├── user.validation.ts

```

Ready-to-use Express + Mongoose files with full CRUD logic!

---

## 📚 Table of Contents

- [Installation](#installation)
- [Tutorials](#tutorials)
- [Features](#features)
- [Usage](#usage)
  - [1. Controller Example](#1-controller-example)
  - [2. Router Example](#2-router-example)
  - [3. With Redis Caching (Optional)](#3-with-redis-caching-optional)

- [Helpers](#helpers)
- [Advanced Query & Options](#advanced-query--options)
- [TypeScript Support](#typescript-support)
- [Contributing](#contributing)
- [License](#license)
- [Links](#links)

---

## 📦 Installation

```bash
npm install xmcrud
# or
yarn add xmcrud
```

> **Peer dependencies:**
> You must install compatible versions of `express`, `mongoose`, and optionally `ioredis`.

```bash
npm install express mongoose ioredis
```

---

## 🎥 Tutorials

[![Watch the tutorial](https://img.youtube.com/vi/oPjdKeG4ppE/0.jpg)](https://www.youtube.com/watch?v=oPjdKeG4ppE)

---

## ✨ Features

- ✅ Zero-config CRUD controller generator
- ✅ Auto-generated Express routes
- ✅ Optional Redis caching via `ioredis`
- ✅ Advanced filtering, population, and pagination
- ✅ TypeScript support with included types
- ✅ CLI command for auto file generation
- ✅ Extensible middleware support

---

## 🚀 Usage

### 1️⃣ Controller Example

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudController } from "xmcrud";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String }));

const userController = generateCrudController({ model: UserModel, name: "User" });

/* 
other options
generateCrudController({model:  mongoose model,
  name: string,
  ioredis?: ioredisType,
  cachedTime: number = 600,
  logger?: Logger  //logger logic {successLogger: (message:string)=> void, errorLogger:(message:string)=>void}
  protectedFields: []
  paginationConfig:{maxLimit: 100, maxSkip: 100000}
  }) 

*/

const app = express();
app.use(express.json());

app.get("/users", userController.getAll);
app.post("/users", userController.create);
app.put("/users/:id", userController.update);
app.delete("/users/:id", userController.remove);

app.listen(3000, () => console.log("✅ Server running on port 3000"));
```

---

### 2️⃣ Router Example

```ts
import express from "express";
import mongoose from "mongoose";
import { generateCrudRoutes } from "xmcrud";

const UserModel = mongoose.model("User", new mongoose.Schema({ name: String, age: Number }));

const crudRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "users",
  basePath: "/users", // optional
});

const app = express();
app.use(express.json());
app.use("/api", crudRouter);
```

**Generated Routes:**

| Method | Path                     | Description           |
| ------ | ------------------------ | --------------------- |
| GET    | `/api/users`             | Get all users         |
| POST   | `/api/users`             | Create user           |
| GET    | `/api/users/:id`         | Get user by ID        |
| PUT    | `/api/users/:id`         | Update user by ID     |
| DELETE | `/api/users/:id`         | Delete user by ID     |
| PATCH  | `/api/users/update-many` | Update multiple users |
| DELETE | `/api/users/delete-many` | Delete multiple users |

### 🚫 Hiding specific auto-generated routes

You can disable any generated CRUD route using `notFoundMiddleware`.

This is useful when:

- you don’t want to expose bulk delete
- you want read-only API
- you want custom logic instead of default auto CRUD

````ts
import { generateCrudRoutes, notFoundMiddleware } from "xmcrud";

const router = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  middlewares: {
    removeMany: [notFoundMiddleware],  // hide Delete Many route
    updateMany: [notFoundMiddleware],  // hide Update Many route
  },
});

---

### 3️⃣ With Redis Caching (Optional)

```ts
import Redis from "ioredis";
import { generateCrudRoutes } from "xmcrud";

const redisClient = new Redis();

const userRouter = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  ioredis: redisClient,
  cachedTime: 600, // in seconds (default: 10 minutes)
  // optionals
  middlewares:[],
  logger: Logger  //logger logic {successLogger: (message:string)=> void, errorLogger:(message:string)=>void}
  protectedFields:[]  // for update
});
````

---

## 🧰 Helpers

| Helper                                              | Description                                      |
| --------------------------------------------------- | ------------------------------------------------ |
| `filterHelper(req.query, keys, model.schema)`       | Builds MongoDB filters dynamically               |
| `paginationHelper(req.query)`                       | Handles pagination & sorting                     |
| `sendResponse({req, res, status, payload, logger})` | Standardized API response structure              |
| `ApiError`                                          | Custom error class                               |
| `partialFilterMiddlewares(keys)`                    | Enables partial search on selected string fields |

Example:

```ts
const pagination = paginationHelper(req.query);
const filter = filterHelper(req.query, ["name", "email"], UserModel.schema);
```

---

## ⚙️ Advanced Query & Options

### 🧩 Filter Operators

| Operator  | Query Param | Example                |
| --------- | ----------- | ---------------------- |
| `$gt`     | `_gt`       | `age_gt=20`            |
| `$lt`     | `_lt`       | `price_lt=100`         |
| `$gte`    | `_gte`      | `rating_gte=4`         |
| `$lte`    | `_lte`      | `date_lte=2025-12-31`  |
| `$ne`     | `_ne`       | `status_ne=inactive`   |
| `$in`     | `_in`       | `role_in=admin,user`   |
| `$nin`    | `_nin`      | `id_nin=1,2,3`         |
| `$regex`  | `_regex`    | `name_regex=^Suronjit` |
| `$exists` | `_exists`   | `email_exists=true`    |

Example:

```
GET /users?age_gt=10&status_ne=inactive&role_in=admin,user
```

---

### 🔎 Select Fields

```http
GET /users?select=name email age
```

✅ Returns only selected fields from MongoDB.

---

### 🤝 Populate Relations

```http
GET /orders?populate=user product
```

✅ Automatically populates given reference fields.

---

### 🧮 Sorting & Pagination

```http
GET /users?sortBy=createdAt&sortOrder=asc&page=2&limit=20
```

| Param       | Description                             |
| ----------- | --------------------------------------- |
| `sortBy`    | Sort by field                           |
| `sortOrder` | "asc", "ascending", "desc", descending" |
| `page`      | Page number (default: 1)                |
| `limit`     | Documents per page (default: 10)        |
| `skip`      | Skip documents manually                 |

---

### 🧠 Search & Dynamic Filters

Supports full-text partial search:

```http
GET /users?search=pal
```

You can enable search fields globally:

```ts
generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  middlewares: {
    getAll: [partialFilterMiddlewares(["name", "email"])],
  },
});
```

---

## 🔐 Security improvement recommendations for your projects

````md
## 🔐 Security Practices

XMCRUD includes:

- Centralized ApiError handler
- Optional Redis caching layer isolation
- Disabled auto-routes via notFoundMiddleware
- Strict query parser to prevent NoSQL injection
- Set `limit` maximum 100 value in pagination

### Recommended Security Checklist

- ObjectId validation for all :id requests
- Always validate ObjectId before DB query
- Never return raw Mongo errors to client
- Disable routes you do not use
- Sanitize `_regex` queries
- Use basic all validation for security in projects

---

<!-- ## 🤝 Contributing

Contributions are welcome!
If you have ideas for new features (CLI templates, Prisma support, etc.), please open an issue or PR.

--- -->

## 📜 License

MIT © [Suronjit Pal](https://github.com/suronjit797)

---

## 🔗 Links

- [GitHub Repository](https://github.com/suronjit797/xmcrud)
- [Report Issues](https://github.com/suronjit797/xmcrud/issues)
- [YouTube Tutorial](https://www.youtube.com/watch?v=oPjdKeG4ppE)
- [NPM Package](https://www.npmjs.com/package/xmcrud)

---

> 💡 **Pro Tip:**
> You can build your next Express API 10× faster using `xmcrud`.
> Try:
>
> ```bash
> npx xmcrud add product
> ```
>
> and start coding instantly!
````
