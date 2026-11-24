import { Schema, SortOrder, Types } from "mongoose";
import { IPagination, ISortCondition, PaginationConfig, RecordUnknown, TFilter, TPopulateOption } from "../Types";
import { ApiError } from "./globalHelper";

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

const MAX_IN_VALUES = 500;
const MAX_REGEX_LENGTH = 200;

export const paginationKeys = ["page", "limit", "sortBy", "sortOrder", "populate", "select"];

const toValue = (v: string): any => {
  if (v === "true") return true;
  if (v === "false") return false;
  if (v === "null") return null;
  if (!isNaN(+v) && v.trim() !== "") return +v;
  return v;
};
const toArray = (v: string | string[]) => (Array.isArray(v) ? v.map(toValue) : String(v).split(",").map(toValue));

// first value of a query param that may arrive as an array (?a=1&a=2)
const firstString = (v: unknown): string | undefined => {
  const value = Array.isArray(v) ? v[0] : v;
  return value === undefined || value === null ? undefined : String(value);
};

const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const splitList = (v: unknown): string[] =>
  (Array.isArray(v) ? v.join(",") : String(v ?? ""))
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const toObjectId = (value: unknown, field: string): Types.ObjectId => {
  const str = String(value);
  if (!/^[a-f\d]{24}$/i.test(str)) throw new ApiError(400, `Invalid ObjectId for "${field}"`);
  return new Types.ObjectId(str);
};

