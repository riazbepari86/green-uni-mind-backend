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
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./database");
exports.default = () => __awaiter(void 0, void 0, void 0, function* () {
    console.log('🧪 Setting up global test environment...');
    try {
        // Set test environment
        process.env.NODE_ENV = 'test';
        // Initialize test database
        yield (0, database_1.setupTestDatabase)();
        console.log('✅ Global test setup completed');
    }
    catch (error) {
        console.error('❌ Global test setup failed:', error);
        throw error;
    }
});
