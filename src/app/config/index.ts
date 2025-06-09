import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
  cloudinary_cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  cloudinary_api_key: process.env.CLOUDINARY_API_KEY,
  cloudinary_api_secret: process.env.CLOUDINARY_API_SECRET,
  jwt_access_secret: process.env.JWT_ACCESS_SECRET!,
  jwt_refresh_secret: process.env.JWT_REFRESH_SECRET!,
  jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN!,
  jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN!,
  reset_pass_ui_link: process.env.RESET_PASS_UI_LINK,
  super_admin_password: process.env.SUPER_ADMIN_PASSWORD,
  invite_teacher_link: process.env.INVITE_TEACHER_LINK,
  stripe_secret_key: process.env.STRIPE_SECRET_KEY!,
  stripe_webhook_secret: process.env.STRIPE_WEBHOOK_SECRET!,
  stripe_mother_account_id: process.env.MOTHER_STRIPE_ACCOUNT_ID!,
  frontend_url: process.env.FRONTEND_URL || 'http://localhost:8080',
  email: {
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_SECURE === 'true',
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
  // OAuth configuration
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Use frontend callback URL instead of backend
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/google`,
      // Keep the backend callback for backward compatibility
      backendRedirectUri: '/api/v1/oauth/google/callback',
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID,
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
      // Use frontend callback URL instead of backend
      redirectUri: process.env.FACEBOOK_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/facebook`,
      // Keep the backend callback for backward compatibility
      backendRedirectUri: '/api/v1/oauth/facebook/callback',
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKeyLocation: process.env.APPLE_PRIVATE_KEY_LOCATION,
      privateKeyContent: process.env.APPLE_PRIVATE_KEY_CONTENT,
      // Use frontend callback URL instead of backend
      redirectUri: process.env.APPLE_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:8080'}/oauth/callback/apple`,
      // Keep the backend callback for backward compatibility
      backendRedirectUri: '/api/v1/oauth/apple/callback',
    },
  },
};
