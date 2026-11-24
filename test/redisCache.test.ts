import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delIoredisCache, redisGenerateCacheKey } from "../src";
import { createFakeRedis } from "./support/fakeRedis";

const req = (baseUrl: string, path: string, query: Record<string, unknown> = {}) => ({ baseUrl, path, query, params: {} }) as any;

describe("redisGenerateCacheKey", () => {
  it("namespaces keys by name and includes the full path", () => {
    assert.equal(redisGenerateCacheKey(req("/api", "/users/"), { name: "users" }), "xmcrud:users:api:users");
    assert.equal(redisGenerateCacheKey(req("/api", "/users/abc"), { name: "users" }), "xmcrud:users:api:users:abc");
  });

  it("gives different keys to routers mounted on the same path", () => {
    const users = redisGenerateCacheKey(req("/api", "/users/"), { name: "users" });
    const orders = redisGenerateCacheKey(req("/api", "/orders/"), { name: "orders" });
    assert.notEqual(users, orders);
  });

  it("sorts query params and serializes arrays and objects", () => {
    const key = redisGenerateCacheKey(req("/api", "/users", { b: "2", a: ["1", "3"], c: { x: 1 } }), { name: "users" });
    assert.equal(key, 'xmcrud:users:api:users?a=1,3&b=2&c={"x":1}');
  });

  it("uses the given query instead of req.query", () => {
    const key = redisGenerateCacheKey(req("/api", "/users", { junk: "1", page: "2" }), { name: "users", query: { page: "2" } });
    assert.equal(key, "xmcrud:users:api:users?page=2");
  });

  it("falls back to the mount path as name", () => {
    assert.equal(redisGenerateCacheKey(req("/v1/users", "/")), "xmcrud:v1:users:v1:users");
    assert.equal(redisGenerateCacheKey(req("", "/")), "xmcrud:root:root");
  });
});

describe("delIoredisCache", () => {
  it("deletes only the given name and invalidateCache names", async () => {
    const redis = createFakeRedis();
    for (const key of ["xmcrud:users:a", "xmcrud:users:b", "xmcrud:superusers:a", "xmcrud:orders:a", "xmcrud:posts:a"]) redis.store.set(key, "1");

    await delIoredisCache(redis, "users", ["orders"]);

    assert.deepEqual([...redis.store.keys()].sort(), ["xmcrud:posts:a", "xmcrud:superusers:a"]);
  });

  it("uses SCAN (never KEYS) and walks every page", async () => {
    const redis = createFakeRedis();
    for (let i = 0; i < 1200; i++) redis.store.set(`xmcrud:users:${i}`, "1");

    await delIoredisCache(redis, "users");

    assert.equal(redis.store.size, 0);
    assert.ok(redis.commands.filter((c: string) => c === "scan").length > 1);
  });

  it("handles an ioredis keyPrefix", async () => {
    const redis = createFakeRedis("app:");
    redis.store.set("app:xmcrud:users:a", "1");
    redis.store.set("app:xmcrud:posts:a", "1");

    await delIoredisCache(redis, "users");

    assert.deepEqual([...redis.store.keys()], ["app:xmcrud:posts:a"]);
  });
});
