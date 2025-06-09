"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarkValidation = void 0;
const zod_1 = require("zod");
const createBookmarkZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string({
            required_error: 'Title is required',
        }),
        timestamp: zod_1.z.number({
            required_error: 'Timestamp is required',
        }),
        lectureId: zod_1.z.string({
            required_error: 'Lecture ID is required',
        }),
        isShared: zod_1.z.boolean().optional(),
        category: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        notes: zod_1.z.string().optional(),
    }),
});
const updateBookmarkZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        title: zod_1.z.string().optional(),
        timestamp: zod_1.z.number().optional(),
        isShared: zod_1.z.boolean().optional(),
        category: zod_1.z.string().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
        notes: zod_1.z.string().optional(),
    }),
});
const shareBookmarkZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        studentIds: zod_1.z.array(zod_1.z.string(), {
            required_error: 'Student IDs are required',
        }),
    }),
});
const getBookmarksByTagsZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        tags: zod_1.z.array(zod_1.z.string(), {
            required_error: 'Tags are required',
        }),
    }),
});
exports.BookmarkValidation = {
    createBookmarkZodSchema,
    updateBookmarkZodSchema,
    shareBookmarkZodSchema,
    getBookmarksByTagsZodSchema,
};
