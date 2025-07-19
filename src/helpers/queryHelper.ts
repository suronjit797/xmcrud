import { Document, SortOrder } from "mongoose";
import { IPagination, ISortCondition, TFilter } from "../Types/types";

// Supported operators for query
const operatorsMap: Record<string, string> = {
  _gt: "$gt", _lt: "$lt", _gte: "$gte", _lte: "$lte",
  _ne: "$ne", _in: "$in", _nin: "$nin",
  _regex: "$regex", _exists: "$exists",
};

const toValue = (v: string): any => {
  if (v === "true") return true;
  if (v === "false") return false;
  if (!isNaN(+v) && v.trim() !== "") return +v;
  return v;
};

const toArray = (v: string | string[]) =>  Array.isArray(v) ? v.map(toValue) : String(v).split(",").map(toValue);

/*######################## pic valid values ####################################*/
export const pic = <T extends Record<string, any>, K extends keyof T>(obj: T, keys: K[]): Partial<T> => {
  return keys.reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      acc[key] = obj[key];
    }
    return acc;
  }, {} as Partial<T>);
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

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
    sortCondition,
    populate,
  };
};


/*######################## Filter Helper ####################################*/
export const filterHelper = <T extends Record<string, unknown>>(
  reqQuery: T,
  partialSearching: string[],
  schemaName: Document
): Partial<TFilter> => {
  const schemaKeys = Object.keys(schemaName.schema.obj);
  const { search, ...rest } = pic(reqQuery, ["search", ...schemaKeys]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conditions: Record<string, any>[] = [];

  // Handle search queries (partial match)
  if (search && partialSearching.length > 0) {
    conditions.push({
      $or: partialSearching.map((field) => ({
        [field]: { $regex: search, $options: "i" },
      })),
    });
  }


  // Handle exact filters and operators (_gt, _lt, etc.)
  Object.entries(rest).forEach(([key, val]) => {
    if (val === undefined || val === null || val === '') return;
    const raw = val.toString().trim();
    const opKey = Object.keys(operatorsMap).find((sfx) => key.endsWith(sfx));
    const operator = opKey && operatorsMap[opKey];
    const field = opKey ? key.slice(0, -opKey.length) : key;

    if (operator) {
      let val: any;
    if (["$in", "$nin"].includes(operator)) {
        val = toArray(raw);
      } else if (operator === "$exists") {
        val = raw === "true" || raw === "1";
      } else if (operator === "$regex") {
        val = new RegExp(raw, "i");
      } else if (["$gt", "$lt", "$gte", "$lte"].includes(operator)) {
        const num = Number(raw);
        if (isNaN(num)) return;
        val = num;
      } else {
        val = toValue(raw);
      }

      conditions.push({ [field]: { [operator]: val } });
    } else {
      const val = typeof raw === "string" && raw.includes(",") ? { $in: toArray(raw) } : toValue(raw);
      conditions.push({ [key]: val });
    }
  });
  console.log(conditions)

  return conditions.length > 0 ? { $and: conditions } : {};
};
