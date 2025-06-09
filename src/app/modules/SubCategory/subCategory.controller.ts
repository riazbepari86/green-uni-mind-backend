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

export const SubCategoryController = {
  createSubCategory,
};
