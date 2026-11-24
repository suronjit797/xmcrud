import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { filterHelper, paginationHelper, pic } from "../src";
import { normalizeSortOrder } from "../src/helpers/queryHelper";
import { createTestSchema, OTHER_ID, VALID_ID } from "./support/fakeModel";

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
      assert.deepEqual(filter({ active: "yes" }), {});
      assert.deepEqual(filter({ born: "not-a-date" }), {});
      assert.deepEqual(filter({ age: "" }), {});
    });

    it("rejects invalid ObjectIds with 400", () => {
      assert400(() => filter({ owner: "abc" }), /owner/);
      assert400(() => filter({ owner_in: `${VALID_ID},nope` }));
    });

    it("uses the element type of array fields", () => {
      assert.deepEqual(firstCondition({ tags: "a" }), { tags: "a" });
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

    it("escapes regex characters", () => {
      const { $or } = firstCondition({ search: "a.b(" }, ["name"]);
      assert.equal($or[0].name.$regex, "a\\.b\\(");
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

    it("falls back to the default limit for 0, negative and invalid values", () => {
      for (const limit of ["0", "-5", "abc", ""]) assert.equal(paginate({ limit }).limit, 10, `limit=${limit}`);
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

    it("applies allowedPopulate", () => {
      assert.deepEqual(paginate({ populate: "owner owner.company" }, { allowedPopulate: ["owner"] }).populate, [{ path: "owner" }]);
    });

    it("returns an empty list when nothing is requested", () => {
      assert.deepEqual(paginate({}).populate, []);
    });
  });
});
