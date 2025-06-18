"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategoryService = void 0;
const subCategory_model_1 = require("./subCategory.model");
const course_model_1 = require("../Course/course.model");
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
const createSubCategory = (payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Generate slug from name if not provided
    if (!payload.slug) {
        payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    const result = yield subCategory_model_1.SubCategory.create(payload);
    return result;
});
const getSubCategoriesByCategory = (categoryId) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield subCategory_model_1.SubCategory.find({ categoryId, isActive: true })
        .populate('categoryId', 'name slug')
        .sort({ name: 1 });
    return result;
});
const getSubCategoryById = (id) => __awaiter(void 0, void 0, void 0, function* () {
    const result = yield subCategory_model_1.SubCategory.findById(id).populate('categoryId', 'name slug');
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subcategory not found');
    }
    return result;
});
const getCoursesBySubCategory = (subcategoryId_1, ...args_1) => __awaiter(void 0, [subcategoryId_1, ...args_1], void 0, function* (subcategoryId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const courses = yield course_model_1.Course.find({
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
    const total = yield course_model_1.Course.countDocuments({
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
});
const updateSubCategory = (id, payload) => __awaiter(void 0, void 0, void 0, function* () {
    // Generate slug from name if name is being updated and slug is not provided
    if (payload.name && !payload.slug) {
        payload.slug = payload.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }
    const result = yield subCategory_model_1.SubCategory.findByIdAndUpdate(id, payload, {
        new: true,
        runValidators: true,
    }).populate('categoryId', 'name slug');
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subcategory not found');
    }
    return result;
});
const deleteSubCategory = (id) => __awaiter(void 0, void 0, void 0, function* () {
    // Check if subcategory has courses
    const coursesCount = yield course_model_1.Course.countDocuments({ subcategoryId: id });
    if (coursesCount > 0) {
        throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Cannot delete subcategory that has courses. Please move or delete courses first.');
    }
    const result = yield subCategory_model_1.SubCategory.findByIdAndDelete(id);
    if (!result) {
        throw new AppError_1.default(http_status_1.default.NOT_FOUND, 'Subcategory not found');
    }
    return result;
});
exports.SubCategoryService = {
    createSubCategory,
    getSubCategoriesByCategory,
    getSubCategoryById,
    getCoursesBySubCategory,
    updateSubCategory,
    deleteSubCategory,
};
