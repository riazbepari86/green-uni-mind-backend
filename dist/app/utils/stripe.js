"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripe = void 0;
const config_1 = __importDefault(require("../config"));
const stripe_1 = __importDefault(require("stripe"));
exports.stripe = new stripe_1.default(config_1.default.stripe_secret_key, {
    apiVersion: '2025-04-30.basil',
});
