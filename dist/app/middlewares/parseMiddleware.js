"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDataMiddleware = void 0;
const parseDataMiddleware = (req, res, next) => {
    try {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        next();
    }
    catch (error) {
        console.error('Error parsing request data:', error);
        next(error);
    }
};
exports.parseDataMiddleware = parseDataMiddleware;
