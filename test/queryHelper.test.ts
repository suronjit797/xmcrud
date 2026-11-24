import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { buildSearchCondition, filterHelper, paginationHelper, pic } from "../src";
import { normalizeSortOrder } from "../src/helpers/queryHelper";
import { createFakeModel, createTestSchema, OTHER_ID, VALID_ID } from "./support/fakeModel";

const schema = createTestSchema();
const filter = (query: Record<string, unknown>, search: string[] = []) => filterHelper(query, search, schema);
const firstCondition = (query: Record<string, unknown>, search: string[] = []) => (filter(query, search).$and as any[])[0];
const assert400 = (fn: () => unknown, message?: RegExp) =>
  assert.throws(fn, (e: any) => e.statusCode === 400 && (!message || message.test(e.message)));

describe("pic", () => {
  it("keeps listed keys and operator variants, drops the rest", () => {
    assert.deepEqual(pic({ age: 1, age_gt: 2, foo: 3, page: undefined }, ["age", "page"]), { age: 1, age_gt: 2 });
  });

  it("returns an empty object for non-objects", () => {
    assert.deepEqual(pic(undefined as any, ["a"]), {});
  });
});

describe("filterHelper", () => {
  it("returns an empty filter when no known field is given", () => {
    assert.deepEqual(filter({}), {});
    assert.deepEqual(filter({ foo: "1", page: "2" }), {});
  });

  describe("type casting", () => {
    it("casts numbers, booleans, dates and ObjectIds", () => {
      assert.deepEqual(firstCondition({ age: "5" }), { age: 5 });
      assert.deepEqual(firstCondition({ active: "true" }), { active: true });
      assert.deepEqual(firstCondition({ active: "0" }), { active: false });
      assert.ok(firstCondition({ born: "2025-01-01" }).born instanceof Date);
      assert.equal(firstCondition({ born: "1700000000000" }).born.getTime(), 1700000000000);
      assert.ok(firstCondition({ owner: VALID_ID }).owner instanceof Types.ObjectId);
    });

    it("treats 'null' as null for every type", () => {
      assert.deepEqual(firstCondition({ age: "null" }), { age: null });
      assert.deepEqual(firstCondition({ name: "null" }), { name: null });
    });

    it("skips values that cannot be cast instead of matching missing fields", () => {
      assert.deepEqual(filter({ age: "abc" }), {});
      assert.deepEqual(filter({ born: "not-a-date" }), {});
      assert.deepEqual(filter({ age: "" }), {});
    });

    it("treats any boolean value other than true/1 as false (as in 1.4.x)", () => {
      assert.deepEqual(firstCondition({ active: "yes" }), { active: false });
    });

    it("rejects invalid ObjectIds with 400", () => {
      assert400(() => filter({ owner: "abc" }), /owner/);
      assert400(() => filter({ owner_in: `${VALID_ID},nope` }));
    });

    it("uses the element type of array fields", () => {
      assert.deepEqual(firstCondition({ tags: "a" }), { tags: "a" });
    });

    it("filters fields inside subdocument arrays and nested subdocuments", () => {
      assert.ok(firstCondition({ "members.member": VALID_ID })["members.member"] instanceof Types.ObjectId);
      assert.deepEqual(firstCondition({ "members.status": "active" }), { "members.status": "active" });
      assert.deepEqual(firstCondition({ "address.city": "Dhaka" }), { "address.city": "Dhaka" });
      assert.deepEqual(firstCondition({ "address.zip_gte": "1000" }), { "address.zip": { $gte: 1000 } });
    });
  });

  describe("comma lists", () => {
    it("turns comma separated values into $in", () => {
      assert.deepEqual(firstCondition({ age: "1,2" }), { age: { $in: [1, 2] } });
    });

    it("joins repeated query params (?age=1&age=2)", () => {
      assert.deepEqual(firstCondition({ age: ["1", "2"] }), { age: { $in: [1, 2] } });
    });
  });

  describe("operators", () => {
    it("maps suffixes to mongo operators", () => {
      assert.deepEqual(firstCondition({ age_gt: "1" }), { age: { $gt: 1 } });
      assert.deepEqual(firstCondition({ age_gte: "1" }), { age: { $gte: 1 } });
      assert.deepEqual(firstCondition({ age_lt: "1" }), { age: { $lt: 1 } });
      assert.deepEqual(firstCondition({ age_lte: "1" }), { age: { $lte: 1 } });
      assert.deepEqual(firstCondition({ role_ne: "admin" }), { role: { $ne: "admin" } });
      assert.deepEqual(firstCondition({ role_in: "a,b" }), { role: { $in: ["a", "b"] } });
      assert.deepEqual(firstCondition({ role_nin: "a" }), { role: { $nin: ["a"] } });
      assert.deepEqual(firstCondition({ email_exists: "true" }), { email: { $exists: true } });
    });

    it("skips comparison operators with uncastable values", () => {
      assert.deepEqual(filter({ age_gt: "abc" }), {});
    });

    it("limits $in to 500 values", () => {
      const many = Array.from({ length: 501 }, (_, i) => i).join(",");
      assert400(() => filter({ age_in: many }), /Too many/);
    });

    it("builds a case-insensitive regex and rejects invalid or long ones", () => {
      const { name } = firstCondition({ name_regex: "^jo" });
      assert.ok(name.$regex instanceof RegExp);
      assert.equal(name.$regex.flags, "i");
      assert400(() => filter({ name_regex: "(" }), /Invalid regex/);
      assert400(() => filter({ name_regex: "a".repeat(201) }), /too long/);
    });

    it("prefers a real schema field over an operator suffix (check_in)", () => {
      const condition = firstCondition({ check_in: "2025-01-01" });
      assert.ok(condition.check_in instanceof Date);
    });
  });

  describe("ids", () => {
    it("accepts comma separated strings, arrays and body arrays", () => {
      assert.equal(firstCondition({ ids: `${VALID_ID},${OTHER_ID}` })._id.$in.length, 2);
      assert.equal(firstCondition({ ids: [VALID_ID, OTHER_ID] })._id.$in.length, 2);
    });

    it("rejects invalid ids with 400", () => {
      assert400(() => filter({ ids: "abc" }), /ids/);
    });
  });

  describe("search", () => {
    it("searches the partial filter fields case-insensitively", () => {
      assert.deepEqual(firstCondition({ search: "jo" }, ["name", "email"]), {
        $or: [{ name: { $regex: "jo", $options: "i" } }, { email: { $regex: "jo", $options: "i" } }],
      });
    });

    it("escapes the text only when it is not a valid regex", () => {
      assert.equal(firstCondition({ search: "a.b(" }, ["name"]).$or[0].name.$regex, "a\\.b\\(");
      // valid patterns are kept, as in 1.4.x, so apps that escape before calling are not escaped twice
      assert.equal(firstCondition({ search: "john\\.doe" }, ["name"]).$or[0].name.$regex, "john\\.doe");
    });

    it("matches each field by its schema type", () => {
      const fields = ["name", "age", "born", "active", "owner", "unknownField"];
      assert.deepEqual(
        firstCondition({ search: "42" }, fields).$or.map((b: any) => Object.keys(b)[0]),
        ["name", "age", "unknownField"],
      );
      assert.deepEqual(firstCondition({ search: "42" }, ["age"]).$or[0], { age: 42 });

      const year = firstCondition({ search: "2025" }, ["born"]).$or[0].born;
      assert.equal(year.$gte.getFullYear(), 2025);
      assert.equal(year.$lt.getFullYear(), 2026);
      const day = firstCondition({ search: "2025-03-14" }, ["born"]).$or[0].born;
      assert.equal(day.$lt.getTime() - day.$gte.getTime(), 24 * 60 * 60 * 1000);

      assert.deepEqual(firstCondition({ search: "yes" }, ["active"]).$or[0], { active: true });
      assert.ok(firstCondition({ search: VALID_ID }, ["owner"]).$or[0].owner instanceof Types.ObjectId);
      assert.ok(firstCondition({ search: VALID_ID }, ["members.member"]).$or[0]["members.member"] instanceof Types.ObjectId);
    });

    it("matches nothing when no field type can match the text", () => {
      assert.deepEqual(firstCondition({ search: "abc" }, ["age", "active"]), { _id: { $in: [] } });
    });

    it("ignores search without fields or with empty field names", () => {
      assert.deepEqual(filter({ search: "jo" }), {});
      assert.deepEqual(filter({ search: "jo" }, [""]), {});
    });

    it("uses the first value when search is repeated", () => {
      const { $or } = firstCondition({ search: ["a", "b"] }, ["name"]);
      assert.equal($or[0].name.$regex, "a");
    });
  });
});

