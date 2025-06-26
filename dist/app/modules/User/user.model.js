"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const mongoose_1 = require("mongoose");
const user_constant_1 = require("./user.constant");
const config_1 = __importDefault(require("../../config"));
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: function () {
            // Password is required unless it's an OAuth user
            return !this.isOAuthUser;
        },
        select: 0,
        validate: {
            validator: function (value) {
                // Skip validation if password is not provided (OAuth user)
                if (!value && this.isOAuthUser)
                    return true;
                const isValidLength = value.length >= 8 && value.length <= 20;
                const matchesPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&^_\-])/.test(value);
                return isValidLength && matchesPattern;
            },
            message: 'Password must be 8–20 characters long and include at least one letter, one number, and one special character.',
        },
    },
    passwordChangedAt: {
        type: Date,
    },
    role: {
        type: String,
        enum: user_constant_1.UserRole,
        default: 'user',
    },
    photoUrl: {
        type: String,
        default: '',
    },
    status: {
        type: String,
        enum: user_constant_1.UserStatus,
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
}, {
    timestamps: true,
});
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        const user = this; // doc
        // Skip password hashing if this is an OAuth user without a password
        // or if the password field hasn't been modified
        if ((user.isOAuthUser && !user.password) || !user.isModified('password')) {
            return next();
        }
        // hashing password before save into DB
        user.password = yield bcrypt_1.default.hash(user.password, Number(config_1.default.bcrypt_salt_rounds));
        next();
    });
});
// set '' after saving password
userSchema.post('save', function (doc, next) {
    doc.password = '';
    next();
});
// find existing user before save
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function* () {
        // Only check for duplicate email on new user creation
        if (this.isNew) {
            const existingUser = yield exports.User.findOne({ email: this.email });
            if (existingUser) {
                const error = new Error('Email already exists. Please use a different email.');
                return next(error);
            }
        }
        next();
    });
});
userSchema.statics.isUserExists = function (email) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('🔍 User.isUserExists called with email:', email);
        try {
            const user = yield exports.User.findOne({ email }).select('+password');
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
            }
            else {
                console.log('❌ No user found with email:', email);
                // Let's also check if there are any users with similar emails (case sensitivity issue)
                const similarUsers = yield exports.User.find({
                    email: { $regex: new RegExp(`^${email}$`, 'i') }
                }).select('email').limit(5);
                if (similarUsers.length > 0) {
                    console.log('🔍 Found similar emails (case-insensitive):', similarUsers.map(u => u.email));
                }
                else {
                    console.log('🔍 No similar emails found in database');
                }
            }
            return user;
        }
        catch (error) {
            console.error('❌ Error in User.isUserExists:', error);
            throw error;
        }
    });
};
userSchema.statics.isPasswordMatched = function (plainTextPassword, hashedPassword) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield bcrypt_1.default.compare(plainTextPassword, hashedPassword);
    });
};
userSchema.statics.isJWTIssuedBeforePasswordChanged = function (passwordChangedTimestamp, jwtIssuedTimestamp) {
    const passwordChangedTime = new Date(passwordChangedTimestamp).getTime() / 1000;
    return passwordChangedTime > jwtIssuedTimestamp;
};
exports.User = (0, mongoose_1.model)('User', userSchema);
