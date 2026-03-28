import { Request } from "express";
import type ioredisType from "ioredis";

// clear cache

export const delIoredisCache = async (redis: ioredisType, name: string, invalidateCache: string[] = []) => {
  if (!redis) return;

  const prefix = (redis as any)?.options?.keyPrefix ?? "";
  const patterns = [`*${name}*`, ...invalidateCache.map((c) => `*${c}*`)];

  for (const pattern of patterns) {
    const keys = await redis.keys(pattern);

    if (!keys.length) continue;
    const normalizedKeys = prefix ? keys.map((k) => (k.startsWith(prefix) ? k.slice(prefix.length) : k)) : keys;
    const deleted = await redis.unlink(...normalizedKeys);
    // console.log({ pattern, keys, normalizedKeys, deleted, prefix });
  }
};

// create cache
export function redisGenerateCacheKey(req: Request): string {
  const baseUrl = req.baseUrl
    .replace(/^\/+|\/+$/g, "") // remove leading/trailing slashes
    .replace(/\//g, ":"); // convert slashes to colons

  // Normalize and sort query parameters
  const sortedQuery = Object.entries(req.query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  // Normalize and sort route parameters
  const sortedParams = Object.entries(req.params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&");

  let cacheKey = baseUrl || "root";

  if (sortedParams) cacheKey += `:${sortedParams}`;
  if (sortedQuery) cacheKey += `?${sortedQuery}`;

  return cacheKey;
}

export default redisGenerateCacheKey;
