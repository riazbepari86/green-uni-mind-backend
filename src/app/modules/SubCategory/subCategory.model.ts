import { model, Schema } from 'mongoose';
import { ISubCategory } from './subCategory.interface';

const subCategorySchema = new Schema<ISubCategory>({
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category ID is required'],
  },
  name: {
    type: String,
    required: [true, 'Subcategory name is required'],
    trim: true,
  },
  slug: {
    type: String,
    required: [true, 'Subcategory slug is required'],
    lowercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// Create compound index for category + slug uniqueness
subCategorySchema.index({ categoryId: 1, slug: 1 }, { unique: true });
// Create index for better searching
subCategorySchema.index({ name: 'text' });

export const SubCategory = model<ISubCategory>(
  'SubCategory',
  subCategorySchema,
);
