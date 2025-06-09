import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Create a multer instance with memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Create a middleware function that doesn't use the user property
const parseFormData = (req: any, res: Response, next: NextFunction) => {
  upload.none()(req, res, (err: any) => {
    if (err) {
      console.error('Error parsing form data:', err);
      return res.status(400).json({
        success: false,
        message: 'Error parsing form data',
        error: err.message
      });
    }

    console.log('Form data parsed successfully:', req.body);
    next();
  });
};

// Middleware to handle form data
export const formDataMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only apply to the OAuth link route
  if (req.originalUrl.includes('/oauth/link') && req.method === 'POST') {
    console.log('==== FORM DATA MIDDLEWARE ====');
    console.log('Content-Type:', req.headers['content-type']);

    // Check if the request is multipart/form-data
    if (req.headers['content-type']?.includes('multipart/form-data')) {
      console.log('Detected multipart/form-data request, using multer');

      // Use our separate middleware function to parse the form data
      parseFormData(req, res, next);
    } else {
      console.log('Not a multipart/form-data request, skipping multer');
      next();
    }
  } else {
    next();
  }
};
