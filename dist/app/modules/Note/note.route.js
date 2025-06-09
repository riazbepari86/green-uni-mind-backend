"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoteRoutes = void 0;
const express_1 = require("express");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const validateRequest_1 = __importDefault(require("../../middlewares/validateRequest"));
const note_validation_1 = require("./note.validation");
const note_controller_1 = require("./note.controller");
const router = (0, express_1.Router)();
// Create or update a note
router.post('/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(note_validation_1.NoteValidation.createOrUpdateNoteZodSchema), note_controller_1.NoteController.createOrUpdateNote);
// Get note by lecture and student
router.get('/:lectureId/:studentId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), note_controller_1.NoteController.getNoteByLectureAndStudent);
// Delete a note
router.delete('/:id', (0, auth_1.default)(user_constant_1.USER_ROLE.student), note_controller_1.NoteController.deleteNote);
// Get shared notes for a lecture
router.get('/shared/:lectureId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), note_controller_1.NoteController.getSharedNotes);
// Share a note with other students
router.post('/share/:noteId', (0, auth_1.default)(user_constant_1.USER_ROLE.student), (0, validateRequest_1.default)(note_validation_1.NoteValidation.shareNoteZodSchema), note_controller_1.NoteController.shareNote);
exports.NoteRoutes = router;
