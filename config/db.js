const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    await mongoose.connect(
      process.env.MONGODB_URI,
      {
        useNewUrlParser: true,
        useUnifiedTopology: true
      }
    );
    console.log("MongoDB Connected to newsupdate database...");
  } catch (err) {
    console.error("Database connection error:", err.message);
    process.exit(1);
  }
  mongoose.connection.on("connected", () => {
    console.log("Connected to DB:", mongoose.connection.db.databaseName);
  });
};

module.exports = connectDB;
