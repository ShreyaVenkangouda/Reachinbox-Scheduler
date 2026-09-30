import { Client } from "@elastic/elasticsearch";
import { prisma } from "../config/prisma";

export const ELASTICSEARCH_INDEX = "emails";

export const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || "http://127.0.0.1:9200",
});

let isEsConnected = false;

export const initElasticsearch = async () => {
    try {
        await esClient.ping();
        isEsConnected = true;
        console.log("Elasticsearch connected successfully");

        const exists = await esClient.indices.exists({ index: ELASTICSEARCH_INDEX });
        if (!exists) {
            await esClient.indices.create({
                index: ELASTICSEARCH_INDEX,
                mappings: {
                    properties: {
                        id: { type: "keyword" },
                        userId: { type: "keyword" },
                        senderId: { type: "keyword" },
                        recipient: { type: "text" },
                        subject: { type: "text" },
                        body: { type: "text" },
                        status: { type: "keyword" },
                        scheduledAt: { type: "date" },
                        sentAt: { type: "date" },
                        createdAt: { type: "date" },
                    },
                },
            });
            console.log(`Created Elasticsearch index: ${ELASTICSEARCH_INDEX}`);
        }
    } catch (error) {
        isEsConnected = false;
        console.warn("Elasticsearch initialization warning (will use DB fallback):", error instanceof Error ? error.message : error);
    }
};

export const indexEmailDocument = async (email: {
    id: string;
    userId: string;
    senderId: string;
    recipient: string;
    subject: string;
    body: string;
    status: string;
    scheduledAt: Date;
    sentAt?: Date | null;
    createdAt: Date;
}) => {
    try {
        await esClient.index({
            index: ELASTICSEARCH_INDEX,
            id: email.id,
            document: {
                id: email.id,
                userId: email.userId,
                senderId: email.senderId,
                recipient: email.recipient,
                subject: email.subject,
                body: email.body,
                status: email.status,
                scheduledAt: email.scheduledAt,
                sentAt: email.sentAt || null,
                createdAt: email.createdAt,
            },
        });
    } catch (error) {
        console.warn(`Failed to index email ${email.id} in Elasticsearch:`, error instanceof Error ? error.message : error);
    }
};

export const searchEmailsInES = async (userId: string, queryText: string) => {
    try {
        if (!isEsConnected) {
            await esClient.ping();
            isEsConnected = true;
        }

        const response = await esClient.search({
            index: ELASTICSEARCH_INDEX,
            query: {
                bool: {
                    filter: [{ term: { userId } }],
                    must: [
                        {
                            multi_match: {
                                query: queryText,
                                fields: ["recipient^2", "subject^2", "body"],
                                fuzziness: "AUTO",
                            },
                        },
                    ],
                },
            },
        });

        const hits = response.hits.hits.map((hit) => hit._source);
        return hits;
    } catch (error) {
        console.warn("Elasticsearch search failed, falling back to PostgreSQL:", error instanceof Error ? error.message : error);
        
        // Graceful DB fallback
        const results = await prisma.email.findMany({
            where: {
                userId,
                OR: [
                    { recipient: { contains: queryText, mode: "insensitive" } },
                    { subject: { contains: queryText, mode: "insensitive" } },
                    { body: { contains: queryText, mode: "insensitive" } },
                ],
            },
            orderBy: { createdAt: "desc" },
        });

        return results;
    }
};
