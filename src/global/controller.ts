import { Request } from "express";
import { Types } from "mongoose";
import { ApiError, handleError, sendResponse, stripProtectedFields } from "../helpers/globalHelper";
import { buildSearchCondition, filterHelper, paginationHelper } from "../helpers/queryHelper";
import redisGenerateCacheKey, { delIoredisCache } from "../helpers/redisCacheKeyGenerator";
import { GlobalControllerOptions, GlobalControllerReturn, IMeta, PartialFilterField, TFilter } from "../Types";

const defaultProtectedFields = ["_id", "createdAt", "updatedAt", "__v"];

const isValidId = (id: unknown) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

const hasScope = (req: Request) => Boolean(req.scopeFilter && Object.keys(req.scopeFilter).length);

// AND the request's scopeFilter (if any) into a filter
const withScope = (req: Request, filter: TFilter): TFilter => {
  if (!hasScope(req)) return filter;
  return Object.keys(filter).length ? { $and: [filter, req.scopeFilter] } : { ...req.scopeFilter };
};

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

  // cache helpers: a redis failure is logged and treated as a cache miss, never a failed request
  const logCacheError = (action: string, error: unknown) =>
    logger?.errorLogger?.(`(${name}) redis ${action} failed: ${error instanceof Error ? error.message : String(error)}`);

  // the full query is part of the key (as in earlier versions), plus the scope, so scoped users never share entries
  const getCacheKey = (req: Request) => redisGenerateCacheKey(req, { name, scope: hasScope(req) ? req.scopeFilter : undefined });

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

  // runs after a successful write; `extra` adds the record id, like earlier versions
  const clearCache = async (...extra: string[]) => {
    if (!ioredis) return;
    try {
      await delIoredisCache(ioredis, name, [...invalidateCache, ...extra.filter(Boolean)]);
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

  // filter from query/body, with typed + reference search
  const buildFilter = async (req: Request, source: Record<string, unknown>) => {
    const fields = req.partialFilter as PartialFilterField[] | undefined;
    const searchCondition = await buildSearchCondition(source?.search, fields, mongooseModel);
    return filterHelper(source, fields, schema, { searchCondition });
  };

  // single-document queries use findById & co. unless the request is scoped
  const idFilter = (req: Request): TFilter => withScope(req, { _id: new Types.ObjectId(String(req.params.id)) });

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
          const filter = withScope(req, await buildFilter(req, req.query as Record<string, unknown>));

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
        assertValidId(req);
        const cacheKey = getCacheKey(req);
        let data: TType | null = await readCache<TType>(cacheKey);

        if (!data) {
          const { populate, select } = paginationHelper(req.query as Record<string, unknown>, paginationConfig, schema);

          let query = hasScope(req) ? mongooseModel.findOne(idFilter(req)) : mongooseModel.findById(req.params.id);
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
        const options = { returnDocument: "after" as const, runValidators: true };
        const data = hasScope(req)
          ? await mongooseModel.findOneAndUpdate(idFilter(req), updateBody, options)
          : await mongooseModel.findByIdAndUpdate(req.params.id, updateBody, options);

        if (!data) throw new ApiError(404, `${name} not found`);
        await clearCache(String(req.params.id));
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // update many (filter from query string; body applied as in earlier versions)
    updateMany: async (req, res, next) => {
      try {
        const queryFilter = await buildFilter(req, req.query as Record<string, unknown>);
        requireBulkFilter(queryFilter);
        const filter = withScope(req, queryFilter);

        // capture the matched ids first: the update may change the fields the filter uses
        const ids = (await mongooseModel.find(filter).select("_id").lean()).map((doc: any) => doc._id as Types.ObjectId);
        if (!ids.length) throw new ApiError(404, "not found");

        await mongooseModel.updateMany({ _id: { $in: ids } }, req.body ?? {}, { runValidators: true });
        await clearCache();

        const data = await mongooseModel.find({ _id: { $in: ids } });
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s updated successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove (responds 200 with null data when the document does not exist, as in earlier versions)
    remove: async (req, res, next) => {
      try {
        assertValidId(req);

        const data = hasScope(req) ? await mongooseModel.findOneAndDelete(idFilter(req)) : await mongooseModel.findByIdAndDelete(req.params.id);

        if (data) await clearCache(String(req.params.id));
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name} deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many (filter from query string)
    removeMany: async (req, res, next) => {
      try {
        const queryFilter = await buildFilter(req, req.query as Record<string, unknown>);
        requireBulkFilter(queryFilter);

        const data = await mongooseModel.deleteMany(withScope(req, queryFilter));
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },

    // remove many (filter from body)
    removeManyPost: async (req, res, next) => {
      try {
        const bodyFilter = await buildFilter(req, req.body ?? {});
        requireBulkFilter(bodyFilter);

        const data = await mongooseModel.deleteMany(withScope(req, bodyFilter));
        await clearCache();
        sendResponse({ req, res, status: 200, payload: { success: true, message: `${name}s deleted successfully`, data }, logger });
      } catch (error) {
        handleError(error, next, logger, name);
      }
    },
  };
};

export default generateCrudController;
