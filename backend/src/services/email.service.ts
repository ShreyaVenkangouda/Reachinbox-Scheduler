import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
    },
});

export const sendEmail = async (
    recipient: string,
    subject: string,
    body: string
) => {
    const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: recipient,
        subject,
        text: body,
    });

    console.log("Email sent:", info.messageId);

    const previewUrl = nodemailer.getTestMessageUrl(info);

    if (previewUrl) {
        console.log("Preview URL:", previewUrl);
    }

    return info;
};