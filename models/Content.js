const mongoose = require("mongoose");

// Cache for models
const modelCache = {};

// Dynamic model creation with caching
const createContentModel = (category) => {
  // Return cached model if it exists
  if (modelCache[category]) {
    return modelCache[category];
  }

  const schema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 7000
    },
    tags: {
      type: [String],
      default: []
    },
    imageUrl: {
      type: String,
      default: ""
    },
    status: {
      type: Boolean,
      default: false
    },
    trending: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  });

  // Create and cache the model
  const model = mongoose.model(category, schema, `${category.toLowerCase()}s`);
  modelCache[category] = model;
  
  return model;
};

module.exports = createContentModel;