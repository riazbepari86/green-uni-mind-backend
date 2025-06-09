import { Types } from 'mongoose';

export interface ISubCategory {
  categoryId: Types.ObjectId;
  name: string;
}
