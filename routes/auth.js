const express = require('express');
const User = require('../models/User');
const JWTService = require('../services/jwt');
const router = express.Router();

const jwtService = new JWTService();

// Signup route
router.post('/signup', async (req, res) => {
  try {
    const { password, contractorId, email, name } = req.body;
    
    // Check if contractor ID is provided
    if (!contractorId) {
      return res.status(400).json({ error: 'Contractor ID is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    
    if (existingUser) {
      return res.status(400).json({ 
        error: 'Email already exists' 
      });
    }

    const user = await User.create({
      email,
      password,
      contractorId,
      name
    });

    // Generate JWT tokens
    const tokens = jwtService.generateTokens(user);
    
    // Store refresh token in database
    await user.addRefreshToken(
      tokens.refreshToken,
      req.headers['user-agent'],
      req.ip || req.connection.remoteAddress
    );

    // Set cookies for web requests
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Also set session for backward compatibility
    req.session.user = {
      id: user._id,
      email: user.email,
      contractorId: user.contractorId,
      name: user.name
    };

    // For API requests, return JSON with tokens
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        message: 'Signup successful',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          contractorId: user.contractorId
        },
        tokens
      });
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Error creating user' });
  }
});

// Login route
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null, email: '' });
});

// Login POST handler
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt for:', email);

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password))) {
      return res.render('login', { 
        error: 'Invalid email or password',
        email 
      });
    }

    // Generate JWT tokens
    const tokens = jwtService.generateTokens(user);
    
    // Store refresh token in database
    await user.addRefreshToken(
      tokens.refreshToken,
      req.headers['user-agent'],
      req.ip || req.connection.remoteAddress
    );

    // Set cookies for web requests
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Also set session for backward compatibility
    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      contractorId: user.contractorId
    };

    // For API requests, return JSON with tokens
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({
        message: 'Login successful',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          contractorId: user.contractorId,
          role: user.role,
          isAdmin: user.isAdmin
        },
        tokens
      });
    }

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { 
      error: 'An error occurred during login',
      email: req.body.email 
    });
  }
});

// Logout route
router.get('/logout', async (req, res) => {
  try {
    // Remove refresh token from database if it exists
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      try {
        const decoded = jwtService.verifyRefreshToken(refreshToken);
        const user = await User.findById(decoded.id);
        if (user) {
          await user.removeRefreshToken(refreshToken);
        }
      } catch (jwtError) {
        console.log('Error removing refresh token:', jwtError.message);
      }
    }

    // Clear JWT cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    // Destroy session for backward compatibility
    req.session.destroy();

    res.redirect('/');
  } catch (error) {
    console.error('Logout error:', error);
    res.redirect('/');
  }
});

// Logout from all devices
router.post('/logout-all', async (req, res) => {
  try {
    // Get user from JWT or session
    let userId = null;
    
    if (req.cookies.refreshToken) {
      try {
        const decoded = jwtService.verifyRefreshToken(req.cookies.refreshToken);
        userId = decoded.id;
      } catch (jwtError) {
        console.log('JWT verification failed:', jwtError.message);
      }
    }
    
    if (!userId && req.session && req.session.user) {
      userId = req.session.user.id;
    }

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        await user.removeAllRefreshTokens();
      }
    }

    // Clear JWT cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');

    // Destroy session
    req.session.destroy();

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ message: 'Logged out from all devices' });
    }

    res.redirect('/');
  } catch (error) {
    console.error('Logout all error:', error);
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(500).json({ error: 'Error during logout' });
    }
    res.redirect('/');
  }
});

// Token refresh route
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const cookieRefreshToken = req.cookies.refreshToken;
    
    const tokenToUse = refreshToken || cookieRefreshToken;
    
    if (!tokenToUse) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwtService.verifyRefreshToken(tokenToUse);
    
    // Find user and verify they have this refresh token
    const user = await User.findById(decoded.id);
    if (!user || !user.hasRefreshToken(tokenToUse)) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Generate new tokens
    const tokens = jwtService.generateTokens(user);
    
    // Replace old refresh token with new one
    await user.removeRefreshToken(tokenToUse);
    await user.addRefreshToken(
      tokens.refreshToken,
      req.headers['user-agent'],
      req.ip || req.connection.remoteAddress
    );

    // Set new cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    };

    res.cookie('accessToken', tokens.accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    res.cookie('refreshToken', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.json({
      message: 'Tokens refreshed successfully',
      tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// Delete account route
router.post('/delete-account', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Delete user from database
    await User.findOneAndDelete({ email: req.session.user.email });

    // Clear session
    req.session.destroy();

    res.redirect('/');
  } catch (error) {
    console.error('Account deletion error:', error);
    res.status(500).json({ error: 'Error deleting account' });
  }
});

// Admin login POST handler
router.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Admin login attempt for:', email);

    const user = await User.findOne({ email });

    if (!user || !(await user.comparePassword(password)) || !user.isAdmin) {
      return res.render('login', { 
        error: 'Invalid admin credentials',
        email 
      });
    }

    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin: true
    };

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Admin login error:', error);
    res.render('login', { 
      error: 'An error occurred during admin login',
      email: req.body.email 
    });
  }
});

module.exports = router; 