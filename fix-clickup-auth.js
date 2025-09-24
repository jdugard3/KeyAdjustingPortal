#!/usr/bin/env node

/**
 * ClickUp Authentication Debug Script
 * 
 * This script will help you find the correct Team ID for your API key
 * and verify your ClickUp authentication setup.
 */

const axios = require('axios');
require('dotenv').config();

async function debugClickUpAuth() {
  console.log('🔧 ClickUp Authentication Debug');
  console.log('================================\n');

  const API_KEY = process.env.CLICKUP_API_KEY;
  const CURRENT_TEAM_ID = process.env.CLICKUP_TEAM_ID;

  if (!API_KEY) {
    console.error('❌ CLICKUP_API_KEY environment variable is not set!');
    console.log('Please set it in your .env file or environment variables.');
    process.exit(1);
  }

  console.log('Current Configuration:');
  console.log(`API Key: ${API_KEY}`);
  console.log(`Current Team ID: ${CURRENT_TEAM_ID || 'Not set'}\n`);

  const api = axios.create({
    baseURL: 'https://api.clickup.com/api/v2',
    headers: {
      'Authorization': API_KEY,
      'Content-Type': 'application/json'
    }
  });

  try {
    // Step 1: Test API key validity by getting user info
    console.log('1. Testing API key validity...');
    const userResponse = await api.get('/user');
    console.log('✅ API key is valid!');
    console.log(`   User: ${userResponse.data.user.username} (${userResponse.data.user.email})`);

    // Step 2: Get all teams accessible with this API key
    console.log('\n2. Getting accessible teams...');
    const teamsResponse = await api.get('/team');
    
    if (teamsResponse.data.teams && teamsResponse.data.teams.length > 0) {
      console.log('✅ Found accessible teams:');
      teamsResponse.data.teams.forEach((team, index) => {
        const isCurrentTeam = team.id === CURRENT_TEAM_ID;
        const marker = isCurrentTeam ? '👈 CURRENT' : '';
        console.log(`   ${index + 1}. ${team.name} (ID: ${team.id}) ${marker}`);
      });

      // Step 3: If current team ID doesn't match any accessible team, suggest the first one
      const accessibleTeamIds = teamsResponse.data.teams.map(t => t.id);
      if (CURRENT_TEAM_ID && !accessibleTeamIds.includes(CURRENT_TEAM_ID)) {
        console.log(`\n⚠️  Your current CLICKUP_TEAM_ID (${CURRENT_TEAM_ID}) is not in the accessible teams list!`);
        console.log(`✅ Suggested fix: Use team ID "${teamsResponse.data.teams[0].id}" (${teamsResponse.data.teams[0].name})`);
        
        // Test with the suggested team ID
        console.log('\n3. Testing with suggested team ID...');
        await testTaskAccess(api, teamsResponse.data.teams[0].id);
      } else if (CURRENT_TEAM_ID) {
        console.log(`\n✅ Your current team ID matches an accessible team.`);
        console.log('\n3. Testing task access...');
        await testTaskAccess(api, CURRENT_TEAM_ID);
      } else {
        console.log(`\n💡 No CLICKUP_TEAM_ID set. Recommended team: "${teamsResponse.data.teams[0].id}"`);
      }

    } else {
      console.log('❌ No teams found! Your API key might not have proper permissions.');
    }

  } catch (error) {
    console.error('\n❌ Authentication test failed:');
    console.error('Status:', error.response?.status || 'Unknown');
    console.error('Message:', error.message);
    console.error('Response:', error.response?.data || 'No response data');

    if (error.response?.status === 401) {
      console.log('\n🔍 401 Unauthorized suggests:');
      console.log('1. Invalid API key');
      console.log('2. API key doesn\'t have required permissions');
      console.log('3. API key format is incorrect (should start with "pk_")');
    }
  }
}

async function testTaskAccess(api, teamId) {
  try {
    // Try to get spaces for this team
    const spacesResponse = await api.get(`/team/${teamId}/space`);
    console.log(`✅ Successfully accessed team ${teamId}`);
    console.log(`   Found ${spacesResponse.data.spaces?.length || 0} spaces`);

    if (spacesResponse.data.spaces && spacesResponse.data.spaces.length > 0) {
      // Try to get lists from the first space
      const firstSpace = spacesResponse.data.spaces[0];
      console.log(`   Testing space: ${firstSpace.name} (ID: ${firstSpace.id})`);
      
      const foldersResponse = await api.get(`/space/${firstSpace.id}/folder`);
      console.log(`   Found ${foldersResponse.data.folders?.length || 0} folders`);

      // Show environment variable suggestion
      console.log(`\n💡 Environment variable suggestion:`);
      console.log(`   CLICKUP_TEAM_ID=${teamId}`);
      console.log(`\n   Add this to your .env file to fix the authentication issue.`);
    }

  } catch (error) {
    console.error(`❌ Failed to access team ${teamId}:`, error.response?.data || error.message);
  }
}

// Run the debug script
debugClickUpAuth();
