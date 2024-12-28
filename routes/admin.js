const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

// Admin middleware
const isAdmin = async (req, res, next) => {
  if (!req.session.user?.isAdmin) {
    return res.redirect('/');
  }
  next();
};

// Middleware to check if user is super admin
const isSuperAdmin = async (req, res, next) => {
  if (!req.session.user?.isSuperAdmin) {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
};

// Add master admin check middleware
const isMasterAdmin = async (req, res, next) => {
  if (req.session.user?.email !== 'admin@test.com') {
    return res.status(403).json({ error: 'Not authorized. Only master admin can perform this action.' });
  }
  next();
};

// Admin dashboard
router.get('/dashboard', isAdmin, async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ createdAt: -1 });
    
    const stats = {
      totalUsers: users.length,
      activeUsers: users.filter(u => u.status === 'active').length,
      onlineToday: users.filter(u => {
        const today = new Date();
        return u.lastLogin && u.lastLogin.toDateString() === today.toDateString();
      }).length
    };

    res.render('admin/dashboard', { 
      user: req.session.user,
      users,
      stats
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.render('error', {
      message: 'Error loading admin dashboard',
      error: error.message
    });
  }
});

// Add new user
router.post('/users', isAdmin, async (req, res) => {
  try {
    const { email, password, name, contractorId, isAdmin } = req.body;
    
    const user = await User.create({
      email,
      password,
      name,
      contractorId,
      isAdmin: isAdmin === 'true'
    });

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user status
router.put('/users/:id/status', isAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user details
router.get('/users/:id', isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/users/:id', isAdmin, async (req, res) => {
  try {
    const { name, email, status, newPassword } = req.body;
    const updateData = { name, email, status };
    
    if (newPassword) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(newPassword, salt);
    }
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');
    
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/users/:id', isAdmin, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new admin (only accessible by super admin)
router.post('/create-admin', isMasterAdmin, async (req, res) => {
  try {
    console.log('Creating new admin:', req.body);
    
    const { name, email, password } = req.body;
    
    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Let the User model handle the password hashing
    const admin = await User.create({
      name,
      email,
      password, // The User model's pre-save hook will hash this
      isAdmin: true,
      contractorId: 'ADMIN',
      status: 'active'
    });

    console.log('Admin created successfully:', admin);
    res.json({ message: 'Admin created successfully', admin });
  } catch (error) {
    console.error('Error creating admin:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 