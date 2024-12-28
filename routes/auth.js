const express = require('express');
const User = require('../models/User');
const router = express.Router();

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

    req.session.user = {
      email: user.email,
      contractorId: user.contractorId,
      name: user.name
    };

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

    req.session.user = {
      id: user._id,
      email: user.email,
      name: user.name,
      contractorId: user.contractorId
    };

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
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
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