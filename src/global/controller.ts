import { RequestHandler } from "express";
import type ioredisType from "ioredis";
import { Model, Types } from "mongoose";
import { ApiError, handleError, Logger, sendResponse } from "../helpers/globalHelper";
import { IMeta } from "../Types";
import redisGenerateCacheKey from "../helpers/redisCacheKeyGenerator";
import { filterHelper, paginationHelper } from "../helpers/queryHelper";

const { ObjectId } = Types;
const defaultProtectedFields = ["_id", "createdAt", "updatedAt", "__v"];

export interface GlobalControllerOptions<TType> {
  model: Model<TType>;
  name: string;
  ioredis?: ioredisType;
  cachedTime?: number;
  logger?: Logger;
  protectedFields?: readonly string[];
}
export interface GlobalControllerReturn {
  create: RequestHandler;
  getAll: RequestHandler;
  getSingle: RequestHandler;
  update: RequestHandler;
  updateMany: RequestHandler;
  remove: RequestHandler;
  removeMany: RequestHandler;
  removeManyPost: RequestHandler;
}

const delIoredisCache = async (ioredis: ioredisType, name: string): Promise<void> => {
  if (ioredis && name) {
    const cacheKey = `*api:*:${name}*`.toLowerCase();
    const keys = await ioredis.keys(cacheKey);
    if (keys.length > 0) await ioredis.call("DEL", ...keys);
  }
};

// const globalController = <TType>(
//   ModelName: Model<TType>,
//   name: string,
//   ioredis?: ioredisType,
//   cachedTime: number = 600,
//   logger?: Logger,
//   protectedFields: string[] = [],
// ): {
//   create: RequestHandler;
//   getAll: RequestHandler;
//   getSingle: RequestHandler;
//   update: RequestHandler;
//   updateMany: RequestHandler;
//   remove: RequestHandler;
//   removeMany: RequestHandler;
//   removeManyPost: RequestHandler;
// } => {

export const globalController = <TType extends object>({
  model,
  name,
  ioredis,
  cachedTime = 600,
  logger,
  protectedFields = [],
}: GlobalControllerOptions<TType>): GlobalControllerReturn => {
  return {
    // create
    create: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const data = await model.create(req.body);
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
          const filter = filterHelper(req.query, req.partialFilter || [], new model());

          const { page, limit, skip, sortCondition, populate, select } = pagination;
          // const data = (await ModelName.find(filter)
          //   .limit(limit)
          //   .skip(skip)
          //   .sort(sortCondition)
          //   .populate(populate || "")
          //   .select(select || "")
          //   .lean()) as TType[];
          // const total = await ModelName.countDocuments(filter);

          const [data, total] = await Promise.all([
            model
              .find(filter)
              .limit(limit)
              .skip(skip)
              .sort(sortCondition)
              .populate(populate || "")
              .select(select || "")
              .lean() as Promise<TType[]>,
            model.countDocuments(filter),
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
          if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");
          const { populate, select } = paginationHelper(req.query);

          data = (await model
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
        if (ioredis) await delIoredisCache(ioredis, name);
        if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const updateBody = { ...req.body };
        [...(protectedFields || []), ...defaultProtectedFields].forEach((field) => delete updateBody[field]);

        const data = await model.findByIdAndUpdate(req.params.id, updateBody, { new: true, runValidators: true });

        if (!data) throw new ApiError(404, `${name} not found`);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update many
    updateMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.query, req.partialFilter || [], new model());
        const result = await model.updateMany(filter, req.body, { runValidators: true });

        if (result.modifiedCount === 0) throw new ApiError(404, "not found");
        const data = await model.find(filter);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove
    remove: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);
        if (!ObjectId.isValid(req.params.id)) throw new ApiError(400, "Invalid ID format");

        const data = await model.findByIdAndDelete(req.params.id);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many
    removeMany: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.query, req.partialFilter || [], new model());
        const data = await model.deleteMany(filter);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
    removeManyPost: async (req, res, next) => {
      try {
        if (ioredis) await delIoredisCache(ioredis, name);

        const filter = filterHelper(req.body, req.partialFilter || [], new model());
        const data = await model.deleteMany(filter);

        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
  };
};

export default globalController;
