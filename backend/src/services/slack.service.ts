import { prisma } from "../config/prisma";
import { redisConnection } from "../config/redis";

export const getSlackAuthUrl = (userId: string): string => {
    const clientId = process.env.SLACK_CLIENT_ID || "";
    const redirectUri = encodeURIComponent(process.env.SLACK_REDIRECT_URI || "http://localhost:5000/api/integrations/slack/callback");
    const scope = encodeURIComponent("chat:write,chat:write.public,channels:read");
    const state = encodeURIComponent(userId);

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scope}&redirect_uri=${redirectUri}&state=${state}`;
};

export const exchangeSlackCode = async (code: string, userId: string) => {
    const clientId = process.env.SLACK_CLIENT_ID || "";
    const clientSecret = process.env.SLACK_CLIENT_SECRET || "";
    const redirectUri = process.env.SLACK_REDIRECT_URI || "http://localhost:5000/api/integrations/slack/callback";

    const response = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
        }),
    });

    const data = await response.json();

    if (!data.ok) {
        throw new Error(data.error || "Failed to exchange Slack OAuth code");
    }

    const accessToken = data.access_token;
    const teamId = data.team?.id || null;
    const teamName = data.team?.name || null;
    const incomingChannel = data.incoming_webhook?.channel_id || null;

    // Persist Slack integration for user
    const integration = await prisma.slackIntegration.upsert({
        where: { userId },
        create: {
            userId,
            accessToken,
            teamId,
            teamName,
            channelId: incomingChannel,
        },
        update: {
            accessToken,
            teamId,
            teamName,
            channelId: incomingChannel,
        },
    });

    return integration;
};

export const getSlackStatus = async (userId: string) => {
    const integration = await prisma.slackIntegration.findUnique({
        where: { userId },
    });

    if (!integration) {
        return { connected: false };
    }

    return {
        connected: true,
        teamName: integration.teamName,
        channelId: integration.channelId,
    };
};

export const disconnectSlack = async (userId: string) => {
    await prisma.slackIntegration.deleteMany({
        where: { userId },
    });
};

export const notifyRateLimitReached = async (
    senderId: string,
    senderEmail: string,
    userId: string,
    windowStart: number,
    windowMs: number
) => {
    try {
        const dedupeKey = `slack-rate-notified:${senderId}:${windowStart}`;
        const setOk = await redisConnection.set(dedupeKey, "1", "PX", windowMs, "NX");

        if (setOk !== "OK") {
            // Already notified for this sender & window
            return;
        }

        const slack = await prisma.slackIntegration.findUnique({
            where: { userId },
        });

        if (!slack || !slack.accessToken) {
            // Slack not connected for this user, gracefully skip
            return;
        }

        // Determine destination channel (saved channelId or find general/public channel)
        let targetChannel = slack.channelId;
        if (!targetChannel) {
            try {
                const listResp = await fetch("https://slack.com/api/conversations.list?types=public_channel&limit=5", {
                    headers: { Authorization: `Bearer ${slack.accessToken}` },
                });
                const listData = await listResp.json();
                if (listData.ok && listData.channels && listData.channels.length > 0) {
                    targetChannel = listData.channels[0].id;
                }
            } catch {
                // Ignore channel lookup failure
            }
        }

        if (!targetChannel) {
            targetChannel = "general";
        }

        const msgText = `⚠️ *Rate limit reached for sender \`${senderEmail}\`.* Remaining emails have been delayed until the next available hour window.`;

        const postResp = await fetch("https://slack.com/api/chat.postMessage", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${slack.accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                channel: targetChannel,
                text: msgText,
            }),
        });

        const postData = await postResp.json();
        if (!postData.ok) {
            console.warn("Slack notification API returned error:", postData.error);
        } else {
            console.log(`Slack rate limit notification sent to team ${slack.teamName || slack.teamId}`);
        }
    } catch (error) {
        console.warn("Slack rate limit notification failed (non-critical):", error instanceof Error ? error.message : error);
    }
};
