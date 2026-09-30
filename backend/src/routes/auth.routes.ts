import { Router } from "express";
import {
    getGoogleAuthUrl,
    handleGoogleCallback,
    getMe,
    logout,
} from "../controllers/auth.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

// OAuth initiation & callback
router.get("/google", getGoogleAuthUrl);
router.get("/google/callback", handleGoogleCallback);

// Protected session user info & logout
router.get("/me", requireAuth, getMe);
router.post("/logout", requireAuth, logout);

export default router;
