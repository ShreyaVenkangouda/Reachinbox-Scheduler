import { Router } from "express";
import {
    scheduleEmail,
    scheduleBulkEmails,
    getScheduledEmails,
    getSentEmails,
    searchEmails,
} from "../controllers/email.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// Single schedule
router.post("/schedule", requireAuth, scheduleEmail);

// Bulk schedule (Phase 13)
router.post("/schedule-bulk", requireAuth, scheduleBulkEmails);

// Scheduled emails list (Phase 14)
router.get("/scheduled", requireAuth, getScheduledEmails);

// Sent/Failed emails list (Phase 14)
router.get("/sent", requireAuth, getSentEmails);

// Search emails (Phase 9)
router.get("/search", requireAuth, searchEmails);

export default router;