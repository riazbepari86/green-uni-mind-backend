import { ISubCategory } from './subCategory.interface';
import { SubCategory } from './subCategory.model';

const createSubCategory = async (payload: ISubCategory) => {
  const result = await SubCategory.create(payload);

  return result;
};

export const SubCategoryService = {
  createSubCategory,
};
