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
exports.getCloudinaryVideoDuration = exports.handleVideoUpload = exports.upload = exports.sendImageToCloudinary = exports.deleteFileFromCloudinary = exports.extractPublicIdFromUrl = exports.sendFileToCloudinary = void 0;
const cloudinary_1 = require("cloudinary");
const config_1 = __importDefault(require("../config"));
const multer_1 = __importDefault(require("multer"));
const fs_1 = require("fs");
const fs_2 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const stream_1 = require("stream");
// Cloudinary configuration
cloudinary_1.v2.config({
    cloud_name: config_1.default.cloudinary_cloud_name,
    api_key: config_1.default.cloudinary_api_key,
    api_secret: config_1.default.cloudinary_api_secret,
});
// Function to upload image/video to Cloudinary from local path
const sendFileToCloudinary = (fileName, pathToFile) => {
    return new Promise((resolve, reject) => {
        // Check if the file path is valid
        if (!pathToFile || typeof pathToFile !== 'string') {
            return reject(new Error('Invalid file path'));
        }
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            public_id: fileName,
            resource_type: 'auto',
            format: 'webp', // Auto, video, or image
            transformation: [{ fetch_format: 'auto', quality: 'auto:good' }],
        }, (error, result) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // Delete the local file after upload
                yield fs_2.default.promises.unlink(pathToFile);
                console.log(`Temp file ${path_1.default.basename(pathToFile)} deleted.`);
            }
            catch (unlinkError) {
                console.error('Failed to delete temp file:', unlinkError);
            }
            if (error) {
                console.error('Cloudinary upload error:', error);
                return reject(error);
            }
            // Resolve with both secure_url and public_id
            resolve({
                secure_url: (result === null || result === void 0 ? void 0 : result.secure_url) || '',
                public_id: (result === null || result === void 0 ? void 0 : result.public_id) || '',
            });
        }));
        // Ensure file exists before creating the stream
        try {
            const fileStream = (0, fs_1.createReadStream)(pathToFile);
            fileStream.on('error', (streamError) => {
                console.error('File stream error:', streamError);
                reject(streamError);
            });
            fileStream.pipe(uploadStream);
        }
        catch (err) {
            console.error('Error in file stream creation:', err);
            reject(new Error('Failed to create file stream'));
        }
    });
};
exports.sendFileToCloudinary = sendFileToCloudinary;
// Extract public ID from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
    try {
        const fileWithExtension = url.split('/').pop();
        if (!fileWithExtension)
            return null;
        const publicId = fileWithExtension.split('.')[0];
        return decodeURIComponent(publicId);
    }
    catch (error) {
        console.error('Failed to extract public_id from URL:', url);
        return null;
    }
};
exports.extractPublicIdFromUrl = extractPublicIdFromUrl;
// Delete image/video from Cloudinary
const deleteFileFromCloudinary = (publicId) => __awaiter(void 0, void 0, void 0, function* () {
    if (!publicId || typeof publicId !== 'string') {
        throw new Error('Invalid publicId provided to deleteImageFromCloudinary');
    }
    try {
        const result = yield cloudinary_1.v2.uploader.destroy(publicId);
        if (result.result === 'ok') {
            console.log(`✅ Successfully deleted from Cloudinary: ${publicId}`);
        }
        else {
            console.warn(`⚠️ Image not found in Cloudinary: ${publicId}`);
        }
    }
    catch (error) {
        console.error(`🔥 Error deleting from Cloudinary [${publicId}]:`, error === null || error === void 0 ? void 0 : error.message);
        throw new Error(`Failed to delete image/video from Cloudinary: ${(error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'}`);
    }
});
exports.deleteFileFromCloudinary = deleteFileFromCloudinary;
// Function to optimize video using FFmpeg with improved quality and adaptive resolution
const optimizeVideo = (inputBuffer) => {
    return new Promise((resolve, reject) => {
        const outputChunks = [];
        // Create a more sophisticated FFmpeg command with better quality settings
        const ffmpegCommand = (0, fluent_ffmpeg_1.default)()
            .input(stream_1.Readable.from(inputBuffer))
            .inputFormat('mp4') // Input video format
            // Use a better scaling algorithm and maintain aspect ratio
            .outputOptions([
            // Scale to 720p while maintaining aspect ratio
            '-vf', 'scale=-2:720',
            // Use a better video codec with higher quality settings
            '-c:v', 'libx264',
            '-preset', 'slow', // Better compression at the cost of encoding time
            '-crf', '22', // Constant Rate Factor (18-28 is good, lower is better quality)
            // Better audio quality
            '-c:a', 'aac',
            '-b:a', '128k',
            // Optimize for streaming
            '-movflags', '+faststart',
            // Set keyframe interval to 2 seconds for better seeking
            '-g', '48',
            '-keyint_min', '48',
            // Use 2-pass encoding for better quality
            '-profile:v', 'high',
            '-level', '4.0',
            // Maintain metadata
            '-map_metadata', '0'
        ])
            .format('mp4') // Output format as MP4
            .on('start', (commandLine) => {
            console.log('FFmpeg optimization started with command:', commandLine);
        })
            .on('progress', (progress) => {
            // Log progress if available
            if (progress.percent) {
                console.log(`FFmpeg optimization progress: ${Math.round(progress.percent)}%`);
            }
        })
            .on('error', (error) => {
            console.error('FFmpeg optimization error:', error);
            reject(error);
        })
            .on('end', () => {
            const outputBuffer = Buffer.concat(outputChunks.map((chunk) => Buffer.from(chunk)));
            console.log(`FFmpeg optimization completed. Output size: ${(outputBuffer.length / (1024 * 1024)).toFixed(2)}MB`);
            resolve(outputBuffer);
        });
        // Pipe the output to our writable stream
        ffmpegCommand.pipe(new stream_1.Writable({
            write(chunk, encoding, callback) {
                outputChunks.push(chunk);
                callback();
            },
        }));
    });
};
const sendImageToCloudinary = (imageName, pathToFile) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary_1.v2.uploader.upload_stream({
            public_id: imageName,
            resource_type: 'auto',
            transformation: [{ fetch_format: 'auto', quality: 'auto' }],
        }, (error, result) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                // Always delete the local file after upload
                yield fs_2.default.promises.unlink(pathToFile);
                console.log(`Temp file ${path_1.default.basename(pathToFile)} deleted.`);
            }
            catch (unlinkError) {
                console.error('Failed to delete temp file:', unlinkError);
            }
            if (error) {
                console.error('Cloudinary upload error:', error);
                return reject(error);
            }
            // Resolve with both secure_url and public_id
            resolve({
                secure_url: (result === null || result === void 0 ? void 0 : result.secure_url) || '',
                public_id: (result === null || result === void 0 ? void 0 : result.public_id) || '',
            });
        }));
        // Pipe the local file into Cloudinary
        const fileStream = (0, fs_1.createReadStream)(pathToFile);
        fileStream.on('error', (streamError) => {
            console.error('File stream error:', streamError);
            reject(streamError);
        });
        fileStream.pipe(uploadStream);
    });
};
exports.sendImageToCloudinary = sendImageToCloudinary;
// Multer storage setup for local disk (if you want to save temporarily)
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path_1.default.join(process.cwd(), 'uploads');
        // Create 'uploads' folder if it doesn't exist
        if (!fs_2.default.existsSync(uploadPath)) {
            fs_2.default.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix);
    },
});
exports.upload = (0, multer_1.default)({ storage: storage });
// Handling video upload, optimize and send to Cloudinary with adaptive streaming
const handleVideoUpload = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const file = req.file;
    if (!file)
        return res.status(400).json({ message: 'No file uploaded' });
    try {
        // Step 1: Optimize video (scale down to 640x360)
        const optimizedBuffer = yield optimizeVideo(file.buffer);
        // Step 2: Upload optimized video to Cloudinary with adaptive streaming
        const uploadResult = cloudinary_1.v2.uploader.upload_stream({
            resource_type: 'video', // Uploading video
            folder: 'lectures', // Store video in 'lectures' folder
            chunk_size: 10 * 1024 * 1024, // 10MB chunk size (increased from 6MB)
            // Enable adaptive streaming with maxres quality
            streaming_profile: 'auto:maxres',
            // Add eager transformations for different quality levels
            eager: [
                { streaming_profile: 'auto:maxres' },
                { streaming_profile: 'full_hd' },
                { streaming_profile: 'hd' },
                { streaming_profile: 'sd' }
            ],
            eager_async: true,
            // Enable chunked uploads explicitly
            use_filename: true,
            unique_filename: true,
            // Add timeout settings
            timeout: 600000, // 10 minutes in milliseconds
            transformation: [
                { quality: 'auto:best' }, // Use best quality
                { fetch_format: 'auto' }, // Automatically select best format
            ],
        }, (error, result) => {
            if (error) {
                console.error('Cloudinary upload error:', error);
                return res.status(500).json({ message: 'Cloudinary upload error' });
            }
            // Return more comprehensive information including streaming URLs
            const streamingUrls = (result === null || result === void 0 ? void 0 : result.eager) ?
                result.eager.map((item) => ({
                    url: item.secure_url,
                    format: item.format,
                    transformation: item.transformation
                })) : [];
            res.json({
                secure_url: result === null || result === void 0 ? void 0 : result.secure_url,
                public_id: result === null || result === void 0 ? void 0 : result.public_id,
                duration: result === null || result === void 0 ? void 0 : result.duration,
                streaming_url: (result === null || result === void 0 ? void 0 : result.eager) && result.eager[0] ? result.eager[0].secure_url : null,
                streaming_urls: streamingUrls,
                format: result === null || result === void 0 ? void 0 : result.format,
                bytes: result === null || result === void 0 ? void 0 : result.bytes,
                created_at: result === null || result === void 0 ? void 0 : result.created_at
            });
        });
        // Pipe the optimized buffer to Cloudinary upload stream
        stream_1.Readable.from(optimizedBuffer).pipe(uploadResult);
        // Log the upload start
        console.log(`Video upload started: ${file.originalname}, size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
    }
    catch (error) {
        console.error('Error processing video:', error);
        res.status(500).json({ message: 'Error processing video' });
    }
});
exports.handleVideoUpload = handleVideoUpload;
const getCloudinaryVideoDuration = (videoUrl) => __awaiter(void 0, void 0, void 0, function* () {
    const regex = /\/upload\/(?:v\d+\/)?(.+)\.(mp4|mov|webm|mkv|avi)/;
    const match = videoUrl.match(regex);
    if (!match || !match[1]) {
        throw new Error('Failed to extract public_id from Cloudinary URL.');
    }
    const publicId = match[1];
    const result = yield cloudinary_1.v2.api.resource(publicId, {
        resource_type: 'video',
    });
    return result.duration;
});
exports.getCloudinaryVideoDuration = getCloudinaryVideoDuration;
