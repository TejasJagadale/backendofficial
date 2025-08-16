const express = require("express");
const router = express.Router();
const Comment = require("../models/Comment");

// Get comments for an article
router.get("/:articleId", async (req, res) => {
  try {
    const comments = await Comment.find({ articleId: req.params.articleId })
      .sort({ createdAt: -1 });
    res.json(comments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a new comment
router.post("/", async (req, res) => {
  try {
    const { articleId, articleCategory, content, author, email, mobile } = req.body;
    
    // Validate required fields
    if (!articleId || !articleCategory || !content || !email) {
      return res.status(400).json({ 
        message: "Missing required fields: articleId, articleCategory, content, or email" 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        message: "Invalid email format" 
      });
    }

    const newComment = new Comment({
      articleId,
      articleCategory,
      content,
      author: author || email, // Use email as author name if author not provided
      email,
      mobile: mobile || "" // Mobile is optional
    });

    const savedComment = await newComment.save();
    res.status(201).json(savedComment);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(val => val.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: messages
      });
    }
    res.status(500).json({ message: err.message });
  }
});

// Delete a comment (optional)
router.delete("/:id", async (req, res) => {
  try {
    const deletedComment = await Comment.findByIdAndDelete(req.params.id);
    if (!deletedComment) {
      return res.status(404).json({ message: "Comment not found" });
    }
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
