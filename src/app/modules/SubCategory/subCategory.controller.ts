import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { SubCategoryService } from './subCategory.service';
import httpStatus from 'http-status';

const createSubCategory = catchAsync(async (req, res) => {
  const result = await SubCategoryService.createSubCategory(req.body);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: 'Sub Category created successfully!',
    data: result,
  });
});

const getSubCategoriesByCategory = catchAsync(async (req, res) => {
  const { categoryId } = req.params;
  const result = await SubCategoryService.getSubCategoriesByCategory(categoryId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subcategories retrieved successfully!',
    data: result,
  });
});

const getSubCategoryById = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubCategoryService.getSubCategoryById(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subcategory retrieved successfully!',
    data: result,
  });
});

const getCoursesBySubCategory = catchAsync(async (req, res) => {
  const { subcategoryId } = req.params;
  const { page, limit } = req.query;
  const result = await SubCategoryService.getCoursesBySubCategory(
    subcategoryId,
    Number(page) || 1,
    Number(limit) || 10
  );

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Courses retrieved successfully!',
    data: result.courses,
    meta: result.meta,
  });
});

const updateSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const result = await SubCategoryService.updateSubCategory(id, req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subcategory updated successfully!',
    data: result,
  });
});

const deleteSubCategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  await SubCategoryService.deleteSubCategory(id);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: 'Subcategory deleted successfully!',
    data: null,
  });
});

export const SubCategoryController = {
  createSubCategory,
  getSubCategoriesByCategory,
  getSubCategoryById,
  getCoursesBySubCategory,
  updateSubCategory,
  deleteSubCategory,
};
