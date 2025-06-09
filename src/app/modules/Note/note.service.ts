import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { INote } from './note.interface';
import { Note } from './note.model';
import { Student } from '../Student/student.model';
import { Lecture } from '../Lecture/lecture.model';
import { Types } from 'mongoose';

const createOrUpdateNote = async (payload: INote): Promise<INote> => {
  // Check if student exists
  const student = await Student.findById(payload.studentId);
  if (!student) {
    throw new AppError(httpStatus.NOT_FOUND, 'Student not found');
  }

  // Check if lecture exists
  const lecture = await Lecture.findById(payload.lectureId);
  if (!lecture) {
    throw new AppError(httpStatus.NOT_FOUND, 'Lecture not found');
  }

  // Check if note already exists for this student and lecture
  const existingNote = await Note.findOne({
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

    await existingNote.save();
    return existingNote;
  }

  // Create new note
  const result = await Note.create(payload);
  return result;
};

const getNoteByLectureAndStudent = async (
  lectureId: string,
  studentId: string,
): Promise<INote | null> => {
  const note = await Note.findOne({
    lectureId: new Types.ObjectId(lectureId),
    studentId: new Types.ObjectId(studentId),
  });

  return note;
};

const deleteNote = async (id: string): Promise<INote | null> => {
  const note = await Note.findByIdAndDelete(id);

  if (!note) {
    throw new AppError(httpStatus.NOT_FOUND, 'Note not found');
  }

  return note;
};

const getSharedNotes = async (lectureId: string): Promise<INote[]> => {
  const notes = await Note.find({
    lectureId: new Types.ObjectId(lectureId),
    isShared: true,
  }).populate('studentId', 'name email');

  return notes;
};

const shareNote = async (
  noteId: string,
  studentIds: string[]
): Promise<INote | null> => {
  const note = await Note.findById(noteId);

  if (!note) {
    throw new AppError(httpStatus.NOT_FOUND, 'Note not found');
  }

  // Convert string IDs to ObjectIds
  const studentObjectIds = studentIds.map(id => new Types.ObjectId(id));

  // Set note as shared and add students to sharedWith array
  note.isShared = true;
  note.sharedWith = studentObjectIds;

  await note.save();
  return note;
};

export const NoteService = {
  createOrUpdateNote,
  getNoteByLectureAndStudent,
  deleteNote,
  getSharedNotes,
  shareNote,
};
