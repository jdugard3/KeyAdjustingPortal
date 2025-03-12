const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const ClickUpService = require('../services/clickup');
const axios = require('axios');

const clickupService = new ClickUpService();

// Helper functions for formatting
function formatCurrency(val) {
  if (val === null || val === undefined || val === '') return '';
  
  // Handle various formats of currency values
  let numValue;
  if (typeof val === 'number') {
    numValue = val;
  } else if (typeof val === 'string') {
    // Remove currency symbols and commas
    numValue = parseFloat(val.replace(/[$,]/g, ''));
  } else if (typeof val === 'object' && val !== null && val.value) {
    numValue = parseFloat(val.value);
  } else {
    return val; // Return original if we can't parse it
  }
  
  if (isNaN(numValue)) return val;
  return `$${numValue.toFixed(2)}`;
}

function formatDate(val) {
  if (val === null || val === undefined || val === '') return '';
  
  try {
    // Handle timestamp values
    if (!isNaN(val) && val > 1000000000) {
      return new Date(parseInt(val)).toLocaleDateString();
    }
    
    // Handle date strings
    return new Date(val).toLocaleDateString();
  } catch (e) {
    return val;
  }
}

// Update the formatters for Created Date and Updated Date
function formatTimestamp(val) {
  if (!val) return '';
  
  try {
    // Convert millisecond timestamp to date
    if (typeof val === 'number' || !isNaN(parseInt(val))) {
      const timestamp = typeof val === 'number' ? val : parseInt(val);
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }
    
    return val;
  } catch (e) {
    console.log('Error formatting timestamp:', val, e);
    return val;
  }
}

// Helper function to process field values based on their type
function processFieldValue(field) {
  if (field.value === null || field.value === undefined) return '';
  
  // Handle different field types
  if (typeof field.value === 'object') {
    // Handle array values (like assignees, tags, etc.)
    if (Array.isArray(field.value)) {
      return field.value
        .filter(Boolean)
        .map(v => {
          if (typeof v === 'object' && v !== null) {
            return v.name || v.value || JSON.stringify(v);
          }
          return v;
        })
        .join(', ');
    } 
    // Handle location/address fields
    else if (field.value.formatted_address) {
      return field.value.formatted_address;
    }
    // Handle task reference fields
    else if (field.value.name) {
      return field.value.name;
    }
    // Handle numeric value fields
    else if (field.value.value !== undefined) {
      return field.value.value;
    }
    // Fallback for other object types
    else {
      return JSON.stringify(field.value);
    }
  }
  
  // Return primitive values as-is
  return field.value;
}

