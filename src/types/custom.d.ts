import { JwtUserPayload } from '../app/interface/auth';

declare global {
  namespace Express {
    interface Request {
      user?: JwtUserPayload;
    }
  }
}
