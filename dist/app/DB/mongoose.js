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
const config_1 = __importDefault(require("../config"));
// Create a global variable to store the cached connection
let cached = global.mongoose || { conn: null, promise: null };
if (!global.mongoose) {
    global.mongoose = cached;
}
const connectDB = () => __awaiter(void 0, void 0, void 0, function* () {
    // If we have a cached connection, return it
    if (cached.conn) {
        return cached.conn;
    }
    // If we don't have a connection promise, create one
    if (!cached.promise) {
        const options = {
            serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
            socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
            family: 4, // Use IPv4, skip trying IPv6
            maxPoolSize: 10, // Maintain up to 10 socket connections
            minPoolSize: 5, // Maintain at least 5 socket connections
            retryWrites: true,
            retryReads: true,
        };
        cached.promise = mongoose_1.default.connect(config_1.default.database_url, options);
    }
    try {
        // Wait for the connection promise to resolve
        cached.conn = yield cached.promise;
        console.log('MongoDB connected successfully');
        // Handle connection errors after initial connection
        mongoose_1.default.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err);
        });
        mongoose_1.default.connection.on('disconnected', () => {
            console.log('MongoDB disconnected. Attempting to reconnect...');
            // Clear the cached connection on disconnect
            cached.conn = null;
            cached.promise = null;
            setTimeout(connectDB, 5000); // Retry connection after 5 seconds
        });
        return cached.conn;
    }
    catch (error) {
        // Clear the cached promise on error
        cached.promise = null;
        console.error('MongoDB connection error:', error);
        // Retry connection after 5 seconds
        setTimeout(connectDB, 5000);
        throw error;
    }
});
exports.default = connectDB;
