const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Clear any existing models
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  contractorId: {
    type: String,
    required: true,
    trim: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginHistory: [{
    timestamp: Date,
    ip: String,
    userAgent: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  role: {
    type: String,
    enum: ['master_admin', 'admin', 'user'],
    default: 'user'
  }
}, { 
  strict: true,
  timestamps: true,
  // Explicitly prevent username field
  selectPopulatedPaths: false,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.username;
      return ret;
    }
  }
});

// Ensure username field is not added
userSchema.set('toObject', {
  transform: function(doc, ret) {
    delete ret.username;
    return ret;
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Add a method to check if user is master admin
userSchema.methods.isMasterAdmin = function() {
  return this.email === 'admin@test.com';
};

const User = mongoose.model('User', userSchema);

module.exports = User; 