const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const ClickUpService = require('../services/clickup');

const clickupService = new ClickUpService();

router.get('/', isAuthenticated, async (req, res) => {
  try {
    // Get initial claims list
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    
    // Get full claim details for each claim
    const fullClaimDetails = await Promise.all(
      claims.map(claim => clickupService.getTask(claim.id))
    );

    // Get unique values for different fields
    const uniqueStatuses = [...new Set(claims.map(claim => 
      claim.status?.status || 'Unknown'
    ))];

    // Extract salesmen from full claim details
    const uniqueSalesmen = [...new Set(fullClaimDetails
      .map(claim => {
        const salesmanField = claim.custom_fields?.find(f => f.name === 'Contractor Salesman');
        if (!salesmanField?.value || !Array.isArray(salesmanField.value)) return null;
        return salesmanField.value[0]?.name || null;
      })
      .filter(Boolean)
    )].sort();

    res.render('reports', {
      user: req.session.user,
      statuses: uniqueStatuses,
      salesmen: uniqueSalesmen
    });
  } catch (error) {
    console.error('Reports page error:', error);
    res.render('error', {
      message: 'Error loading reports',
      error: error.message
    });
  }
});

router.post('/generate', isAuthenticated, async (req, res) => {
  try {
    const { reportType, status, salesman } = req.body;
    console.log('Report requested for:', { reportType, status, salesman });
    
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    console.log('Total claims fetched:', claims.length);

    // Get full claim details for each claim
    const fullClaimDetails = await Promise.all(
      claims.map(claim => clickupService.getTask(claim.id))
    );
    console.log('Full claim details fetched:', fullClaimDetails.length);

    // Filter claims based on criteria
    let filteredClaims = fullClaimDetails;
    
    if (status && status !== 'all') {
      filteredClaims = filteredClaims.filter(claim => 
        claim.status?.status?.toLowerCase() === status.toLowerCase()
      );
    }

    if (salesman && salesman !== 'all') {
      filteredClaims = filteredClaims.filter(claim => {
        const salesmanField = claim.custom_fields?.find(f => f.name === 'Contractor Salesman');
        const salesmanName = salesmanField?.value?.[0]?.name;
        console.log('Checking salesman:', salesmanName, 'against:', salesman);
        return salesmanName === salesman;
      });
    }
    console.log('Filtered claims:', filteredClaims.length);

    // Sample the first claim's RCV/ACV fields
    if (filteredClaims.length > 0) {
      const sampleClaim = filteredClaims[0];
      console.log('Sample claim RCV field:', JSON.stringify(
        sampleClaim.custom_fields.find(f => f.name === 'RCV'),
        null, 2
      ));
      console.log('Sample claim ACV field:', JSON.stringify(
        sampleClaim.custom_fields.find(f => f.name === 'ACV'),
        null, 2
      ));
    }

    // Calculate report data
    let reportData = {
      totalClaims: filteredClaims.length,
      totalRCV: filteredClaims.reduce((sum, claim) => {
        const rcvField = claim.custom_fields?.find(f => f.name === 'RCV');
        if (!rcvField?.value) return sum;
        
        // Handle different RCV value formats
        let rcvValue = 0;
        if (typeof rcvField.value === 'number') {
          rcvValue = rcvField.value;
        } else if (typeof rcvField.value === 'string') {
          // Remove any currency symbols and commas
          rcvValue = parseFloat(rcvField.value.replace(/[$,]/g, '')) || 0;
        } else if (typeof rcvField.value === 'object' && rcvField.value !== null) {
          rcvValue = parseFloat(rcvField.value.value || 0);
        }
        
        console.log(`RCV for claim ${claim.id}: ${rcvValue}`);
        return sum + rcvValue;
      }, 0),
      totalACV: filteredClaims.reduce((sum, claim) => {
        const acvField = claim.custom_fields?.find(f => f.name === 'ACV');
        if (!acvField?.value) return sum;
        
        // Handle different ACV value formats
        let acvValue = 0;
        if (typeof acvField.value === 'number') {
          acvValue = acvField.value;
        } else if (typeof acvField.value === 'string') {
          // Remove any currency symbols and commas
          acvValue = parseFloat(acvField.value.replace(/[$,]/g, '')) || 0;
        } else if (typeof acvField.value === 'object' && acvField.value !== null) {
          acvValue = parseFloat(acvField.value.value || 0);
        }
        
        console.log(`ACV for claim ${claim.id}: ${acvValue}`);
        return sum + acvValue;
      }, 0),
      claims: filteredClaims.map(claim => ({
        id: claim.id,
        name: claim.name,
        status: claim.status
      }))
    };

    res.json(reportData);
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 