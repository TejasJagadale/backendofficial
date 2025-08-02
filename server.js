require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const contentRoutes = require("./routes/contentRoutes");
const s3Routes = require("./routes/s3Routes");

const app = express();

// Connect to database first
connectDB();

const allowedOrigins = [
  // "https://ttcontentpost.vercel.app",
 "https://todaytalks.vercel.app",
 "https://contentpostofficial.vercel.app",
 "https://ttcontentpost.vercel.app"
];
console.log("hi this is frontend");
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/s3", s3Routes);
app.use("/api/contents", contentRoutes);

// Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Basic route
app.get("/", (req, res) => {
  res.send("Content Management API");
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

