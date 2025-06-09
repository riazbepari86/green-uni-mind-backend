import { Request, Response, NextFunction } from 'express';

// Extend the Request type to include any custom properties
interface ExtendedRequest extends Request {
  [key: string]: any;
}

export const debugRequestMiddleware = (
  req: ExtendedRequest,
  _res: Response,
  next: NextFunction,
) => {
  // Only log for specific routes that are having issues
  if (req.originalUrl.includes('/oauth/link')) {
    console.log('==== DEBUG REQUEST ====');
    console.log('URL:', req.originalUrl);
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    // Log the request body
    console.log('Body type:', typeof req.body);
    if (typeof req.body === 'object') {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    } else if (typeof req.body === 'string') {
      console.log('Body (string):', req.body);
      try {
        // Try to parse it as JSON
        const parsedBody = JSON.parse(req.body);
        console.log('Parsed body:', JSON.stringify(parsedBody, null, 2));
      } catch (e) {
        console.log('Body is not valid JSON');
      }
    } else {
      console.log('Body:', req.body);
    }

    // Check for any custom raw body property
    if ('rawBody' in req) {
      console.log('Raw body available:', typeof req.rawBody);
    }

    console.log('==== END DEBUG REQUEST ====');
  }

  next();
};
