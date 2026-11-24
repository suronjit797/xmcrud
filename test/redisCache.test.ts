import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { delIoredisCache, redisGenerateCacheKey } from "../src";
import { createFakeRedis } from "./support/fakeRedis";

const req = (baseUrl: string, path: string, query: Record<string, unknown> = {}, params: Record<string, string> = {}) =>
  ({ baseUrl, path, query, params }) as any;

describe("redisGenerateCacheKey", () => {
  describe("without options (same key as 1.4.x)", () => {
    it("uses the mount path, params and sorted query", () => {
      assert.equal(redisGenerateCacheKey(req("/api/v1/users", "/abc", { page: "2", a: "1" }, { id: "abc" })), "api:v1:users:id=abc?a=1&page=2");
      assert.equal(redisGenerateCacheKey(req("", "/")), "root");
    });
  });

  describe("with options (generated routes)", () => {
    it("namespaces keys by name and includes the full path", () => {
      assert.equal(redisGenerateCacheKey(req("/api", "/users/"), { name: "users" }), "xmcrud:users:api:users");
      assert.equal(redisGenerateCacheKey(req("/api", "/users/abc"), { name: "users" }), "xmcrud:users:api:users:abc");
    });

    it("gives different keys to routers mounted on the same path", () => {
      const users = redisGenerateCacheKey(req("/api", "/users/"), { name: "users" });
      const orders = redisGenerateCacheKey(req("/api", "/orders/"), { name: "orders" });
      assert.notEqual(users, orders);
    });

    it("keeps the full query, sorted, with arrays and objects serialized", () => {
      const key = redisGenerateCacheKey(req("/api", "/users", { b: "2", a: ["1", "3"], c: { x: 1 } }), { name: "users" });
      assert.equal(key, 'xmcrud:users:api:users?a=1,3&b=2&c={"x":1}');
    });

    it("adds the scope so scoped users never share an entry", () => {
      const a = redisGenerateCacheKey(req("/api", "/users"), { name: "users", scope: { agency: "a" } });
      const b = redisGenerateCacheKey(req("/api", "/users"), { name: "users", scope: { agency: "b" } });
      assert.notEqual(a, b);
      assert.equal(a, 'xmcrud:users:api:users#scope={"agency":"a"}');
    });

    it("still contains the route path so path-based invalidation matches", () => {
      assert.ok(redisGenerateCacheKey(req("/api/v1/bankings", "/"), { name: "Banking" }).includes("api:v1:bankings"));
    });
  });
});

describe("delIoredisCache", () => {
  it("deletes every key containing the name or an invalidateCache entry (1.4.x matching)", async () => {
    const redis = createFakeRedis();
    for (const key of ["xmcrud:users:a", "xmcrud:superusers:a", "api:v1:orders?page=1", "custom:orders", "xmcrud:posts:a"]) redis.store.set(key, "1");

    await delIoredisCache(redis, "users", ["orders"]);

    assert.deepEqual([...redis.store.keys()], ["xmcrud:posts:a"]);
  });

  it("never deletes BullMQ keys", async () => {
    const redis = createFakeRedis();
    for (const key of ["bull:onboarding:1", "bullmq:onboarding:meta", "xmcrud:onboarding:api:onboarding"]) redis.store.set(key, "1");

    await delIoredisCache(redis, "onboarding");

    assert.deepEqual([...redis.store.keys()].sort(), ["bull:onboarding:1", "bullmq:onboarding:meta"]);
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
