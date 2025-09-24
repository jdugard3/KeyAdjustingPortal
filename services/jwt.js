const jwt = require('jsonwebtoken');

class JWTService {
  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-jwt-refresh-secret';
    this.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
  }

  // Generate access token
  generateAccessToken(user) {
    const payload = {
      id: user._id || user.id,
      email: user.email,
      name: user.name,
      contractorId: user.contractorId,
      role: user.role || 'user',
      isAdmin: user.isAdmin || false,
      userType: user.userType || 'contractor'
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.ACCESS_TOKEN_EXPIRY,
      issuer: 'keyadjusting-portal',
      audience: 'keyadjusting-users'
    });
  }

  // Generate refresh token
  generateRefreshToken(user) {
    const payload = {
      id: user._id || user.id,
      email: user.email,
      tokenType: 'refresh'
    };

    return jwt.sign(payload, this.JWT_REFRESH_SECRET, {
      expiresIn: this.REFRESH_TOKEN_EXPIRY,
      issuer: 'keyadjusting-portal',
      audience: 'keyadjusting-users'
    });
  }

  // Generate both tokens
  generateTokens(user) {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.ACCESS_TOKEN_EXPIRY
    };
  }

  // Verify access token
  verifyAccessToken(token) {
    try {
      return jwt.verify(token, this.JWT_SECRET, {
        issuer: 'keyadjusting-portal',
        audience: 'keyadjusting-users'
      });
    } catch (error) {
      throw new Error('Invalid access token: ' + error.message);
    }
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.JWT_REFRESH_SECRET, {
        issuer: 'keyadjusting-portal',
        audience: 'keyadjusting-users'
      });
      
      if (decoded.tokenType !== 'refresh') {
        throw new Error('Invalid token type');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid refresh token: ' + error.message);
    }
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader) {
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new Error('Invalid authorization header format. Expected: Bearer <token>');
    }

    return parts[1];
  }

  // Extract token from cookie
  extractTokenFromCookie(cookies, cookieName = 'accessToken') {
    if (!cookies || !cookies[cookieName]) {
      throw new Error(`No ${cookieName} cookie found`);
    }
    return cookies[cookieName];
  }

  // Get token expiration time
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded.exp * 1000; // Convert to milliseconds
    } catch (error) {
      return null;
    }
  }

  // Check if token is expired
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    return Date.now() >= expiration;
  }

  // Decode token without verification (for debugging)
  decodeToken(token) {
    return jwt.decode(token, { complete: true });
  }
}

module.exports = JWTService;
