
const TestController = (req, res, next) => {
    try {
        console.log("test");
    } catch (error) {
        next(error);
    }
};

export const {{name}}Controller = {TestController};
