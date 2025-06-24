"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDataMiddleware = void 0;
const parseDataMiddleware = (req, res, next) => {
    try {
        if (req.body.data) {
            req.body = JSON.parse(req.body.data);
        }
        // Parse JSON stringified fields from FormData
        const fieldsToParseAsJSON = [
            'learningObjectives',
            'hasSubtitles',
            'hasCertificate',
            'isPublished'
        ];
        fieldsToParseAsJSON.forEach(field => {
            if (req.body[field] && typeof req.body[field] === 'string') {
                try {
                    req.body[field] = JSON.parse(req.body[field]);
                }
                catch (parseError) {
                    console.warn(`Failed to parse ${field} as JSON:`, parseError);
                    // Keep the original value if parsing fails
                }
            }
        });
        next();
    }
    catch (error) {
        console.error('Error parsing request data:', error);
        next(error);
    }
};
exports.parseDataMiddleware = parseDataMiddleware;
