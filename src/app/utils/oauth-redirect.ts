import { Request } from 'express';
import config from '../config';

/**
 * Determines the correct frontend URL to redirect to based on the request origin
 * This ensures users are redirected back to the domain they originally accessed
 */
export function getFrontendUrlFromRequest(req: Request): string {
  // Get the origin from various possible headers
  const origin = req.get('Origin') || req.get('Referer') || req.get('X-Forwarded-Host');
  
  console.log('OAuth Redirect - Request headers:', {
    origin: req.get('Origin'),
    referer: req.get('Referer'),
    host: req.get('Host'),
    forwardedHost: req.get('X-Forwarded-Host'),
    userAgent: req.get('User-Agent')
  });

  // If we have an origin, check if it matches any of our allowed frontend URLs
  if (origin) {
    // Extract the base URL from the origin (remove path if present)
    const originUrl = origin.includes('://') ? origin.split('://')[1].split('/')[0] : origin.split('/')[0];
    const originWithProtocol = origin.includes('://') ? origin.split('/').slice(0, 3).join('/') : `https://${originUrl}`;
    
    console.log('OAuth Redirect - Extracted origin:', originWithProtocol);
    
    // Check if this origin is in our allowed frontend URLs
    for (const allowedUrl of config.frontend_urls) {
      const allowedUrlBase = allowedUrl.split('/').slice(0, 3).join('/');
      if (originWithProtocol === allowedUrlBase || originWithProtocol.includes(allowedUrlBase.replace('https://', ''))) {
        console.log('OAuth Redirect - Matched allowed URL:', allowedUrl);
        return allowedUrl;
      }
    }
  }

  // Check if we have a state parameter that might contain the original URL
  const state = req.query.state as string;
  if (state) {
    try {
      const stateData = JSON.parse(state);
      if (stateData.origin && config.frontend_urls.includes(stateData.origin)) {
        console.log('OAuth Redirect - Using origin from state:', stateData.origin);
        return stateData.origin;
      }
    } catch (error) {
      console.log('OAuth Redirect - Could not parse state parameter:', error);
    }
  }

  // Fallback to default frontend URL
  console.log('OAuth Redirect - Using default frontend URL:', config.frontend_url);
  return config.frontend_url;
}

/**
 * Creates a redirect URL with the correct frontend domain
 */
export function createOAuthRedirectUrl(req: Request, path: string, params?: Record<string, string>): string {
  const frontendUrl = getFrontendUrlFromRequest(req);
  const url = new URL(path, frontendUrl);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  console.log('OAuth Redirect - Created redirect URL:', url.toString());
  return url.toString();
}

/**
 * Middleware to store the origin in the session/state for OAuth flows
 */
export function storeOriginMiddleware(req: Request, res: any, next: any) {
  const origin = getFrontendUrlFromRequest(req);
  
  // Store origin in the state parameter for OAuth flows
  if (req.query.state) {
    try {
      const existingState = JSON.parse(req.query.state as string);
      existingState.origin = origin;
      req.query.state = JSON.stringify(existingState);
    } catch (error) {
      // If state is not valid JSON, create new state with origin
      req.query.state = JSON.stringify({ origin, ...req.query });
    }
  } else {
    // Create new state with origin
    req.query.state = JSON.stringify({ origin, ...req.query });
  }
  
  console.log('OAuth Redirect - Stored origin in state:', req.query.state);
  next();
}
