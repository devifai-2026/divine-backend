import { Router } from "express";
import {
  getSitemap,
  getRobots,
  getSeoMeta,
  getRedirects,
  createRedirect,
  deleteRedirect,
} from "../controllers/seo.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import isAdmin from "../middlewares/admin.middleware.js";

const router = Router();

// Public — search engine endpoints
router.get("/sitemap.xml", getSitemap);
router.get("/robots.txt", getRobots);

// Public — frontend React Helmet meta API
router.get("/api/seo/meta", getSeoMeta);

// Admin — redirect management
router.get("/api/seo/redirects", verifyJWT, isAdmin, getRedirects);
router.post("/api/seo/redirects", verifyJWT, isAdmin, createRedirect);
router.delete("/api/seo/redirects/:id", verifyJWT, isAdmin, deleteRedirect);

export default router;
