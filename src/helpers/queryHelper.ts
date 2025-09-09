import { Document, SortOrder, Types } from "mongoose";
import { IPagination, ISortCondition, RecordUnknown, TFilter } from "../Types";
import dayjs from "dayjs";

// Supported operators for query
const operatorsMap: Record<string, string> = {
  _gt: "$gt",
  _lt: "$lt",
  _gte: "$gte",
  _lte: "$lte",
  _ne: "$ne",
  _in: "$in",
  _nin: "$nin",
  _regex: "$regex",
  _exists: "$exists",
};

const toValue = (v: string): any => {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (!isNaN(+v) && v.trim() !== "") return +v;
  return v;
};
const toArray = (v: string | string[]) => (Array.isArray(v) ? v.map(toValue) : String(v).split(",").map(toValue));

/*######################## pic valid values ####################################*/
export const pic = <T extends Record<string, any>>(obj: T, schemaFields: string[]): Record<string, any> => {
  const validKeys = Object.keys(obj).filter((key) => {
    // Direct key match
    if (schemaFields.includes(key)) return true;

    // Operator match (e.g., amount_gt → amount)
    return schemaFields.some((field) => Object.keys(operatorsMap).some((op) => key === `${field}${op}`));
  });

  return validKeys.reduce((acc: Record<string, any>, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      acc[key] = obj[key];
    }
    return acc;
  }, {});
};

/*######################## Pagination helpers ####################################*/
export const paginationHelper = (obj: Record<string, unknown>): IPagination => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    populate = "",
  } = pic(obj, ["page", "limit", "sortBy", "sortOrder", "populate"]) as {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: SortOrder;
    populate?: string;
  };

  const parsedPage = Math.abs(Number(page)) || 1;
  const parsedLimit = Math.min(Math.abs(Number(limit || 10)), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const validSortOrders: SortOrder[] = [1, -1, "asc", "ascending", "desc", "descending"];
  const parsedSortOrder: SortOrder = validSortOrders.includes(sortOrder) ? sortOrder : "desc";

  const sortCondition: ISortCondition = { [sortBy]: parsedSortOrder };

  // need to test for populate
  const parsePopulateString = (populateStr: string = ""): any => {
    if (typeof populateStr !== "string" || !populateStr.length) return "";
    const paths = populateStr.trim().split(/\s+/); // split by space
    const populateMap: Record<string, any> = {};

    for (const path of paths) {
      const [root, nested] = path.split(".");
      if (!nested) {
        if (!populateMap[root]) populateMap[root] = { path: root };
      } else {
        if (!populateMap[root]) {
          populateMap[root] = { path: root, populate: { path: nested } };
        } else if (!populateMap[root].populate) {
          populateMap[root].populate = { path: nested };
        } else {
          // Support deeper nesting if needed
          const current = populateMap[root].populate;
          populateMap[root].populate = Array.isArray(current) ? [...current, { path: nested }] : [current, { path: nested }];
        }
      }
    }

    return Object.values(populateMap);
  };

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
    sortCondition,
    populate: parsePopulateString(populate),
  };
};

/*######################## Filter Helper ####################################*/
export const filterHelper = <T extends RecordUnknown>(reqQuery: T, partialSearching: string[], schemaName: Document): Partial<TFilter> => {
  const query = { ...reqQuery };
  const schemaKeys = Object.keys(schemaName?.schema?.paths);
  const schemaKeyWithTypes: Record<string, string> = {};
  const conditions: RecordUnknown[] = [];
  const acceptedFilterTypes = ["String", "Number", "Boolean", "Date", "ObjectId"];

  Object.entries(schemaName?.schema?.paths)?.forEach(([key, value]) => {
    if (acceptedFilterTypes.includes(value?.instance)) schemaKeyWithTypes[key] = value?.instance;
  });

  const { search, ids, ...rest } = pic(query, ["search", "ids", ...schemaKeys]);

  // Handle search queries (partial match)
  if (search && partialSearching.length > 0) {
    conditions.push({
      $or: partialSearching.map((field) => ({
        [field]: { $regex: search, $options: "i" },
      })),
    });
  }

  // if (_id) conditions.push({ _id: new Types.ObjectId(_id) });

  // Handle multiple ids
  if (Array.isArray(ids) && ids?.length) conditions.push({ _id: { $in: ids?.map((id: string) => new Types.ObjectId(id)) } });

  // handle types
  const castValueByType = (raw: string, type: string): any => {
    switch (type) {
      case "Number": {
        const num = Number(raw);
        return isNaN(num) ? undefined : num;
      }
      case "Date": {
        const date = dayjs(raw);
        return date.isValid() ? date.toDate() : undefined;
      }
      case "ObjectId":
        // return /^[a-f\d]{24}$/i.test(raw) ? raw : undefined;
        return typeof raw === "string" ? new Types.ObjectId(raw) : undefined;
      case "Boolean":
        return raw === "true" || raw === "1";
      case "String":
      default:
        return raw;
    }
  };

  Object.entries(rest).forEach(([key, val]) => {
    if (val === undefined || val === null || val === "") return;

    const raw = val.toString().trim();
    const opKey = Object.keys(operatorsMap).find((sfx) => key.endsWith(sfx));
    const operator = opKey && operatorsMap[opKey];
    const field = opKey ? key.slice(0, -opKey.length) : key;
    const fieldType = schemaKeyWithTypes[field];

    if (!fieldType) return; // Skip unknown fields

    let value: any;

    if (operator) {
      // console.log({ key, val, raw, opKey, operator, field, fieldType });
      if (["$in", "$nin"].includes(operator)) {
        const arr = toArray(raw);
        value = arr.map((item) => castValueByType(item, fieldType)).filter((v) => v !== undefined);
      } else if (operator === "$exists") {
        value = raw === "true" || raw === "1";
      } else if (operator === "$regex") {
        value = new RegExp(raw, "i");
      } else if (["$gt", "$lt", "$gte", "$lte"].includes(operator)) {
        value = castValueByType(raw, fieldType);
        if (value === undefined) return;
      } else {
        value = castValueByType(raw, fieldType);
      }

      conditions.push({ [field]: { [operator]: value } });
    } else {
      const isArray = typeof raw === "string" && raw.includes(",");
      const val = isArray
        ? {
            $in: toArray(raw)
              .map((item) => castValueByType(item, fieldType))
              .filter((v) => v !== undefined),
          }
        : castValueByType(raw, fieldType);

      conditions.push({ [key]: val });
    }
  });

  console.log(conditions);

  return conditions.length > 0 ? { $and: conditions } : {};
};
