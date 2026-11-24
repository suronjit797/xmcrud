import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ApiError, errorHandler, partialFilterMiddlewares, sendResponse, stripProtectedFields, writableQueryMiddleware } from "../src";

// tiny response double that captures status and json
const createRes = () => {
  const res: any = { statusCode: 0, body: undefined, headersSent: false };
  res.status = (code: number) => ((res.statusCode = code), res);
  res.json = (body: unknown) => ((res.body = body), res);
  return res;
};

describe("stripProtectedFields", () => {
  const fields = ["_id", "role"];

  it("removes top-level protected fields and dotted children", () => {
    assert.deepEqual(stripProtectedFields({ _id: 1, role: "admin", "role.level": 2, name: "n" }, fields), { name: "n" });
  });

  it("removes protected fields inside update operators", () => {
    assert.deepEqual(stripProtectedFields({ $set: { role: "admin", name: "n" }, $inc: { "role.level": 1 } }, fields), { $set: { name: "n" } });
  });

  it("blocks $rename into a protected field", () => {
    assert.deepEqual(stripProtectedFields({ $rename: { name: "role", age: "years" } }, fields), { $rename: { age: "years" } });
  });

  it("returns an empty object for arrays (pipelines), null and primitives", () => {
    assert.deepEqual(stripProtectedFields([{ $set: { name: "x" } }], fields), {});
    assert.deepEqual(stripProtectedFields(null, fields), {});
    assert.deepEqual(stripProtectedFields("x", fields), {});
  });
});

describe("sendResponse", () => {
  it("only includes meta and data when present", () => {
    const res = createRes();
    sendResponse({ req: {} as any, res, status: 200, payload: { success: true, message: "ok" } });
    assert.deepEqual(res.body, { success: true, message: "ok" });
  });

  it("logs success with the data id", () => {
    const logs: any[] = [];
    const logger = { successLogger: (m: string, meta?: any) => logs.push([m, meta]), errorLogger: () => {} };
    sendResponse({ req: {} as any, res: createRes(), status: 201, payload: { success: true, message: "made", data: { _id: "1" } }, logger });
    assert.deepEqual(logs, [["[201] made", { dataId: "1" }]]);
  });
});

describe("partialFilterMiddlewares", () => {
  it("sets req.partialFilter without empty names", () => {
    const req: any = {};
    let called = false;
    partialFilterMiddlewares(["name", "", { path: "owner", refFields: ["name"] }, { path: "" }])(req, {} as any, () => (called = true));
    assert.deepEqual(req.partialFilter, ["name", { path: "owner", refFields: ["name"] }]);
    assert.ok(called);
  });
});

describe("writableQueryMiddleware", () => {
  it("replaces a getter-based req.query with a writable copy", () => {
    const req: any = {};
    Object.defineProperty(req, "query", { get: () => ({ a: "1" }), configurable: true });
    writableQueryMiddleware(req, {} as any, () => {});
    req.query.b = "2";
    assert.deepEqual(req.query, { a: "1", b: "2" });
  });
});

describe("errorHandler", () => {
  const handle = (error: unknown) => {
    const res = createRes();
    errorHandler(error, {} as any, res, () => {});
    return res;
  };

  it("uses ApiError status and message", () => {
    const res = handle(new ApiError(404, "nope"));
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.message, "nope");
    assert.equal(res.body.success, false);
  });

  it("maps mongoose errors and duplicate keys", () => {
    assert.equal(handle({ name: "ValidationError", errors: { a: { path: "a", message: "bad" } } }).statusCode, 400);
    assert.equal(handle({ name: "CastError", path: "age" }).statusCode, 400);
    assert.equal(handle({ name: "StrictPopulateError", message: "x", path: "p" }).statusCode, 400);
    const dup = handle({ code: 11000, keyValue: { email: "a" } });
    assert.equal(dup.statusCode, 409);
    assert.deepEqual(dup.body.errorMessages, [{ path: "email", message: "email already exists" }]);
  });

  it("uses the status of any error class that carries one (e.g. an app's own ApiError)", () => {
    class AppError extends Error {
      constructor(
        public statusCode: number,
        message: string,
      ) {
        super(message);
      }
    }
    const res = handle(new AppError(403, "Forbidden here"));
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.message, "Forbidden here");
    assert.equal(handle(Object.assign(new Error("gone"), { status: 410 })).statusCode, 410);
    // 5xx from unknown classes keeps the generic message
    assert.equal(handle(Object.assign(new Error("db password leaked"), { statusCode: 503 })).body.message, "Something went wrong");
  });

  it("hides unknown error details", () => {
    const res = handle(new Error("secret db detail"));
    assert.equal(res.statusCode, 500);
    assert.equal(res.body.message, "Something went wrong");
  });

  it("passes on when headers are already sent", () => {
    const res = createRes();
    res.headersSent = true;
    let forwarded: unknown;
    errorHandler("boom", {} as any, res, (e?: unknown) => (forwarded = e));
    assert.equal(forwarded, "boom");
  });
});
