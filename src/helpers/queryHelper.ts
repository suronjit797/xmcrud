import { Model, Schema, SortOrder, Types } from "mongoose";
import {
  FilterHelperOptions,
  IPagination,
  ISortCondition,
  PaginationConfig,
  PartialFilterField,
  RecordUnknown,
  TFilter,
  TPopulateOption,
} from "../Types";
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
const MAX_REF_SEARCH_IDS = 1000;
// matches no document: used when a search cannot match any field
const MATCH_NOTHING = { _id: { $in: [] as unknown[] } };

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

export const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// earlier versions used the search text as a regex; keep that for valid patterns (apps may pre-escape it)
// and fall back to a literal match when the text is not a valid regex (e.g. "(")
const toSearchPattern = (text: string) => {
  try {
    new RegExp(text);
    return text;
  } catch {
    return escapeRegex(text);
  }
};

const splitList = (v: unknown): string[] =>
  (Array.isArray(v) ? v.join(",") : String(v ?? ""))
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

const isObjectIdString = (value: string) => /^[a-f\d]{24}$/i.test(value);

const toObjectId = (value: unknown, field: string): Types.ObjectId => {
  const str = String(value);
  if (!isObjectIdString(str)) throw new ApiError(400, `Invalid ObjectId for "${field}"`);
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
// a dotted path that is itself a schema path (e.g. "members.member" inside a subdocument array) stays one path
const buildPopulateTree = (paths: string[], schema?: Schema): TPopulateOption[] => {
  const root: TPopulateOption[] = [];

  for (const fullPath of paths) {
    const segments = schema?.path(fullPath) ? [fullPath] : fullPath.split(".").filter(Boolean);
    let level = root;
    for (const segment of segments) {
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
    // without an allowlist only populate paths whose root the schema knows about
    paths = paths.filter((p) => {
      const rootPath = p.split(".")[0];
      return Boolean(schema.path(p)) || Boolean(schema.path(rootPath)) || Boolean((schema as any).virtuals?.[rootPath]);
    });
  }

  return buildPopulateTree(paths, schema);
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

// absolute integer value like earlier versions (?limit=-5 -> 5); NaN when not a number
const toAbsInt = (value: unknown): number => Math.floor(Math.abs(Number(firstString(value))));

/*######################## Pagination helpers ####################################*/
export const paginationHelper = (obj: RecordUnknown, config: PaginationConfig = {}, schema?: Schema): IPagination => {
  const { page, limit, sortBy, sortOrder, populate, select } = pic(obj || {}, paginationKeys);

  const { maxLimit = 100, maxSkip = 1_000_000, allowNoLimit = true } = config || {};

  const pageNumber = toAbsInt(page);
  const parsedPage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  // ?limit=0 means "no limit" in earlier versions (mongoose treats limit(0) as unlimited)
  const limitNumber = limit === undefined || limit === "" ? 10 : toAbsInt(limit);
  let parsedLimit: number;
  if (limitNumber === 0) parsedLimit = allowNoLimit ? 0 : 10;
  else parsedLimit = Number.isFinite(limitNumber) ? Math.min(limitNumber, maxLimit) : 10;

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

/*######################## schema helpers ####################################*/
const acceptedFilterTypes = ["String", "Number", "Boolean", "Date", "ObjectId"];

// schema path -> filterable type. Array paths use their element type; subdocument arrays and
// single nested subdocuments are walked so "members.member" or "address.city" can be filtered.
export const getFilterableSchemaFields = (schema: Schema): Record<string, string> => {
  const fields: Record<string, string> = {};

  const walk = (current: Schema, prefix: string, depth: number) => {
    Object.entries(current?.paths || {}).forEach(([key, value]: [string, any]) => {
      const fullPath = `${prefix}${key}`;
      if (value?.schema && depth < 5 && (value.$isMongooseDocumentArray || value.$isSingleNested)) {
        walk(value.schema, `${fullPath}.`, depth + 1);
        return;
      }

      let instance = value?.instance;
      if (instance === "Array" && value?.embeddedSchemaType?.instance) instance = value.embeddedSchemaType.instance;
      if (acceptedFilterTypes.includes(instance)) fields[fullPath] = instance;
    });
  };

  walk(schema, "", 0);
  return fields;
};

type SchemaFieldInfo = { type?: string; ref?: string };

const getFieldInfo = (schema: Schema | undefined, path: string): SchemaFieldInfo => {
  const schemaType: any = schema?.path(path);
  if (!schemaType) return {};
  const element = schemaType.instance === "Array" ? schemaType.embeddedSchemaType : undefined;
  return {
    type: element?.instance ?? schemaType.instance,
    ref: schemaType.options?.ref ?? element?.options?.ref,
  };
};

/*######################## typed partial search ####################################*/
const normalizeSearchField = (field: PartialFilterField) => (typeof field === "string" ? { path: field } : field);

// "2025" -> whole year, "2025-03" -> month, "2025-03-14" -> day (server local time)
const toDateRange = (text: string): { $gte: Date; $lt: Date } | undefined => {
  const match = /^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/.exec(text.trim());
  if (!match) return undefined;
  const [year, month, day] = [Number(match[1]), match[2] ? Number(match[2]) - 1 : undefined, match[3] ? Number(match[3]) : undefined];
  if (month !== undefined && (month < 0 || month > 11)) return undefined;
  if (day !== undefined && (day < 1 || day > 31)) return undefined;

  if (day !== undefined) return { $gte: new Date(year, month!, day), $lt: new Date(year, month!, day + 1) };
  if (month !== undefined) return { $gte: new Date(year, month, 1), $lt: new Date(year, month + 1, 1) };
  return { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) };
};

// condition for one search field, or undefined when the search text cannot match its type
const searchBranch = (text: string, path: string, info: SchemaFieldInfo): RecordUnknown | undefined => {
  switch (info.type) {
    case undefined: // not in the schema: regex, as in earlier versions
    case "String":
    case "Mixed":
      return { [path]: { $regex: toSearchPattern(text), $options: "i" } };
    case "Number": {
      const num = Number(text);
      return text.trim() !== "" && Number.isFinite(num) ? { [path]: num } : undefined;
    }
    case "Date": {
      const range = toDateRange(text);
      return range ? { [path]: range } : undefined;
    }
    case "Boolean": {
      const lower = text.trim().toLowerCase();
      if (["true", "yes", "1"].includes(lower)) return { [path]: true };
      if (["false", "no", "0"].includes(lower)) return { [path]: false };
      return undefined;
    }
    case "ObjectId":
      return isObjectIdString(text.trim()) ? { [path]: new Types.ObjectId(text.trim()) } : undefined;
    default:
      return undefined;
  }
};

const getSearchText = (search: unknown) => firstString(search)?.trim().slice(0, MAX_REGEX_LENGTH);

// sync search condition: every field type except reference lookups (refFields)
const buildSearchConditionSync = (search: unknown, fields: PartialFilterField[] | undefined, schema?: Schema): RecordUnknown | null => {
  const text = getSearchText(search);
  const searchFields = (fields || []).map(normalizeSearchField).filter((f) => f && f.path);
  if (!text || !searchFields.length) return null;

  const branches = searchFields
    .map(({ path }) => searchBranch(text, path, getFieldInfo(schema, path)))
    .filter((b): b is RecordUnknown => Boolean(b));

  return branches.length ? { $or: branches } : MATCH_NOTHING;
};

/**
 * Builds the `?search=` condition for the given fields, matching each field by its schema type.
 * Reference fields given as { path, refFields } are searched by the referenced documents' fields.
 * Returns null when there is nothing to search.
 */
export const buildSearchCondition = async (
  search: unknown,
  fields: PartialFilterField[] | undefined,
  model: Model<any>,
): Promise<RecordUnknown | null> => {
  const text = getSearchText(search);
  const searchFields = (fields || []).map(normalizeSearchField).filter((f) => f && f.path);
  if (!text || !searchFields.length) return null;

  const schema = model.schema;
  const branches: RecordUnknown[] = [];

  for (const { path, refFields } of searchFields) {
    const info = getFieldInfo(schema, path);

    if (refFields?.length && info.type === "ObjectId" && info.ref) {
      try {
        const refModel = model.db.model(info.ref);
        const regex = { $regex: toSearchPattern(text), $options: "i" };
        const docs = await refModel
          .find({ $or: refFields.map((f) => ({ [f]: regex })) })
          .select("_id")
          .limit(MAX_REF_SEARCH_IDS)
          .lean();
        if (docs.length) branches.push({ [path]: { $in: docs.map((d: any) => d._id) } });
      } catch {
        // referenced model is not registered: skip this field
      }
      continue;
    }

    const branch = searchBranch(text, path, info);
    if (branch) branches.push(branch);
  }

  return branches.length ? { $or: branches } : MATCH_NOTHING;
};

/*######################## Filter Helper ####################################*/
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
      // same as earlier versions: anything other than "true"/"1" is false
      return str === "true" || str === "1";
    case "String":
    default:
      return str;
  }
};

export const filterHelper = <T extends RecordUnknown>(
  reqQuery: T,
  partialSearching?: PartialFilterField[],
  schema?: Schema,
  options: FilterHelperOptions = {},
): TFilter => {
  const query: RecordUnknown = { ...(reqQuery || {}) };
  for (const key of options.exclude || []) delete query[key];

  const schemaKeyWithTypes = getFilterableSchemaFields(schema as Schema);
  const schemaKeys = [...new Set([...Object.keys(schema?.paths || {}), ...Object.keys(schemaKeyWithTypes)])];
  const conditions: RecordUnknown[] = [];

  const { search, ids, ...rest } = pic(query, ["search", "ids", ...schemaKeys]);

  // Handle search queries (partial match)
  const searchCondition = options.searchCondition !== undefined ? options.searchCondition : buildSearchConditionSync(search, partialSearching, schema);
  if (searchCondition) conditions.push(searchCondition);

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
