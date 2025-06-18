import { Types } from 'mongoose';

export interface ISubCategory {
  categoryId: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}
