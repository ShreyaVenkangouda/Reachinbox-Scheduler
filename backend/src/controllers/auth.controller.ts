import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { JWT_SECRET } from "../middleware/auth.middleware";

export const getGoogleAuthUrl = (_req: Request, res: Response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || "";
    const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback";

    if (!clientId) {
        return res.status(500).json({
            message: "GOOGLE_CLIENT_ID not configured in backend .env",
        });
    }

    const scope = encodeURIComponent("openid email profile");
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;

    return res.redirect(authUrl);
};

export const handleGoogleCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!code) {
        return res.redirect(`${frontendUrl}/login?error=no_code`);
    }

    try {
        const clientId = process.env.GOOGLE_CLIENT_ID || "";
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
        const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:5000/auth/google/callback";

        // 1. Exchange authorization code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: callbackUrl,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok || !tokenData.access_token) {
            console.error("Google token exchange failed:", tokenData);
            return res.redirect(`${frontendUrl}/login?error=token_exchange_failed`);
        }

        // 2. Fetch user profile from Google
        const userinfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const profile = await userinfoResponse.json();

        if (!profile.email) {
            return res.redirect(`${frontendUrl}/login?error=no_email`);
        }

        // 3. Upsert User in PostgreSQL
        const user = await prisma.user.upsert({
            where: { email: profile.email },
            create: {
                googleId: profile.id,
                email: profile.email,
                name: profile.name || profile.email.split("@")[0],
                avatar: profile.picture || null,
            },
            update: {
                googleId: profile.id,
                name: profile.name || undefined,
                avatar: profile.picture || undefined,
            },
        });

        // 4. Ensure a default Sender exists for this user
        const existingSender = await prisma.sender.findFirst({
            where: { userId: user.id },
        });

        if (!existingSender) {
            await prisma.sender.create({
                data: {
                    userId: user.id,
                    name: user.name || "Default Sender",
                    email: user.email,
                    hourlyLimit: 200,
                },
            });
        }

        // 5. Generate session token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: "7d" });

        // Set HTTP-only cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Redirect back to frontend dashboard with token parameter for convenience
        return res.redirect(`${frontendUrl}/?token=${token}&auth=success`);
    } catch (error) {
        console.error("Google OAuth error:", error);
        return res.redirect(`${frontendUrl}/login?error=oauth_error`);
    }
};

export const getMe = (req: Request, res: Response) => {
    return res.json({
        user: req.user,
    });
};

export const logout = (_req: Request, res: Response) => {
    res.clearCookie("token");
    return res.json({
        success: true,
        message: "Logged out successfully",
    });
};
