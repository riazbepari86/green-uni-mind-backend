import { NextFunction, Request, Response } from 'express';

export const parseDataMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (req.body.data) {
      req.body = JSON.parse(req.body.data);
    }
    
    
    next();
  } catch (error) {
    console.error('Error parsing request data:', error);
    next(error);
  }
};
