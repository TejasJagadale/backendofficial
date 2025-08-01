const express = require("express");
const router = express.Router();
const { getUploadUrl } = require("../services/s3Service");

router.get("/upload-url", async (req, res) => {
  try {
    const { fileType } = req.query;
    if (!fileType) {
      return res.status(400).json({ message: "File type is required" });
    }

    const { uploadUrl, key, publicUrl } = await getUploadUrl(fileType);

    res.json({
      uploadUrl,
      key,
      publicUrl // Send this to frontend
    });
  } catch (error) {
    console.error("S3 Route Error:", error);
    res.status(500).json({
      message: "Failed to generate upload URL",
      error: error.message
    });
  }
});

router.delete("/delete-file", async (req, res) => {
  try {
    const { key } = req.body; // Expecting the S3 object key in the request body

    if (!key) {
      return res.status(400).json({ message: "File key is required" });
    }

    // Extract just the object key if a full URL was provided
    const urlPattern =
      /https:\/\/videosbucketlookit\.s3\.ap-south-1\.amazonaws\.com\/(.*)/;
    const match = key.match(urlPattern);
    const objectKey = match ? match[1] : key;

    await deleteFile(objectKey);

    res.json({
      success: true,
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error("S3 Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message
    });
  }
});

module.exports = router;
