import { z } from 'zod';

const createQuestionZodSchema = z.object({
  body: z.object({
    question: z.string({
      required_error: 'Question text is required',
    }),
    timestamp: z.number({
      required_error: 'Timestamp is required',
    }),
    lectureId: z.string({
      required_error: 'Lecture ID is required',
    }),
  }),
});

const updateQuestionZodSchema = z.object({
  body: z.object({
    question: z.string().optional(),
    timestamp: z.number().optional(),
  }),
});

const answerQuestionZodSchema = z.object({
  body: z.object({
    answer: z.string({
      required_error: 'Answer is required',
    }),
  }),
});

export const QuestionValidation = {
  createQuestionZodSchema,
  updateQuestionZodSchema,
  answerQuestionZodSchema,
};
