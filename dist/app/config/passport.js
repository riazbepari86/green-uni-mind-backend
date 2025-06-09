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
exports.configurePassport = void 0;
const passport_1 = __importDefault(require("passport"));
const passport_google_oauth20_1 = require("passport-google-oauth20");
const passport_facebook_1 = require("passport-facebook");
const passport_apple_1 = require("passport-apple");
const index_1 = __importDefault(require("./index"));
const user_model_1 = require("../modules/User/user.model");
const student_model_1 = require("../modules/Student/student.model");
const teacher_model_1 = require("../modules/Teacher/teacher.model");
// Configure Passport strategies
const configurePassport = () => {
    // Check if Google OAuth credentials are set
    if (index_1.default.oauth.google.clientId && index_1.default.oauth.google.clientSecret) {
        console.log('Configuring Google OAuth strategy');
        // Google Strategy
        passport_1.default.use(new passport_google_oauth20_1.Strategy({
            clientID: index_1.default.oauth.google.clientId,
            clientSecret: index_1.default.oauth.google.clientSecret,
            callbackURL: index_1.default.oauth.google.redirectUri, // This is now the frontend URL
            passReqToCallback: true,
            // Add proxy support to handle potential proxy issues
            proxy: true,
        }, (req, _accessToken, _refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                console.log('Google OAuth callback received');
                console.log('Profile:', JSON.stringify(profile));
                console.log('Request state:', req.query.state);
                // Check if user already exists with this Google ID
                let user = yield user_model_1.User.findOne({ googleId: profile.id });
                // If user exists, return the user
                if (user) {
                    console.log('Existing user found with Google ID:', user._id, 'with role:', user.role);
                    // Log the original role for debugging
                    console.log('PRESERVING EXISTING USER ROLE:', user.role);
                    // Ensure connectedAccounts.google is set to true
                    if (!user.connectedAccounts) {
                        user.connectedAccounts = {
                            google: true,
                            facebook: false,
                            apple: false,
                        };
                    }
                    else {
                        user.connectedAccounts.google = true;
                    }
                    // Save the changes with markModified to ensure they're persisted
                    user.markModified('connectedAccounts');
                    yield user.save();
                    // Make sure we're returning the user with the original role
                    return done(null, user);
                }
                // Check if user exists with the same email
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
                if (email) {
                    user = yield user_model_1.User.findOne({ email });
                    // If user exists with this email, link the Google ID to this account
                    if (user) {
                        console.log('Existing user found with email:', user._id, 'with role:', user.role);
                        // Set Google ID and mark as verified
                        user.googleId = profile.id;
                        user.isVerified = true;
                        // Mark as OAuth user to bypass password requirement
                        user.isOAuthUser = true;
                        // Ensure connectedAccounts.google is set to true
                        if (!user.connectedAccounts) {
                            user.connectedAccounts = {
                                google: true,
                                facebook: false,
                                apple: false,
                            };
                        }
                        else {
                            user.connectedAccounts.google = true;
                        }
                        // Log the user object before saving
                        console.log('Updating user with Google OAuth data:', {
                            _id: user._id,
                            email: user.email,
                            role: user.role,
                            isOAuthUser: user.isOAuthUser,
                            googleId: user.googleId
                        });
                        // Save the changes with markModified to ensure they're persisted
                        user.markModified('connectedAccounts');
                        yield user.save();
                        return done(null, user);
                    }
                }
                // Determine role from request query or state
                let role = 'student';
                try {
                    // Try to get role from state parameter
                    if (req.query.state) {
                        const stateObj = JSON.parse(req.query.state);
                        if (stateObj && stateObj.role) {
                            role = stateObj.role;
                            console.log('Role from state:', role);
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing state:', error);
                }
                // Fallback to query parameter
                if (req.query.role) {
                    role = req.query.role;
                    console.log('Role from query:', role);
                }
                console.log('Final role determined:', role);
                // Create a new user
                const newUser = {
                    email: email,
                    googleId: profile.id,
                    isOAuthUser: true,
                    isVerified: true,
                    role: role,
                    photoUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
                };
                // Create the user
                const createdUser = yield user_model_1.User.create(newUser);
                // Create corresponding student or teacher profile
                const names = profile.displayName.split(' ');
                const firstName = names[0] || '';
                const lastName = names.length > 1 ? names[names.length - 1] : '';
                const middleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';
                if (role === 'student') {
                    yield student_model_1.Student.create({
                        user: createdUser._id,
                        email: email,
                        name: {
                            firstName,
                            middleName,
                            lastName,
                        },
                        gender: 'other', // Default value, can be updated later
                        profileImg: createdUser.photoUrl,
                    });
                }
                else if (role === 'teacher') {
                    yield teacher_model_1.Teacher.create({
                        user: createdUser._id,
                        email: email,
                        name: {
                            firstName,
                            middleName,
                            lastName,
                        },
                        gender: 'other', // Default value, can be updated later
                        profileImg: createdUser.photoUrl,
                    });
                }
                return done(null, createdUser);
            }
            catch (error) {
                return done(error);
            }
        })));
    }
    else {
        console.log('Google OAuth credentials not set, skipping Google strategy');
    }
    // Check if Facebook OAuth credentials are set
    if (index_1.default.oauth.facebook.clientId && index_1.default.oauth.facebook.clientSecret) {
        console.log('Configuring Facebook OAuth strategy');
        // Facebook Strategy
        passport_1.default.use(new passport_facebook_1.Strategy({
            clientID: index_1.default.oauth.facebook.clientId,
            clientSecret: index_1.default.oauth.facebook.clientSecret,
            callbackURL: index_1.default.oauth.facebook.redirectUri, // This is now the frontend URL
            profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
            passReqToCallback: true,
        }, (req, _accessToken, _refreshToken, profile, done) => __awaiter(void 0, void 0, void 0, function* () {
            var _a, _b;
            try {
                // Check if user already exists with this Facebook ID
                let user = yield user_model_1.User.findOne({ facebookId: profile.id });
                // If user exists, return the user
                if (user) {
                    return done(null, user);
                }
                // Check if user exists with the same email
                const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
                if (email) {
                    user = yield user_model_1.User.findOne({ email });
                    // If user exists with this email, link the Facebook ID to this account
                    if (user) {
                        user.facebookId = profile.id;
                        user.isVerified = true;
                        yield user.save();
                        return done(null, user);
                    }
                }
                // Determine role from request query or state
                let role = 'student';
                try {
                    // Try to get role from state parameter
                    if (req.query.state) {
                        const stateObj = JSON.parse(req.query.state);
                        if (stateObj && stateObj.role) {
                            role = stateObj.role;
                            console.log('Role from state:', role);
                        }
                    }
                }
                catch (error) {
                    console.error('Error parsing state:', error);
                }
                // Fallback to query parameter
                if (req.query.role) {
                    role = req.query.role;
                    console.log('Role from query:', role);
                }
                console.log('Final role determined for Facebook login:', role);
                // Create a new user
                const newUser = {
                    email: email,
                    facebookId: profile.id,
                    isOAuthUser: true,
                    isVerified: true,
                    role: role,
                    photoUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
                };
                // Create the user
                const createdUser = yield user_model_1.User.create(newUser);
                // Create corresponding student or teacher profile
                const firstName = ((_a = profile.name) === null || _a === void 0 ? void 0 : _a.givenName) || '';
                const lastName = ((_b = profile.name) === null || _b === void 0 ? void 0 : _b.familyName) || '';
                const middleName = '';
                if (role === 'student') {
                    yield student_model_1.Student.create({
                        user: createdUser._id,
                        email: email,
                        name: {
                            firstName,
                            middleName,
                            lastName,
                        },
                        gender: 'other', // Default value, can be updated later
                        profileImg: createdUser.photoUrl,
                    });
                }
                else if (role === 'teacher') {
                    yield teacher_model_1.Teacher.create({
                        user: createdUser._id,
                        email: email,
                        name: {
                            firstName,
                            middleName,
                            lastName,
                        },
                        gender: 'other', // Default value, can be updated later
                        profileImg: createdUser.photoUrl,
                    });
                }
                return done(null, createdUser);
            }
            catch (error) {
                return done(error);
            }
        })));
    }
    else {
        console.log('Facebook OAuth credentials not set, skipping Facebook strategy');
    }
    // Check if Apple OAuth credentials are set
    if (index_1.default.oauth.apple.clientId &&
        index_1.default.oauth.apple.teamId &&
        index_1.default.oauth.apple.keyId) {
        console.log('Configuring Apple OAuth strategy');
        try {
            const privateKey = index_1.default.oauth.apple.privateKeyContent;
            if (!privateKey) {
                console.log('Apple private key content not found, skipping Apple strategy');
                return;
            }
            passport_1.default.use(new passport_apple_1.Strategy({
                clientID: index_1.default.oauth.apple.clientId,
                teamID: index_1.default.oauth.apple.teamId,
                keyID: index_1.default.oauth.apple.keyId,
                privateKeyLocation: undefined, // Remove file-based private key
                privateKeyString: privateKey, // Use private key content directly
                callbackURL: index_1.default.oauth.apple.backendRedirectUri,
                passReqToCallback: true,
            }, (req, _accessToken, _refreshToken, _idToken, _profile, done) => __awaiter(void 0, void 0, void 0, function* () {
                var _a, _b;
                try {
                    // Apple doesn't provide much profile info, so we need to extract from the tokens
                    // The profile might be empty, but we can get user info from the request
                    const { sub: appleId, email } = req.user;
                    // Check if user already exists with this Apple ID
                    let user = yield user_model_1.User.findOne({ appleId });
                    // If user exists, return the user
                    if (user) {
                        return done(null, user);
                    }
                    // Check if user exists with the same email
                    if (email) {
                        user = yield user_model_1.User.findOne({ email });
                        // If user exists with this email, link the Apple ID to this account
                        if (user) {
                            user.appleId = appleId;
                            user.isVerified = true;
                            yield user.save();
                            return done(null, user);
                        }
                    }
                    // Determine role from request query or state
                    let role = 'student';
                    try {
                        // Try to get role from state parameter
                        if (req.query.state) {
                            const stateObj = JSON.parse(req.query.state);
                            if (stateObj && stateObj.role) {
                                role = stateObj.role;
                                console.log('Role from state:', role);
                            }
                        }
                    }
                    catch (error) {
                        console.error('Error parsing state:', error);
                    }
                    // Fallback to query parameter
                    if (req.query.role) {
                        role = req.query.role;
                        console.log('Role from query:', role);
                    }
                    console.log('Final role determined for Apple login:', role);
                    // Create a new user
                    const newUser = {
                        email: email,
                        appleId: appleId,
                        isOAuthUser: true,
                        isVerified: true,
                        role: role,
                    };
                    // Create the user
                    const createdUser = yield user_model_1.User.create(newUser);
                    // Extract name from the request if available
                    const firstName = ((_a = req.user.name) === null || _a === void 0 ? void 0 : _a.firstName) || '';
                    const lastName = ((_b = req.user.name) === null || _b === void 0 ? void 0 : _b.lastName) || '';
                    const middleName = '';
                    // Create corresponding student or teacher profile
                    if (role === 'student') {
                        yield student_model_1.Student.create({
                            user: createdUser._id,
                            email: email,
                            name: {
                                firstName,
                                middleName,
                                lastName,
                            },
                            gender: 'other', // Default value, can be updated later
                        });
                    }
                    else if (role === 'teacher') {
                        yield teacher_model_1.Teacher.create({
                            user: createdUser._id,
                            email: email,
                            name: {
                                firstName,
                                middleName,
                                lastName,
                            },
                            gender: 'other', // Default value, can be updated later
                        });
                    }
                    return done(null, createdUser);
                }
                catch (error) {
                    return done(error);
                }
            })));
            console.log('Apple OAuth strategy configured successfully');
        }
        catch (error) {
            console.error('Error configuring Apple OAuth strategy:', error);
            console.log('Apple OAuth will be disabled due to configuration error');
        }
    }
    else {
        console.log('Apple OAuth credentials not set, skipping Apple strategy');
    }
    // Serialize user into the session
    passport_1.default.serializeUser((user, done) => {
        done(null, user._id);
    });
    // Deserialize user from the session
    passport_1.default.deserializeUser((id, done) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const user = yield user_model_1.User.findById(id);
            done(null, user);
        }
        catch (error) {
            done(error);
        }
    }));
};
exports.configurePassport = configurePassport;
