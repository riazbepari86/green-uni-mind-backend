const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Create the oauthCallback.route.js file in the dist folder
const oauthCallbackRouteContent = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthCallbackRoutes = void 0;
const express_1 = require("express");
const oauth_controller_1 = require("./oauth.controller");
const router = (0, express_1.Router)();
// Google OAuth callback route
router.get('/google/callback', oauth_controller_1.OAuthControllers.googleCallback);
// Facebook OAuth callback route
router.get('/facebook/callback', oauth_controller_1.OAuthControllers.facebookCallback);
// Apple OAuth callback route
router.get('/apple/callback', oauth_controller_1.OAuthControllers.appleCallback);
exports.OAuthCallbackRoutes = router;
`;

// Create the directory if it doesn't exist
const distDir = path.join(__dirname, 'dist', 'app', 'modules', 'Auth');
console.log('Creating directory:', distDir);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('Directory created');
} else {
  console.log('Directory already exists');
}

// Write the file
fs.writeFileSync(path.join(distDir, 'oauthCallback.route.js'), oauthCallbackRouteContent);

// Update the routes/index.js file to include the new route
const routesIndexPath = path.join(__dirname, 'dist', 'app', 'routes', 'index.js');
if (fs.existsSync(routesIndexPath)) {
  let routesContent = fs.readFileSync(routesIndexPath, 'utf8');

  // Add the import for OAuthCallbackRoutes if it doesn't exist
  if (!routesContent.includes('OAuthCallbackRoutes')) {
    routesContent = routesContent.replace(
      'const oauth_route_1 = require("../modules/Auth/oauth.route");',
      'const oauth_route_1 = require("../modules/Auth/oauth.route");\nconst oauthCallback_route_1 = require("../modules/Auth/oauthCallback.route");'
    );
  }

  // Add the route to moduleRoutes if it doesn't exist
  if (!routesContent.includes('oauthCallback_route_1.OAuthCallbackRoutes')) {
    routesContent = routesContent.replace(
      '{\n        path: \'/oauth\',\n        route: oauth_route_1.OAuthRoutes,\n    },',
      '{\n        path: \'/oauth\',\n        route: oauth_route_1.OAuthRoutes,\n    },\n    {\n        path: \'/oauth\',\n        route: oauthCallback_route_1.OAuthCallbackRoutes,\n    },'
    );
  }

  fs.writeFileSync(routesIndexPath, routesContent);
}

// Copy the updated OAuth controller to the dist folder
try {
  // Compile just the oauth.controller.ts file
  console.log('Compiling oauth.controller.ts...');
  execSync('npx tsc src/app/modules/Auth/oauth.controller.ts --outDir dist/app/modules/Auth --esModuleInterop --skipLibCheck', { stdio: 'inherit' });
  console.log('Compilation successful!');
} catch (error) {
  console.error('Error compiling oauth.controller.ts:', error);

  // If compilation fails, manually copy the file with modifications for the dist version
  console.log('Falling back to manual file copy...');

  // Read the source file
  const srcControllerPath = path.join(__dirname, 'src', 'app', 'modules', 'Auth', 'oauth.controller.ts');
  const distControllerPath = path.join(__dirname, 'dist', 'app', 'modules', 'Auth', 'oauth.controller.js');

  if (fs.existsSync(srcControllerPath)) {
    // Read the existing dist file to preserve the structure
    let distContent = '';
    if (fs.existsSync(distControllerPath)) {
      distContent = fs.readFileSync(distControllerPath, 'utf8');
    }

    // Update the callback functions to handle linking
    if (distContent) {
      // Add the linking functionality to the callbacks
      distContent = distContent.replace(
        /if \(isLinking\) {[\s\S]*?console\.log\('Google OAuth account linking flow detected'\);[\s\S]*?return res\.redirect\([^;]*\);[\s\S]*?}/,
        `if (isLinking) {
            console.log('Google OAuth account linking flow detected');
            console.log('User data:', {
                googleId: user.googleId,
                email: user.email
            });
            // Get the auth token from cookies or headers
            const authToken = req.cookies.authToken ||
                (req.headers.authorization && req.headers.authorization.startsWith('Bearer')
                    ? req.headers.authorization.split(' ')[1]
                    : null);
            console.log('Auth token available:', !!authToken);
            if (authToken) {
                // If we have an auth token, try to link the account directly
                try {
                    // Verify the token and get the user ID
                    const jwt = require('jsonwebtoken');
                    const decoded = jwt.verify(authToken, config_1.default.jwt_access_secret);
                    if (decoded && decoded.email) {
                        // Find the user by email
                        const existingUser = yield user_model_1.User.findOne({ email: decoded.email });
                        if (existingUser) {
                            // Link the Google account to the existing user
                            existingUser.googleId = user.googleId;
                            // Update connected accounts
                            if (!existingUser.connectedAccounts) {
                                existingUser.connectedAccounts = {
                                    google: false,
                                    facebook: false,
                                    apple: false,
                                };
                            }
                            existingUser.connectedAccounts.google = true;
                            yield existingUser.save();
                            console.log('Successfully linked Google account to user:', existingUser._id);
                            // Redirect to profile with success message
                            return res.redirect(\`\${config_1.default.frontend_url}/user/edit-profile?provider=google&linked=true\`);
                        }
                    }
                }
                catch (tokenError) {
                    console.error('Error verifying token for account linking:', tokenError);
                }
            }
            // If direct linking failed or no auth token, redirect to the callback page with provider info
            return res.redirect(\`\${config_1.default.frontend_url}/oauth/callback?provider=google&providerId=\${user.googleId}&email=\${user.email}&isLinking=true\`);
        }`
      );

      fs.writeFileSync(distControllerPath, distContent);
    }
  }
}

console.log('Files copied successfully!');
