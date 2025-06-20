"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.debugRequestMiddleware = void 0;
const console_replacement_1 = require("../utils/console-replacement");
const config_1 = __importDefault(require("../config"));
const debugRequestMiddleware = (req, _res, next) => {
    // Only enable debug logging in development environment
    if (config_1.default.NODE_ENV !== 'development') {
        next();
        return;
    }
    // Only log for specific routes that are having issues
    if (req.originalUrl.includes('/oauth/link')) {
        console_replacement_1.debugOnly.log('==== DEBUG REQUEST ====');
        console_replacement_1.debugOnly.log('URL:', req.originalUrl);
        console_replacement_1.debugOnly.log('Method:', req.method);
        // Sanitize headers - remove sensitive information
        const sanitizedHeaders = Object.assign({}, req.headers);
        delete sanitizedHeaders.authorization;
        delete sanitizedHeaders.cookie;
        delete sanitizedHeaders['x-api-key'];
        console_replacement_1.debugOnly.log('Headers:', JSON.stringify(sanitizedHeaders, null, 2));
        // Log the request body (sanitized)
        console_replacement_1.debugOnly.log('Body type:', typeof req.body);
        if (typeof req.body === 'object') {
            // Create a sanitized copy of the body
            const sanitizedBody = sanitizeRequestBody(req.body);
            console_replacement_1.debugOnly.log('Body:', JSON.stringify(sanitizedBody, null, 2));
        }
        else if (typeof req.body === 'string') {
            console_replacement_1.debugOnly.log('Body (string length):', req.body.length);
            try {
                // Try to parse it as JSON and sanitize
                const parsedBody = JSON.parse(req.body);
                const sanitizedBody = sanitizeRequestBody(parsedBody);
                console_replacement_1.debugOnly.log('Parsed body:', JSON.stringify(sanitizedBody, null, 2));
            }
            catch (e) {
                console_replacement_1.debugOnly.log('Body is not valid JSON');
            }
        }
        else {
            console_replacement_1.debugOnly.log('Body type:', typeof req.body);
        }
        // Check for any custom raw body property
        if ('rawBody' in req) {
            console_replacement_1.debugOnly.log('Raw body available:', typeof req.rawBody);
        }
        console_replacement_1.debugOnly.log('==== END DEBUG REQUEST ====');
    }
    next();
};
exports.debugRequestMiddleware = debugRequestMiddleware;
// Helper function to sanitize request body
function sanitizeRequestBody(body) {
    if (typeof body !== 'object' || body === null) {
        return body;
    }
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'otp', 'pin'];
    const sanitized = Array.isArray(body) ? [] : {};
    for (const [key, value] of Object.entries(body)) {
        const lowerKey = (key === null || key === void 0 ? void 0 : key.toLowerCase()) || '';
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            sanitized[key] = sanitizeRequestBody(value);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
