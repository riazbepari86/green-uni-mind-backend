"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteValidation = void 0;
const zod_1 = require("zod");
const createOrUpdateNoteZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        content: zod_1.z.string({
            required_error: 'Note content is required',
        }),
        lectureId: zod_1.z.string({
            required_error: 'Lecture ID is required',
        }),
        isShared: zod_1.z.boolean().optional(),
        isRichText: zod_1.z.boolean().optional(),
        tags: zod_1.z.array(zod_1.z.string()).optional(),
    }),
});
const shareNoteZodSchema = zod_1.z.object({
    body: zod_1.z.object({
        studentIds: zod_1.z.array(zod_1.z.string(), {
            required_error: 'Student IDs are required',
        }),
    }),
});
exports.NoteValidation = {
    createOrUpdateNoteZodSchema,
    shareNoteZodSchema,
};
