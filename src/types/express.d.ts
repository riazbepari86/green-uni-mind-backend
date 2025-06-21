/**
 * Express type extensions
 * Centralized type definitions for Express Request interface
 */

import { JwtUserPayload } from '../app/interface/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
      sessionId?: string;
      tokenId?: string;
      startTime?: number;
      requestId?: string;
      rawBody?: string;
      oauthState?: string;
      sessionData?: any;
      accessToken?: string;
      session?: {
        oauthState?: string;
        [key: string]: any;
      };
    }
  }
}

// Override the User type to prevent conflicts with Mongoose User model
declare module 'express-serve-static-core' {
  interface Request {
    user?: JwtUserPayload;
  }
}

// Re-export for convenience
export { JwtUserPayload } from '../app/interface/auth';
