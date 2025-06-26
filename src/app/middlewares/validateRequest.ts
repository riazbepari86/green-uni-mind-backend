import { NextFunction, Request, Response, RequestHandler } from 'express';
import { AnyZodObject } from 'zod';
import catchAsync from '../utils/catchAsync';

const validateRequest = (schema: AnyZodObject): RequestHandler => {
  return catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
    await schema.parseAsync({
      body: req.body,
      cookies: req.cookies,
      params: req.params,
      query: req.query,
    });

    next();
  });
};

export default validateRequest;
