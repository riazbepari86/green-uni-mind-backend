import { v2 as cloudinary } from 'cloudinary';
import config from '../../config';
import AppError from '../../errors/AppError';
import httpStatus from 'http-status';

// Ensure Cloudinary is configured
cloudinary.config({
  cloud_name: config.cloudinary_cloud_name,
  api_key: config.cloudinary_api_key,
  api_secret: config.cloudinary_api_secret,
});

/**
 * Generate a signed URL for a Cloudinary video
 * This creates a URL that will work for a limited time
 */
const generateSignedUrl = async (videoUrl: string, expiresIn = 3600): Promise<string> => {
  try {
    // Extract the public ID from the URL
    const publicId = extractPublicIdFromUrl(videoUrl);
    
    if (!publicId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid video URL');
    }
    
    // Generate a signed URL with the specified expiration time
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      sign_url: true,
      secure: true,
      type: 'upload',
      expires_at: Math.floor(Date.now() / 1000) + expiresIn, // Current time + expiresIn seconds
    });
    
    console.log(`Generated signed URL for ${publicId} with expiration of ${expiresIn} seconds`);
    
    return signedUrl;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to generate video URL');
  }
};

/**
 * Extract the public ID from a Cloudinary URL
 */
const extractPublicIdFromUrl = (url: string): string | null => {
  try {
    // Handle different URL formats
    let publicId: string | null = null;
    
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
  } catch (error) {
    console.error('Error extracting public ID:', error);
    return null;
  }
};

/**
 * Generate a streaming URL for HLS or DASH
 */
const generateStreamingUrl = async (videoUrl: string, format: 'hls' | 'dash' = 'hls', expiresIn = 3600): Promise<string> => {
  try {
    const publicId = extractPublicIdFromUrl(videoUrl);
    
    if (!publicId) {
      throw new AppError(httpStatus.BAD_REQUEST, 'Invalid video URL');
    }
    
    // Generate a signed streaming URL
    const extension = format === 'hls' ? 'm3u8' : 'mpd';
    const transformation = 'sp_auto';
    
    const signedUrl = cloudinary.url(publicId, {
      resource_type: 'video',
      sign_url: true,
      secure: true,
      streaming_profile: 'auto',
      format: extension,
      expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    });
    
    return signedUrl;
  } catch (error) {
    console.error('Error generating streaming URL:', error);
    throw new AppError(httpStatus.INTERNAL_SERVER_ERROR, 'Failed to generate streaming URL');
  }
};

export const VideoService = {
  generateSignedUrl,
  generateStreamingUrl,
  extractPublicIdFromUrl,
};
