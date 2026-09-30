import { Request, Response } from "express";
import {
    getSlackAuthUrl,
    exchangeSlackCode,
    getSlackStatus,
    disconnectSlack,
} from "../services/slack.service";

export const connectSlack = (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const authUrl = getSlackAuthUrl(userId);
    return res.redirect(authUrl);
};

export const handleSlackCallback = async (req: Request, res: Response) => {
    const code = req.query.code as string;
    const userId = req.query.state as string;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    if (!code || !userId) {
        return res.redirect(`${frontendUrl}/?slack_error=missing_params`);
    }

    try {
        await exchangeSlackCode(code, userId);
        return res.redirect(`${frontendUrl}/?slack=connected`);
    } catch (error) {
        console.error("Slack OAuth exchange failed:", error);
        return res.redirect(`${frontendUrl}/?slack_error=exchange_failed`);
    }
};

export const getIntegrationStatus = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
    }

    const status = await getSlackStatus(userId);
    return res.json(status);
};

export const deleteSlackIntegration = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
    }

    await disconnectSlack(userId);
    return res.json({ success: true, message: "Slack disconnected successfully" });
};
