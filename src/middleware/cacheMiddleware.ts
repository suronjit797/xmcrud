import { Request, Response, NextFunction } from "express";
import redisGenerateCacheKey from "../helpers/redisCacheKeyGenerator";
import ioredis from "ioredis";
import { sendResponse } from "../helpers/globalHelper";

const cacheMiddleware = (redis:ioredis) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const method = req.method.toUpperCase();
    const baseUrl = req.baseUrl.toLowerCase(); // e.g., /api/v1/user
    const cachePrefix = `*${baseUrl}*`; // used for deletion

    if (method === "GET") {
      const cacheKey = redisGenerateCacheKey(req);
      const cachedData = await redis.get(cacheKey);

      if (cachedData) {        const parsed = JSON.parse(cachedData);
        const isSingle = req.params?.id !== undefined;

        const payload = isSingle
          ? {
              success: true,
              message: `Fetched successfully`,
              data: parsed,
            }
          : {
              success: true,
              message: `Fetched successfully`,
              data: parsed?.data,
              meta: parsed?.meta,
            };

        return sendResponse(res, 200, payload);
      }
      return next(); // Cache miss → go to controller
    }

    // For mutations → invalidate all related cache
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const keys = await redis.keys(cachePrefix);
      if (keys.length > 0) {
        await redis.call("DEL", ...keys);
      }
    }

    return next();
  } catch (error) {
    return next(error); 
  }
};

export default cacheMiddleware;
