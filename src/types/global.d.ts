// This file contains global type declarations for Node.js globals
// to prevent TypeScript errors when using process.env and process.cwd()

declare const process: {
  env: {
    [key: string]: string | undefined;
    NODE_ENV?: string;
    PORT?: string;
    DATABASE_URL?: string;
    BCRYPT_SALT_ROUNDS?: string;
    CLOUDINARY_CLOUD_NAME?: string;
    CLOUDINARY_API_KEY?: string;
    CLOUDINARY_API_SECRET?: string;
    JWT_ACCESS_SECRET?: string;
    JWT_REFRESH_SECRET?: string;
    JWT_ACCESS_EXPIRES_IN?: string;
    JWT_REFRESH_EXPIRES_IN?: string;
    RESET_PASS_UI_LINK?: string;
    SUPER_ADMIN_PASSWORD?: string;
    INVITE_TEACHER_LINK?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
    MOTHER_STRIPE_ACCOUNT_ID?: string;
    FRONTEND_URL?: string;
  };
  cwd(): string;
  on(event: string, listener: (...args: any[]) => void): any;
  exit(code?: number): never;
};
