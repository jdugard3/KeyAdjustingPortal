require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const { isAuthenticated } = require('./middleware/auth');

// Import routes
const authRouter = require('./routes/auth');
const dashboardRouter = require('./routes/dashboard');
const claimsRouter = require('./routes/claims');
const reportsRouter = require('./routes/reports');
const adminRouter = require('./routes/admin');

const app = express();

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Session setup
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Routes
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('login', { error: null, email: '' });
  }
});

// Mount routers
app.use('/auth', authRouter);
app.use('/dashboard', isAuthenticated, dashboardRouter);
app.use('/claims', isAuthenticated, claimsRouter);
app.use('/reports', isAuthenticated, reportsRouter);
app.use('/admin', adminRouter);

// Error handling middleware
app.use((req, res) => {
  console.log(`404 Error - Route not found: ${req.originalUrl}`);
  res.status(404).render('error', {
    message: 'Page Not Found',
    error: 'The requested page could not be found.'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    message: 'Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server only if not already running
const PORT = process.env.PORT || 3000;

// Function to check if port is in use
const isPortInUse = (port) => {
  return new Promise((resolve) => {
    const server = require('net').createServer()
      .once('error', () => resolve(true))
      .once('listening', () => {
        server.close();
        resolve(false);
      })
      .listen(port);
  });
};

// Start server with port check
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const portInUse = await isPortInUse(PORT);
    if (!portInUse) {
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    } else {
      console.log(`Port ${PORT} is already in use`);
    }
  } catch (err) {
    console.error('Server startup error:', err);
  }
}

startServer();

module.exports = app; 