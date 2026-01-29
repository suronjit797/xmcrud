import type ioredisType from "ioredis";
import { Types } from "mongoose";
import { ApiError, handleError, sendResponse } from "../helpers/globalHelper";
import { filterHelper, paginationHelper } from "../helpers/queryHelper";
import redisGenerateCacheKey from "../helpers/redisCacheKeyGenerator";
import { GlobalControllerOptions, GlobalControllerReturn, IMeta } from "../Types";

const { ObjectId } = Types;
const defaultProtectedFields = ["_id", "createdAt", "updatedAt", "__v"];

const delIoredisCache = async (redis: ioredisType, name: string, invalidateCache: string[] = []) => {
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

export const generateCrudController = <TType extends object>({
  mongooseModel,
  name,
  ioredis,
  cachedTime = 600,
  logger,
  protectedFields = [],
  invalidateCache = [],
}: GlobalControllerOptions<TType>): GlobalControllerReturn => {
  return {
    // create
    create: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);

        const data = await mongooseModel.create(req.body);
        sendResponse({ req, res, status: 201, payload: { success: true, message: `${name} created successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // get all
    getAll: async (req, res, next) => {
      try {
        let values: { data: TType[]; meta: IMeta } = {
          data: [],
          meta: { limit: 10, page: 1, total: 0 },
        };

        const cacheKey = redisGenerateCacheKey(req);

        if (ioredis) {
          const cachedData = await ioredis.get(cacheKey);
          if (cachedData) {
            values = JSON.parse(cachedData);
          }
        }

        if (!values.data.length) {
          const pagination = paginationHelper(req.query);
          const filter = filterHelper(req.query, req.partialFilter || [], mongooseModel.schema);

          const { page, limit, skip, sortCondition, populate, select } = pagination;

          const [data, total] = await Promise.all([
            mongooseModel
              .find(filter)
              .limit(limit)
              .skip(skip)
              .sort(sortCondition)
              .populate(populate || "")
              .select(select || "")
              .lean() as Promise<TType[]>,
            mongooseModel.countDocuments(filter),
          ]);

          values = { data, meta: { page, limit, total } };

          if (ioredis && values.data.length) {
            await ioredis.set(cacheKey, JSON.stringify(values), "EX", cachedTime);
          }
        }

        sendResponse({
          req,
          res,
          status: 200,
          payload: { success: true, message: `${name}s fetched successfully`, data: values.data, meta: values.meta },
          logger,
        });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // get single
    getSingle: async (req, res, next) => {
      try {
        let data: TType | null = null;
        const cacheKey = redisGenerateCacheKey(req);

        if (ioredis) {
          const cachedData = await ioredis.get(cacheKey);
          if (cachedData) {
            data = JSON.parse(cachedData);
          }
        }

        if (!data) {
          if (!req.params.id && !ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");
          const { populate, select } = paginationHelper(req.query);

          data = (await mongooseModel
            .findById(req.params.id)
            .populate(populate || "")
            .select(select || "")
            .lean()) as TType | null;
          if (ioredis && data) {
            await ioredis.set(cacheKey, JSON.stringify(data), "EX", cachedTime);
          }
        }
        // response
        if (!data) throw new ApiError(404, `${name} not found`);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} fetched successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update
    update: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);
        if (!req.params.id && !ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const updateBody = { ...req.body };
        [...(protectedFields || []), ...defaultProtectedFields].forEach((field) => delete updateBody[field]);

        const data = await mongooseModel.findByIdAndUpdate(req.params.id, updateBody, { new: true, runValidators: true });

        if (!data) throw new ApiError(404, `${name} not found`);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update many
    updateMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);

        const filter = filterHelper(req.query, req.partialFilter || [], mongooseModel.schema);
        const result = await mongooseModel.updateMany(filter, req.body, { runValidators: true });

        if (result.modifiedCount === 0) throw new ApiError(404, "not found");
        const data = await mongooseModel.find(filter);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove
    remove: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);
        if (!req.params.id && !ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const data = await mongooseModel.findByIdAndDelete(req.params.id);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many
    removeMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);

        const filter = filterHelper(req.query, req.partialFilter || [], mongooseModel.schema);
        const data = await mongooseModel.deleteMany(filter);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
    removeManyPost: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name, invalidateCache);

        const filter = filterHelper(req.body, req.partialFilter || [], mongooseModel.schema);
        const data = await mongooseModel.deleteMany(filter);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
  };
};

export default generateCrudController;
