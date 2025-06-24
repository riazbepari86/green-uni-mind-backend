"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const config_1 = __importDefault(require("../config"));
const AppError_1 = __importDefault(require("../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const category_model_1 = require("../modules/Category/category.model");
const subCategory_model_1 = require("../modules/SubCategory/subCategory.model");
class AIService {
    constructor() {
        if (!config_1.default.gemini_api_key) {
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Gemini API key not configured');
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(config_1.default.gemini_api_key);
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    enhanceTitle(originalTitle) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const variations = [
                    'Complete', 'Master', 'Learn', 'Build', 'Create', 'Develop', 'Advanced', 'Professional', 'Ultimate', 'Essential'
                ];
                const randomVariation = variations[Math.floor(Math.random() * variations.length)];
                const prompt = `
        You are an expert course title optimizer for premium online learning platforms.

        Original title: "${originalTitle}"
        Suggested enhancement word: "${randomVariation}"

        Create ONE improved, professional course title that:
        - Is compelling and action-oriented
        - Uses power words that drive enrollment
        - Includes relevant technical keywords for discoverability
        - Appeals to ambitious learners seeking career advancement
        - Is between 45-65 characters for optimal display
        - Maintains the core subject while adding value proposition
        - Avoids generic phrases like "Introduction to" or "Basics of"
        - Incorporates modern industry terminology

        Examples of good titles:
        - "Master React Development: Build Production-Ready Apps"
        - "Complete Python Bootcamp: From Zero to Data Scientist"
        - "Advanced JavaScript: Modern ES6+ & Async Programming"

        Return ONLY the enhanced title, no quotes, no explanations.
      `;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                return response.text().trim().replace(/^["']|["']$/g, '');
            }
            catch (error) {
                console.error('AI title enhancement error:', error);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to enhance title');
            }
        });
    }
    enhanceSubtitle(title, originalSubtitle) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const benefitWords = [
                    'master', 'build', 'create', 'develop', 'launch', 'deploy', 'optimize', 'scale', 'implement', 'design'
                ];
                const outcomeWords = [
                    'real-world projects', 'production-ready skills', 'industry standards', 'best practices',
                    'professional portfolio', 'career advancement', 'practical experience', 'hands-on learning'
                ];
                const randomBenefit = benefitWords[Math.floor(Math.random() * benefitWords.length)];
                const randomOutcome = outcomeWords[Math.floor(Math.random() * outcomeWords.length)];
                const prompt = `
        You are an expert course marketing copywriter for premium online education platforms.

        Course title: "${title}"
        ${originalSubtitle ? `Current subtitle: "${originalSubtitle}"` : ''}
        Suggested action word: "${randomBenefit}"
        Suggested outcome: "${randomOutcome}"

        Create ONE compelling course subtitle that:
        - Clearly states what students will achieve or build
        - Uses specific, measurable outcomes (not vague promises)
        - Is 70-130 characters for optimal engagement
        - Targets professionals seeking skill advancement
        - Includes relevant technologies or methodologies
        - Emphasizes practical, applicable knowledge
        - Avoids overused phrases like "step by step" or "from scratch"
        - Focuses on career impact and real-world application

        Examples of effective subtitles:
        - "Build 5 Production Apps with Modern React, TypeScript & Next.js"
        - "Master Data Analysis with Python, Pandas & Machine Learning"
        - "Create Scalable APIs using Node.js, Express & MongoDB"

        Return ONLY the subtitle, no quotes, no explanations.
      `;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                return response.text().trim().replace(/^["']|["']$/g, '');
            }
            catch (error) {
                console.error('AI subtitle enhancement error:', error);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to enhance subtitle');
            }
        });
    }
    enhanceDescription(title, subtitle, originalDescription) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = `
        You are an expert course marketing copywriter for premium online education platforms.

        Course title: "${title}"
        ${subtitle ? `Subtitle: "${subtitle}"` : ''}
        ${originalDescription ? `Current description: "${originalDescription}"` : ''}

        Create a compelling, conversion-focused course description that:

        STRUCTURE:
        1. Opening hook (1-2 sentences about the opportunity/problem)
        2. What you'll build/achieve (specific projects or outcomes)
        3. Key learning outcomes (4-6 bullet points with specific skills)
        4. Who this course is for (target audience)
        5. Prerequisites (if any)
        6. Why this matters for career growth

        REQUIREMENTS:
        - 250-450 words total
        - Use specific technologies, tools, and methodologies
        - Include measurable outcomes and real-world applications
        - Emphasize career advancement and industry relevance
        - Use active voice and action-oriented language
        - Avoid generic phrases and focus on unique value
        - Include social proof elements when relevant

        TONE: Professional, confident, results-focused

        Return only the description with proper formatting and bullet points.
      `;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                return response.text().trim();
            }
            catch (error) {
                console.error('AI description enhancement error:', error);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to enhance description');
            }
        });
    }
    suggestCategory(title, description) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const categories = yield category_model_1.Category.find({ isActive: true }).select('_id name slug');
                const subcategories = yield subCategory_model_1.SubCategory.find({ isActive: true })
                    .populate('categoryId', 'name slug')
                    .select('_id categoryId name slug');
                const categoryList = categories.map(cat => `${cat.name} (${cat.slug})`).join(', ');
                const subcategoryList = subcategories.map(sub => `${sub.name} (${sub.slug}) - under ${sub.categoryId.name}`).join(', ');
                const prompt = `
        You are an expert course categorization system for an online learning platform.
        
        Course title: "${title}"
        ${description ? `Description: "${description}"` : ''}
        
        Available categories: ${categoryList}
        
        Available subcategories: ${subcategoryList}
        
        Analyze the course content and suggest the most appropriate category and subcategory.
        Consider the subject matter, target audience, and learning objectives.
        
        Respond in this exact JSON format:
        {
          "categorySlug": "category-slug",
          "subcategorySlug": "subcategory-slug",
          "confidence": 0.95,
          "reasoning": "Brief explanation"
        }
        
        Return only valid JSON, nothing else.
      `;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                const jsonResponse = JSON.parse(response.text().trim());
                const category = categories.find(cat => cat.slug === jsonResponse.categorySlug);
                const subcategory = subcategories.find(sub => sub.slug === jsonResponse.subcategorySlug &&
                    sub.categoryId.toString() === (category === null || category === void 0 ? void 0 : category._id.toString()));
                if (!category || !subcategory) {
                    throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid category suggestion from AI');
                }
                return {
                    categoryId: category._id.toString(),
                    subcategoryId: subcategory._id.toString(),
                    confidence: jsonResponse.confidence || 0.8
                };
            }
            catch (error) {
                console.error('AI category suggestion error:', error);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to suggest category');
            }
        });
    }
    generateCourseOutline(title, description, level) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const prompt = `
        You are an expert curriculum designer for online courses.
        
        Course title: "${title}"
        ${description ? `Description: "${description}"` : ''}
        ${level ? `Level: ${level}` : ''}
        
        Create a comprehensive course outline with 8-12 main topics/modules that:
        - Follow a logical learning progression
        - Are appropriate for the specified level
        - Cover the subject comprehensively
        - Each topic is 3-8 words long
        - Are actionable and specific
        
        Return as a JSON array of strings, nothing else.
        Example: ["Introduction to Basics", "Core Concepts", "Practical Applications"]
      `;
                const result = yield this.model.generateContent(prompt);
                const response = yield result.response;
                return JSON.parse(response.text().trim());
            }
            catch (error) {
                console.error('AI course outline error:', error);
                throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to generate course outline');
            }
        });
    }
}
exports.aiService = new AIService();
