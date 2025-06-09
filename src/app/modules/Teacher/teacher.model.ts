import { model, Schema } from 'mongoose';
import { ITeacher, ITeacherUserName, TeacherModel } from './teacher.interface';

const teacherNameSchema = new Schema<ITeacherUserName>({
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

const teacherSchema = new Schema<ITeacher, TeacherModel>(
  {
    user: {
      type: Schema.Types.ObjectId,
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
      type: Schema.Types.ObjectId,
      ref: 'Payment',
    }],
    courses: {
      type: [Schema.Types.ObjectId],
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
  },
  { timestamps: true,
    toJSON: {
      virtuals: true,
    },
  },
);

teacherSchema.virtual('fullName').get(function () {
  return this?.name?.firstName + this?.name?.middleName + this?.name?.lastName;
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
teacherSchema.statics.isUserExists = async function (id: string) {
  const existingUser = await Teacher.findOne({ id });
  return existingUser;
};

export const Teacher = model<ITeacher, TeacherModel>('Teacher', teacherSchema);
