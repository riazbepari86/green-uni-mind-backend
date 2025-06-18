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
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = __importDefault(require("../app/config"));
const seedCategories_1 = require("../utils/seedCategories");
const seedDatabase = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.log('🚀 Starting database seeding...');
        // Connect to MongoDB
        yield mongoose_1.default.connect(config_1.default.database_url);
        console.log('✅ Connected to MongoDB');
        // Seed categories and subcategories
        yield (0, seedCategories_1.seedCategories)();
        console.log('🎉 Database seeding completed successfully!');
        process.exit(0);
    }
    catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
});
// Run the seeding if this file is executed directly
if (require.main === module) {
    seedDatabase();
}
exports.default = seedDatabase;
