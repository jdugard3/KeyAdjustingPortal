const JWTService = require('../services/jwt');
const User = require('../models/User');

const jwtService = new JWTService();

// JWT Authentication middleware
const isJWTAuthenticated = async (req, res, next) => {
  try {
    let token;
    
    // Try to get token from Authorization header first
    if (req.headers.authorization) {
      token = jwtService.extractTokenFromHeader(req.headers.authorization);
    }
    // Fallback to cookie
    else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (!token) {
      throw new Error('No token provided');
    }

    // Verify the token
    const decoded = jwtService.verifyAccessToken(token);
    
    // Attach user info to request
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      contractorId: decoded.contractorId,
      role: decoded.role,
      isAdmin: decoded.isAdmin
    };
    
    return next();
  } catch (error) {
    console.log('JWT authentication failed:', error.message);
    
    // For API requests, return JSON error
    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required', message: error.message });
    }
    
    // For web requests, redirect to login
    return res.redirect('/auth/login');
  }
};

// Session Authentication middleware (legacy support)
const isSessionAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    // For backward compatibility, also set req.user
    req.user = req.session.user;
    return next();
  }
  
  // For API requests, return JSON error
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // For web requests, redirect to login
  return res.redirect('/auth/login');
};

// Hybrid authentication middleware - tries JWT first, then session
const isAuthenticated = async (req, res, next) => {
  // Try JWT authentication first
  try {
    let token;
    
    if (req.headers.authorization) {
      token = jwtService.extractTokenFromHeader(req.headers.authorization);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }
    
    if (token) {
      const decoded = jwtService.verifyAccessToken(token);
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        contractorId: decoded.contractorId,
        role: decoded.role,
        isAdmin: decoded.isAdmin,
        userType: decoded.userType
      };
      return next();
    }
  } catch (jwtError) {
    console.log('JWT authentication failed, trying session:', jwtError.message);
  }
  
  // Fallback to session authentication
  if (req.session && req.session.user) {
    req.user = req.session.user;
    return next();
  }
  
  // Both authentication methods failed
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  return res.redirect('/auth/login');
};

// Admin authentication middleware
const isAdmin = async (req, res, next) => {
  // First ensure user is authenticated
  await isAuthenticated(req, res, (err) => {
    if (err) return next(err);
    
    // Check if user has admin privileges
    if (!req.user.isAdmin && req.user.role !== 'admin' && req.user.role !== 'master_admin') {
      if (req.headers.accept && req.headers.accept.includes('application/json')) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      return res.status(403).render('error', {
        message: 'Access Denied',
        error: 'Admin privileges required'
      });
    }
    
    next();
  });
};

module.exports = { 
  isAuthenticated, 
  isJWTAuthenticated, 
  isSessionAuthenticated,
  isAdmin,
  jwtService 
}; 