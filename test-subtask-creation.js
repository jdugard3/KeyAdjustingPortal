#!/usr/bin/env node

/**
 * Test script for debugging ClickUp subtask creation
 * 
 * Usage: node test-subtask-creation.js <task_id>
 * 
 * This script will:
 * 1. Test the ClickUp API connection
 * 2. Get task details 
 * 3. Attempt to create a test subtask
 * 4. Show detailed logs for debugging
 */

const ClickUpService = require('./services/clickup');

async function testSubtaskCreation(taskId) {
  console.log('🔧 Starting ClickUp Subtask Creation Test');
  console.log('==========================================\n');

  if (!taskId) {
    console.error('❌ Error: Please provide a task ID');
    console.log('Usage: node test-subtask-creation.js <task_id>');
    process.exit(1);
  }

  try {
    // Initialize ClickUp service
    console.log('1. Initializing ClickUp service...');
    const clickupService = new ClickUpService();
    console.log('✅ ClickUp service initialized');

    // Test API connection by getting task details
    console.log('\n2. Testing API connection and getting task details...');
    const taskDetails = await clickupService.getTask(taskId);
    console.log('✅ Task retrieved successfully:');
    console.log(`   - Task ID: ${taskDetails.id}`);
    console.log(`   - Task Name: ${taskDetails.name}`);
    console.log(`   - List ID: ${taskDetails.list.id}`);
    console.log(`   - Status: ${taskDetails.status.status}`);

    // Check for Key PA field
    const keyPAField = taskDetails.custom_fields.find(field => 
      field.name === '🙎‍♂️ Key PA' || field.name === 'Key PA'
    );
    
    if (keyPAField && keyPAField.value && keyPAField.value.length > 0) {
      const keyPA = keyPAField.value[0];
      console.log(`   - Key PA: ${keyPA.username || keyPA.name} (ID: ${keyPA.id})`);
    } else {
      console.log('   - Key PA: Not assigned');
    }

    // Test subtask creation
    console.log('\n3. Creating test subtask...');
    const subtaskData = {
      name: `TEST: Subtask created at ${new Date().toISOString()}`,
      description: `This is a test subtask created by the debug script to verify ClickUp API integration.\n\nCreated: ${new Date().toLocaleString()}\nParent Task: ${taskDetails.name} (${taskId})`,
      assignees: [],
      priority: 3,
      status: 'to do'
    };

    console.log('Subtask data to be sent:');
    console.log(JSON.stringify(subtaskData, null, 2));

    const subtaskResult = await clickupService.createSubtask(taskId, subtaskData);
    
    console.log('\n✅ SUBTASK CREATED SUCCESSFULLY!');
    console.log('=================================');
    console.log(`   - Subtask ID: ${subtaskResult.id}`);
    console.log(`   - Subtask Name: ${subtaskResult.name}`);
    console.log(`   - Parent Task: ${subtaskResult.parent || 'Not set (this might be the issue!)'}`);
    console.log(`   - Status: ${subtaskResult.status.status}`);
    console.log(`   - URL: ${subtaskResult.url}`);

    // Verify the subtask appears under the parent
    console.log('\n4. Verifying subtask relationship...');
    const updatedParentTask = await clickupService.getTask(taskId);
    
    if (updatedParentTask.subtasks && updatedParentTask.subtasks.length > 0) {
      console.log(`✅ Parent task now has ${updatedParentTask.subtasks.length} subtask(s):`);
      updatedParentTask.subtasks.forEach((subtask, index) => {
        console.log(`   ${index + 1}. ${subtask.name} (ID: ${subtask.id})`);
      });
    } else {
      console.log('⚠️  Parent task does not show any subtasks in the API response');
      console.log('    This might indicate the subtask wasn\'t properly linked as a child');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Check your ClickUp workspace to see if the subtask appears under the parent task');
    console.log('2. If the subtask is not showing as a child, check the ClickUp API documentation');
    console.log('3. Consider checking ClickUp workspace permissions and settings');

  } catch (error) {
    console.error('\n❌ ERROR occurred during testing:');
    console.error('=====================================');
    console.error('Error message:', error.message);
    
    if (error.response) {
      console.error('HTTP Status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('\nFull error object:');
    console.error(error);
    
    console.log('\n🔍 Troubleshooting tips:');
    console.log('1. Check that your ClickUp API key is valid');
    console.log('2. Verify the task ID exists and you have access to it');
    console.log('3. Ensure your ClickUp workspace allows subtask creation');
    console.log('4. Check that the CLICKUP_TEAM_ID environment variable is correct');
    
    process.exit(1);
  }
}

// Get task ID from command line arguments
const taskId = process.argv[2];
testSubtaskCreation(taskId);
