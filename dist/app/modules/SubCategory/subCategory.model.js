"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubCategory = void 0;
const mongoose_1 = require("mongoose");
const subCategorySchema = new mongoose_1.Schema({
    categoryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Category',
    },
    name: {
        type: String,
        required: true,
    },
});
exports.SubCategory = (0, mongoose_1.model)('SubCategory', subCategorySchema);