// Define ONLY the fields we want to include in the reports and their order
const fieldDefinitions = [
  { key: 'Claim ID', source: 'id' },
  { key: 'Claim Name', source: 'name' },
  { key: 'Status', source: 'status.status' },
  { key: '📋 Claim Number', source: 'custom_fields_by_id.7820b873-6c87-4529-9fd5-bb5816ff0ca2' },
  { key: 'Substage', source: 'custom_fields_by_id.5b90e68a-a5e2-49a8-b273-f3d91a37d264' },
  { key: '✏ ️ Cause of Loss', source: 'custom_fields_by_id.186b149a-d437-47a0-95fe-09117147a041' },
  
  // Group all date fields together
  { key: '🗓 ️ Date Of Loss', source: 'custom_fields_by_id.6de9ab23-1752-4028-8620-738af6ce7de9', formatter: formatDate },
  { key: '🗓 ️ Date Created', source: 'custom_fields_by_id.fd18bd77-695f-4c47-a9d3-4653203fd500', formatter: formatDate },
  { key: '🗓 ️ Date Closed', source: 'custom_fields_by_id.448d8308-1195-47e1-a4b4-625c9916552c', formatter: formatDate },
  { key: '📅 Date Approved', source: 'custom_fields_by_id.797645f1-436f-46bc-89aa-595259651000', formatter: formatDate },
  { key: '🗓️ Claim Filed Date', source: 'custom_fields_by_id.55e8d5dd-0dd9-4250-82e7-5af05decb7b2', formatter: formatDate },
  { key: '🗓️ First Settlement', source: 'custom_fields_by_id.5b8fa077-96e0-4144-851d-688d2d9ea1d8', formatter: formatDate },
  { key: 'Created Date', source: 'date_created', formatter: formatTimestamp },
  { key: 'Updated Date', source: 'date_updated', formatter: formatTimestamp },
  
  // Financial information
  { key: '💰 ACV', source: 'custom_fields_by_id.f8c23071-bbe2-42d9-be1b-68c36bba8299', formatter: formatCurrency },
  { key: '💰 Deductible', source: 'custom_fields_by_id.d56c8d16-12fc-4e9d-9513-b1ad53d6378e', formatter: formatCurrency },
  { key: '💰 Recoverable Depreciation', source: 'custom_fields_by_id.7e7d8b4a-d767-4335-8e35-155209d1ca9e', formatter: formatCurrency },
  { key: '💰 Non Rec Depreciation', source: 'custom_fields_by_id.1f68273a-f485-480a-bb53-ea286514c158', formatter: formatCurrency },
  { key: '💰 PWI', source: 'custom_fields_by_id.19049cc1-5f11-4450-b1a0-e620df919ac6', formatter: formatCurrency },
  { key: '💰 PPS', source: 'custom_fields_by_id.6e61eb30-1a9e-4a11-a9c4-c21a623d41d5', formatter: formatCurrency },
  { key: '💰 RCV', source: 'custom_fields_by_id.3e60f31e-c1bb-4c34-b0f3-aa45dd42872a', formatter: formatCurrency },
  
  // Contact and policy information
  { key: '📋 Policy Number', source: 'custom_fields_by_id.f76aec4e-8874-45db-8b77-fd167bdb3a2a' },
  { key: '⭕ PA Email', source: 'custom_fields_by_id.01688d9c-a24f-4db1-8beb-64a01734c44f' },
  { key: 'Policy Holder', source: 'custom_fields_by_id.54b5cb63-e954-48e3-b5da-7a58ebd3826f' },
  { key: 'Property Address', source: 'custom_fields_by_id.214e7062-e023-4726-bcdc-251b465e9e84' },
  { key: 'Contractor Salesman', source: 'custom_fields_by_id.5c84b678-3fe6-481c-a8e9-f554c1883724' }
];

router.get('/', isAuthenticated, async (req, res) => {
  try {
    res.render('reports', {
      user: req.session.user
    });
  } catch (error) {
    console.error('Reports page error:', error);
    res.render('error', {
      message: 'Error loading reports',
      error: error.message
    });
  }
});

