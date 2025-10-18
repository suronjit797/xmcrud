/* 
if use  zod validation

import { z } from "zod";

const bodySchema = z.object({});

export const {{name}}CreateZodSchema = z.object({
  body: bodySchema,
});

export const {{name}}UpdateZodSchema = z.object({
  body: bodySchema.partial(),
});

 */
