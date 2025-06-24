import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import httpStatus from 'http-status';
import { aiService } from '../../services/ai.service';

const enhanceTitle = catchAsync(async (req: Request, res: Response) => {
  const { title } = req.body;
  const result = await aiService.enhanceTitle(title);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Title enhanced successfully',
    data: { enhancedTitle: result },
  });
});

const enhanceSubtitle = catchAsync(async (req: Request, res: Response) => {
  const { title, subtitle } = req.body;
  const result = await aiService.enhanceSubtitle(title, subtitle);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subtitle enhanced successfully',
    data: { enhancedSubtitle: result },
  });
});

const enhanceDescription = catchAsync(async (req: Request, res: Response) => {
  const { title, subtitle, description } = req.body;
  const result = await aiService.enhanceDescription(title, subtitle, description);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Description enhanced successfully',
    data: { enhancedDescription: result },
  });
});

const suggestCategory = catchAsync(async (req: Request, res: Response) => {
  const { title, description } = req.body;
  const result = await aiService.suggestCategory(title, description);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Category suggested successfully',
    data: result,
  });
});

const generateCourseOutline = catchAsync(async (req: Request, res: Response) => {
  const { title, description, level } = req.body;
  const result = await aiService.generateCourseOutline(title, description, level);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Course outline generated successfully',
    data: { outline: result },
  });
});

export const AIController = {
  enhanceTitle,
  enhanceSubtitle,
  enhanceDescription,
  suggestCategory,
  generateCourseOutline,
};
