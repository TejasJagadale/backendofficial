const express = require("express");
const router = express.Router();
const createContentModel = require("../models/Content");
const auth = require("../middleware/auth");

// Helper function to get the correct model based on category
const getContentModel = (category) => {
  return createContentModel(category);
};

// Like or unlike an article
router.post("/:category/:articleId/like", auth, async (req, res) => {
  try {
    const { category, articleId } = req.params;
    const { userId } = req.body;

    console.log(
      `Like request: category=${category}, articleId=${articleId}, userId=${userId}`
    );

    // Get the correct model for the category
    const ContentModel = getContentModel(category);

    // Find the article
    const article = await ContentModel.findById(articleId);
    if (!article) {
      return res.status(404).json({ message: "Article not found" });
    }

    // ✅ Ensure likes is always an array
    if (!Array.isArray(article.likes)) {
      article.likes = [];
    }

    // Check if user already liked the article
    const alreadyLiked = article.likes.some(
      (id) => id.toString() === userId.toString()
    );

    if (alreadyLiked) {
      // Unlike the article
      article.likes = article.likes.filter(
        (id) => id.toString() !== userId.toString()
      );
      console.log("Article unliked");
    } else {
      // Like the article
      article.likes.push(userId);
      console.log("Article liked");
    }

    await article.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likesCount: article.likes.length
    });
  } catch (error) {
    console.error("Like error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get like status for a user
router.get("/:category/:articleId/like-status", auth, async (req, res) => {
  try {
    const { category, articleId } = req.params;
    const userId = req.query.userId || req.body.userId; // allow frontend to send it

    console.log(
      `Like status request: category=${category}, articleId=${articleId}, userId=${userId}`
    );

    // Get the correct model for the category
    const ContentModel = getContentModel(category);

    const article = await ContentModel.findById(articleId);
    if (!article) {
      console.log("Article not found for like status");
      return res.status(404).json({ message: "Article not found" });
    }

    // Initialize likes array if it doesn't exist
    const likesArray = article.likes || [];
    const isLiked = likesArray.some(
      (id) => id.toString() === userId.toString()
    );

    console.log(`Like status: liked=${isLiked}, count=${likesArray.length}`);

    res.json({
      liked: isLiked,
      likesCount: likesArray.length
    });
  } catch (error) {
    console.error("Like status error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
