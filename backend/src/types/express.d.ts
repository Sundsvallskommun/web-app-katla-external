import { User } from '@interfaces/users.interface';

declare module 'express-serve-static-core' {
  export interface Request {
    // The Record union keeps passport-saml's RequestWithUser (user: Record<string, unknown>)
    // compatible with Express Request; our own handlers use RequestWithUser with user: User.
    user?: User | Record<string, unknown>;
  }
}