/*######################## pic valid values ####################################*/
export const pic = <T extends Record<string, any>>(obj: T, schemaFields: string[]): Record<string, any> => {
  if (!obj || typeof obj !== "object") return {};
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

/*######################## normalize sort order ####################################*/
export const normalizeSortOrder = (value: unknown): 1 | -1 => {
  // Map of string values to sort orders
  const stringMap: Record<string, 1 | -1> = { "1": 1, "-1": -1, asc: 1, ascending: 1, desc: -1, descending: -1 };

  if (typeof value === "string") {
    const normalized = stringMap[value.toLowerCase()];
    if (normalized) return normalized;
  }

  if (typeof value === "number") {
    if (value === 1 || value === -1) return value;
  }

  return -1;
};

/*######################## populate / select parsers ####################################*/
// "author author.company tags" -> [{ path: "author", populate: [{ path: "company" }] }, { path: "tags" }]
const buildPopulateTree = (paths: string[]): TPopulateOption[] => {
  const root: TPopulateOption[] = [];

  for (const fullPath of paths) {
    let level = root;
    for (const segment of fullPath.split(".").filter(Boolean)) {
      let node = level.find((n) => n.path === segment);
      if (!node) {
        node = { path: segment };
        level.push(node);
      }
      node.populate = node.populate || [];
      level = node.populate;
    }
  }

  // drop empty populate arrays
  const clean = (nodes: TPopulateOption[]): TPopulateOption[] =>
    nodes.map((n) => (n.populate && n.populate.length ? { path: n.path, populate: clean(n.populate) } : { path: n.path }));

  return clean(root);
};

const parsePopulate = (value: unknown, config: PaginationConfig, schema?: Schema): TPopulateOption[] => {
  let paths = splitList(value);

  if (config.allowedPopulate) {
    const allowed = config.allowedPopulate;
    paths = paths.filter((p) => allowed.includes(p));
  } else if (schema) {
    // without an allowlist only populate root paths that the schema knows about
    paths = paths.filter((p) => {
      const rootPath = p.split(".")[0];
      return Boolean(schema.path(rootPath)) || Boolean((schema as any).virtuals?.[rootPath]);
    });
  }

  return buildPopulateTree(paths);
};

const parseSelect = (value: unknown, config: PaginationConfig): string => {
  // "+field" forces fields marked `select: false` (e.g. password), never allow it from the client
  let fields = splitList(value).filter((f) => !f.startsWith("+"));

  if (config.allowedSelect) {
    const allowed = config.allowedSelect;
    fields = fields.filter((f) => allowed.includes(f.replace(/^-/, "")));
  }

  const exclusions = fields.filter((f) => f.startsWith("-") && f !== "-_id");
  const inclusions = fields.filter((f) => !f.startsWith("-"));
  if (exclusions.length && inclusions.length) throw new ApiError(400, "select cannot mix included and excluded fields");

  return fields.join(" ");
};

const toPositiveInt = (value: unknown, fallback: number): number => {
  const num = Math.floor(Number(firstString(value)));
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

/*######################## Pagination helpers ####################################*/
export const paginationHelper = (obj: RecordUnknown, config: PaginationConfig = {}, schema?: Schema): IPagination => {
  const { page, limit, sortBy, sortOrder, populate, select } = pic(obj, paginationKeys);

  const { maxLimit = 100, maxSkip = 1_000_000 } = config || {};

  const parsedPage = toPositiveInt(page, 1);
  const parsedLimit = Math.min(toPositiveInt(limit, 10), maxLimit);

  const skip = Math.min((parsedPage - 1) * parsedLimit, maxSkip);

  const parsedSortOrder: SortOrder = normalizeSortOrder(firstString(sortOrder));
  const sortCondition: ISortCondition = { [firstString(sortBy) || "createdAt"]: parsedSortOrder };

  return {
    page: parsedPage,
    limit: parsedLimit,
    skip,
    sortCondition,
    populate: parsePopulate(populate, config || {}, schema),
    select: parseSelect(select, config || {}),
  };
};

/*######################## Filter Helper ####################################*/
const acceptedFilterTypes = ["String", "Number", "Boolean", "Date", "ObjectId"];

// schema path -> filterable type (array paths use their element type)
export const getFilterableSchemaFields = (schema: Schema): Record<string, string> => {
  const fields: Record<string, string> = {};

  Object.entries(schema?.paths || {}).forEach(([key, value]: [string, any]) => {
    let instance = value?.instance;
    if (instance === "Array" && value?.embeddedSchemaType?.instance) instance = value.embeddedSchemaType.instance;
    if (acceptedFilterTypes.includes(instance)) fields[key] = instance;
  });

  return fields;
};

// handle types
const castValueByType = (raw: unknown, type: string, field: string): any => {
  if (raw === null || raw === "null") return null;
  const str = String(raw);

  switch (type) {
    case "Number": {
      if (str.trim() === "") return undefined;
      const num = Number(str);
      return isNaN(num) ? undefined : num;
    }
    case "Date": {
      const date = /^\d+$/.test(str) ? new Date(Number(str)) : new Date(str);
      return isNaN(date.getTime()) ? undefined : date;
    }
    case "ObjectId":
      return toObjectId(str, field);
    case "Boolean":
      if (str === "true" || str === "1") return true;
      if (str === "false" || str === "0") return false;
      return undefined;
    case "String":
    default:
      return str;
  }
};

export const filterHelper = <T extends RecordUnknown>(reqQuery: T, partialSearching: string[], schema: Schema): Partial<TFilter> => {
  const query = { ...(reqQuery || {}) };
  const schemaKeyWithTypes = getFilterableSchemaFields(schema);
  const schemaKeys = Object.keys(schema?.paths || {});
  const conditions: RecordUnknown[] = [];

  const { search, ids, ...rest } = pic(query, ["search", "ids", ...schemaKeys]);

  // Handle search queries (partial match)
  const searchFields = (partialSearching || []).filter(Boolean);
  const searchText = firstString(search)?.trim().slice(0, MAX_REGEX_LENGTH);
  if (searchText && searchFields.length > 0) {
    const pattern = escapeRegex(searchText);
    conditions.push({
      $or: searchFields.map((field) => ({
        [field]: { $regex: pattern, $options: "i" },
      })),
    });
  }

  // Handle multiple ids (?ids=a,b  |  ?ids=a&ids=b  |  body { ids: [a, b] })
  if (ids !== undefined && ids !== null && ids !== "") {
    const idList = splitList(ids);
    if (idList.length > MAX_IN_VALUES) throw new ApiError(400, "Too many ids");
    if (idList.length) conditions.push({ _id: { $in: idList.map((id) => toObjectId(id, "ids")) } });
  }

  Object.entries(rest).forEach(([key, val]) => {
    if (val === undefined || val === null || val === "") return;

    const raw = (Array.isArray(val) ? val.join(",") : String(val)).trim();

    // a real schema field always wins over an operator suffix (e.g. a field named "check_in")
    const opKey = schemaKeyWithTypes[key] ? undefined : Object.keys(operatorsMap).find((sfx) => key.endsWith(sfx));
    const operator = opKey && operatorsMap[opKey];
    const field = opKey ? key.slice(0, -opKey.length) : key;
    const fieldType = schemaKeyWithTypes[field];

    if (!fieldType) return; // Skip unknown fields

    let value: any;

    if (operator) {
      if (["$in", "$nin"].includes(operator)) {
        const arr = toArray(raw);
        if (arr.length > MAX_IN_VALUES) throw new ApiError(400, "Too many values");
        value = arr.map((item) => castValueByType(item, fieldType, field)).filter((v) => v !== undefined);
      } else if (operator === "$exists") {
        value = raw === "true" || raw === "1";
      } else if (operator === "$regex") {
        if (raw.length > MAX_REGEX_LENGTH) throw new ApiError(400, `Regex for "${field}" is too long`);
        try {
          value = new RegExp(raw, "i");
        } catch {
          throw new ApiError(400, `Invalid regex for "${field}"`);
        }
      } else {
        value = castValueByType(raw, fieldType, field);
        if (value === undefined) return;
      }

      conditions.push({ [field]: { [operator]: value } });
    } else {
      if (raw.includes(",")) {
        value = {
          $in: toArray(raw)
            .map((item) => castValueByType(item, fieldType, field))
            .filter((v) => v !== undefined),
        };
      } else {
        value = castValueByType(raw, fieldType, field);
        if (value === undefined) return;
      }

      conditions.push({ [field]: value });
    }
  });

  return conditions.length > 0 ? { $and: conditions } : {};
};
