const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const requestIp = require('request-ip');
const Article = require('../models/Article');
const Like = require('../models/Like');

// Rate limiting configuration with proper proxy handling
const likeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  message: 'Too many like requests from this IP. Please try again later.',
  validate: { 
    trustProxy: true // Enable proxy validation
  },
  keyGenerator: (req) => {
    // Get the client IP from request-ip with proxy support
    const ip = requestIp.getClientIp(req);
    // Handle cases where IP might be undefined
    return ip ? ip.replace('::ffff:', '').split(',')[0].trim() : req.ip;
  }
});

// Improved IP detection middleware
const getClientIp = (req) => {
  try {
    let clientIp = requestIp.getClientIp(req);
    
    // If no IP found, fall back to Express's IP
    if (!clientIp) return req.ip;
    
    // Handle multiple IPs in X-Forwarded-For
    if (clientIp.includes(',')) {
      clientIp = clientIp.split(',')[0].trim();
    }
    
    // Clean IPv6-mapped IPv4 addresses
    return clientIp.replace('::ffff:', '');
  } catch (error) {
    console.error('Error getting client IP:', error);
    return req.ip;
  }
};

/**
 * @route POST /api/likes/:articleId
 * @desc Like/unlike an article
 * @access Public
 */
router.post('/:articleId', likeLimiter, async (req, res) => {
  const { articleId } = req.params;
  
  // Validate article ID
  if (!mongoose.Types.ObjectId.isValid(articleId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid article ID format' 
    });
  }

  try {
    const clientIp = getClientIp(req);
    
    // Find the article
    const article = await Article.findById(articleId);
    if (!article) {
      return res.status(404).json({ 
        success: false,
        error: 'Article not found' 
      });
    }

    // Check for existing like
    const existingLike = await Like.findOne({ 
      articleId, 
      userIp: clientIp 
    });

    let result;
    
    if (existingLike) {
      // Unlike the article
      await Like.deleteOne({ _id: existingLike._id });
      article.likes = Math.max(0, (article.likes || 0) - 1);
      result = { likes: article.likes, userLiked: false };
    } else {
      // Like the article
      const newLike = new Like({
        articleId,
        userIp: clientIp,
        createdAt: new Date()
      });
      await newLike.save();
      article.likes = (article.likes || 0) + 1;
      result = { likes: article.likes, userLiked: true };
    }

    // Save the updated article
    await article.save();

    res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Like operation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
});

/**
 * @route GET /api/likes/:articleId/status
 * @desc Get like status for an article
 * @access Public
 */
router.get('/:articleId/status', async (req, res) => {
  const { articleId } = req.params;

  // Validate article ID
  if (!mongoose.Types.ObjectId.isValid(articleId)) {
    return res.status(400).json({ 
      success: false,
      error: 'Invalid article ID format' 
    });
  }

  try {
    const clientIp = getClientIp(req);
    
    // Get article and like status in parallel
    const [article, userLiked] = await Promise.all([
      Article.findById(articleId).select('likes'),
      Like.exists({ articleId, userIp: clientIp })
    ]);

    if (!article) {
      return res.status(404).json({ 
        success: false,
        error: 'Article not found' 
      });
    }

    res.status(200).json({
      success: true,
      likes: article.likes || 0,
      userLiked: !!userLiked
    });

  } catch (error) {
    console.error('Like status check error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: error.message 
    });
  }
});

module.exports = router;
