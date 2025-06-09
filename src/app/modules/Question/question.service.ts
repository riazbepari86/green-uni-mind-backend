import httpStatus from 'http-status';
import AppError from '../../errors/AppError';
import { IQuestion } from './question.interface';
import { Question } from './question.model';
import { Student } from '../Student/student.model';
import { Lecture } from '../Lecture/lecture.model';
import { Types } from 'mongoose';

const createQuestion = async (payload: IQuestion): Promise<IQuestion> => {
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

  // Create question
  const result = await Question.create(payload);
  return result;
};

const getQuestionsByLectureAndStudent = async (
  lectureId: string,
  studentId: string,
): Promise<IQuestion[]> => {
  const questions = await Question.find({
    lectureId: new Types.ObjectId(lectureId),
    studentId: new Types.ObjectId(studentId),
  }).sort({ timestamp: 1 });

  return questions;
};

const getQuestionsByLecture = async (
  lectureId: string,
): Promise<IQuestion[]> => {
  const questions = await Question.find({
    lectureId: new Types.ObjectId(lectureId),
  })
    .populate('studentId', 'name')
    .sort({ timestamp: 1 });

  return questions;
};

const answerQuestion = async (
  id: string,
  answer: string,
  teacherId: string,
): Promise<IQuestion | null> => {
  const question = await Question.findByIdAndUpdate(
    id,
    {
      answer,
      answeredBy: new Types.ObjectId(teacherId),
      answered: true,
      answeredAt: new Date(),
    },
    { new: true },
  );

  if (!question) {
    throw new AppError(httpStatus.NOT_FOUND, 'Question not found');
  }

  return question;
};

const updateQuestion = async (
  id: string,
  payload: Partial<IQuestion>,
): Promise<IQuestion | null> => {
  const question = await Question.findByIdAndUpdate(id, payload, {
    new: true,
  });

  if (!question) {
    throw new AppError(httpStatus.NOT_FOUND, 'Question not found');
  }

  return question;
};

const deleteQuestion = async (id: string): Promise<IQuestion | null> => {
  const question = await Question.findByIdAndDelete(id);

  if (!question) {
    throw new AppError(httpStatus.NOT_FOUND, 'Question not found');
  }

  return question;
};

export const QuestionService = {
  createQuestion,
  getQuestionsByLectureAndStudent,
  getQuestionsByLecture,
  answerQuestion,
  updateQuestion,
  deleteQuestion,
};
