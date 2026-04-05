import { Schema, model } from "mongoose";

const {{ModelName}}Schema = new Schema(
  {
    // mongoose schema
  },
  { timestamps: true },
);

const {{ModelName}}Model = model("{{ModelName}}", {{ModelName}}Schema);

export default {{ModelName}}Model;
