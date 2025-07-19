import { Request } from "express";

function redisGenerateCacheKey(req: Request): string {
  const baseUrl = req.baseUrl
    .replace(/^\/+|\/+$/g, "") // remove leading/trailing slashes
    .replace(/\//g, ":");      // convert slashes to colons

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

  let cacheKey = baseUrl || "root"; // fallback for routes like "/"

  if (sortedParams) cacheKey += `:${sortedParams}`;
  if (sortedQuery) cacheKey += `?${sortedQuery}`;

  return cacheKey;
}

export default redisGenerateCacheKey;
