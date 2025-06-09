"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuestionValidation = void 0;
const zod_1 = require("zod");
const createQuestionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z.string({
            required_error: 'Question text is required',
        }),
        timestamp: zod_1.z.number({
            required_error: 'Timestamp is required',
        }),
        lectureId: zod_1.z.string({
            required_error: 'Lecture ID is required',
        }),
    }),
});
const updateQuestionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        question: zod_1.z.string().optional(),
        timestamp: zod_1.z.number().optional(),
    }),
});
const answerQuestionZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        answer: zod_1.z.string({
            required_error: 'Answer is required',
        }),
    }),
});
exports.QuestionValidation = {
    createQuestionZodSchema,
    updateQuestionZodSchema,
    answerQuestionZodSchema,
};
