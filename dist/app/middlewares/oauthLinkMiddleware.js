"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthLinkMiddleware = void 0;
const oauthLinkMiddleware = (req, res, next) => {
    // Only apply to the OAuth link route
    if (req.originalUrl.includes('/oauth/link') && req.method === 'POST') {
        console.log('==== OAUTH LINK MIDDLEWARE ====');
        // Check if the body is empty or undefined
        if (!req.body || Object.keys(req.body).length === 0) {
            console.log('Request body is empty or undefined, trying to parse from raw body');
            // Try to get the raw body from the request
            const rawBody = req.rawBody;
            if (rawBody) {
                try {
                    // Try to parse the raw body as JSON
                    const parsedBody = JSON.parse(rawBody);
                    console.log('Successfully parsed raw body:', parsedBody);
                    // Set the parsed body as the request body
                    req.body = parsedBody;
                }
                catch (e) {
                    console.error('Failed to parse raw body as JSON:', e);
                }
            }
        }
        // Log the final request body
        console.log('Final request body:', req.body);
        console.log('==== END OAUTH LINK MIDDLEWARE ====');
    }
    next();
};
exports.oauthLinkMiddleware = oauthLinkMiddleware;
