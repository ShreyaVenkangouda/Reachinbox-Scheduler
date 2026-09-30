import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import emailRoutes from "./routes/email.routes";
import authRoutes from "./routes/auth.routes";
import senderRoutes from "./routes/sender.routes";
import slackRoutes from "./routes/slack.routes";
import { emailWorker } from "./workers/email.worker";
import { emailQueue } from "./queues/email.queue";
import { redisConnection } from "./config/redis";
import { prisma } from "./config/prisma";
import { initElasticsearch } from "./services/elasticsearch.service";

dotenv.config();

const app = express();

const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

app.use(
    cors({
        origin: frontendOrigin,
        credentials: true,
    })
);

app.use(cookieParser());
app.use(express.json());

// Bull Board Queue Dashboard (Phase 10)
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        message: "ReachInbox backend running",
    });
});

// Mount Routes
app.use("/auth", authRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/emails", emailRoutes);
app.use("/api/senders", senderRoutes);
app.use("/api/integrations/slack", slackRoutes);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
    console.log(`Backend running on http://localhost:${PORT}`);
    console.log(`Bull Board dashboard available at http://localhost:${PORT}/admin/queues`);
    await initElasticsearch();
});

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    const forceExitTimeout = setTimeout(() => {
        console.error("Graceful shutdown timed out, forcing exit.");
        process.exit(1);
    }, 10000);
    forceExitTimeout.unref();

    try {
        await new Promise<void>((resolve) => {
            server.close((err) => {
                if (err) {
                    console.error("Error closing HTTP server:", err);
                } else {
                    console.log("HTTP server closed");
                }
                resolve();
            });
        });

        await emailWorker.close();
        console.log("BullMQ worker closed");

        await emailQueue.close();
        console.log("BullMQ queue closed");

        await redisConnection.quit();
        console.log("Redis connection closed");

        await prisma.$disconnect();
        console.log("Prisma disconnected");

        clearTimeout(forceExitTimeout);
        console.log("Graceful shutdown completed successfully.");
        process.exit(0);
    } catch (error) {
        console.error("Error during graceful shutdown:", error);
        clearTimeout(forceExitTimeout);
        process.exit(1);
    }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));