router.post('/active-claims-csv', isAuthenticated, async (req, res) => {
  try {
    console.log('Generating active claims report for contractor:', req.session.user.contractorId);
    
    // Get all claims for the contractor
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    console.log(`Found ${claims.length} claims for contractor`);

    // Get full claim details for each claim
    const fullClaimDetails = await Promise.all(
      claims.map(claim => clickupService.getTask(claim.id))
    );
    console.log('Fetched full details for all claims');
    
    // Filter to only include claims from the active list (901403426089)
    const activeListId = '901403426089';
    const activeClaimDetails = fullClaimDetails.filter(claim => 
      claim.list && claim.list.id === activeListId
    );
    console.log(`Filtered to ${activeClaimDetails.length} active claims`);
    
    // Add this after fetching the active claim details
    console.log('Custom field names in first claim:');
    if (activeClaimDetails.length > 0) {
      activeClaimDetails[0].custom_fields.forEach(field => {
        if (field.name.includes('RCV') || field.name.includes('💰')) {
          console.log(`Field name: "${field.name}", Type: ${typeof field.value}, Value:`, field.value);
        }
      });
    }
    
    // Add this after fetching the active claim details
    console.log('Date fields in first claim:');
    if (activeClaimDetails.length > 0) {
      console.log('date_created:', activeClaimDetails[0].date_created, 'type:', typeof activeClaimDetails[0].date_created);
      console.log('date_updated:', activeClaimDetails[0].date_updated, 'type:', typeof activeClaimDetails[0].date_updated);
    }
    
    // Process claims to extract ONLY the specified fields
    const processedClaims = [];
    
    // Process each claim
    activeClaimDetails.forEach(claim => {
      const claimData = {};
      
      // Process standard fields
      fieldDefinitions.forEach(field => {
        if (!field.source.includes('custom_fields.')) {
          // Handle nested properties like status.status
          const parts = field.source.split('.');
          let value = claim;
          for (const part of parts) {
            value = value && value[part];
          }
          
          claimData[field.key] = field.formatter ? field.formatter(value) : (value || '');
        }
      });
      
      // Process only the custom fields we care about
      const customFieldsMapById = {};
      claim.custom_fields.forEach(field => {
        if (field.value !== null) {
          customFieldsMapById[field.id] = processFieldValue(field);
        }
      });
      
      // Add only the specified custom fields to claim data
      fieldDefinitions.forEach(field => {
        if (field.source.includes('custom_fields_by_id.')) {
          const fieldId = field.source.replace('custom_fields_by_id.', '');
          const value = customFieldsMapById[fieldId];
          claimData[field.key] = field.formatter && value !== undefined ? 
            field.formatter(value) : (value || '');
        }
      });
      
      processedClaims.push(claimData);
    });
    
    // Generate CSV manually
    const headers = fieldDefinitions.map(field => field.key);
    
    // Create CSV content
    let csvContent = headers.join(',') + '\r\n';
    
    processedClaims.forEach(claim => {
      const row = headers.map(header => {
        const value = claim[header] || '';
        // Escape quotes and wrap in quotes if contains comma or newline
        const escaped = String(value).replace(/"/g, '""');
        return /[,\r\n"]/.test(escaped) ? `"${escaped}"` : escaped;
      });
      csvContent += row.join(',') + '\r\n';
    });
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=active_claims_report_${new Date().toISOString().split('T')[0]}.csv`);
    
    // Send the CSV
    res.send(csvContent);
    
  } catch (error) {
    console.error('Error generating active claims report:', error);
    res.status(500).json({ error: 'Failed to generate report: ' + error.message });
  }
});

// Update the PDF generation endpoint with better error handling and HTML sanitization
router.post('/active-claims-pdf', isAuthenticated, async (req, res) => {
  try {
    console.log('Generating active claims PDF report for contractor:', req.session.user.contractorId);
    
    // Get all claims for the contractor
    const claims = await clickupService.getContractorClaims(
      req.session.user.contractorId
    );
    console.log(`Found ${claims.length} claims for contractor`);
    
    // Get full claim details for each claim
    const fullClaimDetails = await Promise.all(
      claims.map(claim => clickupService.getTask(claim.id))
    );
    console.log('Fetched full details for all claims');
    
    // Filter to only include claims from the active list (901403426089)
    const activeListId = '901403426089';
    const activeClaimDetails = fullClaimDetails.filter(claim => 
      claim.list && claim.list.id === activeListId
    );
    console.log(`Filtered to ${activeClaimDetails.length} active claims`);
    
    // Process claims to extract ONLY the specified fields - limit to fewer columns for PDF
    const processedClaims = [];
    
    // Define a smaller set of fields for the PDF report
    const pdfFields = [
      { key: 'Claim Name', source: 'name' },
      { key: 'Status', source: 'status.status' },
      { key: 'Policy Holder', source: 'custom_fields_by_id.54b5cb63-e954-48e3-b5da-7a58ebd3826f' },
      { key: '📋 Claim Number', source: 'custom_fields_by_id.a5e3cd96-b0ac-4e8a-b5c3-dce4a918d275' },
      { key: '🗓 ️ Date Of Loss', source: 'custom_fields_by_id.d5a54541-d34e-4a32-85d5-5daa9bb21131', formatter: formatDate },
      { key: '💰 RCV', source: 'custom_fields_by_id.3e60f31e-c1bb-4c34-b0f3-aa45dd42872a', formatter: formatCurrency },
      { key: 'Property Address', source: 'custom_fields_by_id.214e7062-e023-4726-bcdc-251b465e9e84' },
      { key: 'Contractor Salesman', source: 'custom_fields_by_id.5c84b678-3fe6-481c-a8e9-f554c1883724' }
    ];
    
    // Process each claim with the simplified field set
    activeClaimDetails.forEach(claim => {
      const claimData = {};
      
      // Create a lookup object for custom fields
      const customFieldsById = {};
      if (claim.custom_fields) {
        claim.custom_fields.forEach(field => {
          if (field.id) {
            customFieldsById[field.id] = field.value;
          }
        });
      }
      
      // Add custom_fields_by_id to the claim object
      claim.custom_fields_by_id = customFieldsById;
      
      // Extract each field based on its source path
      pdfFields.forEach(field => {
        let value = '';
        
        // Navigate the object path to get the value
        const path = field.source.split('.');
        let current = claim;
        
        for (const key of path) {
          if (current && current[key] !== undefined) {
            current = current[key];
          } else {
            current = '';
            break;
          }
        }
        
        value = current;
        
        // Apply formatter if provided
        if (field.formatter && typeof field.formatter === 'function') {
          value = field.formatter(value);
        }
        
        claimData[field.key] = value;
      });
      
      processedClaims.push(claimData);
    });
    
    // Create a simple HTML table
    const headers = Object.keys(processedClaims[0] || {});
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Active Claims Report</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
          th { background-color: #f2f2f2; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9f9f9; }
          h1 { color: #333; font-size: 24px; }
        </style>
      </head>
      <body>
        <h1>Active Claims Report - ${new Date().toLocaleDateString()}</h1>
        <table>
          <thead>
            <tr>
              ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
    `;
    
    processedClaims.forEach(claim => {
      htmlContent += '<tr>';
      headers.forEach(header => {
        const value = claim[header] || '';
        // Simple text sanitization
        const sanitizedValue = String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#039;');
        htmlContent += `<td>${sanitizedValue}</td>`;
      });
      htmlContent += '</tr>';
    });
    
    htmlContent += `
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    console.log('HTML content generated, length:', htmlContent.length);
    
    // Use PDF.co API to convert HTML to PDF
    const pdfcoApiKey = process.env.PDFCO_API_KEY;
    
    console.log('Calling PDF.co API...');
    const pdfcoResponse = await axios({
      method: 'POST',
      url: 'https://api.pdf.co/v1/pdf/convert/from/html',
      headers: {
        'x-api-key': pdfcoApiKey,
        'Content-Type': 'application/json'
      },
      data: {
        html: htmlContent,
        name: `active_claims_report_${new Date().toISOString().split('T')[0]}.pdf`,
        landscape: true,
        margins: {
          top: 20,
          right: 20,
          bottom: 20,
          left: 20
        }
      },
      responseType: 'arraybuffer'
    });
    
    console.log('PDF.co API response received, status:', pdfcoResponse.status);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=active_claims_report_${new Date().toISOString().split('T')[0]}.pdf`);
    
    // Send the PDF
    res.send(pdfcoResponse.data);
    
  } catch (error) {
    console.error('Error generating active claims PDF report:', error);
    if (error.response) {
      console.error('PDF.co API error details:', {
        status: error.response.status,
        headers: error.response.headers
      });
      
      // Try to parse the error response if it's JSON
      if (error.response.data) {
        try {
          const errorData = JSON.parse(error.response.data.toString());
          console.error('PDF.co API error message:', errorData);
        } catch (e) {
          console.error('Could not parse error response');
        }
      }
    }
    res.status(500).json({ error: 'Failed to generate PDF report: ' + error.message });
  }
});

module.exports = router; 