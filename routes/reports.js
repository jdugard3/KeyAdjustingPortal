const express = require('express');
const router = express.Router();
const { isAuthenticated } = require('../middleware/auth');
const ClickUpService = require('../services/clickup');

const clickupService = new ClickUpService();

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
        if (typeof val === 'string' && val.includes('-')) {
          return new Date(val).toLocaleDateString();
        }
        
        return val; // Return original if we can't parse it
      } catch (e) {
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
    
    // Define ONLY the fields we want to include in the CSV and their order
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
      { key: 'Created Date', source: 'date_created', formatter: (val) => new Date(val).toLocaleDateString() },
      { key: 'Updated Date', source: 'date_updated', formatter: (val) => new Date(val).toLocaleDateString() },
      
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

module.exports = router; 