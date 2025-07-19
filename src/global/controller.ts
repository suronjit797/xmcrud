import { RequestHandler } from "express";
import type ioredisType from "ioredis";
import { Model, Types } from "mongoose";
import { ApiError, sendResponse } from "../helpers/globalHelper";
import { IMeta } from "../Types";
import redisGenerateCacheKey from "../helpers/redisCacheKeyGenerator";
import { filterHelper, paginationHelper } from "../helpers/queryHelper";

const { ObjectId } = Types;

const globalController = <TType>(
  ModelName: Model<TType>,
  name: string,
  ioredis?: ioredisType,
): {
  create: RequestHandler;
  getAll: RequestHandler;
  getSingle: RequestHandler;
  update: RequestHandler;
  remove: RequestHandler;
  removeMany: RequestHandler;
} => {
  return {
    // create
    create: async (req, res, next) => {
      try {
        if (ioredis) {
          const cacheKey = `*api:v1:${name}*`.toLowerCase();
          const keys = await ioredis.keys(cacheKey);
          if (keys.length > 0) await ioredis.call("DEL", ...keys);
        }

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
          console.log("redis hit");
          const cachedData = await ioredis.get(cacheKey);
          if (cachedData) {
            console.log("cached hit");
            values = JSON.parse(cachedData);
          }
        }

        if (!values.data.length) {
          console.log("cache mis");
          const pagination = paginationHelper(req.query);
          const filter = filterHelper(req.query, req.partialFilter || [], new ModelName());

          const { page, limit, skip, sortCondition, populate } = pagination;
          const data = await ModelName.find(filter)
            .limit(limit)
            .skip(skip)
            .sort(sortCondition)
            .populate(populate || "");

          const total = await ModelName.countDocuments(filter);
          values = { data, meta: { page, limit, total } };

          if (ioredis && values.data.length) {
            await ioredis.set(cacheKey, JSON.stringify(values), "EX", 600);
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
          data = await ModelName.findById(req.params.id);
          if (ioredis && data) {
            await ioredis.set(cacheKey, JSON.stringify(data), "EX", 600);
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
        if (ioredis) {
          const cacheKey = `*api:v1:${name}*`.toLowerCase();
          const keys = await ioredis.keys(cacheKey);
          if (keys.length > 0) await ioredis.call("DEL", ...keys);
        }

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

    // remove
    remove: async (req, res, next) => {
      try {
        if (ioredis) {
          const cacheKey = `*api:v1:${name}*`.toLowerCase();
          const keys = await ioredis.keys(cacheKey);
          if (keys.length > 0) await ioredis.call("DEL", ...keys);
        }

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
        if (ioredis) {
          const cacheKey = `*api:v1:${name}*`.toLowerCase();
          const keys = await ioredis.keys(cacheKey);
          if (keys.length > 0) await ioredis.call("DEL", ...keys);
        }

        const ids = req.body.ids;
        if (!ids || !ids.length) throw new ApiError(400, "No ids provided");

        const filter = { _id: { $in: ids.map((id: string) => new ObjectId(id)) } };
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
