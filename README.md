# ⚡ XMCRUD — Express + Mongoose CRUD Made Easy

[![npm version](https://img.shields.io/npm/v/xmcrud.svg?style=flat&color=blue)](https://www.npmjs.com/package/xmcrud)
[![downloads](https://img.shields.io/npm/dt/xmcrud.svg?color=green)](https://www.npmjs.com/package/xmcrud)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/suronjit797/xmcrud/blob/main/LICENSE)
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
#or
pnpm add xmcrud
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
        ├── user.routes.ts
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

const userController = generateCrudController({ mongooseModel: UserModel, name: "users" });

/* 
Other configuration options
generateCrudController({mongooseModel:  mongoose model,
  name: string,         // cache namespace (keep it unique per model)
  ioredis?: ioredisType,
  cachedTime: number = 600,
  logger?: Logger  //logger logic {successLogger: (message:string)=> void, errorLogger:(message:string)=>void}
  protectedFields: []
  paginationConfig:{maxLimit: 100, maxSkip: 100000, allowNoLimit?: boolean, allowedSelect?: string[], allowedPopulate?: string[]}
  }) 

*/

const app = express();
app.use(express.json());

app.get("/users", userController.getAll);
app.post("/users", userController.create);
app.put("/users/:id", userController.update);
app.delete("/users/:id", userController.remove);

app.use(errorHandler); // optional: import { errorHandler } from "xmcrud"

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
| PATCH  | `/api/users/:id`         | Update user by ID     |
| PUT    | `/api/users/update-many` | Update multiple users (filter from query) |
| PATCH  | `/api/users/update-many` | Update multiple users (filter from query) |
| DELETE | `/api/users/delete-many` | Delete multiple users (filter from query) |
| POST   | `/api/users/delete-many` | Delete multiple users (filter from body)  |

> Bulk routes (`update-many`, `delete-many`) reject a request whose filter is empty with `400`, so they can never touch the whole collection by accident.

### 🚫 Hiding specific auto-generated routes

You can disable any generated CRUD route using `notFoundMiddleware`.

This is useful when:

- you don’t want to expose bulk delete
- you want read-only API
- you want custom logic instead of default auto CRUD

```ts
import { generateCrudRoutes, notFoundMiddleware } from "xmcrud";

const router = generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  middlewares: {
    removeMany: [notFoundMiddleware], // hide DELETE /delete-many
    removeManyPost: [notFoundMiddleware], // hide POST /delete-many
    updateMany: [notFoundMiddleware], // hide Update Many route
  },
});
```

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
  invalidateCache: ["orders"], // also clear every cache key containing these words (another module's name or route path) on every write
  middlewares: {},
  logger: Logger  //logger logic {successLogger: (message:string)=> void, errorLogger:(message:string)=>void}
  protectedFields:[]  // for update
});
```

---

## 🧰 Helpers

| Helper                                              | Description                                      |
| --------------------------------------------------- | ------------------------------------------------ |
| `filterHelper(req.query, keys, model.schema)`       | Builds MongoDB filters dynamically               |
| `paginationHelper(req.query)`                       | Handles pagination & sorting                     |
| `sendResponse({req, res, status, payload, logger})` | Standardized API response structure              |
| `ApiError`                                          | Custom error class                               |
| `partialFilterMiddlewares(keys)`                    | Enables partial search on selected string fields |
| `errorHandler`                                      | Express error middleware (ApiError, validation, cast, duplicate key) |
| `stripProtectedFields(body, fields)`                | Removes protected fields from an update body, including `$set`/`$inc`/... |
| `buildSearchCondition(search, fields, model)`       | Async `?search=` condition with typed fields and reference lookups |
| `writableQueryMiddleware`                           | Express 5: keeps values that middlewares assign to `req.query` |

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
🔒 `+field` (forcing fields with `select: false`, such as passwords) is always ignored. Restrict further with `paginationConfig.allowedSelect`.

---

### 🤝 Populate Relations

```http
GET /orders?populate=user product
```

✅ Automatically populates given reference fields. Nested paths work too: `populate=author author.company`.
🔒 Without `paginationConfig.allowedPopulate` only paths that exist in the schema are populated.

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
| `limit`     | Documents per page (default: 10, max: `maxLimit`; `0` = no limit unless `allowNoLimit: false`) |

---

### 🧠 Search & Dynamic Filters

Supports full-text partial search:

```http
GET /users?search=pal
```

Each search field is matched by its schema type:

| Field type | `?search=` matches |
| ---------- | ------------------ |
| String (or not in the schema) | case-insensitive regex; text that is not a valid regex (e.g. `(`) is matched literally |
| Number | exact number (`search=42`) |
| Date | whole year / month / day (`2025`, `2025-03`, `2025-03-14`) |
| Boolean | `true/false/yes/no/1/0` |
| ObjectId | exact id |
| Reference with `refFields` | documents whose referenced record matches |

Use `?ids=id1,id2` to filter by several ids. Fields inside subdocument arrays and nested subdocuments can be filtered too: `?members.member=<id>`, `?address.city=Dhaka`.

You can enable search fields globally:

```ts
generateCrudRoutes({
  mongooseModel: UserModel,
  name: "User",
  basePath: "/users",
  middlewares: {
    getAll: [partialFilterMiddlewares(["name", "email", "age", "createdAt", { path: "company", refFields: ["name"] }])],
  },
});
```

### 🛡️ Scoping (row-level access)

Set `req.scopeFilter` in a middleware; it is AND-ed into every generated query (list, single, update, delete, bulk) and kept in the cache key, so scoped users never share cached data:

```ts
const onlyOwnAgency: RequestHandler = (req, res, next) => {
  if (req.user.role === "agent") req.scopeFilter = { agency: req.user.agency };
  next();
};

generateCrudRoutes({ mongooseModel: ClientModel, name: "clients", middlewares: { getAll: [auth, onlyOwnAgency], getSingle: [auth, onlyOwnAgency] } });
```

On Express 5, values assigned to `req.query` are lost (it is rebuilt on every read). Prefer `req.scopeFilter`, or register `app.use(writableQueryMiddleware)` before such middlewares.

---

## ⬆️ Upgrading from 1.4.x to 1.5

1.5 is a drop-in update: no app code has to change. Behaviour that differs from 1.4.x is limited to bug fixes:

- Bulk routes (`update-many`, `delete-many`) return `400` when the filter is empty or has no known field, instead of updating or deleting the whole collection.
- `?ids=a,b` (comma separated) is applied; invalid ObjectIds return `400` instead of `500`.
- Filters on fields inside subdocument arrays (`members.member`) are applied; they were ignored before.
- `?search=` no longer crashes on invalid regex text, and number/date/boolean/ObjectId search fields work instead of failing.
- `?select=+field` is ignored; unknown `populate` paths are dropped instead of failing with `500`.
- Protected fields are also stripped inside `$set`/`$inc`/... on `PUT/PATCH /:id`.
- Cache is cleared after a successful write, with SCAN instead of KEYS, and never deletes BullMQ (`bull:`) keys. Redis errors no longer fail requests.
- Generated routes cache under `xmcrud:<name>:<route path>?<query>`; keys still contain the route path, so path-based invalidation keeps working. Old keys expire on their own.

New, opt-in: typed and reference search (`refFields`), `req.scopeFilter`, `writableQueryMiddleware`, `errorHandler`, `filterHelper(query, fields, schema, { exclude, searchCondition })`, `paginationConfig.allowNoLimit / allowedSelect / allowedPopulate`.

See [version.md](version.md) for the full list.

---

## 🔐 Security improvement recommendations for your projects

```md
## 🔐 Security Practices

XMCRUD includes:

- Centralized ApiError handler
- Optional Redis caching layer isolation
- Disabled auto-routes via notFoundMiddleware
- Strict query parser to prevent NoSQL injection

### Recommended Security Checklist

- ObjectId validation for all :id requests
- Always validate ObjectId before DB query
- Never return raw Mongo errors to client
- Disable routes you do not use
- Sanitize `_regex` queries
- Use basic all validation for security in projects
```

---

<!-- ## 🤝 Contributing

Contributions are welcome!
If you have ideas for new features (CLI templates, Prisma support, etc.), please open an issue or PR.

--- -->

## 🧪 Running tests

Tests use Node's built-in test runner (no database or Redis needed: mongoose and ioredis are replaced by in-memory fakes in `test/support`).

```bash
yarn test          # run all tests
yarn test:watch    # re-run on file changes
yarn typecheck     # type-check src and tests
```

| File | Covers |
| ---- | ------ |
| `test/queryHelper.test.ts` | filters, operators, ids, search, pagination, select, populate |
| `test/globalHelper.test.ts` | `stripProtectedFields`, `sendResponse`, `errorHandler` |
| `test/redisCache.test.ts` | cache keys and invalidation (SCAN, keyPrefix) |
| `test/crudRoutes.test.ts` | every generated route over HTTP, bulk-filter guard, middlewares, caching |
| `test/cli.test.ts` | `xmcrud add` in throwaway projects |

---

## 📜 License

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/suronjit797/xmcrud/blob/main/LICENSE)

---

## 🔗 Links

- 📦 **NPM Package:** [npmjs.com/package/xmcrud](https://www.npmjs.com/package/xmcrud)
- 🖥️ **GitHub Repository:** [github.com/suronjit797/xmcrud](https://github.com/suronjit797/xmcrud)
- 🪲 **Report Issues:** [github.com/suronjit797/xmcrud/issues](https://github.com/suronjit797/xmcrud/issues)
- 🎥 **YouTube Tutorial:** [Watch on YouTube](https://www.youtube.com/watch?v=oPjdKeG4ppE)

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
