import { Router } from "express";
import {
    connectSlack,
    handleSlackCallback,
    getIntegrationStatus,
    deleteSlackIntegration,
} from "../controllers/slack.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/connect", requireAuth, connectSlack);
router.get("/callback", handleSlackCallback);
router.get("/status", requireAuth, getIntegrationStatus);
router.delete("/", requireAuth, deleteSlackIntegration);

export default router;
