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
exports.NoteService = void 0;
const http_status_1 = __importDefault(require("http-status"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const note_model_1 = require("./note.model");
const student_model_1 = require("../Student/student.model");
const lecture_model_1 = require("../Lecture/lecture.model");
const mongoose_1 = require("mongoose");
const createOrUpdateNote = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if student exists
    const student = yield student_model_1.Student.findById(payload.studentId);
    if (!student) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Student not found');
    }
    // Check if lecture exists
    const lecture = yield lecture_model_1.Lecture.findById(payload.lectureId);
    if (!lecture) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Lecture not found');
    }
    // Check if note already exists for this student and lecture
    const existingNote = yield note_model_1.Note.findOne({
        lectureId: payload.lectureId,
        studentId: payload.studentId,
    });
    if (existingNote) {
        // Update existing note
        existingNote.content = payload.content;
        // Update sharing settings if provided
        if (payload.isShared !== undefined) {
            existingNote.isShared = payload.isShared;
        }
        if (payload.sharedWith) {
            existingNote.sharedWith = payload.sharedWith;
        }
        if (payload.isRichText !== undefined) {
            existingNote.isRichText = payload.isRichText;
        }
        if (payload.tags) {
            existingNote.tags = payload.tags;
        }
        yield existingNote.save();
        return existingNote;
    }
    // Create new note
    const result = yield note_model_1.Note.create(payload);
    return result;
});
const getNoteByLectureAndStudent = (lectureId, studentId) => __awaiter(void 0, void 0, void 0, function* () {
    const note = yield note_model_1.Note.findOne({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
        studentId: new mongoose_1.Types.ObjectId(studentId),
    });
    return note;
});
const deleteNote = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const note = yield note_model_1.Note.findByIdAndDelete(id);
    if (!note) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Note not found');
    }
    return note;
});
const getSharedNotes = (lectureId) => __awaiter(void 0, void 0, void 0, function* () {
    const notes = yield note_model_1.Note.find({
        lectureId: new mongoose_1.Types.ObjectId(lectureId),
        isShared: true,
    }).populate('studentId', 'name email');
    return notes;
});
const shareNote = (noteId, studentIds) => __awaiter(void 0, void 0, void 0, function* () {
    const note = yield note_model_1.Note.findById(noteId);
    if (!note) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Note not found');
    }
    // Convert string IDs to ObjectIds
    const studentObjectIds = studentIds.map(id => new mongoose_1.Types.ObjectId(id));
    // Set note as shared and add students to sharedWith array
    note.isShared = true;
    note.sharedWith = studentObjectIds;
    yield note.save();
    return note;
});
exports.NoteService = {
    createOrUpdateNote,
    getNoteByLectureAndStudent,
    deleteNote,
    getSharedNotes,
    shareNote,
};
