import IORedis from "ioredis";

export const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    family: 4,
    retryStrategy(times) {
        return Math.min(times * 50, 2000);
    },
});

redisConnection.on("connect", () => {
    console.log("Redis connected");
});

redisConnection.on("error", (error) => {
    console.error("Redis error:", error);
});