import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateCrudRoutes, notFoundMiddleware } from "../src";
import { IGenerateCrudRoutes } from "../src/Types";
import { createFakeModel, createTestSchema, FakeResults, OTHER_ID, VALID_ID } from "./support/fakeModel";
import { createFakeRedis } from "./support/fakeRedis";
import { startApp } from "./support/http";

// Full HTTP tests: real express app + generateCrudRoutes, mongoose model and redis replaced by fakes.

let app: Awaited<ReturnType<typeof startApp>> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const setup = async (results: Partial<FakeResults> = {}, options: Partial<IGenerateCrudRoutes<any>> = {}) => {
  const fake = createFakeModel(createTestSchema(), results);
  const router = generateCrudRoutes({ mongooseModel: fake.model, name: "users", basePath: "/users", ...options });
  app = await startApp(router);
  return { ...fake, request: app.request };
};

describe("GET /users (getAll)", () => {
  it("returns data with pagination meta", async () => {
    const { request, callsOf } = await setup({ find: [{ name: "a" }], countDocuments: 1 });
    const res = await request("GET", "/api/users?page=2&limit=5&sortBy=name&sortOrder=asc");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, [{ name: "a" }]);
    assert.deepEqual(res.body.meta, { page: 2, limit: 5, total: 1 });
    assert.equal(res.body.message, "users fetched successfully");
    assert.deepEqual(callsOf("find.skip")[0].args, [5]);
    assert.deepEqual(callsOf("find.sort")[0].args, [{ name: 1 }]);
  });

  it("passes the parsed filter to mongoose", async () => {
    const { request, callsOf } = await setup();
    await request("GET", "/api/users?age_gte=18&role=admin");
    assert.deepEqual(callsOf("find")[0].args[0], { $and: [{ age: { $gte: 18 } }, { role: "admin" }] });
  });

  it("never sends limit 0 to mongoose", async () => {
    const { request, callsOf } = await setup();
    await request("GET", "/api/users?limit=0");
    assert.deepEqual(callsOf("find.limit")[0].args, [10]);
  });

  it("drops +field from select and unknown populate paths", async () => {
    const { request, callsOf } = await setup();
    await request("GET", "/api/users?select=name%20%2Bpassword&populate=owner%20secret");
    assert.deepEqual(callsOf("find.select")[0].args, ["name"]);
    assert.deepEqual(callsOf("find.populate")[0].args, [[{ path: "owner" }]]);
  });

  it("uses search fields from partialFilter", async () => {
    const { request, callsOf } = await setup({}, { middlewares: { getAll: [(req, _res, next) => ((req.partialFilter = ["name"]), next())] } });
    await request("GET", "/api/users?search=jo");
    assert.deepEqual(callsOf("find")[0].args[0], { $and: [{ $or: [{ name: { $regex: "jo", $options: "i" } }] }] });
  });

  it("returns 400 for an invalid ObjectId filter", async () => {
    const { request } = await setup();
    const res = await request("GET", "/api/users?owner=abc");
    assert.equal(res.status, 400);
  });
});

