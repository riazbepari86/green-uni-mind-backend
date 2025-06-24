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
const multer_1 = __importDefault(require("multer"));
const cloudinary_1 = require("cloudinary");
const path_1 = __importDefault(require("path"));
const logger_1 = require("../../config/logger");
const MessagingValidationService_1 = __importDefault(require("./MessagingValidationService"));
const AppError_1 = __importDefault(require("../../errors/AppError"));
const http_status_1 = __importDefault(require("http-status"));
class FileUploadService {
    constructor() {
        this.validationService = new MessagingValidationService_1.default();
        this.setupMulter();
        this.setupCloudinary();
    }
    setupMulter() {
        // Configure multer for memory storage
        const storage = multer_1.default.memoryStorage();
        this.upload = (0, multer_1.default)({
            storage,
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB max file size
                files: 5, // Maximum 5 files per message
            },
            fileFilter: (req, file, cb) => {
                var _a;
                try {
                    // Get user type from request (should be set by auth middleware)
                    const userType = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.role) === 'teacher' ? 'teacher' : 'student';
                    // Validate file type
                    if (!this.validationService.validateFileType(file.mimetype, userType)) {
                        return cb(new Error(`File type ${file.mimetype} is not allowed for ${userType}s`));
                    }
                    cb(null, true);
                }
                catch (error) {
                    cb(error);
                }
            },
        });
    }
    setupCloudinary() {
        cloudinary_1.v2.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
    }
    /**
     * Get multer middleware for file uploads
     */
    getUploadMiddleware() {
        return this.upload.array('attachments', 5);
    }
    /**
     * Upload files to Cloudinary
     */
    uploadFiles(files, userType, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            const uploadedFiles = [];
            const errors = [];
            if (!files || files.length === 0) {
                return { success: true, files: [] };
            }
            for (const file of files) {
                try {
                    // Validate file size
                    if (!this.validationService.validateFileSize(file.size, userType)) {
                        errors.push(`File ${file.originalname} exceeds size limit`);
                        continue;
                    }
                    // Validate file type
                    if (!this.validationService.validateFileType(file.mimetype, userType)) {
                        errors.push(`File type ${file.mimetype} is not allowed`);
                        continue;
                    }
                    // Upload to Cloudinary
                    const uploadResult = yield this.uploadToCloudinary(file, conversationId);
                    uploadedFiles.push(uploadResult);
                    logger_1.Logger.info(`✅ File uploaded successfully: ${file.originalname}`);
                }
                catch (error) {
                    logger_1.Logger.error(`❌ Failed to upload file ${file.originalname}:`, error);
                    errors.push(`Failed to upload ${file.originalname}: ${error.message}`);
                }
            }
            return {
                success: errors.length === 0,
                files: uploadedFiles,
                errors: errors.length > 0 ? errors : undefined,
            };
        });
    }
    /**
     * Upload single file to Cloudinary
     */
    uploadToCloudinary(file, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const uploadOptions = {
                    folder: `messaging/${conversationId}`,
                    resource_type: this.getCloudinaryResourceType(file.mimetype),
                    public_id: `${Date.now()}_${path_1.default.parse(file.originalname).name}`,
                    use_filename: true,
                    unique_filename: false,
                };
                cloudinary_1.v2.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) {
                        reject(error);
                    }
                    else if (result) {
                        resolve({
                            fileName: result.public_id,
                            originalName: file.originalname,
                            fileSize: file.size,
                            mimeType: file.mimetype,
                            fileUrl: result.secure_url,
                            publicId: result.public_id,
                            uploadedAt: new Date(),
                        });
                    }
                    else {
                        reject(new Error('Upload failed - no result returned'));
                    }
                }).end(file.buffer);
            });
        });
    }
    /**
     * Get Cloudinary resource type based on MIME type
     */
    getCloudinaryResourceType(mimeType) {
        if (mimeType.startsWith('image/')) {
            return 'image';
        }
        else if (mimeType.startsWith('video/')) {
            return 'video';
        }
        else {
            return 'raw';
        }
    }
    /**
     * Delete file from Cloudinary
     */
    deleteFile(publicId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield cloudinary_1.v2.uploader.destroy(publicId);
                logger_1.Logger.info(`🗑️ File deleted from Cloudinary: ${publicId}`);
                return result.result === 'ok';
            }
            catch (error) {
                logger_1.Logger.error(`❌ Failed to delete file from Cloudinary: ${publicId}`, error);
                return false;
            }
        });
    }
    /**
     * Delete multiple files from Cloudinary
     */
    deleteFiles(publicIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleted = [];
            const failed = [];
            for (const publicId of publicIds) {
                const success = yield this.deleteFile(publicId);
                if (success) {
                    deleted.push(publicId);
                }
                else {
                    failed.push(publicId);
                }
            }
            return { deleted, failed };
        });
    }
    /**
     * Get file info from Cloudinary
     */
    getFileInfo(publicId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield cloudinary_1.v2.api.resource(publicId);
                return result;
            }
            catch (error) {
                logger_1.Logger.error(`❌ Failed to get file info from Cloudinary: ${publicId}`, error);
                return null;
            }
        });
    }
    /**
     * Generate signed URL for secure file access
     */
    generateSignedUrl(publicId, expiresIn = 3600) {
        try {
            const timestamp = Math.round(Date.now() / 1000) + expiresIn;
            const signedUrl = cloudinary_1.v2.utils.private_download_url(publicId, 'jpg', {
                expires_at: timestamp,
            });
            return signedUrl;
        }
        catch (error) {
            logger_1.Logger.error(`❌ Failed to generate signed URL for: ${publicId}`, error);
            throw new AppError_1.default(http_status_1.default.INTERNAL_SERVER_ERROR, 'Failed to generate file access URL');
        }
    }
    /**
     * Validate and process uploaded files
     */
    processUploadedFiles(files, userType, conversationId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!files || files.length === 0) {
                return [];
            }
            // Check file count limit
            if (files.length > 5) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, 'Maximum 5 files allowed per message');
            }
            const uploadResult = yield this.uploadFiles(files, userType, conversationId);
            if (!uploadResult.success && uploadResult.errors) {
                throw new AppError_1.default(http_status_1.default.BAD_REQUEST, uploadResult.errors.join(', '));
            }
            return uploadResult.files || [];
        });
    }
    /**
     * Get file extension from MIME type
     */
    getFileExtension(mimeType) {
        const mimeToExt = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'application/pdf': 'pdf',
            'application/msword': 'doc',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'text/plain': 'txt',
            'application/zip': 'zip',
            'application/x-rar-compressed': 'rar',
        };
        return mimeToExt[mimeType] || 'bin';
    }
    /**
     * Check if file is an image
     */
    isImage(mimeType) {
        return mimeType.startsWith('image/');
    }
    /**
     * Check if file is a video
     */
    isVideo(mimeType) {
        return mimeType.startsWith('video/');
    }
    /**
     * Check if file is a document
     */
    isDocument(mimeType) {
        const documentTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
            'text/csv',
        ];
        return documentTypes.includes(mimeType);
    }
    /**
     * Get human-readable file size
     */
    formatFileSize(bytes) {
        if (bytes === 0)
            return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
exports.default = FileUploadService;
