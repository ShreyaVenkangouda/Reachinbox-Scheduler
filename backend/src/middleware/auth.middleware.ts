import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

export interface AuthenticatedUser {
    id: string;
    email: string;
    name?: string | null;
    avatar?: string | null;
}

declare global {
    namespace Express {
        interface Request {
            user?: AuthenticatedUser;
        }
    }
}

export const JWT_SECRET = process.env.SESSION_SECRET || "reachinbox-default-secret-change-in-prod";

export const requireAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    try {
        const token =
            req.cookies?.token ||
            req.headers.authorization?.replace(/^Bearer\s+/, "");

        if (!token) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatar: true,
            },
        });

        if (!user) {
            return res.status(401).json({
                message: "User not found",
            });
        }

        req.user = user;
        next();
    } catch {
        return res.status(401).json({
            message: "Invalid or expired session token",
        });
    }
};
