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
exports.NoteController = void 0;
const catchAsync_1 = __importDefault(require("../../utils/catchAsync"));
const sendResponse_1 = __importDefault(require("../../utils/sendResponse"));
const note_service_1 = require("./note.service");
const http_status_1 = __importDefault(require("http-status"));
const createOrUpdateNote = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { studentId } = req.params;
    const noteData = Object.assign(Object.assign({}, req.body), { studentId });
    const result = yield note_service_1.NoteService.createOrUpdateNote(noteData);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Note saved successfully',
        data: result,
    });
}));
const getNoteByLectureAndStudent = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId, studentId } = req.params;
    const result = yield note_service_1.NoteService.getNoteByLectureAndStudent(lectureId, studentId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Note retrieved successfully',
        data: result,
    });
}));
const deleteNote = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { id } = req.params;
    const result = yield note_service_1.NoteService.deleteNote(id);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Note deleted successfully',
        data: result,
    });
}));
const getSharedNotes = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { lectureId } = req.params;
    const result = yield note_service_1.NoteService.getSharedNotes(lectureId);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Shared notes retrieved successfully',
        data: result,
    });
}));
const shareNote = (0, catchAsync_1.default)((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { noteId } = req.params;
    const { studentIds } = req.body;
    const result = yield note_service_1.NoteService.shareNote(noteId, studentIds);
    (0, sendResponse_1.default)(res, {
        statusCode: http_status_1.default.OK,
        success: true,
        message: 'Note shared successfully',
        data: result,
    });
}));
exports.NoteController = {
    createOrUpdateNote,
    getNoteByLectureAndStudent,
    deleteNote,
    getSharedNotes,
    shareNote,
};
