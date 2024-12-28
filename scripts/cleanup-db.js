require('dotenv').config();
const mongoose = require('mongoose');

async function cleanupDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    
    // Drop the specific username index
    try {
      await db.collection('users').dropIndex('username_1');
      console.log('Successfully dropped username index');
    } catch (err) {
      console.log('No username index found to drop');
    }

    console.log('Database cleanup completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupDatabase(); 