describe("filterHelper options", () => {
  it("excludes keys", () => {
    assert.deepEqual(filterHelper({ role: "a", age: "1" }, [], schema, { exclude: ["role"] }), { $and: [{ age: 1 }] });
  });

  it("uses a given searchCondition instead of building one", () => {
    const searchCondition = { $or: [{ name: "x" }] };
    assert.deepEqual(filterHelper({ search: "jo" }, ["name"], schema, { searchCondition }), { $and: [searchCondition] });
    assert.deepEqual(filterHelper({ search: "jo" }, ["name"], schema, { searchCondition: null }), {});
  });

  it("accepts a missing partial filter and schema", () => {
    assert.deepEqual(filterHelper({ search: "jo" }, undefined, schema), {});
    assert.deepEqual(filterHelper({ age: "1" }, undefined, undefined as any), {});
  });
});

describe("buildSearchCondition", () => {
  it("searches references by the referenced documents' fields", async () => {
    const owner = createFakeModel(createTestSchema(), { find: [{ _id: OTHER_ID }] });
    const { model } = createFakeModel(schema, {}, { Owner: owner.model });
    const condition: any = await buildSearchCondition("acme", ["name", { path: "owner", refFields: ["name", "email"] }], model);

    assert.deepEqual(condition.$or[1], { owner: { $in: [OTHER_ID] } });
    assert.deepEqual(owner.callsOf("find")[0].args[0], {
      $or: [{ name: { $regex: "acme", $options: "i" } }, { email: { $regex: "acme", $options: "i" } }],
    });
  });

  it("skips unregistered reference models and returns null without search", async () => {
    const { model } = createFakeModel(schema);
    assert.deepEqual(await buildSearchCondition("acme", [{ path: "owner", refFields: ["name"] }], model), { _id: { $in: [] } });
    assert.equal(await buildSearchCondition("", ["name"], model), null);
    assert.equal(await buildSearchCondition("acme", [], model), null);
  });
});

