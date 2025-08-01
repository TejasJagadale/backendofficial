const express = require("express");
const router = express.Router();
const createContentModel = require("../models/Content");
const axios = require("axios"); // Required for S3 delete requests

const categories = [
  "Technology",
  "Business",
  "Science",
  "Environment",
  "Health",
  "Entertainment",
  "Sports",
  "Education",
  "Stories",
  "Information",
  "Updates"
];

// Create new content
router.post("/:category", async (req, res) => {
  try {
    const { category } = req.params;

    if (!categories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const Content = createContentModel(category);
    const newContent = new Content({
      ...req.body,
      category // Ensure category is stored with the document
    });
    const savedContent = await newContent.save();

    res.status(201).json(savedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Get all content for a category (with category field added)
router.get("/:category", async (req, res) => {
  try {
    const { category } = req.params;

    if (!categories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const Content = createContentModel(category);
    const contents = await Content.find().sort({ createdAt: -1 });
    
    // Add category to each document
    const contentsWithCategory = contents.map(content => ({
      ...content.toObject(),
      category
    }));

    res.json(contentsWithCategory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single article by ID across all categories
router.get("/article/:id", async (req, res) => {
  try {
    const { id } = req.params;
    let foundArticle = null;
    
    for (const category of categories) {
      const Content = createContentModel(category);
      const article = await Content.findOne({ _id: id });
      if (article) {
        foundArticle = article.toObject();
        foundArticle.category = category;
        break;
      }
    }

    if (foundArticle) {
      res.json(foundArticle);
    } else {
      res.status(404).json({ message: "Article not found" });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update content
router.put("/:category/:id", async (req, res) => {
  try {
    const { category, id } = req.params;

    if (!categories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const Content = createContentModel(category);
    const updatedContent = await Content.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedContent) {
      return res.status(404).json({ message: "Content not found" });
    }

    res.json(updatedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Delete content with S3 image cleanup
router.delete("/:category/:id", async (req, res) => {
  try {
    const { category, id } = req.params;

    if (!categories.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const Content = createContentModel(category);
    const deletedContent = await Content.findByIdAndDelete(id);

    if (!deletedContent) {
      return res.status(404).json({ message: "Content not found" });
    }

    // Clean up S3 image if exists
    if (deletedContent.imageUrl) {
      try {
        await axios.delete("https://todaytalkserver.onrender.com/api/s3/delete-file", {
          data: { key: deletedContent.imageUrl }
        });
      } catch (s3Error) {
        console.error("S3 deletion error:", s3Error);
        // Continue even if image deletion fails
      }
    }

    res.json({ 
      message: "Content deleted successfully",
      deletedId: id
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle Status
router.patch("/toggle-status/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    let updatedContent;

    // Search through all categories to find the content
    for (const category of categories) {
      const Content = createContentModel(category);
      updatedContent = await Content.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
      if (updatedContent) break;
    }

    if (!updatedContent) {
      return res.status(404).json({ message: "Content not found" });
    }

    res.json(updatedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Toggle Trending
router.patch("/toggle-trending/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { trending } = req.body;

    let updatedContent;

    // Search through all categories to find the content
    for (const category of categories) {
      const Content = createContentModel(category);
      updatedContent = await Content.findByIdAndUpdate(
        id,
        { trending },
        { new: true }
      );
      if (updatedContent) break;
    }

    if (!updatedContent) {
      return res.status(404).json({ message: "Content not found" });
    }

    res.json(updatedContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
