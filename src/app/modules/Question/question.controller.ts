import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { QuestionService } from './question.service';
import httpStatus from 'http-status';

const createQuestion = catchAsync(async (req: Request, res: Response) => {
  const { studentId } = req.params;
  const questionData = { ...req.body, studentId };

  const result = await QuestionService.createQuestion(questionData);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Question created successfully',
    data: result,
  });
});

const getQuestionsByLectureAndStudent = catchAsync(
  async (req: Request, res: Response) => {
    const { lectureId, studentId } = req.params;

    const result = await QuestionService.getQuestionsByLectureAndStudent(
      lectureId,
      studentId,
    );

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: 'Questions retrieved successfully',
      data: result,
    });
  },
);

const getQuestionsByLecture = catchAsync(async (req: Request, res: Response) => {
  const { lectureId } = req.params;

  const result = await QuestionService.getQuestionsByLecture(lectureId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Questions retrieved successfully',
    data: result,
  });
});

const answerQuestion = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { answer } = req.body;
  const teacherId = req.user?.id;

  if (!teacherId) {
    throw new Error('Teacher ID not found');
  }

  const result = await QuestionService.answerQuestion(id, answer, teacherId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Question answered successfully',
    data: result,
  });
});

const updateQuestion = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await QuestionService.updateQuestion(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Question updated successfully',
    data: result,
  });
});

const deleteQuestion = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await QuestionService.deleteQuestion(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Question deleted successfully',
    data: result,
  });
});

export const QuestionController = {
  createQuestion,
  getQuestionsByLectureAndStudent,
  getQuestionsByLecture,
  answerQuestion,
  updateQuestion,
  deleteQuestion,
};
