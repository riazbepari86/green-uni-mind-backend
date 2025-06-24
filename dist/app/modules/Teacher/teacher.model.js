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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Teacher = void 0;
const mongoose_1 = require("mongoose");
const teacherNameSchema = new mongoose_1.Schema({
    firstName: {
        type: String,
        required: [true, 'First Name is required'],
        trim: true,
        maxlength: [20, 'Name can not be more than 20 characters'],
    },
    middleName: {
        type: String,
        trim: true,
    },
    lastName: {
        type: String,
        trim: true,
        required: [true, 'Last Name is required'],
        maxlength: [20, 'Name can not be more than 20 characters'],
    },
});
const stripeConnectSchema = new mongoose_1.Schema({
    accountId: {
        type: String,
        sparse: true,
    },
    email: {
        type: String,
        sparse: true,
    },
    status: {
        type: String,
        enum: ['not_connected', 'pending', 'connected', 'failed', 'disconnected', 'restricted'],
        default: 'not_connected',
    },
    onboardingComplete: {
        type: Boolean,
        default: false,
    },
    verified: {
        type: Boolean,
        default: false,
    },
    requirements: {
        type: [String],
        default: [],
    },
    capabilities: {
        card_payments: {
            type: String,
            enum: ['active', 'inactive', 'pending'],
        },
        transfers: {
            type: String,
            enum: ['active', 'inactive', 'pending'],
        },
    },
    lastStatusUpdate: {
        type: Date,
        default: Date.now,
    },
    onboardingUrl: {
        type: String,
    },
    failureReason: {
        type: String,
    },
    connectedAt: {
        type: Date,
    },
    disconnectedAt: {
        type: Date,
    },
    lastWebhookReceived: {
        type: Date,
    },
});
const stripeAuditLogSchema = new mongoose_1.Schema({
    action: {
        type: String,
        enum: ['account_created', 'onboarding_started', 'onboarding_completed', 'account_verified', 'account_disconnected', 'webhook_received', 'error_occurred'],
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    details: {
        type: mongoose_1.Schema.Types.Mixed,
    },
    ipAddress: {
        type: String,
    },
    userAgent: {
        type: String,
    },
});
const teacherSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: [true, 'User id is required'],
        unique: true,
        ref: 'User',
    },
    name: {
        type: teacherNameSchema,
        required: [true, 'Name is required'],
    },
    gender: {
        type: String,
        enum: {
            values: ['male', 'female', 'other'],
            message: '{VALUE} is not a valid gender',
        },
        required: [true, 'Gender is required'],
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: true,
    },
    profileImg: {
        type: String,
        default: '',
    },
    isDeleted: {
        type: Boolean,
        default: false,
    },
    // Legacy Stripe fields (keeping for backward compatibility)
    stripeAccountId: {
        type: String,
        unique: true,
        sparse: true,
    },
    stripeEmail: {
        type: String,
        unique: true,
        sparse: true,
    },
    stripeVerified: {
        type: Boolean,
        default: false,
    },
    stripeOnboardingComplete: {
        type: Boolean,
        default: false,
    },
    stripeRequirements: {
        type: [String],
        default: [],
    },
    // Enhanced Stripe Connect integration
    stripeConnect: {
        type: stripeConnectSchema,
        default: () => ({}),
    },
    stripeAuditLog: {
        type: [stripeAuditLogSchema],
        default: [],
    },
    earnings: {
        total: {
            type: Number,
            default: 0,
        },
        monthly: {
            type: Number,
            default: 0,
        },
        yearly: {
            type: Number,
            default: 0,
        },
        weekly: {
            type: Number,
            default: 0,
        },
    },
    totalEarnings: {
        type: Number,
        default: 0,
    },
    payments: [{
            type: mongoose_1.Schema.Types.ObjectId,
            ref: 'Payment',
        }],
    courses: {
        type: [mongoose_1.Schema.Types.ObjectId],
        ref: 'Course',
    },
    averageRating: {
        type: Number,
        default: 0,
    },
    payoutInfo: {
        availableBalance: {
            type: Number,
            default: 0,
        },
        pendingBalance: {
            type: Number,
            default: 0,
        },
        lastSyncedAt: {
            type: Date,
        },
        nextPayoutDate: {
            type: Date,
        },
        nextPayoutAmount: {
            type: Number,
            default: 0,
        },
    },
}, { timestamps: true,
    toJSON: {
        virtuals: true,
    },
});
teacherSchema.virtual('fullName').get(function () {
    var _a, _b, _c;
    return ((_a = this === null || this === void 0 ? void 0 : this.name) === null || _a === void 0 ? void 0 : _a.firstName) + ((_b = this === null || this === void 0 ? void 0 : this.name) === null || _b === void 0 ? void 0 : _b.middleName) + ((_c = this === null || this === void 0 ? void 0 : this.name) === null || _c === void 0 ? void 0 : _c.lastName);
});
// Query Middleware
teacherSchema.pre('find', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});
teacherSchema.pre('findOne', function (next) {
    this.find({ isDeleted: { $ne: true } });
    next();
});
teacherSchema.pre('aggregate', function (next) {
    this.pipeline().unshift({ $match: { isDeleted: { $ne: true } } });
    next();
});
//creating a custom static method
teacherSchema.statics.isUserExists = function (id) {
    return __awaiter(this, void 0, void 0, function* () {
        const existingUser = yield exports.Teacher.findOne({ id });
        return existingUser;
    });
};
exports.Teacher = (0, mongoose_1.model)('Teacher', teacherSchema);
