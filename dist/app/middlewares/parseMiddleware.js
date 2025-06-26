"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDataMiddleware = void 0;
const parseDataMiddleware = (req, res, next) => {
    try {
        console.log('🔍 parseDataMiddleware - Original req.body:', JSON.stringify(req.body, null, 2));
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
                console.log(`🔧 Parsing ${field}: "${req.body[field]}" (type: ${typeof req.body[field]})`);
                try {
                    const parsed = JSON.parse(req.body[field]);
                    req.body[field] = parsed;
                    console.log(`✅ Successfully parsed ${field}:`, parsed, `(type: ${typeof parsed})`);
                }
                catch (parseError) {
                    console.warn(`❌ Failed to parse ${field} as JSON:`, parseError);
                    // Keep the original value if parsing fails
                }
            }
            else {
                console.log(`⏭️  Skipping ${field}: value="${req.body[field]}", type="${typeof req.body[field]}"`);
            }
        });
        console.log('🔍 parseDataMiddleware - Final req.body:', JSON.stringify(req.body, null, 2));
        next();
    }
    catch (error) {
        console.error('Error parsing request data:', error);
        next(error);
    }
};
exports.parseDataMiddleware = parseDataMiddleware;
