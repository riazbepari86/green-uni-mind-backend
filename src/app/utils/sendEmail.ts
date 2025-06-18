import nodemailer from 'nodemailer';
import config from '../config';

export const sendEmail = async (to: string, html: string, subject?: string) => {
  const transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  // send mail with defined transport object
  await transporter.sendMail({
    from: `"Green Uni Mind" <${config.email.user}>`, // sender address
    to, // list of receivers
    subject: subject || 'Password reset request for Green Uni Mind', // Subject line
    text: subject || 'Change your password', // plain text body
    html, // html body
  });
};
