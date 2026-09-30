import { Request, Response } from "express";
import { prisma } from "../config/prisma";

export const getSenders = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        let senders = await prisma.sender.findMany({
            where: { userId },
            orderBy: { createdAt: "asc" },
        });

        // Ensure user has at least one default sender
        if (senders.length === 0 && req.user) {
            const defaultSender = await prisma.sender.create({
                data: {
                    userId,
                    name: req.user.name || "Default Sender",
                    email: req.user.email,
                    hourlyLimit: 200,
                },
            });
            senders = [defaultSender];
        }

        return res.json(senders);
    } catch (error) {
        console.error("Failed to get senders:", error);
        return res.status(500).json({ message: "Failed to fetch senders" });
    }
};

export const createSender = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const { name, email, hourlyLimit } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: "Invalid sender email address" });
        }

        const parsedLimit = hourlyLimit ? Number(hourlyLimit) : 200;

        const sender = await prisma.sender.upsert({
            where: {
                userId_email: {
                    userId,
                    email,
                },
            },
            create: {
                userId,
                name: name || email.split("@")[0],
                email,
                hourlyLimit: parsedLimit > 0 ? parsedLimit : 200,
            },
            update: {
                name: name || undefined,
                hourlyLimit: parsedLimit > 0 ? parsedLimit : undefined,
            },
        });

        return res.status(201).json(sender);
    } catch (error) {
        console.error("Failed to create sender:", error);
        return res.status(500).json({ message: "Failed to create sender" });
    }
};
