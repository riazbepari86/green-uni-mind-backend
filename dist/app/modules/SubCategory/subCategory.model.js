"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategory = void 0;
const mongoose_1 = require("mongoose");
const subCategorySchema = new mongoose_1.Schema({
    categoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
exports.SubCategory = (0, mongoose_1.model)('SubCategory', subCategorySchema);
