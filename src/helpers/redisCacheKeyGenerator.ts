import { Request } from "express";
import type ioredisType from "ioredis";

const CACHE_NAMESPACE = "xmcrud";
const SCAN_COUNT = 500;
const UNLINK_BATCH = 500;

// never touch job-queue data that may live in the same redis database
const isProtectedKey = (key: string) => key.includes("bull:") || key.includes("bullmq:");

const stringifyValue = (value: unknown): string => {
  if (Array.isArray(value)) return value.map(stringifyValue).join(",");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const sortedEntries = (obj: Record<string, unknown> | undefined, stringify: (v: unknown) => string) =>
  Object.entries(obj || {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${stringify(value)}`)
    .join("&");

const toSegments = (path: string) =>
  path
    .replace(/^\/+|\/+$/g, "") // remove leading/trailing slashes
    .replace(/\//g, ":"); // convert slashes to colons

/**
 * Clear cache: deletes every key that contains `name` or one of `invalidateCache` (same matching as
 * earlier versions, so route paths like "bankings" keep working). Uses SCAN instead of KEYS and
 * never deletes BullMQ keys.
 */
export const delIoredisCache = async (redis: ioredisType, name: string, invalidateCache: string[] = []) => {
  if (!redis) return;

  const prefix = (redis as any)?.options?.keyPrefix ?? "";
  const patterns = [...new Set([name, ...invalidateCache])].filter(Boolean).map((c) => `*${c}*`);

  for (const pattern of patterns) {
    // ioredis does not apply keyPrefix to the MATCH pattern, but does apply it to UNLINK
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", SCAN_COUNT);
      cursor = nextCursor;

      const deletable = keys.filter((k) => !isProtectedKey(k));
      if (!deletable.length) continue;

      const normalizedKeys = prefix ? deletable.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k)) : deletable;
      for (let i = 0; i < normalizedKeys.length; i += UNLINK_BATCH) {
        await redis.unlink(...normalizedKeys.slice(i, i + UNLINK_BATCH));
      }
    } while (cursor !== "0");
  }
};

export type RedisCacheKeyOptions = {
  /** Cache namespace, normally the `name` passed to generateCrudRoutes. */
  name?: string;
  /** Query values that affect the response. Defaults to the full `req.query`. */
  query?: Record<string, unknown>;
  /** Extra value that changes the response (e.g. req.scopeFilter); serialized into the key. */
  scope?: unknown;
};

/**
 * Create cache key.
 * - Without options: the same key as earlier versions ("api:v1:users:id=1?page=2").
 * - With options (used by the generated routes): "xmcrud:<name>:<full path>?<query>[#<scope>]",
 *   which still contains the route path, so path-based invalidation keeps matching.
 */
export function redisGenerateCacheKey(req: Request, options?: RedisCacheKeyOptions): string {
  const baseUrl = toSegments(req.baseUrl || "");

  if (!options) {
    const sortedQuery = sortedEntries(req.query as Record<string, unknown>, (v) => String(v));
    const sortedParams = sortedEntries(req.params as Record<string, unknown>, (v) => String(v));

    let cacheKey = baseUrl || "root";
    if (sortedParams) cacheKey += `:${sortedParams}`;
    if (sortedQuery) cacheKey += `?${sortedQuery}`;
    return cacheKey;
  }

  const name = options.name || baseUrl || "root";
  const path = toSegments(`${req.baseUrl || ""}${req.path || ""}`) || "root";
  const sortedQuery = sortedEntries(options.query ?? (req.query as Record<string, unknown>), stringifyValue);

  let cacheKey = `${CACHE_NAMESPACE}:${name}:${path}`;
  if (sortedQuery) cacheKey += `?${sortedQuery}`;
  if (options.scope !== undefined && options.scope !== null) cacheKey += `#scope=${stringifyValue(options.scope)}`;

  return cacheKey;
}

export default redisGenerateCacheKey;
