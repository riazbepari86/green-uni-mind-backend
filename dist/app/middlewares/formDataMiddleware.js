"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.formDataMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
// Create a multer instance with memory storage
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
// Create a middleware function that doesn't use the user property
const parseFormData = (req, res, next) => {
    upload.none()(req, res, (err) => {
        if (err) {
            console.error('Error parsing form data:', err);
            return res.status(400).json({
                success: false,
                message: 'Error parsing form data',
                error: err.message
            });
        }
        console.log('Form data parsed successfully:', req.body);
        next();
    });
};
// Middleware to handle form data
const formDataMiddleware = (req, res, next) => {
    var _a;
    // Only apply to the OAuth link route
    if (req.originalUrl.includes('/oauth/link') && req.method === 'POST') {
        console.log('==== FORM DATA MIDDLEWARE ====');
        console.log('Content-Type:', req.headers['content-type']);
        // Check if the request is multipart/form-data
        if ((_a = req.headers['content-type']) === null || _a === void 0 ? void 0 : _a.includes('multipart/form-data')) {
            console.log('Detected multipart/form-data request, using multer');
            // Use our separate middleware function to parse the form data
            parseFormData(req, res, next);
        }
        else {
            console.log('Not a multipart/form-data request, skipping multer');
            next();
        }
    }
    else {
        next();
    }
};
exports.formDataMiddleware = formDataMiddleware;
