import jwt, { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

export const createToken = (
  jwtPayload: { email: string; role: string },
  secret: Secret,
  expiresIn: SignOptions['expiresIn'],
) => {
  return jwt.sign(jwtPayload, secret, { expiresIn });
};

export const emailTemplate = (resetLink: string) => `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <style>
      /* Reset styles for email clients */
      body, html, table, div, p, h1, h2, h3, h4, h5, h6, a, span {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        line-height: 1.5;
      }

      body {
        background-color: #f5f5f5;
        color: #333333;
        width: 100% !important;
        height: 100% !important;
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
      }

      /* Outlook-specific styles */
      table {
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }

      img {
        -ms-interpolation-mode: bicubic;
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
      }

      /* Container */
      .email-container {
        max-width: 600px;
        margin: 30px auto;
        background: #ffffff;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
      }

      /* Header */
      .email-header {
        background-color: #0f766e;
        color: white;
        text-align: center;
        padding: 35px 20px;
      }

      .logo {
        margin-bottom: 20px;
      }

      .logo-text {
        font-size: 28px;
        font-weight: 700;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 1px;
      }

      .header-title {
        margin: 0;
        font-size: 26px;
        font-weight: 700;
        letter-spacing: -0.5px;
        color: #ffffff;
      }

      .header-subtitle {
        margin: 12px 0 0;
        font-size: 16px;
        color: rgba(255, 255, 255, 0.9);
      }

      /* Body */
      .email-body {
        padding: 40px 30px;
        color: #333333;
      }

      .greeting {
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 20px;
        color: #111827;
      }

      .message {
        margin-bottom: 30px;
        font-size: 16px;
        color: #4b5563;
        line-height: 1.6;
      }

      .button-container {
        text-align: center;
        margin: 35px 0;
      }

      /* Button styles with MSO fallback for Outlook */
      .reset-button {
        background-color: #0f766e;
        border-radius: 8px;
        color: #ffffff;
        display: inline-block;
        font-size: 18px;
        font-weight: 600;
        line-height: 1;
        padding: 18px 36px;
        text-align: center;
        text-decoration: none;
        -webkit-text-size-adjust: none;
        mso-hide: all;
      }

      /* Outlook button fallback */
      .button-fallback {
        border-collapse: separate;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
        width: 100%;
      }

      .button-fallback td {
        padding: 0;
      }

      .button-fallback-link {
        background-color: #0f766e;
        border: solid 1px #0f766e;
        border-radius: 8px;
        color: #ffffff !important;
        cursor: pointer;
        display: inline-block;
        font-size: 18px;
        font-weight: 600;
        margin: 0;
        padding: 18px 36px;
        text-align: center;
        text-decoration: none;
      }

      .expiry-notice {
        margin-top: 30px;
        padding: 18px;
        background-color: #fffbeb;
        border-left: 4px solid #f59e0b;
        border-radius: 4px;
        font-size: 15px;
        color: #92400e;
      }

      .expiry-notice strong {
        color: #b45309;
        font-weight: 700;
      }

      .link-fallback {
        margin-top: 30px;
        padding: 18px;
        background-color: #f8fafc;
        border-radius: 8px;
        font-size: 15px;
        word-break: break-all;
      }

      .link-fallback p {
        margin: 0 0 12px;
        color: #64748b;
      }

      .link-fallback a {
        color: #0f766e;
        text-decoration: none;
        font-weight: 500;
        word-break: break-all;
      }

      /* Footer */
      .email-footer {
        text-align: center;
        font-size: 14px;
        color: #64748b;
        padding: 25px 20px;
        background-color: #f8fafc;
        border-top: 1px solid #e2e8f0;
      }

      .footer-links {
        margin-bottom: 15px;
      }

      .footer-links a {
        color: #0f766e;
        text-decoration: none;
        margin: 0 10px;
        font-weight: 500;
      }

      .copyright {
        margin: 10px 0;
        color: #64748b;
      }

      .disclaimer {
        font-size: 13px;
        color: #94a3b8;
        margin-top: 10px;
      }

      /* Responsive */
      @media only screen and (max-width: 600px) {
        .email-container {
          width: 100% !important;
          margin: 0 !important;
          border-radius: 0 !important;
        }

        .email-header {
          padding: 25px 15px;
        }

        .email-body {
          padding: 25px 15px;
        }

        .reset-button, .button-fallback-link {
          display: block !important;
          width: 100% !important;
          padding: 16px 10px !important;
          font-size: 16px !important;
        }

        .footer-links a {
          display: block;
          margin: 10px 0;
        }
      }
    </style>
    <!--[if mso]>
    <style type="text/css">
      .email-container {
        background-color: #ffffff !important;
      }
      .email-header {
        background-color: #0f766e !important;
      }
      .reset-button {
        display: none !important;
      }
      .button-fallback {
        display: block !important;
      }
    </style>
    <![endif]-->
  </head>
  <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preheader text (hidden) -->
    <div style="display: none; max-height: 0; overflow: hidden;">
      Reset your GreenUniMind password - Your password reset link is ready
    </div>

    <!-- Main container -->
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="min-width: 100%; background-color: #f5f5f5;">
      <tr>
        <td align="center" valign="top" style="padding: 30px 10px;">
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="email-container" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);">
            <!-- Header -->
            <tr>
              <td align="center" valign="top" class="email-header" style="background-color: #0f766e; padding: 35px 20px; text-align: center;">
                <div class="logo">
                  <div class="logo-text" style="font-size: 28px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 1px;">GreenUniMind</div>
                </div>
                <h1 class="header-title" style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">Password Reset Request</h1>
                <p class="header-subtitle" style="margin: 12px 0 0; font-size: 16px; color: rgba(255, 255, 255, 0.9);">Follow the instructions to reset your password</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td align="left" valign="top" class="email-body" style="padding: 40px 30px; color: #333333;">
                <p class="greeting" style="font-size: 20px; font-weight: 600; margin-bottom: 20px; color: #111827;">Hello there,</p>

                <p class="message" style="margin-bottom: 30px; font-size: 16px; color: #4b5563; line-height: 1.6;">
                  We received a request to reset your password for your GreenUniMind account.
                  To proceed with resetting your password, please click the button below.
                </p>

                <!-- Button container -->
                <div class="button-container" style="text-align: center; margin: 35px 0;">
                  <!-- Button for most email clients -->
                  <a href="${resetLink}" class="reset-button" style="background-color: #0f766e; border-radius: 8px; color: #ffffff; display: inline-block; font-size: 18px; font-weight: 600; line-height: 1; padding: 18px 36px; text-align: center; text-decoration: none; -webkit-text-size-adjust: none;">Reset My Password</a>

                  <!-- Outlook button fallback -->
                  <!--[if mso]>
                  <table border="0" cellpadding="0" cellspacing="0" class="button-fallback" style="border-collapse: separate; mso-table-lspace: 0pt; mso-table-rspace: 0pt; width: 100%;">
                    <tr>
                      <td align="center" style="padding: 0;">
                        <a href="${resetLink}" class="button-fallback-link" style="background-color: #0f766e; border: solid 1px #0f766e; border-radius: 8px; color: #ffffff !important; cursor: pointer; display: inline-block; font-size: 18px; font-weight: 600; margin: 0; padding: 18px 36px; text-align: center; text-decoration: none;">Reset My Password</a>
                      </td>
                    </tr>
                  </table>
                  <![endif]-->
                </div>

                <!-- Expiry notice -->
                <div class="expiry-notice" style="margin-top: 30px; padding: 18px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 4px; font-size: 15px; color: #92400e;">
                  <strong style="color: #b45309; font-weight: 700;">Important:</strong> This password reset link will expire in 5 minutes for security reasons.
                  If you didn't request this password reset, you can safely ignore this email.
                </div>

                <!-- Link fallback -->
                <div class="link-fallback" style="margin-top: 30px; padding: 18px; background-color: #f8fafc; border-radius: 8px; font-size: 15px; word-break: break-all;">
                  <p style="margin: 0 0 12px; color: #64748b;">If the button above doesn't work, copy and paste this link into your browser:</p>
                  <a href="${resetLink}" style="color: #0f766e; text-decoration: none; font-weight: 500; word-break: break-all;">${resetLink}</a>
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td align="center" valign="top" class="email-footer" style="text-align: center; font-size: 14px; color: #64748b; padding: 25px 20px; background-color: #f8fafc; border-top: 1px solid #e2e8f0;">
                <div class="footer-links" style="margin-bottom: 15px;">
                  <a href="#" style="color: #0f766e; text-decoration: none; margin: 0 10px; font-weight: 500;">Help Center</a>
                  <a href="#" style="color: #0f766e; text-decoration: none; margin: 0 10px; font-weight: 500;">Terms of Service</a>
                  <a href="#" style="color: #0f766e; text-decoration: none; margin: 0 10px; font-weight: 500;">Privacy Policy</a>
                </div>
                <p class="copyright" style="margin: 10px 0; color: #64748b;">© 2024 GreenUniMind. All rights reserved.</p>
                <p class="disclaimer" style="font-size: 13px; color: #94a3b8; margin-top: 10px;">This is an automated email, please do not reply.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
`;

export const verifyToken = (token: string, secret: string) => {
  return jwt.verify(token, secret) as JwtPayload;
};
