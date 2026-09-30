import { redisConnection } from "../config/redis";

const RESERVE_SLOT_LUA = `
local now = tonumber(ARGV[1])
local minDelay = tonumber(ARGV[2])
local current = redis.call('get', KEYS[1])
local nextAllowed = now

if current and tonumber(current) and tonumber(current) > now then
    nextAllowed = tonumber(current)
end

local newNextAllowed = nextAllowed + minDelay
redis.call('set', KEYS[1], newNextAllowed, 'EX', 3600)
return nextAllowed
`;

const CHECK_RATE_LIMIT_LUA = `
local limit = tonumber(ARGV[1])
local current = tonumber(redis.call('get', KEYS[1]) or '0')

if current >= limit then
    return {0, current}
else
    local newCount = redis.call('incr', KEYS[1])
    if newCount == 1 then
        redis.call('pexpire', KEYS[1], tonumber(ARGV[2]))
    end
    return {1, newCount}
end
`;

/**
 * Phase 6: Global spacing between individual email sends
 * Atomically reserves a timestamp slot spaced by MIN_SEND_DELAY_MS.
 */
export const reserveSendSlot = async (): Promise<number> => {
    const minDelayMs = Number(process.env.MIN_SEND_DELAY_MS || 2000);
    const now = Date.now();
    const key = "global:throttle:next_allowed_send_time";

    try {
        const reservedSlot = (await redisConnection.eval(
            RESERVE_SLOT_LUA,
            1,
            key,
            now,
            minDelayMs
        )) as number;

        return Number(reservedSlot);
    } catch (error) {
        console.warn("Failed to reserve send slot via Redis Lua, falling back to now:", error);
        return now;
    }
};

/**
 * Phase 7: Per-sender rate limiting using atomic Redis counter per time window
 */
export const checkAndIncrementSenderRate = async (
    senderId: string,
    customLimit?: number | null
): Promise<{
    allowed: boolean;
    currentCount: number;
    configuredLimit: number;
    nextWindowStart: number;
    windowStart: number;
    windowMs: number;
}> => {
    const defaultHourlyLimit = Number(
        process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || process.env.MAX_EMAILS_PER_HOUR || 200
    );
    const limit = customLimit && customLimit > 0 ? customLimit : defaultHourlyLimit;

    // Configurable window for demo/testing (defaults to 1 hour = 3600000ms)
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 3600000);
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const nextWindowStart = windowStart + windowMs;
    const key = `email-rate:${senderId}:${windowStart}`;

    try {
        const result = (await redisConnection.eval(
            CHECK_RATE_LIMIT_LUA,
            1,
            key,
            limit,
            windowMs * 2 // TTL safe buffer
        )) as [number, number];

        const allowed = result[0] === 1;
        const currentCount = Number(result[1]);

        console.log(
            `Rate limit check:\nsenderId=${senderId}\nconfiguredLimit=${limit}\ncurrentCount=${currentCount}\nwindowMs=${windowMs}\nallowed=${allowed}`
        );

        return {
            allowed,
            currentCount,
            configuredLimit: limit,
            nextWindowStart,
            windowStart,
            windowMs,
        };
    } catch (error) {
        console.warn("Rate limit check failed, allowing send as fallback:", error);
        return {
            allowed: true,
            currentCount: 0,
            configuredLimit: limit,
            nextWindowStart,
            windowStart,
            windowMs,
        };
    }
};
