import { Schema } from "mongoose";

// A recording stand-in for a mongoose Model. It does not evaluate filters: each method returns
// the canned value in `results`, and every call is stored in `calls` so tests can assert on the
// filter, update body, populate and select the controller sent to mongoose.

export type FakeResults = {
  find: any[];
  countDocuments: number;
  findById: any;
  findOne: any;
  findByIdAndUpdate: any;
  findOneAndUpdate: any;
  findByIdAndDelete: any;
  findOneAndDelete: any;
  create: any;
  updateMany: any;
  deleteMany: any;
};

export type Call = { method: string; args: any[] };

export const createFakeModel = (schema: Schema, overrides: Partial<FakeResults> = {}, refModels: Record<string, any> = {}) => {
  const results: FakeResults = {
    find: [],
    countDocuments: 0,
    findById: null,
    findOne: null,
    findByIdAndUpdate: null,
    findOneAndUpdate: null,
    findByIdAndDelete: null,
    findOneAndDelete: null,
    create: null,
    updateMany: { matchedCount: 0, modifiedCount: 0 },
    deleteMany: { deletedCount: 0 },
    ...overrides,
  };
  const calls: Call[] = [];
  const record = (method: string, args: any[]) => calls.push({ method, args });

  // chainable query: find().sort().skip().limit().populate().select().lean() or awaited directly
  const query = (method: string, getResult: () => any) => {
    const q: any = {};
    for (const m of ["sort", "skip", "limit", "populate", "select"]) {
      q[m] = (...args: any[]) => {
        record(`${method}.${m}`, args);
        return q;
      };
    }
    q.lean = () => Promise.resolve(getResult());
    q.then = (resolve: any, reject: any) => Promise.resolve(getResult()).then(resolve, reject);
    return q;
  };

  const model: any = {
    schema,
    find: (...args: any[]) => {
      record("find", args);
      return query("find", () => results.find);
    },
    findById: (...args: any[]) => {
      record("findById", args);
      return query("findById", () => results.findById);
    },
    findOne: (...args: any[]) => {
      record("findOne", args);
      return query("findOne", () => results.findOne);
    },
    findOneAndUpdate: async (...args: any[]) => {
      record("findOneAndUpdate", args);
      return results.findOneAndUpdate;
    },
    findOneAndDelete: async (...args: any[]) => {
      record("findOneAndDelete", args);
      return results.findOneAndDelete;
    },
    // model.db.model(ref) for reference search
    db: {
      model: (refName: string) => {
        if (!refModels[refName]) throw new Error(`Schema hasn't been registered for model "${refName}"`);
        return refModels[refName];
      },
    },
    countDocuments: async (...args: any[]) => {
      record("countDocuments", args);
      return results.countDocuments;
    },
    create: async (...args: any[]) => {
      record("create", args);
      return results.create ?? args[0];
    },
    findByIdAndUpdate: async (...args: any[]) => {
      record("findByIdAndUpdate", args);
      return results.findByIdAndUpdate;
    },
    findByIdAndDelete: async (...args: any[]) => {
      record("findByIdAndDelete", args);
      return results.findByIdAndDelete;
    },
    updateMany: async (...args: any[]) => {
      record("updateMany", args);
      return results.updateMany;
    },
    deleteMany: async (...args: any[]) => {
      record("deleteMany", args);
      return results.deleteMany;
    },
  };

  const callsOf = (method: string) => calls.filter((c) => c.method === method);
  const dbWrites = () => calls.filter((c) => ["create", "findByIdAndUpdate", "findOneAndUpdate", "findByIdAndDelete", "findOneAndDelete", "updateMany", "deleteMany"].includes(c.method));

  return { model, results, calls, callsOf, dbWrites };
};

// shared test schema
export const createTestSchema = () =>
  new Schema(
    {
      name: String,
      email: String,
      age: Number,
      active: Boolean,
      born: Date,
      check_in: Date,
      role: String,
      tags: [String],
      owner: { type: Schema.Types.ObjectId, ref: "Owner" },
      members: [{ member: { type: Schema.Types.ObjectId, ref: "Owner" }, status: String }],
      address: new Schema({ city: String, zip: Number }, { _id: false }),
      password: { type: String, select: false },
    },
    { timestamps: true },
  );

export const VALID_ID = "507f1f77bcf86cd799439011";
export const OTHER_ID = "507f191e810c19729de860ea";