describe("paginationHelper", () => {
  const paginate = (query: Record<string, unknown>, config = {}) => paginationHelper(query, config, schema);

  describe("page and limit", () => {
    it("uses defaults", () => {
      const result = paginate({});
      assert.equal(result.page, 1);
      assert.equal(result.limit, 10);
      assert.equal(result.skip, 0);
      assert.deepEqual(result.sortCondition, { createdAt: -1 });
    });

    it("keeps 1.4.x behaviour: limit=0 means no limit, negative values are made positive", () => {
      assert.equal(paginate({ limit: "0" }).limit, 0);
      assert.equal(paginate({ limit: "-5" }).limit, 5);
    });

    it("uses the default limit for limit=0 when allowNoLimit is false, and for invalid values", () => {
      assert.equal(paginate({ limit: "0" }, { allowNoLimit: false }).limit, 10);
      for (const limit of ["abc", ""]) assert.equal(paginate({ limit }).limit, 10, `limit=${limit}`);
    });

    it("caps limit at maxLimit", () => {
      assert.equal(paginate({ limit: "5000" }).limit, 100);
      assert.equal(paginate({ limit: "50" }, { maxLimit: 20 }).limit, 20);
    });

    it("floors fractional page and limit and caps skip", () => {
      const result = paginate({ page: "2.7", limit: "10.9" });
      assert.equal(result.page, 2);
      assert.equal(result.limit, 10);
      assert.equal(result.skip, 10);
      assert.equal(paginate({ page: "1000", limit: "10" }, { maxSkip: 50 }).skip, 50);
    });
  });

  describe("sorting", () => {
    it("normalizes sort orders", () => {
      assert.deepEqual(paginate({ sortBy: "age", sortOrder: "asc" }).sortCondition, { age: 1 });
      assert.equal(normalizeSortOrder("DESC"), -1);
      assert.equal(normalizeSortOrder(1), 1);
      assert.equal(normalizeSortOrder("weird"), -1);
    });
  });

  describe("select", () => {
    it("keeps normal fields and never allows +field", () => {
      assert.equal(paginate({ select: "name email" }).select, "name email");
      assert.equal(paginate({ select: "name,+password" }).select, "name");
    });

    it("rejects mixing included and excluded fields", () => {
      assert400(() => paginate({ select: "name -age" }), /mix/);
      assert.equal(paginate({ select: "name -_id" }).select, "name -_id");
    });

    it("applies allowedSelect", () => {
      assert.equal(paginate({ select: "name email" }, { allowedSelect: ["name"] }).select, "name");
      assert.equal(paginate({ select: "-email" }, { allowedSelect: ["email"] }).select, "-email");
    });
  });

  describe("populate", () => {
    it("keeps only schema paths without an allowlist", () => {
      assert.deepEqual(paginate({ populate: "owner unknown" }).populate, [{ path: "owner" }]);
    });

    it("builds nested populate of any depth and merges shared roots", () => {
      assert.deepEqual(paginate({ populate: "owner.company.country owner.manager" }).populate, [
        { path: "owner", populate: [{ path: "company", populate: [{ path: "country" }] }, { path: "manager" }] },
      ]);
    });

    it("keeps a dotted path that is a schema path (subdocument array) as one path", () => {
      assert.deepEqual(paginate({ populate: "members.member owner" }).populate, [{ path: "members.member" }, { path: "owner" }]);
    });

    it("applies allowedPopulate", () => {
      assert.deepEqual(paginate({ populate: "owner owner.company" }, { allowedPopulate: ["owner"] }).populate, [{ path: "owner" }]);
    });

    it("returns an empty list when nothing is requested", () => {
      assert.deepEqual(paginate({}).populate, []);
    });
  });
});
