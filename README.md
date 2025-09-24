# KeyAdjusting Contractor Portal

A secure contractor portal for KeyAdjusting that integrates with ClickUp for claims management, featuring JWT authentication and real-time document handling.

## 🚀 Features

### Authentication & Security
- **JWT Authentication**: Secure token-based authentication with automatic refresh
- **Session Management**: Support for multiple active sessions per user
- **HTTP-Only Cookies**: Protection against XSS attacks
- **Role-Based Access**: Admin and user roles with appropriate permissions
- **Secure Logout**: Complete token cleanup on logout

### Claims Management
- **ClickUp Integration**: Real-time synchronization with ClickUp API
- **Interactive Dashboard**: Filterable claims overview with status indicators
- **Detailed Claim Views**: Organized claim information with collapsible sections
- **Document Upload**: Direct file upload to ClickUp tasks
- **Comment System**: Real-time commenting with automatic Key PA assignment

### User Experience
- **Responsive Design**: Modern UI with mobile-friendly design
- **Real-time Updates**: Live data synchronization
- **Search & Filter**: Advanced filtering and search capabilities
- **Loading Animations**: Smooth user experience with progress indicators

## 🛠 Technology Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT tokens with refresh token rotation
- **Template Engine**: EJS
- **External API**: ClickUp API v2
- **File Upload**: Multer middleware
- **Session Management**: Express Session + JWT hybrid

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or cloud instance)
- ClickUp API access
- Environment variables configured

## ⚡ Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd keyadjusting-portal
npm install
```

### 2. Environment Configuration

Create a `.env` file with the following variables:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/keyadjusting

# Session & JWT
SESSION_SECRET=your-super-secret-session-key
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# ClickUp Integration
CLICKUP_API_KEY=your-clickup-api-key
CLICKUP_TEAM_ID=your-clickup-team-id

# Server Configuration
PORT=3000
NODE_ENV=development
```

### 3. Start the Application

```bash
# Development mode
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
keyadjusting-portal/
├── app.js                  # Main application entry point
├── package.json           # Dependencies and scripts
├── README.md             # This file
├── .gitignore            # Git ignore rules
├── .env.example          # Environment variables template
├── middleware/           # Custom middleware
│   └── auth.js          # Authentication middleware
├── models/              # Database models
│   └── User.js         # User model with JWT support
├── routes/             # Route handlers
│   ├── auth.js        # Authentication routes
│   ├── dashboard.js   # Dashboard routes
│   ├── claims.js      # Claims management routes
│   ├── admin.js       # Admin routes
│   └── reports.js     # Reports routes
├── services/           # External services
│   ├── jwt.js         # JWT token management
│   └── clickup.js     # ClickUp API integration
├── views/              # EJS templates
│   ├── dashboard.ejs  # Main dashboard view
│   ├── claim.ejs      # Individual claim view
│   ├── login.ejs      # Login page
│   ├── error.ejs      # Error page
│   └── partials/      # Reusable template parts
│       ├── header.ejs # Common header
│       └── footer.ejs # Common footer
├── public/             # Static assets
│   ├── css/           # Stylesheets
│   ├── js/            # Client-side JavaScript
│   │   └── auth.js    # JWT authentication manager
│   └── styles/        # Additional styles
└── scripts/           # Utility scripts
    └── cleanup-db.js  # Database maintenance
```

## 🔐 Authentication Flow

### JWT Token Management
1. **Login**: User provides credentials → JWT tokens generated → HTTP-only cookies set
2. **Access**: Protected routes verify JWT → `req.user` populated with user data
3. **Refresh**: Expired tokens automatically refreshed → New tokens issued
4. **Logout**: Tokens removed from database → Cookies cleared

### Security Features
- **Token Rotation**: Refresh tokens are replaced on each use
- **Session Limits**: Maximum 5 active sessions per user
- **Secure Cookies**: HTTP-only, Secure, SameSite protection
- **Database Validation**: Server-side token verification

## 📊 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/signup` - User registration
- `GET /auth/logout` - Logout current session
- `POST /auth/logout-all` - Logout all sessions
- `POST /auth/refresh-token` - Refresh JWT tokens
- `POST /auth/delete-account` - Delete user account

### Dashboard
- `GET /dashboard` - Main dashboard view
- `GET /dashboard/claims` - Get user's claims data

### Claims
- `GET /claims/:claimId` - Individual claim details
- `POST /claims/:claimId/comment` - Add comment to claim
- `GET /claims/:claimId/comments` - Get claim comments
- `POST /dashboard/upload/:claimId` - Upload document to claim

### Admin
- `GET /admin/dashboard` - Admin dashboard
- Admin-only routes with role verification

## 🔧 Development

### Available Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run test suite (when implemented)
- `npm run lint` - Run ESLint (when configured)

### Git Workflow
- `main` branch for production-ready code
- `develop` branch for integration
- Feature branches for new development
- Commit messages follow conventional format

### Code Style
- ESLint configuration for consistent code style
- Prettier for automatic code formatting
- Conventional commit messages

## 🌐 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production MongoDB URI
3. Set secure JWT secrets
4. Enable HTTPS for secure cookies
5. Configure reverse proxy (nginx recommended)

### Production Considerations
- Use PM2 for process management
- Set up log rotation
- Configure SSL certificates
- Enable security headers
- Set up database backups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software owned by KeyAdjusting. All rights reserved.

## 🐛 Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**MongoDB Connection Issues**
- Verify MongoDB is running
- Check connection string in `.env`
- Ensure network connectivity

**ClickUp API Issues**
- Verify API key is valid
- Check team ID configuration
- Review API rate limits

**JWT Token Issues**
- Clear browser cookies
- Check JWT secrets in environment
- Verify token expiration settings

## 📞 Support

For support and questions, contact the development team or create an issue in the repository.

---

**Built with ❤️ for KeyAdjusting**
