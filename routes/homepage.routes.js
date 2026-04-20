import { Router } from "express";
import { getHomepage } from "../controllers/homepage.controller.js";

const router = Router();

router.get("/", getHomepage);

export default router;
