const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const requestIp = require('request-ip');

// Rate limiting for like endpoints
const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 likes per windowMs
  message: 'Too many like requests from this IP, please try again later'
});

// Article model (assuming you have this)
const Article = require('../models/Article');

// Like tracking model
const Like = require('../models/Like');

// Middleware to get client IP
const getClientIp = (req) => {
  return requestIp.getClientIp(req) || req.ip;
};

// POST /api/likes/:articleId - Like an article
router.post('/:articleId', likeLimiter, async (req, res) => {
  try {
    const { articleId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    const clientIp = getClientIp(req);
    
    // Check if article exists
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check if this IP has already liked the article
    const existingLike = await Like.findOne({ 
      articleId, 
      userIp: clientIp 
    });

    if (existingLike) {
      // Unlike if already liked
      await Like.deleteOne({ _id: existingLike._id });
      
      // Decrement likes count
      article.likes = Math.max(0, article.likes - 1);
      await article.save();
      
      return res.json({ 
        likes: article.likes, 
        userLiked: false 
      });
    }

    // Create new like
    const newLike = new Like({
      articleId,
      userIp: clientIp,
      createdAt: new Date()
    });
    await newLike.save();

    // Increment likes count
    article.likes = (article.likes || 0) + 1;
    await article.save();

    res.json({ 
      likes: article.likes, 
      userLiked: true 
    });

  } catch (error) {
    console.error('Error in like endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/likes/:articleId/status - Check like status
router.get('/:articleId/status', async (req, res) => {
  try {
    const { articleId } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      return res.status(400).json({ error: 'Invalid article ID' });
    }

    const clientIp = getClientIp(req);
    
    // Get article likes count
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    // Check if user has liked
    const userLiked = await Like.exists({ 
      articleId, 
      userIp: clientIp 
    });

    res.json({ 
      likes: article.likes || 0, 
      userLiked: !!userLiked 
    });

  } catch (error) {
    console.error('Error in like status endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
