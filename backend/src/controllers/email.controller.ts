import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { emailQueue } from "../queues/email.queue";
import { indexEmailDocument, searchEmailsInES } from "../services/elasticsearch.service";

/**
 * Phase 11 & existing: Schedule a single email
 * Derives userId from authenticated session
 */
export const scheduleEmail = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const {
            senderId,
            recipient,
            subject,
            body,
            scheduledAt,
            hourlyLimit,
        } = req.body;

        if (!senderId || !recipient || !subject || !body || !scheduledAt) {
            return res.status(400).json({
                message: "Missing required fields: senderId, recipient, subject, body, scheduledAt",
            });
        }

        // Verify sender belongs to authenticated user
        const sender = await prisma.sender.findFirst({
            where: { id: senderId, userId },
        });

        if (!sender) {
            return res.status(403).json({
                message: "Sender not found or not owned by authenticated user",
            });
        }

        // Update sender hourly limit if provided
        const parsedHourlyLimit = hourlyLimit !== undefined && hourlyLimit !== null && Number(hourlyLimit) > 0
            ? Number(hourlyLimit)
            : undefined;
        if (parsedHourlyLimit && sender.hourlyLimit !== parsedHourlyLimit) {
            await prisma.sender.update({
                where: { id: sender.id },
                data: { hourlyLimit: parsedHourlyLimit },
            });
            sender.hourlyLimit = parsedHourlyLimit;
            console.log(`Updated sender ${sender.email} (${sender.id}) hourlyLimit to ${parsedHourlyLimit}`);
        }

        const scheduledDate = new Date(scheduledAt);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({
                message: "Invalid scheduledAt format",
            });
        }

        // 1. Save email in PostgreSQL
        const email = await prisma.email.create({
            data: {
                userId,
                senderId: sender.id,
                recipient: recipient.trim().toLowerCase(),
                subject,
                body,
                scheduledAt: scheduledDate,
                status: "SCHEDULED",
            },
        });

        // 2. Calculate BullMQ delay
        const delay = Math.max(scheduledDate.getTime() - Date.now(), 0);

        // 3. Add delayed job to Redis (deterministic jobId: email.id)
        const job = await emailQueue.add(
            "send-email",
            {
                emailId: email.id,
            },
            {
                delay,
                jobId: email.id,
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 5000,
                },
                removeOnComplete: 1000,
                removeOnFail: 1000,
            }
        );

        // 4. Store BullMQ job ID
        await prisma.email.update({
            where: { id: email.id },
            data: { bullJobId: job.id },
        });

        // 5. Index in Elasticsearch
        await indexEmailDocument({
            id: email.id,
            userId: email.userId,
            senderId: email.senderId,
            recipient: email.recipient,
            subject: email.subject,
            body: email.body,
            status: email.status,
            scheduledAt: email.scheduledAt,
            sentAt: null,
            createdAt: email.createdAt,
        });

        return res.status(201).json({
            message: "Email scheduled successfully",
            emailId: email.id,
            jobId: job.id,
            scheduledAt: email.scheduledAt,
        });
    } catch (error) {
        console.error("Schedule email error:", error);
        return res.status(500).json({
            message: "Failed to schedule email",
        });
    }
};

/**
 * Phase 13: Bulk Scheduling API
 * Accepts list of recipients, deduplicates, spaces them, and schedules all jobs
 */
