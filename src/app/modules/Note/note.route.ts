import { Router } from 'express';
import auth from '../../middlewares/auth';
import { USER_ROLE } from '../User/user.constant';
import validateRequest from '../../middlewares/validateRequest';
import { NoteValidation } from './note.validation';
import { NoteController } from './note.controller';

const router = Router();

// Create or update a note
router.post(
  '/:studentId',
  auth(USER_ROLE.student),
  validateRequest(NoteValidation.createOrUpdateNoteZodSchema),
  NoteController.createOrUpdateNote,
);

// Get note by lecture and student
router.get(
  '/:lectureId/:studentId',
  auth(USER_ROLE.student),
  NoteController.getNoteByLectureAndStudent,
);

// Delete a note
router.delete(
  '/:id',
  auth(USER_ROLE.student),
  NoteController.deleteNote,
);

// Get shared notes for a lecture
router.get(
  '/shared/:lectureId',
  auth(USER_ROLE.student),
  NoteController.getSharedNotes,
);

// Share a note with other students
router.post(
  '/share/:noteId',
  auth(USER_ROLE.student),
  validateRequest(NoteValidation.shareNoteZodSchema),
  NoteController.shareNote,
);

export const NoteRoutes = router;
