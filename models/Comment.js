const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  articleId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: 'articleCategory'
  },
  articleCategory: {
    type: String,
    required: true,
    enum: [
      "Technology", "Business", "Science", "Environment", 
      "Health", "Entertainment", "Sports", "Education", 
      "Stories", "Information", "Updates", "Insights"
    ]
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  author: {
    type: String,
    default: "Anonymous"
  },
  email: {
    type: String,
    required: true
  },
  mobile: {
    type: String,
    default: ""
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Comment", commentSchema);
