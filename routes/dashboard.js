const express = require('express');
const router = express.Router();
const ClickUpService = require('../services/clickup');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { isAuthenticated } = require('../middleware/auth');

// Create a single instance of ClickUpService
const clickupService = new ClickUpService();

// Get contractor dashboard
router.get('/', isAuthenticated, async (req, res) => {
  try {
    console.log('Loading dashboard for user:', req.session.user.email);
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    
    // Get unique statuses from claims
    const uniqueStatuses = [...new Set(claims.map(claim => claim.status.status))];
    
    res.render('dashboard', {
      user: req.session.user,
      claims: claims || [],
      statuses: uniqueStatuses
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('error', { 
      message: 'Error loading dashboard',
      error: error.message 
    });
  }
});

// Upload document to claim
router.post('/upload/:claimId', upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).render('error', {
        message: 'Upload Error',
        error: 'No file was selected'
      });
    }

    // Get the file type and handle "Other" case
    let fileType = req.body.fileType;
    if (fileType === 'Other' && req.body.otherType) {
      fileType = req.body.otherType;
    }

    // Modify the original filename to include the type
    const originalName = req.file.originalname;
    const fileExtension = originalName.split('.').pop();
    const baseFileName = originalName.slice(0, -(fileExtension.length + 1));
    req.file.originalname = `${baseFileName} (${fileType}).${fileExtension}`;

    await clickupService.uploadDocument(req.params.claimId, req.file);
    
    res.redirect(`/claims/${req.params.claimId}?upload=success`);
  } catch (error) {
    console.error('Upload error:', error);
    res.render('error', {
      message: 'Upload Error',
      error: error.message || 'Failed to upload document'
    });
  }
});

// Get claims data
router.get('/claims', isAuthenticated, async (req, res) => {
  try {
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    res.json(claims);
  } catch (error) {
    console.error('Error fetching claims:', error);
    res.status(500).json({ error: 'Failed to fetch claims' });
  }
});

module.exports = router; 