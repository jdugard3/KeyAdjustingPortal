require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const adminData = {
      email: 'admin@test.com',
      password: '123',
      name: 'Admin User',
      contractorId: 'ADMIN',
      isAdmin: true,
      isSuperAdmin: true,
      status: 'active'
    };
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminData.email });
    if (existingAdmin) {
      console.log('Admin user already exists');
      return;
    }

    const admin = await User.create(adminData);
    console.log('Admin user created successfully:', admin.email);
  } catch (error) {
    console.error('Error creating admin:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

createAdmin(); 