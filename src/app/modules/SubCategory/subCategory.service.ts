import { ISubCategory } from './subCategory.interface';
import { SubCategory } from './subCategory.model';
import { Course } from '../Course/course.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createSubCategory = async (payload: ISubCategory) => {
  // Generate slug from name if not provided
  if (!payload.slug) {
    payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const result = await SubCategory.create(payload);
  return result;
};

const getSubCategoriesByCategory = async (categoryId: string) => {
  const result = await SubCategory.find({ categoryId, isActive: true })
    .populate('categoryId', 'name slug')
    .sort({ name: 1 });
  return result;
};

const getSubCategoryById = async (id: string) => {
  const result = await SubCategory.findById(id).populate('categoryId', 'name slug');

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subcategory not found');
  }

  return result;
};

const getCoursesBySubCategory = async (subcategoryId: string, page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const courses = await Course.find({
    subcategoryId,
    isPublished: true,
    status: 'published'
  })
    .populate('categoryId', 'name slug')
    .populate('subcategoryId', 'name slug')
    .populate('creator', 'name email')
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });

  const total = await Course.countDocuments({
    subcategoryId,
    isPublished: true,
    status: 'published'
  });

  return {
    courses,
    meta: {
      page,
      limit,
      total,
      totalPage: Math.ceil(total / limit),
    },
  };
};

const updateSubCategory = async (id: string, payload: Partial<ISubCategory>) => {
  // Generate slug from name if name is being updated and slug is not provided
  if (payload.name && !payload.slug) {
    payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const result = await SubCategory.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  }).populate('categoryId', 'name slug');

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subcategory not found');
  }

  return result;
};

const deleteSubCategory = async (id: string) => {
  // Check if subcategory has courses
  const coursesCount = await Course.countDocuments({ subcategoryId: id });

  if (coursesCount > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot delete subcategory that has courses. Please move or delete courses first.'
    );
  }

  const result = await SubCategory.findByIdAndDelete(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Subcategory not found');
  }

  return result;
};

export const SubCategoryService = {
  createSubCategory,
  getSubCategoriesByCategory,
  getSubCategoryById,
  getCoursesBySubCategory,
  updateSubCategory,
  deleteSubCategory,
};