describe("GET /users/:id (getSingle)", () => {
  it("returns the document", async () => {
    const { request } = await setup({ findById: { _id: VALID_ID, name: "a" } });
    const res = await request("GET", `/api/users/${VALID_ID}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, "a");
  });

  it("returns 400 for an invalid id and 404 when missing", async () => {
    const { request, callsOf } = await setup();
    assert.equal((await request("GET", "/api/users/abc")).status, 400);
    assert.equal(callsOf("findById").length, 0);
    assert.equal((await request("GET", `/api/users/${VALID_ID}`)).status, 404);
  });
});

describe("POST /users (create)", () => {
  it("creates and returns 201", async () => {
    const { request, callsOf } = await setup();
    const res = await request("POST", "/api/users", { name: "a" });
    assert.equal(res.status, 201);
    assert.deepEqual(callsOf("create")[0].args[0], { name: "a" });
  });
});

describe("PATCH /users/:id (update)", () => {
  it("strips protected fields, also inside operators", async () => {
    const { request, callsOf } = await setup({ findByIdAndUpdate: { _id: VALID_ID } }, { protectedFields: ["role"] });
    const res = await request("PATCH", `/api/users/${VALID_ID}`, { name: "n", role: "admin", _id: OTHER_ID, $set: { role: "admin", age: 3 } });

    assert.equal(res.status, 200);
    const [id, body, options] = callsOf("findByIdAndUpdate")[0].args;
    assert.equal(id, VALID_ID);
    assert.deepEqual(body, { name: "n", $set: { age: 3 } });
    assert.deepEqual(options, { returnDocument: "after", runValidators: true });
  });

  it("returns 400 for an invalid id and 404 when missing", async () => {
    const { request } = await setup();
    assert.equal((await request("PUT", "/api/users/abc", { name: "n" })).status, 400);
    assert.equal((await request("PUT", `/api/users/${VALID_ID}`, { name: "n" })).status, 404);
  });
});

describe("DELETE /users/:id (remove)", () => {
  it("deletes the document", async () => {
    const { request } = await setup({ findByIdAndDelete: { _id: VALID_ID } });
    assert.equal((await request("DELETE", `/api/users/${VALID_ID}`)).status, 200);
  });

  it("returns 404 when the document does not exist", async () => {
    const { request } = await setup();
    assert.equal((await request("DELETE", `/api/users/${VALID_ID}`)).status, 404);
  });
});

describe("bulk routes never run with an empty filter", () => {
  const cases: [string, string, unknown?][] = [
    ["DELETE", "/api/users/delete-many"],
    ["DELETE", "/api/users/delete-many?unknown=1"],
    ["POST", "/api/users/delete-many"],
    ["POST", "/api/users/delete-many", {}],
    ["PATCH", "/api/users/update-many", { name: "x" }],
    ["PUT", "/api/users/update-many?foo=bar", { name: "x" }],
  ];

  for (const [method, path, body] of cases) {
    it(`${method} ${path} ${body ? JSON.stringify(body) : ""} -> 400 without touching the DB`, async () => {
      const { request, dbWrites } = await setup();
      const res = await request(method, path, body);
      assert.equal(res.status, 400);
      assert.equal(dbWrites().length, 0);
    });
  }
});

describe("DELETE / POST /users/delete-many", () => {
  it("deletes by comma separated ids", async () => {
    const { request, callsOf } = await setup({ deleteMany: { deletedCount: 2 } });
    const res = await request("DELETE", `/api/users/delete-many?ids=${VALID_ID},${OTHER_ID}`);
    assert.equal(res.status, 200);
    assert.equal(callsOf("deleteMany")[0].args[0].$and[0]._id.$in.length, 2);
  });

  it("deletes by ids from the body", async () => {
    const { request, callsOf } = await setup();
    const res = await request("POST", "/api/users/delete-many", { ids: [VALID_ID] });
    assert.equal(res.status, 200);
    assert.equal(callsOf("deleteMany").length, 1);
  });
});

describe("PATCH /users/update-many", () => {
  it("updates the matched ids and returns them", async () => {
    const { request, callsOf } = await setup({ find: [{ _id: VALID_ID }] }, { protectedFields: ["role"] });
    const res = await request("PATCH", "/api/users/update-many?role=user", { role: "admin", active: true });

    assert.equal(res.status, 200);
    const [filter, body] = callsOf("updateMany")[0].args;
    assert.deepEqual(filter, { _id: { $in: [VALID_ID] } });
    assert.deepEqual(body, { active: true });
  });

  it("returns 404 when nothing matches and 400 for an empty body", async () => {
    const { request } = await setup();
    assert.equal((await request("PATCH", "/api/users/update-many?role=user", { active: true })).status, 404);
    assert.equal((await request("PATCH", "/api/users/update-many?role=user", { _id: VALID_ID })).status, 400);
  });
});

describe("route middlewares", () => {
  it("removeMany middlewares also guard POST /delete-many", async () => {
    const { request, dbWrites } = await setup({}, { middlewares: { removeMany: [notFoundMiddleware] } });
    assert.equal((await request("DELETE", `/api/users/delete-many?ids=${VALID_ID}`)).status, 404);
    assert.equal((await request("POST", "/api/users/delete-many", { ids: [VALID_ID] })).status, 404);
    assert.equal(dbWrites().length, 0);
  });

  it("removeManyPost overrides removeMany for POST", async () => {
    const { request } = await setup({}, { middlewares: { removeMany: [notFoundMiddleware], removeManyPost: [] } });
    assert.equal((await request("POST", "/api/users/delete-many", { ids: [VALID_ID] })).status, 200);
  });

  it("handles a trailing slash in basePath", async () => {
    const fake = createFakeModel(createTestSchema());
    app = await startApp(generateCrudRoutes({ mongooseModel: fake.model, name: "users", basePath: "/users/" }));
    assert.equal((await app.request("GET", "/api/users")).status, 200);
  });
});

describe("redis caching", () => {
  it("serves getAll from cache and ignores unrelated query params in the key", async () => {
    const redis = createFakeRedis();
    const { request, callsOf } = await setup({ find: [{ name: "a" }], countDocuments: 1 }, { ioredis: redis });

    await request("GET", "/api/users?page=1");
    const second = await request("GET", "/api/users?page=1&utm=x");

    assert.equal(callsOf("find").length, 1);
    assert.deepEqual(second.body.data, [{ name: "a" }]);
    assert.deepEqual([...redis.store.keys()], ["xmcrud:users:api:users?page=1"]);
  });

  it("invalidates its own and invalidateCache names after a write", async () => {
    const redis = createFakeRedis();
    redis.store.set("xmcrud:orders:api:orders", "[]");
    redis.store.set("xmcrud:posts:api:posts", "[]");
    const { request } = await setup({ find: [{ name: "a" }], create: { _id: VALID_ID } }, { ioredis: redis, invalidateCache: ["orders"] });

    await request("GET", "/api/users");
    await request("POST", "/api/users", { name: "b" });

    assert.deepEqual([...redis.store.keys()], ["xmcrud:posts:api:posts"]);
  });

  it("does not clear the cache when the write fails", async () => {
    const redis = createFakeRedis();
    redis.store.set("xmcrud:users:api:users", "{}");
    const { request } = await setup({}, { ioredis: redis });

    assert.equal((await request("DELETE", `/api/users/${VALID_ID}`)).status, 404);
    assert.equal(redis.store.size, 1);
  });

  it("keeps working when redis is down and logs the error", async () => {
    const redis = createFakeRedis();
    redis.failing = true;
    const errors: string[] = [];
    const logger = { errorLogger: (m: string) => errors.push(m), successLogger: () => {} };
    const { request } = await setup({ find: [{ name: "a" }], create: { _id: VALID_ID } }, { ioredis: redis, logger });

    assert.equal((await request("GET", "/api/users")).status, 200);
    assert.equal((await request("POST", "/api/users", { name: "b" })).status, 201);
    assert.ok(errors.some((m) => m.includes("redis read failed")));
    assert.ok(errors.some((m) => m.includes("redis invalidate failed")));
  });
});
