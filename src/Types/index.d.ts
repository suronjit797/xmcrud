import "express";

declare global {
  namespace Express {
    interface Request {
      partialFilter: string[]
    }
  }
}
