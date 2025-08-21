const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// User Schema - Define it only once
// User Schema - Updated to include mobile number
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobile: { type: String, required: true, unique: true, trim: true },
  password: { type: String, minlength: 6 },
  avatar: { type: String },
  googleId: { type: String },
  isVerified: { type: Boolean, default: false }
}, {
  timestamps: true
});


// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});


// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create model - check if it already exists to avoid OverwriteModelError
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Google OAuth endpoint
// In your authRoutes.js
// router.post('/google', async (req, res) => {
//   try {
//     res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
//     res.header('Access-Control-Allow-Credentials', 'true');

//     const { token } = req.body;
//     const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

//     const ticket = await client.verifyIdToken({
//       idToken: token,
//       audience: process.env.GOOGLE_CLIENT_ID,
//     });

//     const payload = ticket.getPayload();
//     const { email, name, picture, sub: googleId } = payload;

//     let user = await User.findOne({ email });

//     if (!user) {
//       user = new User({
//         name,
//         email,
//         avatar: picture,
//         googleId,
//         isVerified: true,
//         password: undefined // no password for Google user
//       });
//       await user.save();
//     }

//     const jwtToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });

//     res.json({
//       success: true,
//       token: jwtToken,
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         avatar: user.avatar
//       }
//     });
//   } catch (error) {
//     console.error('Google auth error:', error);
//     res.status(500).json({ 
//       success: false, 
//       message: 'Google authentication failed',
//       error: error.message 
//     });
//   }
// }

router.post('/google', async (req, res) => {
  try {
    console.log('Google auth request received');
    console.log('Request headers:', req.headers);
    console.log('Request body:', req.body);

    const { token } = req.body;
    
    if (!token) {
      console.log('No token provided');
      return res.status(400).json({ 
        success: false, 
        message: 'No Google token provided' 
      });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    console.log('Google token verified successfully');
    const payload = ticket.getPayload();
    console.log('Google payload:', {
      email: payload.email,
      name: payload.name,
      googleId: payload.sub
    });

    const { email, name, picture, sub: googleId } = payload;

    // Check if user already exists with this Google ID
    let user = await User.findOne({ 
      $or: [
        { googleId },
        { email }
      ]
    });

    if (!user) {
      // Create new user with Google authentication
      console.log('Creating new user from Google authentication');
      user = new User({
        name,
        email,
        avatar: picture,
        googleId,
        isVerified: true,
        // No password for Google users
        password: undefined
      });
      await user.save();
      console.log('New user created:', user._id);
    } else if (user.googleId !== googleId) {
      // User exists but not with Google auth - update with Google ID
      console.log('Updating existing user with Google ID');
      user.googleId = googleId;
      user.avatar = picture;
      user.isVerified = true;
      await user.save();
    }

    // Generate JWT token
    const jwtToken = jwt.sign({ 
      userId: user._id,
      email: user.email 
    }, JWT_SECRET, { expiresIn: '7d' });

    console.log('JWT token generated for user:', user._id);

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        mobile: user.mobile
      }
    });

  } catch (error) {
    console.error('Google auth error details:', error);
    
    // More specific error messages
    if (error.message.includes('Token used too late')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google token has expired. Please try again.' 
      });
    }
    
    if (error.message.includes('Wrong number of segments')) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Google token format.' 
      });
    }

    res.status(500).json({ 
      success: false, 
      message: 'Google authentication failed',
      error: error.message 
    });
  }
});

// Signup endpoint - Updated to accept mobile number
router.post('/signup', async (req, res) => {
  try {
    const { name, email, mobile, password } = req.body;
    
    // Check if user already exists with email
    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      return res.status(400).json({ message: 'User already exists with this email' });
    }
    
    // Check if user already exists with mobile number
    const existingUserByMobile = await User.findOne({ mobile });
    if (existingUserByMobile) {
      return res.status(400).json({ message: 'User already exists with this mobile number' });
    }
    
    // Validate mobile number format
    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit mobile number' });
    }
    
    // Create new user
    const user = new User({ name, email, mobile, password });
    await user.save();
    
    // Don't generate JWT token or log in automatically
    // Just return success message
    res.status(201).json({
      message: 'User created successfully. Please login.',
      success: true
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Protected route example
router.get('/profile', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
