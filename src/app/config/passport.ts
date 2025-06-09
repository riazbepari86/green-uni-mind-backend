import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as AppleStrategy } from 'passport-apple';
import fs from 'fs';
import path from 'path';
import config from './index';
import { User } from '../modules/User/user.model';
import { Student } from '../modules/Student/student.model';
import { Teacher } from '../modules/Teacher/teacher.model';
import { IUser } from '../modules/User/user.interface';


// Configure Passport strategies
export const configurePassport = () => {
  // Check if Google OAuth credentials are set
  if (config.oauth.google.clientId && config.oauth.google.clientSecret) {
    console.log('Configuring Google OAuth strategy');
    // Google Strategy
    passport.use(
      new GoogleStrategy(
        {
          clientID: config.oauth.google.clientId,
          clientSecret: config.oauth.google.clientSecret,
          callbackURL: config.oauth.google.redirectUri, // This is now the frontend URL
          passReqToCallback: true,
          // Add proxy support to handle potential proxy issues
          proxy: true,
        },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          console.log('Google OAuth callback received');
          console.log('Profile:', JSON.stringify(profile));
          console.log('Request state:', req.query.state);

          // Check if user already exists with this Google ID
          let user = await User.findOne({ googleId: profile.id });

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
            } else {
              user.connectedAccounts.google = true;
            }

            // Save the changes with markModified to ensure they're persisted
            user.markModified('connectedAccounts');
            await user.save();

            // Make sure we're returning the user with the original role
            return done(null, user);
          }

          // Check if user exists with the same email
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
          if (email) {
            user = await User.findOne({ email });

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
              } else {
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
              await user.save();

              return done(null, user);
            }
          }

          // Determine role from request query or state
          let role = 'student';

          try {
            // Try to get role from state parameter
            if (req.query.state) {
              const stateObj = JSON.parse(req.query.state as string);
              if (stateObj && stateObj.role) {
                role = stateObj.role;
                console.log('Role from state:', role);
              }
            }
          } catch (error) {
            console.error('Error parsing state:', error);
          }

          // Fallback to query parameter
          if (req.query.role) {
            role = req.query.role as string;
            console.log('Role from query:', role);
          }

          console.log('Final role determined:', role);

          // Create a new user
          const newUser: Partial<IUser> = {
            email: email,
            googleId: profile.id,
            isOAuthUser: true,
            isVerified: true,
            role: role as 'student' | 'teacher',
            photoUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          };

          // Create the user
          const createdUser = await User.create(newUser);

          // Create corresponding student or teacher profile
          const names = profile.displayName.split(' ');
          const firstName = names[0] || '';
          const lastName = names.length > 1 ? names[names.length - 1] : '';
          const middleName = names.length > 2 ? names.slice(1, -1).join(' ') : '';

          if (role === 'student') {
            await Student.create({
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
          } else if (role === 'teacher') {
            await Teacher.create({
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
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
  } else {
    console.log('Google OAuth credentials not set, skipping Google strategy');
  }

  // Check if Facebook OAuth credentials are set
  if (config.oauth.facebook.clientId && config.oauth.facebook.clientSecret) {
    console.log('Configuring Facebook OAuth strategy');
    // Facebook Strategy
    passport.use(
      new FacebookStrategy(
        {
          clientID: config.oauth.facebook.clientId,
          clientSecret: config.oauth.facebook.clientSecret,
          callbackURL: config.oauth.facebook.redirectUri, // This is now the frontend URL
          profileFields: ['id', 'emails', 'name', 'displayName', 'photos'],
          passReqToCallback: true,
        },
      async (req, _accessToken, _refreshToken, profile, done) => {
        try {
          // Check if user already exists with this Facebook ID
          let user = await User.findOne({ facebookId: profile.id });

          // If user exists, return the user
          if (user) {
            return done(null, user);
          }

          // Check if user exists with the same email
          const email = profile.emails && profile.emails[0] ? profile.emails[0].value : '';
          if (email) {
            user = await User.findOne({ email });

            // If user exists with this email, link the Facebook ID to this account
            if (user) {
              user.facebookId = profile.id;
              user.isVerified = true;
              await user.save();
              return done(null, user);
            }
          }

          // Determine role from request query or state
          let role = 'student';

          try {
            // Try to get role from state parameter
            if (req.query.state) {
              const stateObj = JSON.parse(req.query.state as string);
              if (stateObj && stateObj.role) {
                role = stateObj.role;
                console.log('Role from state:', role);
              }
            }
          } catch (error) {
            console.error('Error parsing state:', error);
          }

          // Fallback to query parameter
          if (req.query.role) {
            role = req.query.role as string;
            console.log('Role from query:', role);
          }

          console.log('Final role determined for Facebook login:', role);

          // Create a new user
          const newUser: Partial<IUser> = {
            email: email,
            facebookId: profile.id,
            isOAuthUser: true,
            isVerified: true,
            role: role as 'student' | 'teacher',
            photoUrl: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
          };

          // Create the user
          const createdUser = await User.create(newUser);

          // Create corresponding student or teacher profile
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const middleName = '';

          if (role === 'student') {
            await Student.create({
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
          } else if (role === 'teacher') {
            await Teacher.create({
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
        } catch (error) {
          return done(error as Error);
        }
      }
    )
  );
  } else {
    console.log('Facebook OAuth credentials not set, skipping Facebook strategy');
  }

  // Check if Apple OAuth credentials are set
  if (
    config.oauth.apple.clientId &&
    config.oauth.apple.teamId &&
    config.oauth.apple.keyId
  ) {
    console.log('Configuring Apple OAuth strategy');

    try {
      const privateKey = config.oauth.apple.privateKeyContent;
      if (!privateKey) {
        console.log('Apple private key content not found, skipping Apple strategy');
        return;
      }

      passport.use(
        new AppleStrategy(
          {
            clientID: config.oauth.apple.clientId,
            teamID: config.oauth.apple.teamId,
            keyID: config.oauth.apple.keyId,
            privateKeyLocation: undefined, // Remove file-based private key
            privateKeyString: privateKey, // Use private key content directly
            callbackURL: config.oauth.apple.backendRedirectUri,
            passReqToCallback: true,
          },
          async (req: any, _accessToken: string, _refreshToken: string, _idToken: string, _profile: any, done: any) => {
            try {
              // Apple doesn't provide much profile info, so we need to extract from the tokens
              // The profile might be empty, but we can get user info from the request
              const { sub: appleId, email } = req.user;

              // Check if user already exists with this Apple ID
              let user = await User.findOne({ appleId });

              // If user exists, return the user
              if (user) {
                return done(null, user);
              }

              // Check if user exists with the same email
              if (email) {
                user = await User.findOne({ email });

                // If user exists with this email, link the Apple ID to this account
                if (user) {
                  user.appleId = appleId;
                  user.isVerified = true;
                  await user.save();
                  return done(null, user);
                }
              }

              // Determine role from request query or state
              let role = 'student';

              try {
                // Try to get role from state parameter
                if (req.query.state) {
                  const stateObj = JSON.parse(req.query.state as string);
                  if (stateObj && stateObj.role) {
                    role = stateObj.role;
                    console.log('Role from state:', role);
                  }
                }
              } catch (error) {
                console.error('Error parsing state:', error);
              }

              // Fallback to query parameter
              if (req.query.role) {
                role = req.query.role as string;
                console.log('Role from query:', role);
              }

              console.log('Final role determined for Apple login:', role);

              // Create a new user
              const newUser: Partial<IUser> = {
                email: email,
                appleId: appleId,
                isOAuthUser: true,
                isVerified: true,
                role: role as 'student' | 'teacher',
              };

              // Create the user
              const createdUser = await User.create(newUser);

              // Extract name from the request if available
              const firstName = req.user.name?.firstName || '';
              const lastName = req.user.name?.lastName || '';
              const middleName = '';

              // Create corresponding student or teacher profile
              if (role === 'student') {
                await Student.create({
                  user: createdUser._id,
                  email: email,
                  name: {
                    firstName,
                    middleName,
                    lastName,
                  },
                  gender: 'other', // Default value, can be updated later
                });
              } else if (role === 'teacher') {
                await Teacher.create({
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
            } catch (error) {
              return done(error as Error);
            }
          }
        )
      );
      console.log('Apple OAuth strategy configured successfully');
    } catch (error) {
      console.error('Error configuring Apple OAuth strategy:', error);
      console.log('Apple OAuth will be disabled due to configuration error');
    }
  } else {
    console.log('Apple OAuth credentials not set, skipping Apple strategy');
  }

  // Serialize user into the session
  passport.serializeUser((user, done) => {
    done(null, (user as any)._id);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });
};
