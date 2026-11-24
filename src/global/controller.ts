import { Request } from "express";
import { Types } from "mongoose";
import { ApiError, handleError, sendResponse, stripProtectedFields } from "../helpers/globalHelper";
import { filterHelper, paginationHelper, paginationKeys, pic } from "../helpers/queryHelper";
import redisGenerateCacheKey, { delIoredisCache } from "../helpers/redisCacheKeyGenerator";
import { GlobalControllerOptions, GlobalControllerReturn, IMeta } from "../Types";

const defaultProtectedFields = ["_id", "createdAt", "updatedAt", "__v"];

const isValidId = (id: unknown) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

export const generateCrudController = <TType extends object>({
  mongooseModel,
  name,
  ioredis,
  cachedTime = 600,
  logger,
  protectedFields = [],
  invalidateCache = [],
  paginationConfig = {},
}: GlobalControllerOptions<TType>): GlobalControllerReturn => {
  const schema = mongooseModel.schema;
  const allProtectedFields = [...(protectedFields || []), ...defaultProtectedFields];
  const cacheQueryKeys = [...paginationKeys, "search", "ids", ...Object.keys(schema?.paths || {})];

  // cache helpers: a redis failure is logged and treated as a cache miss, never a failed request
  const logCacheError = (action: string, error: unknown) =>
    logger?.errorLogger?.(`(${name}) redis ${action} failed: ${error instanceof Error ? error.message : String(error)}`);

  const getCacheKey = (req: Request) => redisGenerateCacheKey(req, { name, query: pic(req.query as Record<string, unknown>, cacheQueryKeys) });

  const readCache = async <T>(key: string): Promise<T | null> => {
    if (!ioredis) return null;
    try {
      const cached = await ioredis.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      logCacheError("read", error);
      return null;
    }
  };

  const writeCache = async (key: string, value: unknown) => {
    if (!ioredis) return;
    try {
      await ioredis.set(key, JSON.stringify(value), "EX", cachedTime);
    } catch (error) {
      logCacheError("write", error);
    }
  };

  const clearCache = async () => {
    if (!ioredis) return;
    try {
      await delIoredisCache(ioredis, name, invalidateCache);
    } catch (error) {
      logCacheError("invalidate", error);
    }
  };

  // bulk operations must never run with an empty filter (it would hit the whole collection)
  const requireBulkFilter = (filter: object) => {
    if (!Object.keys(filter).length) throw new ApiError(400, "A valid filter is required for bulk operations");
  };

  const assertValidId = (req: Request) => {
    if (!isValidId(req.params.id)) throw new ApiError(400, "Invalid ID format");
  };

  return {
    // create
    create: async (req, res, next) => {
      try {
        const data = await mongooseModel.create(req.body ?? {});
        await clearCache();
        sendResponse({ req, res, status: 201, payload: { success: true, message: `${name} created successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // get all
    getAll: async (req, res, next) => {
      try {
        const cacheKey = getCacheKey(req);
        let values = await readCache<{ data: TType[]; meta: IMeta }>(cacheKey);

        if (!values) {
          const pagination = paginationHelper(req.query as Record<string, unknown>, paginationConfig, schema);
          const filter = filterHelper(req.query as Record<string, unknown>, req.partialFilter || [], schema);

          const { page, limit, skip, sortCondition, populate, select } = pagination;

          let query = mongooseModel.find(filter).sort(sortCondition).skip(skip).limit(limit);
          if (populate.length) query = query.populate(populate);
          if (select) query = query.select(select);

          const [data, total] = await Promise.all([query.lean() as Promise<TType[]>, mongooseModel.countDocuments(filter)]);

          values = { data, meta: { page, limit, total } };
          await writeCache(cacheKey, values);
        }

        sendResponse({
          req,
          res,
          status: 200,
          payload: { success: true, message: `${name} fetched successfully`, data: values.data, meta: values.meta },
          logger,
        });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // get single
    getSingle: async (req, res, next) => {
      try {
        assertValidId(req);
        const cacheKey = getCacheKey(req);
        let data: TType | null = await readCache<TType>(cacheKey);

        if (!data) {
          const { populate, select } = paginationHelper(req.query as Record<string, unknown>, paginationConfig, schema);

          let query = mongooseModel.findById(req.params.id);
          if (populate.length) query = query.populate(populate);
          if (select) query = query.select(select);

          data = (await query.lean()) as TType | null;
          if (data) await writeCache(cacheKey, data);
        }

        if (!data) throw new ApiError(404, `${name} not found`);
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} fetched successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update
    update: async (req, res, next) => {
      try {
        assertValidId(req);

        const updateBody = stripProtectedFields(req.body, allProtectedFields);
        const data = await mongooseModel.findByIdAndUpdate(req.params.id, updateBody, { returnDocument: "after", runValidators: true });

        if (!data) throw new ApiError(404, `${name} not found`);
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update many
    updateMany: async (req, res, next) => {
      try {
        const filter = filterHelper(req.query as Record<string, unknown>, req.partialFilter || [], schema);
        requireBulkFilter(filter);

        const updateBody = stripProtectedFields(req.body, allProtectedFields);
        if (!Object.keys(updateBody).length) throw new ApiError(400, "Update body is empty");

        // capture the matched ids first: the update may change the fields the filter uses
        const ids = (await mongooseModel.find(filter).select("_id").lean()).map((doc: any) => doc._id as Types.ObjectId);
        if (!ids.length) throw new ApiError(404, `${name} not found`);

        await mongooseModel.updateMany({ _id: { $in: ids } }, updateBody, { runValidators: true });
        await clearCache();

        const data = await mongooseModel.find({ _id: { $in: ids } });
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove
    remove: async (req, res, next) => {
      try {
        assertValidId(req);

        const data = await mongooseModel.findByIdAndDelete(req.params.id);

        if (!data) throw new ApiError(404, `${name} not found`);
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many (filter from query string)
    removeMany: async (req, res, next) => {
      try {
        const filter = filterHelper(req.query as Record<string, unknown>, req.partialFilter || [], schema);
        requireBulkFilter(filter);

        const data = await mongooseModel.deleteMany(filter);
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many (filter from body)
    removeManyPost: async (req, res, next) => {
      try {
        const filter = filterHelper(req.body ?? {}, req.partialFilter || [], schema);
        requireBulkFilter(filter);

        const data = await mongooseModel.deleteMany(filter);
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
  };
};

export default generateCrudController;
