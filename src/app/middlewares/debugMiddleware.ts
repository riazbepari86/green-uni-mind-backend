import { Request, Response, NextFunction } from 'express';
import { debugOnly } from '../utils/console-replacement';
import config from '../config';

// Extend the Request type to include any custom properties
interface ExtendedRequest extends Request {
  [key: string]: any;
}

export const debugRequestMiddleware = (
  req: ExtendedRequest,
  _res: Response,
  next: NextFunction,
) => {
  // Only enable debug logging in development environment
  if (config.NODE_ENV !== 'development') {
    next();
    return;
  }

  // Only log for specific routes that are having issues
  if (req.originalUrl.includes('/oauth/link')) {
    debugOnly.log('==== DEBUG REQUEST ====');
    debugOnly.log('URL:', req.originalUrl);
    debugOnly.log('Method:', req.method);

    // Sanitize headers - remove sensitive information
    const sanitizedHeaders = { ...req.headers };
    delete sanitizedHeaders.authorization;
    delete sanitizedHeaders.cookie;
    delete sanitizedHeaders['x-api-key'];

    debugOnly.log('Headers:', JSON.stringify(sanitizedHeaders, null, 2));

    // Log the request body (sanitized)
    debugOnly.log('Body type:', typeof req.body);
    if (typeof req.body === 'object') {
      // Create a sanitized copy of the body
      const sanitizedBody = sanitizeRequestBody(req.body);
      debugOnly.log('Body:', JSON.stringify(sanitizedBody, null, 2));
    } else if (typeof req.body === 'string') {
      debugOnly.log('Body (string length):', req.body.length);
      try {
        // Try to parse it as JSON and sanitize
        const parsedBody = JSON.parse(req.body);
        const sanitizedBody = sanitizeRequestBody(parsedBody);
        debugOnly.log('Parsed body:', JSON.stringify(sanitizedBody, null, 2));
      } catch (e) {
        debugOnly.log('Body is not valid JSON');
      }
    } else {
      debugOnly.log('Body type:', typeof req.body);
    }

    // Check for any custom raw body property
    if ('rawBody' in req) {
      debugOnly.log('Raw body available:', typeof req.rawBody);
    }

    debugOnly.log('==== END DEBUG REQUEST ====');
  }

  next();
};

// Helper function to sanitize request body
function sanitizeRequestBody(body: any): any {
  if (typeof body !== 'object' || body === null) {
    return body;
  }

  const sensitiveFields = ['password', 'token', 'secret', 'key', 'otp', 'pin'];
  const sanitized: any = Array.isArray(body) ? [] : {};

  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeRequestBody(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
