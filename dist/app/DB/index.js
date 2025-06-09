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
const config_1 = __importDefault(require("../config"));
const user_constant_1 = require("../modules/User/user.constant");
const user_model_1 = require("../modules/User/user.model");
const superUser = {
    name: "Super Admin",
    email: 'admin@admin.com',
    password: config_1.default.super_admin_password,
    role: user_constant_1.USER_ROLE.student,
    status: 'in-progress',
    isDeleted: false,
};
const seedSuperAdmin = () => __awaiter(void 0, void 0, void 0, function* () {
    // when database is connected, we will check if there any user who is super admin
    const isSuperAdminExists = yield user_model_1.User.findOne({ role: user_constant_1.USER_ROLE.student });
    if (!isSuperAdminExists) {
        yield user_model_1.User.create(superUser);
    }
});
exports.default = seedSuperAdmin;
