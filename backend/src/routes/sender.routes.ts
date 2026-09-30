import { Router } from "express";
import { getSenders, createSender } from "../controllers/sender.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/", requireAuth, getSenders);
router.post("/", requireAuth, createSender);

export default router;