export const scheduleBulkEmails = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const {
            senderId,
            recipients,
            subject,
            body,
            startTime,
            delayBetweenEmailsMs,
            hourlyLimit,
        } = req.body;

        if (!senderId || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
            return res.status(400).json({
                message: "A sender and a non-empty recipients array are required",
            });
        }

        if (!subject || !body) {
            return res.status(400).json({
                message: "Subject and body are required",
            });
        }

        // Verify sender belongs to user
        const sender = await prisma.sender.findFirst({
            where: { id: senderId, userId },
        });

        if (!sender) {
            return res.status(403).json({
                message: "Sender not found or not owned by user",
            });
        }

        // Update sender hourly limit if provided
        const parsedBulkLimit = hourlyLimit !== undefined && hourlyLimit !== null && Number(hourlyLimit) > 0
            ? Number(hourlyLimit)
            : undefined;
        if (parsedBulkLimit && sender.hourlyLimit !== parsedBulkLimit) {
            await prisma.sender.update({
                where: { id: sender.id },
                data: { hourlyLimit: parsedBulkLimit },
            });
            sender.hourlyLimit = parsedBulkLimit;
            console.log(`Updated sender ${sender.email} (${sender.id}) hourlyLimit to ${parsedBulkLimit}`);
        }

        // Validate and deduplicate recipients
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const seen = new Set<string>();
        const validRecipients: string[] = [];

        for (const raw of recipients) {
            const trimmed = String(raw).trim().toLowerCase();
            if (emailRegex.test(trimmed) && !seen.has(trimmed)) {
                seen.add(trimmed);
                validRecipients.push(trimmed);
            }
        }

        if (validRecipients.length === 0) {
            return res.status(400).json({
                message: "No valid email addresses found in the recipient list",
            });
        }

        const baseTimestamp = startTime ? new Date(startTime).getTime() : Date.now();
        const startMillis = isNaN(baseTimestamp) ? Date.now() : Math.max(baseTimestamp, Date.now());
        const spacingMs = delayBetweenEmailsMs ? Math.max(Number(delayBetweenEmailsMs), 0) : 2000;

        const scheduledResults = [];

        // Schedule each recipient with calculated spaced timestamp
        for (let i = 0; i < validRecipients.length; i++) {
            const recipient = validRecipients[i] as string;
            const targetTime = new Date(startMillis + (i * spacingMs));

            // 1. Create DB record
            const email = await prisma.email.create({
                data: {
                    userId,
                    senderId: sender.id,
                    recipient,
                    subject,
                    body,
                    scheduledAt: targetTime,
                    status: "SCHEDULED",
                },
            });

            // 2. Add delayed BullMQ job
            const delay = Math.max(targetTime.getTime() - Date.now(), 0);
            const job = await emailQueue.add(
                "send-email",
                { emailId: email.id },
                {
                    delay,
                    jobId: email.id,
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 5000,
                    },
                    removeOnComplete: 1000,
                    removeOnFail: 1000,
                }
            );

            // 3. Update BullMQ job ID
            await prisma.email.update({
                where: { id: email.id },
                data: { bullJobId: job.id },
            });

            // 4. Index in Elasticsearch
            await indexEmailDocument({
                id: email.id,
                userId: email.userId,
                senderId: email.senderId,
                recipient: email.recipient,
                subject: email.subject,
                body: email.body,
                status: email.status,
                scheduledAt: email.scheduledAt,
                sentAt: null,
                createdAt: email.createdAt,
            });

            scheduledResults.push({
                emailId: email.id,
                recipient: email.recipient,
                scheduledAt: email.scheduledAt,
            });
        }

        return res.status(201).json({
            message: `Successfully scheduled ${validRecipients.length} emails`,
            count: validRecipients.length,
            scheduledEmails: scheduledResults,
        });
    } catch (error) {
        console.error("Bulk schedule error:", error);
        return res.status(500).json({
            message: "Failed to schedule bulk emails",
        });
    }
};

/**
 * Phase 14: Get scheduled emails (SCHEDULED or PROCESSING)
 */
export const getScheduledEmails = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const emails = await prisma.email.findMany({
            where: {
                userId,
                status: { in: ["SCHEDULED", "PROCESSING"] },
            },
            include: {
                sender: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { scheduledAt: "asc" },
        });

        return res.json(emails);
    } catch (error) {
        console.error("Get scheduled emails error:", error);
        return res.status(500).json({ message: "Failed to fetch scheduled emails" });
    }
};

/**
 * Phase 14: Get sent/completed emails (SENT or FAILED)
 */
export const getSentEmails = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const emails = await prisma.email.findMany({
            where: {
                userId,
                status: { in: ["SENT", "FAILED"] },
            },
            include: {
                sender: {
                    select: { id: true, name: true, email: true },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return res.json(emails);
    } catch (error) {
        console.error("Get sent emails error:", error);
        return res.status(500).json({ message: "Failed to fetch sent emails" });
    }
};

/**
 * Phase 9: Search emails using Elasticsearch (with DB fallback)
 */
export const searchEmails = async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ message: "Authentication required" });
        }

        const queryText = (req.query.q as string) || "";
        if (!queryText.trim()) {
            return res.json([]);
        }

        const results = await searchEmailsInES(userId, queryText.trim());
        return res.json(results);
    } catch (error) {
        console.error("Search emails error:", error);
        return res.status(500).json({ message: "Failed to search emails" });
    }
};