import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { Request } from 'express';
import path from 'path';
import { Logger } from '../../config/logger';
import MessagingValidationService from './MessagingValidationService';
import { IFileAttachment } from '../../modules/Messaging/messaging.interface';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

interface UploadResult {
  success: boolean;
  files?: IFileAttachment[];
  errors?: string[];
}

class FileUploadService {
  private validationService: MessagingValidationService;
  private upload!: multer.Multer;

  constructor() {
    this.validationService = new MessagingValidationService();
    this.setupMulter();
    this.setupCloudinary();
  }

  private setupMulter(): void {
    // Configure multer for memory storage
    const storage = multer.memoryStorage();

    this.upload = multer({
      storage,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 5, // Maximum 5 files per message
      },
      fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        try {
          // Get user type from request (should be set by auth middleware)
          const userType = (req as any).user?.role === 'teacher' ? 'teacher' : 'student';
          
          // Validate file type
          if (!this.validationService.validateFileType(file.mimetype, userType)) {
            return cb(new Error(`File type ${file.mimetype} is not allowed for ${userType}s`));
          }

          cb(null, true);
        } catch (error) {
          cb(error as Error);
        }
      },
    });
  }

  private setupCloudinary(): void {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  /**
   * Get multer middleware for file uploads
   */
  public getUploadMiddleware() {
    return this.upload.array('attachments', 5);
  }

  /**
   * Upload files to Cloudinary
   */
  public async uploadFiles(
    files: Express.Multer.File[],
    userType: 'student' | 'teacher',
    conversationId: string
  ): Promise<UploadResult> {
    const uploadedFiles: IFileAttachment[] = [];
    const errors: string[] = [];

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
        const uploadResult = await this.uploadToCloudinary(file, conversationId);
        uploadedFiles.push(uploadResult);

        Logger.info(`✅ File uploaded successfully: ${file.originalname}`);
      } catch (error) {
        Logger.error(`❌ Failed to upload file ${file.originalname}:`, error);
        errors.push(`Failed to upload ${file.originalname}: ${(error as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      files: uploadedFiles,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Upload single file to Cloudinary
   */
  private async uploadToCloudinary(
    file: Express.Multer.File,
    conversationId: string
  ): Promise<IFileAttachment> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: `messaging/${conversationId}`,
        resource_type: this.getCloudinaryResourceType(file.mimetype),
        public_id: `${Date.now()}_${path.parse(file.originalname).name}`,
        use_filename: true,
        unique_filename: false,
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              fileName: result.public_id,
              originalName: file.originalname,
              fileSize: file.size,
              mimeType: file.mimetype,
              fileUrl: result.secure_url,
              publicId: result.public_id,
              uploadedAt: new Date(),
            });
          } else {
            reject(new Error('Upload failed - no result returned'));
          }
        }
      ).end(file.buffer);
    });
  }

  /**
   * Get Cloudinary resource type based on MIME type
   */
  private getCloudinaryResourceType(mimeType: string): 'image' | 'video' | 'raw' | 'auto' {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else {
      return 'raw';
    }
  }

  /**
   * Delete file from Cloudinary
   */
  public async deleteFile(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      Logger.info(`🗑️ File deleted from Cloudinary: ${publicId}`);
      return result.result === 'ok';
    } catch (error) {
      Logger.error(`❌ Failed to delete file from Cloudinary: ${publicId}`, error);
      return false;
    }
  }

  /**
   * Delete multiple files from Cloudinary
   */
  public async deleteFiles(publicIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    for (const publicId of publicIds) {
      const success = await this.deleteFile(publicId);
      if (success) {
        deleted.push(publicId);
      } else {
        failed.push(publicId);
      }
    }

    return { deleted, failed };
  }

  /**
   * Get file info from Cloudinary
   */
  public async getFileInfo(publicId: string): Promise<any> {
    try {
      const result = await cloudinary.api.resource(publicId);
      return result;
    } catch (error) {
      Logger.error(`❌ Failed to get file info from Cloudinary: ${publicId}`, error);
      return null;
    }
  }

  /**
   * Generate signed URL for secure file access
   */
  public generateSignedUrl(publicId: string, expiresIn: number = 3600): string {
    try {
      const timestamp = Math.round(Date.now() / 1000) + expiresIn;
      
      const signedUrl = cloudinary.utils.private_download_url(publicId, 'jpg', {
        expires_at: timestamp,
      });

      return signedUrl;
    } catch (error) {
      Logger.error(`❌ Failed to generate signed URL for: ${publicId}`, error);
      throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to generate file access URL');
    }
  }

  /**
   * Validate and process uploaded files
   */
  public async processUploadedFiles(
    files: Express.Multer.File[],
    userType: 'student' | 'teacher',
    conversationId: string
  ): Promise<IFileAttachment[]> {
    if (!files || files.length === 0) {
      return [];
    }

    // Check file count limit
    if (files.length > 5) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Maximum 5 files allowed per message');
    }

    const uploadResult = await this.uploadFiles(files, userType, conversationId);

    if (!uploadResult.success && uploadResult.errors) {
      throw new AppError(httpStatus.BAD_REQUEST, uploadResult.errors.join(', '));
    }

    return uploadResult.files || [];
  }

  /**
   * Get file extension from MIME type
   */
  private getFileExtension(mimeType: string): string {
    const mimeToExt: { [key: string]: string } = {
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
  public isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  /**
   * Check if file is a video
   */
  public isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  /**
   * Check if file is a document
   */
  public isDocument(mimeType: string): boolean {
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
  public formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default FileUploadService;
