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
exports.AuditLogRoutes = void 0;
const express_1 = __importDefault(require("express"));
const auditLog_controller_1 = require("./auditLog.controller");
const auth_1 = __importDefault(require("../../middlewares/auth"));
const user_constant_1 = require("../User/user.constant");
const router = express_1.default.Router();
// Admin-only routes for audit log management
router.get('/', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.getAuditLogs);
router.get('/summary', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.getAuditLogSummary);
router.get('/user/:userId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.getUserAuditLogs);
router.get('/resource/:resourceType/:resourceId', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.getResourceAuditLogs);
router.get('/export', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.exportAuditLogs);
router.post('/archive', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.archiveOldLogs);
router.delete('/archived', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.deleteArchivedLogs);
router.get('/compliance-report', (0, auth_1.default)(user_constant_1.USER_ROLE.admin), auditLog_controller_1.AuditLogController.getComplianceReport);
// User-specific audit log access (limited)
router.get('/my-activity', (0, auth_1.default)(user_constant_1.USER_ROLE.student, user_constant_1.USER_ROLE.teacher, user_constant_1.USER_ROLE.admin), (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    // Override userId with current user's ID for security
    req.params.userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a._id;
    next();
}), auditLog_controller_1.AuditLogController.getUserAuditLogs);
exports.AuditLogRoutes = router;
