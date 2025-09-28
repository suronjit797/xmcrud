import { RequestHandler } from "express";
import type ioredisType from "ioredis";
import { Model, Types } from "mongoose";
import { ApiError, sendResponse } from "../helpers/globalHelper";
import { IMeta } from "../Types";
import redisGenerateCacheKey from "../helpers/redisCacheKeyGenerator";
import { filterHelper, paginationHelper } from "../helpers/queryHelper";

const { ObjectId } = Types;

const delIoredisCache = async (ioredis: ioredisType, name: string): Promise<void> => {
  if (ioredis && name) {
    const cacheKey = `*api:v1:${name}*`.toLowerCase();
    const keys = await ioredis.keys(cacheKey);
    if (keys.length > 0) await ioredis.call("DEL", ...keys);
  }
};

const globalController = <TType>(
  ModelName: Model<TType>,
  name: string,
  ioredis?: ioredisType,
  cachedTime: number = 600, // in seconds
): {
  create: RequestHandler;
  getAll: RequestHandler;
  getSingle: RequestHandler;
  update: RequestHandler;
  updateMany: RequestHandler;
  remove: RequestHandler;
  removeMany: RequestHandler;
  removeManyPost: RequestHandler;
} => {
  return {
    // create
    create: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const data = await ModelName.create(req.body);
        sendResponse(res, 201, {
          success: true,
          message: `${name} created successfully`,
          data,
        });
      } catch (error) {
        next(error);
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
          const filter = filterHelper(req.query, req.partialFilter || [], new ModelName());

          const { page, limit, skip, sortCondition, populate, select } = pagination;
          const data = (await ModelName.find(filter)
            .limit(limit)
            .skip(skip)
            .sort(sortCondition)
            .populate(populate || "")
            .select(select || "")
            .lean()) as TType[];

          const total = await ModelName.countDocuments(filter);
          values = { data, meta: { page, limit, total } };

          if (ioredis && values.data.length) {
            await ioredis.set(cacheKey, JSON.stringify(values), "EX", cachedTime);
          }
        }

        sendResponse(res, 200, {
          success: true,
          message: `${name}s fetched successfully`,
          data: values.data,
          meta: values.meta,
        });
      } catch (error) {
        next(error);
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
          if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");
          const { populate, select } = paginationHelper(req.query);

          data = (await ModelName.findById(req.params.id)
            .populate(populate || "")
            .select(select || "")
            .lean()) as TType | null;
          if (ioredis && data) {
            await ioredis.set(cacheKey, JSON.stringify(data), "EX", cachedTime);
          }
        }

        sendResponse(res, 200, {
          success: true,
          message: `${name} fetched successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },

    // update
    update: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);
        if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const data = await ModelName.findByIdAndUpdate(req.params.id, req.body, {
          new: true,
          runValidators: true,
        });

        if (!data) {
          throw new ApiError(500, "Server Error");
        }

        sendResponse(res, 200, {
          success: true,
          message: `${name} updated successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },

    // update
    updateMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.query, req.partialFilter || [], new ModelName());

        const result = await ModelName.updateMany(filter, req.body, { runValidators: true });

        if (result.modifiedCount === 0) {
          throw new ApiError(404, "No documents updated");
        }
        const data = await ModelName.find(filter);

        sendResponse(res, 200, {
          success: true,
          message: `${name}s updated successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },

    // remove
    remove: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);
        if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const data = await ModelName.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, {
          success: true,
          message: `${name} deleted successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },

    // removeMany
    removeMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.query, req.partialFilter || [], new ModelName());
        const data = await ModelName.deleteMany(filter);

        sendResponse(res, 200, {
          success: true,
          message: `${name}s deleted successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },
    removeManyPost: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.body, req.partialFilter || [], new ModelName());
        const data = await ModelName.deleteMany(filter);

        sendResponse(res, 200, {
          success: true,
          message: `${name}s deleted successfully`,
          data,
        });
      } catch (error) {
        next(error);
      }
    },
  };
};

export default globalController;
