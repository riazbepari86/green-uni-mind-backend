import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { NoteService } from './note.service';
import httpStatus from 'http-status';

const createOrUpdateNote = catchAsync(async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const noteData = { ...req.body, studentId };

  const result = await NoteService.createOrUpdateNote(noteData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Note saved successfully',
    data: result,
  });
});

const getNoteByLectureAndStudent = catchAsync(
  async (req: Request, res: Response) => {
    const { lectureId, studentId } = req.params;

    const result = await NoteService.getNoteByLectureAndStudent(
      lectureId,
      studentId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Note retrieved successfully',
      data: result,
    });
  },
);

const deleteNote = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await NoteService.deleteNote(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Note deleted successfully',
    data: result,
  });
});

const getSharedNotes = catchAsync(async (req: Request, res: Response) => {
  const { lectureId } = req.params;

  const result = await NoteService.getSharedNotes(lectureId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Shared notes retrieved successfully',
    data: result,
  });
});

const shareNote = catchAsync(async (req: Request, res: Response) => {
  const { noteId } = req.params;
  const { studentIds } = req.body;

  const result = await NoteService.shareNote(noteId, studentIds);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Note shared successfully',
    data: result,
  });
});

export const NoteController = {
  createOrUpdateNote,
  getNoteByLectureAndStudent,
  deleteNote,
  getSharedNotes,
  shareNote,
};
