"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestApp = createTestApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const sseRoutes_1 = __importDefault(require("../../app/routes/sseRoutes"));
const pollingRoutes_1 = __importDefault(require("../../app/routes/pollingRoutes"));
const monitoringRoutes_1 = __importDefault(require("../../app/routes/monitoringRoutes"));
function createTestApp() {
    const app = (0, express_1.default)();
    // Basic middleware
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use(express_1.default.urlencoded({ extended: true }));
    // Test routes
    app.use('/api/sse', sseRoutes_1.default);
    app.use('/api/polling', pollingRoutes_1.default);
    app.use('/api/monitoring', monitoringRoutes_1.default);
    // Error handling middleware
    app.use((error, req, res, next) => {
        res.status(error.statusCode || 500).json({
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'test' ? error.stack : undefined
        });
    });
    return app;
}
