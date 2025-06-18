import { ICategory } from './category.interface';
import { Category } from './category.model';
import { SubCategory } from '../SubCategory/subCategory.model';
import { Course } from '../Course/course.model';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

const createCategory = async (payload: ICategory) => {
  // Generate slug from name if not provided
  if (!payload.slug) {
    payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const result = await Category.create(payload);
  return result;
};

const getAllCategories = async () => {
  const result = await Category.find({ isActive: true }).sort({ name: 1 });
  return result;
};

const getAllCategoriesWithSubcategories = async () => {
  const categories = await Category.find({ isActive: true }).sort({ name: 1 });

  // Get subcategories for each category
  const categoriesWithSubcategories = await Promise.all(
    categories.map(async (category) => {
      const subcategories = await SubCategory.find({
        categoryId: category._id,
        isActive: true
      }).sort({ name: 1 });

      return {
        ...category.toObject(),
        subcategories,
      };
    })
  );

  return categoriesWithSubcategories;
};

const getCategoryById = async (id: string) => {
  const result = await Category.findById(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return result;
};

const getCoursesByCategory = async (categoryId: string, page: number = 1, limit: number = 10) => {
  const skip = (page - 1) * limit;

  const courses = await Course.find({
    categoryId,
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
    categoryId,
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

const updateCategory = async (id: string, payload: Partial<ICategory>) => {
  // Generate slug from name if name is being updated and slug is not provided
  if (payload.name && !payload.slug) {
    payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  const result = await Category.findByIdAndUpdate(id, payload, {
    new: true,
    runValidators: true,
  });

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return result;
};

const deleteCategory = async (id: string) => {
  // Check if category has courses
  const coursesCount = await Course.countDocuments({ categoryId: id });

  if (coursesCount > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      'Cannot delete category that has courses. Please move or delete courses first.'
    );
  }

  const result = await Category.findByIdAndDelete(id);

  if (!result) {
    throw new AppError(httpStatus.NOT_FOUND, 'Category not found');
  }

  return result;
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getAllCategoriesWithSubcategories,
  getCategoryById,
  getCoursesByCategory,
  updateCategory,
  deleteCategory,
};
