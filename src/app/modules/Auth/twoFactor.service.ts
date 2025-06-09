import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { User } from '../User/user.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';
import bcrypt from 'bcrypt';
import config from '../../config';
import { TwoFactorSetupPayload } from '../../interface/auth';

/**
 * Generate a new TOTP secret for a user
 * @param userId The user ID
 * @returns The secret and QR code URL
 */
const setupTwoFactor = async (userId: string): Promise<TwoFactorSetupPayload> => {
  // Find the user
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  try {
    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name: `GreenUniMind:${user.email}`,
      issuer: 'GreenUniMind',
      length: 20
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url || '');

    // Store the secret temporarily in the user document
    // This will be confirmed and enabled when the user verifies the code
    user.twoFactorSecret = secret.base32;
    await user.save();

    return {
      secret: secret.base32,
      otpAuthUrl: secret.otpauth_url || '',
      qrCodeUrl,
    };
  } catch (error) {
    console.error('Error setting up 2FA:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to setup two-factor authentication');
  }
};

/**
 * Verify a TOTP token and enable 2FA for a user
 * @param token The TOTP token
 * @param userId The user ID
 * @param secret The TOTP secret
 * @returns Success message
 */
const verifyAndEnableTwoFactor = async (
  token: string,
  userId: string,
  secret: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if the secret matches what's stored in the user document
    if (user.twoFactorSecret !== secret) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid secret. Please restart the setup process.');
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2, // Allow 2 steps before and after for clock drift (more forgiving)
    });

    if (!verified) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid verification code. Please try again.');
    }

    // Enable 2FA
    user.twoFactorEnabled = true;

    // Generate backup codes
    const backupCodes = Array(8)
      .fill(0)
      .map(() => Math.random().toString(36).substring(2, 8).toUpperCase());

    user.twoFactorBackupCodes = backupCodes;

    await user.save();

    return {
      success: true,
      message: 'Two-factor authentication enabled successfully',
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error verifying 2FA setup:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to verify two-factor authentication');
  }
};

/**
 * Verify a TOTP token during login
 * @param token The TOTP token
 * @param userId The user ID
 * @returns Whether the token is valid
 */
const verifyTwoFactorToken = async (
  token: string,
  userId: string,
): Promise<boolean> => {
  // Find the user with 2FA secret
  const user = await User.findById(userId).select('+twoFactorSecret');
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, 'User not found');
  }

  if (!user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Two-factor authentication is not enabled for this user',
    );
  }

  // Verify the token
  const verified = speakeasy.totp.verify({
    secret: user.twoFactorSecret,
    encoding: 'base32',
    token,
    window: 1, // Allow 1 step before and after for clock drift
  });

  return verified;
};

/**
 * Disable 2FA for a user
 * @param userId The user ID
 * @param password The user's password for verification
 * @returns Success message
 */
const disableTwoFactor = async (
  userId: string,
  password: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    // Find the user with password
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, 'User not found');
    }

    // Check if 2FA is enabled
    if (!user.twoFactorEnabled) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Two-factor authentication is not enabled for this user');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError(httpStatus.UNAUTHORIZED, 'Invalid password. Please enter your correct password to disable 2FA.');
    }

    // Disable 2FA
    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorBackupCodes = undefined;

    await user.save();

    return {
      success: true,
      message: 'Two-factor authentication disabled successfully',
    };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    console.error('Error disabling 2FA:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to disable two-factor authentication');
  }
};

export const TwoFactorService = {
  setupTwoFactor,
  verifyAndEnableTwoFactor,
  verifyTwoFactorToken,
  disableTwoFactor,
};
