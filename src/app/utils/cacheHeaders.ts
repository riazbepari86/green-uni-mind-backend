import { Response } from 'express';

/**
 * Set no-cache headers for real-time data endpoints
 * Prevents browser disk caching for critical financial and analytics data
 */
export const setNoCacheHeaders = (res: Response): void => {
  // Prevent all forms of caching
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache'); // HTTP 1.0 compatibility
  res.setHeader('Expires', '0'); // Legacy browser support
  
  // Additional headers for enhanced cache prevention
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', `"${Date.now()}"`); // Dynamic ETag to prevent conditional requests
  
  // Prevent proxy caching
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', '*'); // Prevent shared caches
};

/**
 * Set no-cache headers specifically for financial data
 * Includes additional security headers for sensitive financial information
 */
export const setFinancialDataNoCacheHeaders = (res: Response): void => {
  setNoCacheHeaders(res);
  
  // Additional security headers for financial data
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
};

/**
 * Set no-cache headers for analytics data
 * Optimized for real-time analytics and dashboard updates
 */
export const setAnalyticsNoCacheHeaders = (res: Response): void => {
  setNoCacheHeaders(res);
  
  // Add timestamp for analytics tracking
  res.setHeader('X-Analytics-Timestamp', Date.now().toString());
  res.setHeader('X-Data-Freshness', 'real-time');
};
