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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
var bcrypt_1 = __importDefault(require("bcrypt"));
var mongoose_1 = require("mongoose");
var user_constant_1 = require("./user.constant");
var config_1 = __importDefault(require("../../config"));
var userSchema = new mongoose_1.Schema({
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
                var isValidLength = value.length >= 8 && value.length <= 20;
                var matchesPattern = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&^_\-])/.test(value);
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
}, {
    timestamps: true,
});
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function () {
        var user, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    user = this;
                    // Skip password hashing if this is an OAuth user without a password
                    // or if the password field hasn't been modified
                    if ((user.isOAuthUser && !user.password) || !user.isModified('password')) {
                        return [2 /*return*/, next()];
                    }
                    // hashing password before save into DB
                    _a = user;
                    return [4 /*yield*/, bcrypt_1.default.hash(user.password, Number(config_1.default.bcrypt_salt_rounds))];
                case 1:
                    // hashing password before save into DB
                    _a.password = _b.sent();
                    next();
                    return [2 /*return*/];
            }
        });
    });
});
// set '' after saving password
userSchema.post('save', function (doc, next) {
    doc.password = '';
    next();
});
// find existing user before save
userSchema.pre('save', function (next) {
    return __awaiter(this, void 0, void 0, function () {
        var existingUser, error;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!this.isNew) return [3 /*break*/, 2];
                    return [4 /*yield*/, exports.User.findOne({ email: this.email })];
                case 1:
                    existingUser = _a.sent();
                    if (existingUser) {
                        error = new Error('Email already exists. Please use a different email.');
                        return [2 /*return*/, next(error)];
                    }
                    _a.label = 2;
                case 2:
                    next();
                    return [2 /*return*/];
            }
        });
    });
});
userSchema.statics.isUserExists = function (email) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.User.findOne({ email: email }).select('+password')];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
};
userSchema.statics.isPasswordMatched = function (plainTextPassword, hashedPassword) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, bcrypt_1.default.compare(plainTextPassword, hashedPassword)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    });
};
userSchema.statics.isJWTIssuedBeforePasswordChanged = function (passwordChangedTimestamp, jwtIssuedTimestamp) {
    var passwordChangedTime = new Date(passwordChangedTimestamp).getTime() / 1000;
    return passwordChangedTime > jwtIssuedTimestamp;
};
exports.User = (0, mongoose_1.model)('User', userSchema);
