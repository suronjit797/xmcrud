import { RequestHandler } from "express";

const TestController: RequestHandler = (req, res, next) => {
    try {
        console.log("test");
    } catch (error) {
        next(error);
    }
};

export const {{name}}Controller = {TestController};
