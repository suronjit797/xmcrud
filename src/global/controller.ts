import { RequestHandler } from "express";
import { Model, Types } from "mongoose";
import { ApiError, sendResponse } from "../helpers/globalHelper";
import { filterHelper, paginationHelper } from "../helpers/queryHelper";

const { ObjectId } = Types;

const generateCurdController = <TType>(
  ModelName: Model<TType>,
  name: string
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
        const data = await ModelName.create(req.body);

        const payload = {
          success: true,
          message: `${name} created successfully`,
          data,
        };

        sendResponse(res, 201, payload);
        return;
      } catch (error) {
        next(error);
      }
    },

    // get all
    getAll: async (req, res, next) => {
      try {
        // filter
        const pagination = paginationHelper(req.query);
        const { page, limit, skip, sortCondition, populate } = pagination;
        const filter = filterHelper(req.query, req.partialFilter || [], new ModelName());
        const a = req.query

        const total = await ModelName.countDocuments(filter);
        const data = await ModelName.find(filter)
          .limit(limit)
          .skip(skip)
          .sort(sortCondition)
          .populate(populate || "");

        // payload
        const payload = {
          success: true,
          message: `${name}s fetched successfully`,
          meta: { page, limit, total },
          data,
        };
        sendResponse(res, 200, payload);
        return;
      } catch (error) {
        next(error);
      }
    },

    // get single
    getSingle: async (req, res, next) => {
      try {
        const data = await ModelName.findById(req.params.id);

        // const data = await service.getSingle(req.params.id);
        const payload = {
          success: true,
          message: `${name} fetched successfully`,
          data,
        };
        sendResponse(res, 200, payload);
        return;
      } catch (error) {
        next(error);
      }
    },

    // update single
    update: async (req, res, next) => {
      try {
        const data = await ModelName.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });

        if (!data) throw new ApiError(500, "Server Error");

        const payload = {
          success: true,
          message: `${name} updated successfully`,
          data,
        };

        sendResponse(res, 200, payload);
        return;
      } catch (error) {
        next(error);
      }
    },

    // remove single
    remove: async (req, res, next) => {
      try {
        const data = await ModelName.findByIdAndDelete(req.params.id);

        const payload = {
          success: true,
          message: `${name} deleted successfully`,
          data,
        };
        sendResponse(res, 200, payload);
        return;
      } catch (error) {
        next(error);
      }
    },

    // remove all
    removeMany: async (req, res, next) => {
      try {
        const ids = req.body.ids;

        if (!Array.isArray(ids) || !ids.length) throw new ApiError(400, "No ids provided");
        const filter = { _id: { $in: ids.map((id: string) => new ObjectId(id)) } };
        const data = await ModelName.deleteMany(filter);

        const payload = {
          success: true,
          message: `${name}s deleted successfully`,
          data,
        };
        sendResponse(res, 200, payload);
        return;
      } catch (error) {
        next(error);
      }
    },
  };
};

export default generateCurdController;
