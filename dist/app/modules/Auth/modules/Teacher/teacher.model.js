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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Teacher = void 0;
var mongoose_1 = require("mongoose");
var teacherNameSchema = new mongoose_1.Schema({
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
var teacherSchema = new mongoose_1.Schema({
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
    return __awaiter(this, void 0, void 0, function () {
        var existingUser;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, exports.Teacher.findOne({ id: id })];
                case 1:
                    existingUser = _a.sent();
                    return [2 /*return*/, existingUser];
            }
        });
    });
};
exports.Teacher = (0, mongoose_1.model)('Teacher', teacherSchema);
