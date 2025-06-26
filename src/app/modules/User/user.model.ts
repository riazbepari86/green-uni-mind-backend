import bcrypt from 'bcrypt';
import { model, Schema } from 'mongoose';
import { IUser, UserModel } from './user.interface';
import { UserRole, UserStatus } from './user.constant';
import config from '../../config';

const userSchema = new Schema<IUser, UserModel>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: function() {
        // Password is required unless it's an OAuth user
        return !this.isOAuthUser;
      },
      select: 0,
      validate: {
        validator: function (value: string) {
          // Skip validation if password is not provided (OAuth user)
          if (!value && this.isOAuthUser) return true;

          const isValidLength = value.length >= 8 && value.length <= 20;
          const matchesPattern =
            /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&^_\-])/.test(value);
          return isValidLength && matchesPattern;
        },
        message:
          'Password must be 8–20 characters long and include at least one letter, one number, and one special character.',
      },
    },
    passwordChangedAt: {
      type: Date,
    },
    role: {
      type: String,
      enum: UserRole,
      default: 'user',
    },
    photoUrl: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: UserStatus,
      default: 'in-progress',
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // Email verification fields
    emailVerificationCode: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
    // OAuth provider fields
    googleId: {
      type: String,
      sparse: true,
    },
    facebookId: {
      type: String,
      sparse: true,
    },
    appleId: {
      type: String,
      sparse: true,
    },
    isOAuthUser: {
      type: Boolean,
      default: false,
    },
    // OAuth connection status
    connectedAccounts: {
      type: {
        google: {
          type: Boolean,
          default: false,
        },
        facebook: {
          type: Boolean,
          default: false,
        },
        apple: {
          type: Boolean,
          default: false,
        },
      },
      default: {
        google: false,
        facebook: false,
        apple: false,
      },
    },
    // Two-factor authentication fields
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: {
      type: String,
      select: 0,
    },
    twoFactorBackupCodes: {
      type: [String],
      select: 0,
    },
    twoFactorRecoveryCodes: {
      type: [String],
      select: 0,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre('save', async function (next) {
  const user = this; // doc

  // Skip password hashing if this is an OAuth user without a password
  // or if the password field hasn't been modified
  if ((user.isOAuthUser && !user.password) || !user.isModified('password')) {
    return next();
  }

  // hashing password before save into DB
  user.password = await bcrypt.hash(
    user.password,
    Number(config.bcrypt_salt_rounds),
  );

  next();
});

// set '' after saving password
userSchema.post('save', function (doc, next) {
  doc.password = '';

  next();
});

// find existing user before save
userSchema.pre('save', async function (next) {
  // Only check for duplicate email on new user creation
  if (this.isNew) {
    const existingUser = await User.findOne({ email: this.email });

    if (existingUser) {
      const error = new Error(
        'Email already exists. Please use a different email.',
      );
      return next(error);
    }
  }

  next();
});

userSchema.statics.isUserExists = async function (email: string) {
  console.log('🔍 User.isUserExists called with email:', email);

  try {
    const user = await User.findOne({ email }).select('+password');
    console.log('📊 Database query result:', user ? 'User found' : 'User not found');

    if (user) {
      console.log('👤 Found user details:', {
        id: user._id,
        email: user.email,
        role: user.role,
        status: user.status,
        isOAuthUser: user.isOAuthUser,
        isVerified: user.isVerified
      });
    } else {
      console.log('❌ No user found with email:', email);

      // Let's also check if there are any users with similar emails (case sensitivity issue)
      const similarUsers = await User.find({
        email: { $regex: new RegExp(`^${email}$`, 'i') }
      }).select('email').limit(5);

      if (similarUsers.length > 0) {
        console.log('🔍 Found similar emails (case-insensitive):',
          similarUsers.map(u => u.email));
      } else {
        console.log('🔍 No similar emails found in database');
      }
    }

    return user;
  } catch (error) {
    console.error('❌ Error in User.isUserExists:', error);
    throw error;
  }
};

userSchema.statics.isPasswordMatched = async function (
  plainTextPassword,
  hashedPassword,
) {
  return await bcrypt.compare(plainTextPassword, hashedPassword);
};

userSchema.statics.isJWTIssuedBeforePasswordChanged = function (
  passwordChangedTimestamp: Date,
  jwtIssuedTimestamp: number,
) {
  const passwordChangedTime =
    new Date(passwordChangedTimestamp).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};

export const User = model<IUser, UserModel>('User', userSchema);
