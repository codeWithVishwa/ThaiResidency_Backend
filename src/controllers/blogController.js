import Blog from "../models/Blog.js";
import ApiError from "../utils/apiError.js";

export async function listPublishedBlogs(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);
  const items = await Blog.find({ status: "published" })
    .populate("author", "fullName")
    .sort({ publishedAt: -1, createdAt: -1 })
    .limit(limit);

  res.json({
    success: true,
    data: {
      items,
    },
  });
}

export async function getBlogBySlug(req, res) {
  const blog = await Blog.findOne({
    slug: String(req.params.slug),
    status: "published",
  }).populate("author", "fullName");

  if (!blog) {
    throw new ApiError(404, "Blog not found");
  }

  res.json({
    success: true,
    data: {
      blog,
    },
  });
}
