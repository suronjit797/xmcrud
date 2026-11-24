import { Request } from "express";
import type ioredisType from "ioredis";

const CACHE_NAMESPACE = "xmcrud";
const SCAN_COUNT = 500;
const UNLINK_BATCH = 500;

// keys are "xmcrud:<name>:<path>?<query>", so a name only ever matches its own keys
const namePattern = (name: string) => `*${CACHE_NAMESPACE}:${name}:*`;

const stringifyValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(stringifyValue).join(",");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
};

// clear cache
export const delIoredisCache = async (redis: ioredisType, name: string, invalidateCache: string[] = []) => {
  if (!redis) return;

  const prefix = (redis as any)?.options?.keyPrefix ?? "";
  const patterns = [...new Set([name, ...invalidateCache])].filter(Boolean).map(namePattern);

  for (const pattern of patterns) {
    // SCAN instead of KEYS so a large keyspace does not block redis.
    // ioredis does not apply keyPrefix to the MATCH pattern, but does apply it to UNLINK.
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_COUNT);
      cursor = nextCursor;
      if (!keys.length) continue;

      const normalizedKeys = prefix ? keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k)) : keys;
      for (let i = 0; i < normalizedKeys.length; i += UNLINK_BATCH) {
        await redis.unlink(...normalizedKeys.slice(i, i + UNLINK_BATCH));
      }
    } while (cursor !== "0");
  }
};

export type RedisCacheKeyOptions = {
  /** Cache namespace, normally the `name` passed to generateCrudRoutes. Defaults to the router mount path. */
  name?: string;
  /** Query values that affect the response. Defaults to the full `req.query`. */
  query?: Record<string, unknown>;
};

// create cache
export function redisGenerateCacheKey(req: Request, options: RedisCacheKeyOptions = {}): string {
  const toSegments = (path: string) =>
    path
      .replace(/^\/+|\/+$/g, "") // remove leading/trailing slashes
      .replace(/\//g, ":"); // convert slashes to colons

  const name = options.name || toSegments(req.baseUrl || "") || "root";
  const path = toSegments(`${req.baseUrl || ""}${req.path || ""}`) || "root";

  // Normalize and sort query parameters
  const sortedQuery = Object.entries(options.query ?? req.query ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${stringifyValue(value)}`)
    .join("&");

  let cacheKey = `${CACHE_NAMESPACE}:${name}:${path}`;
  if (sortedQuery) cacheKey += `?${sortedQuery}`;

  return cacheKey;
}

export default redisGenerateCacheKey;
