import { Schema, model } from "mongoose";
import type { I{{ModelName}} } from "./{{name}}.interface";


const {{ModelName}}Schema: Schema = new Schema<I{{ModelName}}>(
  {
    // mongoose schema
  },
  { timestamps: true },
);

const {{ModelName}}Model = model<I{{ModelName}}>("{{ModelName}}", {{ModelName}}Schema);

export default {{ModelName}}Model;
