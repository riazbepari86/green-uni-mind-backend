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
exports.VideoService = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = __importDefault(require("../../config"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
// Ensure Cloudinary is configured
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary_cloud_name,
    api_key: config_1.default.cloudinary_api_key,
    api_secret: config_1.default.cloudinary_api_secret,
});
/**
 * Generate a signed URL for a Cloudinary video
 * This creates a URL that will work for a limited time
 */
const generateSignedUrl = (videoUrl_1, ...args_1) => __awaiter(void 0, [videoUrl_1, ...args_1], void 0, function* (videoUrl, expiresIn = 3600) {
    try {
        // Extract the public ID from the URL
        const publicId = extractPublicIdFromUrl(videoUrl);
        if (!publicId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid video URL');
        }
        // Generate a signed URL with the specified expiration time
        const signedUrl = cloudinary_1.v2.url(publicId, {
            resource_type: 'video',
            sign_url: true,
            secure: true,
            type: 'upload',
            expires_at: Math.floor(Date.now() / 1000) + expiresIn, // Current time + expiresIn seconds
        });
        console.log(`Generated signed URL for ${publicId} with expiration of ${expiresIn} seconds`);
        return signedUrl;
    }
    catch (error) {
        console.error('Error generating signed URL:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to generate video URL');
    }
});
/**
 * Extract the public ID from a Cloudinary URL
 */
const extractPublicIdFromUrl = (url) => {
    try {
        // Handle different URL formats
        let publicId = null;
        // Format: https://res.cloudinary.com/cloud_name/video/upload/v1234567890/folder/filename.mp4
        const uploadRegex = /\/video\/upload\/(?:v\d+\/)?(.+?)(?:\.[^.]+)?$/;
        const match = url.match(uploadRegex);
        if (match && match[1]) {
            publicId = match[1];
            // Remove any transformation parameters
            if (publicId.includes('/')) {
                const parts = publicId.split('/');
                publicId = parts[parts.length - 1];
            }
            return publicId;
        }
        return null;
    }
    catch (error) {
        console.error('Error extracting public ID:', error);
        return null;
    }
};
/**
 * Generate a streaming URL for HLS or DASH
 */
const generateStreamingUrl = (videoUrl_1, ...args_1) => __awaiter(void 0, [videoUrl_1, ...args_1], void 0, function* (videoUrl, format = 'hls', expiresIn = 3600) {
    try {
        const publicId = extractPublicIdFromUrl(videoUrl);
        if (!publicId) {
            throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Invalid video URL');
        }
        // Generate a signed streaming URL
        const extension = format === 'hls' ? 'm3u8' : 'mpd';
        const transformation = 'sp_auto';
        const signedUrl = cloudinary_1.v2.url(publicId, {
            resource_type: 'video',
            sign_url: true,
            secure: true,
            streaming_profile: 'auto',
            format: extension,
            expires_at: Math.floor(Date.now() / 1000) + expiresIn,
        });
        return signedUrl;
    }
    catch (error) {
        console.error('Error generating streaming URL:', error);
        throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to generate streaming URL');
    }
});
exports.VideoService = {
    generateSignedUrl,
    generateStreamingUrl,
    extractPublicIdFromUrl,
};
