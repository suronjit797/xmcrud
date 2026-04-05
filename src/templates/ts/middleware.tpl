import { RequestHandler } from "express";

const TestMiddleware: RequestHandler = (req, res, next) => {
    try {
        console.log("test");
        next()
    } catch (error) {
        next(error);
    }
};

export const {{name}}Middleware = {TestMiddleware};
