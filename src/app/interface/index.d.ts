import { JwtPayload } from 'jsonwebtoken';

export interface JwtUserPayload extends JwtPayload {
  email: string;
  role: string;
}

export declare global {
  namespace Express {
    interface Request {
      user: JwtUserPayload;
    }
  }
}
