const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: String,
  content: String,
  category: String,
  imageUrl: String,
  likes: {
    type: Number,
    default: 0
  },
  // Add other fields you need
}, { timestamps: true });

module.exports = mongoose.model('Article', articleSchema);
