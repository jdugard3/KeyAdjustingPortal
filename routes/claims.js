const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const ClickUpService = require('../services/clickup');

// Create a single instance of ClickUpService
const clickupService = new ClickUpService();

// Helper function to determine file icon
function getFileIcon(filename) {
  if (!filename) return 'fa-file';
  
  const ext = filename.split('.').pop().toLowerCase();
  const icons = {
    pdf: 'fa-file-pdf',
    doc: 'fa-file-word',
    docx: 'fa-file-word',
    xls: 'fa-file-excel',
    xlsx: 'fa-file-excel',
    jpg: 'fa-file-image',
    jpeg: 'fa-file-image',
    png: 'fa-file-image',
    txt: 'fa-file-alt',
    csv: 'fa-file-csv'
  };
  return icons[ext] || 'fa-file';
}

router.get('/:claimId', isAuthenticated, async (req, res) => {
  try {
    const claimId = req.params.claimId;
    console.log('Claims route hit - claimId:', claimId);
    
    const taskResponse = await clickupService.getTask(claimId);
    console.log('ClickUp response received:', !!taskResponse);
    
    if (!taskResponse) {
      console.log('No task response found');
      return res.status(404).render('error', { 
        message: 'Claim not found',
        error: 'The requested claim could not be found.'
      });
    }

    // Format the claim data and exclude sensitive fields
    const claimDetails = {
      id: taskResponse.id,
      name: taskResponse.name,
      status: taskResponse.status,
      description: taskResponse.description || '',
      customFields: taskResponse.custom_fields
        .filter(field => 
          field.value !== null && 
          !field.name.includes('Record New Settlement')
        )
        .map(field => {
          let formattedValue = field.value;

          // Handle specific field types
          if (typeof field.value === 'object' && field.value !== null) {
            switch(field.name) {
              case 'Contractor Salesman':
                // Handle Contractor Salesman field specifically
                if (Array.isArray(field.value) && field.value.length > 0) {
                  formattedValue = field.value[0].name || 'Not Specified';
                } else {
                  formattedValue = 'Not Specified';
                }
                break;

              case 'Policy Holder':
              case 'Property Address':
              case 'Inspection':
              case 'Insurance Carrier':
              case 'Key PA':
                // Handle other task-type fields
                if (Array.isArray(field.value) && field.value.length > 0) {
                  formattedValue = field.value[0].name || 'Not Specified';
                } else if (field.value.formatted_address) {
                  formattedValue = field.value.formatted_address;
                } else if (field.value.name) {
                  formattedValue = field.value.name;
                } else {
                  formattedValue = 'Not Specified';
                }
                break;

              case 'Loss Address':
                if (Array.isArray(field.value)) {
                  formattedValue = field.value
                    .filter(v => v && typeof v === 'string')
                    .join(', ');
                } else if (field.value.formatted_address) {
                  formattedValue = field.value.formatted_address;
                } else {
                  formattedValue = 'Not Specified';
                }
                break;

              case 'RCV':
              case 'ACV':
                // Handle currency fields
                if (typeof field.value === 'number') {
                  formattedValue = field.value;
                } else if (typeof field.value === 'string') {
                  formattedValue = parseFloat(field.value.replace(/[$,]/g, '')) || 0;
                } else if (field.value.value) {
                  formattedValue = parseFloat(field.value.value) || 0;
                } else {
                  formattedValue = 0;
                }
                break;

              default:
                // Handle all other object types
                if (field.value.name) {
                  formattedValue = field.value.name;
                } else if (field.value.value) {
                  formattedValue = field.value.value;
                } else if (Array.isArray(field.value)) {
                  formattedValue = field.value
                    .filter(Boolean)
                    .map(v => {
                      if (typeof v === 'object' && v !== null) {
                        return v.name || v.value || JSON.stringify(v);
                      }
                      return v;
                    })
                    .join(', ');
                } else {
                  formattedValue = JSON.stringify(field.value);
                }
            }
          }

          return {
            name: field.name,
            value: formattedValue || 'Not Specified',
            type: field.type
          };
        }),
      attachments: taskResponse.attachments || []
    };

    console.log('Rendering claim template with details');
    res.render('claim', { 
      claim: claimDetails,
      user: req.session.user,
      getFileIcon: getFileIcon
    });
  } catch (error) {
    console.error('Claims route error:', error);
    res.status(500).render('error', { 
      message: 'Error loading claim details',
      error: error.message 
    });
  }
});

module.exports = router; 