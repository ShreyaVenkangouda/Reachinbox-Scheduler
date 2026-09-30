import { Worker } from "bullmq";
import { redisConnection } from "../config/redis";
import { prisma } from "../config/prisma";
import { sendEmail } from "../services/email.service";
import { EMAIL_QUEUE_NAME, emailQueue } from "../queues/email.queue";
import { reserveSendSlot, checkAndIncrementSenderRate } from "../services/rateLimiter.service";
import { notifyRateLimitReached } from "../services/slack.service";
import { indexEmailDocument } from "../services/elasticsearch.service";

export const emailWorker = new Worker(
    EMAIL_QUEUE_NAME,

    async (job) => {
        const { emailId } = job.data;

        console.log("Processing email:", emailId);

        // 1. Fetch email record with sender
        const email = await prisma.email.findUnique({
            where: {
                id: emailId,
            },
            include: {
                sender: true,
            },
        });

        if (!email) {
            console.warn(`Email not found: ${emailId}`);
            return;
        }

        // 2. Early idempotency check: already sent
        if (email.status === "SENT") {
            console.log("Email already sent. Skipping:", email.id);
            return;
        }

        // 3. Atomically claim the email in PostgreSQL
        // Only one worker/attempt can successfully transition SCHEDULED -> PROCESSING
        const claimed = await prisma.email.updateMany({
            where: {
                id: emailId,
                status: "SCHEDULED",
            },
            data: {
                status: "PROCESSING",
                attempts: {
                    increment: 1,
                },
            },
        });

        if (claimed.count === 0) {
            const currentEmail = await prisma.email.findUnique({
                where: { id: emailId },
            });

            if (currentEmail?.status === "SENT") {
                console.log("Email already sent. Skipping:", emailId);
            } else {
                console.log(
                    `Email already claimed or not in SCHEDULED status (${currentEmail?.status}). Skipping: ${emailId}`
                );
            }
            return;
        }

        // 4. Per-Sender Hourly Rate Limit Check (Phase 7)
        const rateCheck = await checkAndIncrementSenderRate(
            email.senderId,
            email.sender?.hourlyLimit
        );

        if (!rateCheck.allowed) {
            console.log(
                `Rate limit reached for sender ${email.sender?.email || email.senderId}. Rescheduling email ${email.id} to window: ${new Date(rateCheck.nextWindowStart).toISOString()}`
            );

            // Revert back to SCHEDULED, decrement attempts (since send was not attempted), and update scheduledAt to next window
            await prisma.email.update({
                where: { id: email.id },
                data: {
                    status: "SCHEDULED",
                    scheduledAt: new Date(rateCheck.nextWindowStart),
                    attempts: {
                        decrement: 1,
                    },
                },
            });

            // Send Real Slack Notification (Phase 8 - deduplicated per sender per window)
            await notifyRateLimitReached(
                email.senderId,
                email.sender?.email || "Unknown Sender",
                email.userId,
                rateCheck.windowStart,
                rateCheck.windowMs
            );

            // Reschedule BullMQ delayed job for the next window
            const delay = Math.max(rateCheck.nextWindowStart - Date.now(), 1000);
            const delayedJob = await emailQueue.add(
                "send-email",
                { emailId: email.id },
                {
                    delay,
                    jobId: `${email.id}:window:${rateCheck.nextWindowStart}`,
                    attempts: 3,
                    backoff: {
                        type: "exponential",
                        delay: 5000,
                    },
                    removeOnComplete: 1000,
                    removeOnFail: 1000,
                }
            );

            // Update BullMQ job ID on email record
            await prisma.email.update({
                where: { id: email.id },
                data: {
                    bullJobId: delayedJob.id,
                },
            });

            return;
        }

        // 5. Global Throttle / Minimum Send Spacing (Phase 6)
        const reservedSlot = await reserveSendSlot();
        const waitMs = reservedSlot - Date.now();
        if (waitMs > 0) {
            console.log(`Global throttle: worker waiting ${waitMs}ms before sending email ${email.id}`);
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }

        // 6. Send Email via Nodemailer
        try {
            await sendEmail(
                email.recipient,
                email.subject,
                email.body
            );

            const sentAt = new Date();

            await prisma.email.update({
                where: {
                    id: email.id,
                },
                data: {
                    status: "SENT",
                    sentAt,
                    lastError: null,
                },
            });

            // Index in Elasticsearch (Phase 9)
            await indexEmailDocument({
                id: email.id,
                userId: email.userId,
                senderId: email.senderId,
                recipient: email.recipient,
                subject: email.subject,
                body: email.body,
                status: "SENT",
                scheduledAt: email.scheduledAt,
                sentAt,
                createdAt: email.createdAt,
            });

            console.log("Email completed:", email.recipient);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : "Unknown error";

            // Make DB state compatible with BullMQ retry:
            // Revert back to SCHEDULED and record lastError so BullMQ retry can claim it again
            await prisma.email.update({
                where: {
                    id: email.id,
                },
                data: {
                    status: "SCHEDULED",
                    lastError: message,
                },
            });

            console.error("Email failed:", message);

            // Important: let BullMQ retry it
            throw error;
        }
    },

    {
        connection: redisConnection,

        // Configurable concurrency requirement (Phase 6)
        concurrency: Number(
            process.env.WORKER_CONCURRENCY || 5
        ),
    }
);

emailWorker.on("completed", (job) => {
    console.log(`Job ${job.id} completed`);
});

emailWorker.on("failed", async (job, error) => {
    console.error(
        `Job ${job?.id} failed:`,
        error.message
    );

    // If all BullMQ retries have been exhausted, mark the email as FAILED in DB
    if (job && job.data?.emailId && job.attemptsMade >= (job.opts.attempts || 1)) {
        try {
            const failedEmail = await prisma.email.update({
                where: {
                    id: job.data.emailId,
                },
                data: {
                    status: "FAILED",
                    lastError: error.message,
                },
            });

            // Update status in Elasticsearch
            await indexEmailDocument({
                id: failedEmail.id,
                userId: failedEmail.userId,
                senderId: failedEmail.senderId,
                recipient: failedEmail.recipient,
                subject: failedEmail.subject,
                body: failedEmail.body,
                status: "FAILED",
                scheduledAt: failedEmail.scheduledAt,
                sentAt: failedEmail.sentAt,
                createdAt: failedEmail.createdAt,
            });

            console.error(
                `Job ${job.id} exhausted all retries (${job.attemptsMade}/${job.opts.attempts || 1}). Status set to FAILED in DB.`
            );
        } catch (dbError) {
            console.error("Failed to mark email as FAILED in DB:", dbError);
        }
    }
});