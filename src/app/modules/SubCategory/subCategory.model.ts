import { model, Schema } from 'mongoose';
import { ISubCategory } from './subCategory.interface';

const subCategorySchema = new Schema<ISubCategory>({
  categoryId: {
    type: Schema.Types.ObjectId,
    ref: 'Category',
  },
  name: {
    type: String,
    required: true,
  },
});

export const SubCategory = model<ISubCategory>(
  'SubCategory',
  subCategorySchema,
);
