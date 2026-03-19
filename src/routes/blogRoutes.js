import express from "express";

import { getBlogBySlug, listPublishedBlogs } from "../controllers/blogController.js";

const router = express.Router();

router.get("/", listPublishedBlogs);
router.get("/:slug", getBlogBySlug);

export default router;
