const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  userIp: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index to ensure one like per IP per article
likeSchema.index({ articleId: 1, userIp: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
