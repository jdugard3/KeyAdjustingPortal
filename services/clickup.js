const axios = require('axios');
const util = require('util');
const FormData = require('form-data');

class ClickUpService {
  constructor() {
    console.log('Initializing ClickUpService');
    if (!process.env.CLICKUP_API_KEY) {
      throw new Error('CLICKUP_API_KEY is not set');
    }
    this.API_KEY = process.env.CLICKUP_API_KEY;
    this.API_URL = 'https://api.clickup.com/api/v2';
    this.TEAM_ID = process.env.CLICKUP_TEAM_ID;
    this.CLAIMS_FIELD_ID = 'e94a7e2a-4113-4bde-a6ff-ed034bfb3c98';

    this.api = axios.create({
      baseURL: this.API_URL,
      headers: {
        'Authorization': this.API_KEY,
        'Content-Type': 'application/json'
      }
    });
  }

  // Get task by ID
  async getTask(taskId) {
    try {
      console.log('ClickUpService.getTask called with:', taskId);
      const response = await this.api.get(`/task/${taskId}?custom_task_ids=true&team_id=${this.TEAM_ID}`);
      console.log('ClickUp API response status:', response.status);
      
      console.log('Sample custom fields:', JSON.stringify(response.data.custom_fields.slice(0, 3), null, 2));
      console.log('Contractor Salesman field:', JSON.stringify(
        response.data.custom_fields.find(f => f.name === 'Contractor Salesman'),
        null, 2
      ));
      console.log('RCV field:', JSON.stringify(
        response.data.custom_fields.find(f => f.name === 'RCV'),
        null, 2
      ));
      
      return response.data;
    } catch (error) {
      console.error('ClickUpService.getTask error:', error.message);
      throw error;
    }
  }

  // Get all related claims from a contractor task
  async getContractorClaims(contractorId) {
    try {
      // Get contractor data from ClickUp
      const contractorTask = await this.getTask(contractorId);
      
      // Find the claims field
      const claimsField = contractorTask.custom_fields.find(field => 
        field.type === 'tasks' && field.name === 'Claim'
      );
      
      if (!claimsField || !claimsField.value) {
        console.log('No claims field found or no claims');
        return [];
      }

      // Return simplified claims list immediately
      const claims = claimsField.value
        .filter(claim => claim.access !== false)
        .map(claim => ({
          id: claim.id,
          claimId: claim.id,
          name: claim.name,
          status: {
            status: claim.status || 'unknown',
            color: claim.color || '#999999'
          }
        }));

      console.log(`Found ${claims.length} claims for contractor ${contractorId}`);
      return claims;
    } catch (error) {
      console.error('Error fetching contractor claims:', error);
      throw error;
    }
  }

  // Fetch detailed claim data when requested
  async getClaimDetails(claimId) {
    try {
      const claimDetails = await this.getTask(claimId);
      const comments = await this.getTaskComments(claimId);
      
      return {
        id: claimDetails.id,
        claimId: claimDetails.id,
        name: claimDetails.name,
        status: claimDetails.status,
        customFields: claimDetails.custom_fields
          .filter(field => !field.hide_from_guests && field.value != null)
          .map(field => ({
            id: field.id,
            name: field.name,
            type: field.type,
            value: field.value
          })),
        attachments: claimDetails.attachments || [],
        description: claimDetails.description || '',
        comments: comments.slice(0, 5) // Get only the 5 most recent comments
      };
    } catch (error) {
      console.error(`Error fetching claim details for ${claimId}:`, error);
      throw error;
    }
  }

  // Upload attachment to a task
  async uploadDocument(taskId, file) {
    try {
      const formData = new FormData();
      formData.append('attachment', file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype
      });

      const response = await axios.post(
        `${this.API_URL}/task/${taskId}/attachment`,
        formData,
        {
          headers: {
            'Authorization': this.API_KEY,
            ...formData.getHeaders()
          }
        }
      );

      if (!response.data) {
        throw new Error('No response from ClickUp API');
      }

      console.log('Upload successful:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error uploading document:', error.message);
      throw new Error('Unable to upload document: ' + error.message);
    }
  }

  // Get contractor info (now just uses getTask)
  async getContractorInfo(contractorId) {
    return this.getTask(contractorId);
  }

  // Get comments for a task
  async getTaskComments(taskId) {
    try {
      console.log(`Fetching comments for task ${taskId}`);
      const response = await this.api.get(
        `/task/${taskId}/comment?custom_task_ids=true&team_id=${this.TEAM_ID}`
      );
      
      // Log the response structure to debug
      console.log('Comments response structure:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
      
      return response.data.comments || [];
    } catch (error) {
      console.error('Error fetching task comments:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // Add a comment to a task (optionally assign to Key PA if no subtask will be created)
  async addTaskComment(taskId, commentData, assignToKeyPA = true) {
    try {
      console.log(`Adding comment to task ${taskId}:`, commentData);
      
      // Only assign to Key PA if explicitly requested (when no subtask is being created)
      if (assignToKeyPA) {
        // Get the task details to find the Key PA
        const taskDetails = await this.getTask(taskId);
        
        // Find the Key PA field
        const keyPAField = taskDetails.custom_fields.find(field => 
          field.name === '🙎‍♂️ Key PA' || field.name === 'Key PA'
        );
        
        // If Key PA exists and has a value, assign the comment to them
        if (keyPAField && keyPAField.value && keyPAField.value.length > 0) {
          // For user fields, the value is typically an array of user objects
          const keyPAUser = keyPAField.value[0];
          console.log('Found Key PA user:', keyPAUser);
          
          // Add the assignee to the comment data
          if (keyPAUser.id) {
            commentData.assignee = keyPAUser.id;
            console.log('Assigning comment to Key PA:', keyPAUser.id);
          }
        } else {
          console.log('No Key PA found for this task or field is empty');
        }
      } else {
        console.log('Skipping Key PA assignment - subtask will handle follow-up');
      }
      
      const response = await this.api.post(
        `/task/${taskId}/comment?custom_task_ids=true&team_id=${this.TEAM_ID}`,
        commentData
      );
      
      console.log('Comment post response:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error) {
      console.error('Error adding task comment:', error.response?.data || error.message);
      throw error;
    }
  }

  // Create a subtask from a parent task
  async createSubtask(parentTaskId, subtaskData) {
    try {
      console.log(`Creating subtask for parent task ${parentTaskId}:`, subtaskData);
      
      // Get parent task details to extract list_id
      const parentTask = await this.getTask(parentTaskId);
      const listId = parentTask.list.id;
      
      console.log(`Parent task details - List ID: ${listId}, Task ID: ${parentTaskId}`);
      
      // Prepare subtask payload with explicit parent reference
      const subtaskPayload = {
        name: subtaskData.name,
        description: subtaskData.description || '',
        parent: parentTaskId, // This is the key field that makes it a subtask
        assignees: Array.isArray(subtaskData.assignees) ? subtaskData.assignees : [],
        priority: subtaskData.priority || 3, // Default to normal priority (3)
        status: subtaskData.status || 'new claim' // Use the first available status for Active Claims list
      };

      // Only add optional fields if they have values
      if (subtaskData.due_date) {
        subtaskPayload.due_date = subtaskData.due_date;
      }
      if (subtaskData.start_date) {
        subtaskPayload.start_date = subtaskData.start_date;
      }
      if (subtaskData.custom_fields && Array.isArray(subtaskData.custom_fields)) {
        subtaskPayload.custom_fields = subtaskData.custom_fields;
      }

      console.log('Subtask payload:', JSON.stringify(subtaskPayload, null, 2));

      const response = await this.api.post(
        `/list/${listId}/task?custom_task_ids=true&team_id=${this.TEAM_ID}`,
        subtaskPayload
      );
      
      console.log('Subtask creation response:', JSON.stringify(response.data, null, 2));
      console.log(`Successfully created subtask ${response.data.id} under parent ${parentTaskId}`);
      
      return response.data;
    } catch (error) {
      console.error('Error creating subtask:', error.response?.data || error.message);
      console.error('Full error response:', error.response);
      throw error;
    }
  }

  // Add a comment and optionally create a subtask based on user type
  async addTaskCommentWithSubtask(taskId, commentData, createSubtask = false, userInfo = null) {
    try {
      console.log(`Adding comment with potential subtask creation for task ${taskId}`);
      console.log(`User info:`, userInfo);
      console.log(`Create subtask:`, createSubtask);
      
      // First add the comment (don't assign to Key PA if we're creating a subtask)
      const commentResponse = await this.addTaskComment(taskId, commentData, !createSubtask);
      console.log(`Comment added successfully:`, commentResponse);
      
      // If subtask creation is requested, create one
      if (createSubtask && userInfo) {
        console.log('Creating subtask...');
        
        // Get parent task to find Key PA for assignment
        const parentTask = await this.getTask(taskId);
        const keyPAField = parentTask.custom_fields.find(field => 
          field.name === '🙎‍♂️ Key PA' || field.name === 'Key PA'
        );
        
        let assignees = [];
        if (keyPAField && keyPAField.value && keyPAField.value.length > 0) {
          // For user fields, extract the user ID
          const keyPAUser = keyPAField.value[0];
          if (keyPAUser && keyPAUser.id) {
            assignees = [parseInt(keyPAUser.id)]; // ClickUp expects integer user IDs
            console.log(`Assigning subtask to Key PA: ${keyPAUser.id} (${keyPAUser.username || keyPAUser.name})`);
          }
        }
        
        const subtaskName = `Follow-up: ${commentData.comment_text.substring(0, 50)}${commentData.comment_text.length > 50 ? '...' : ''}`;
        const subtaskDescription = `Created from comment by ${userInfo.name} (${userInfo.email}):\n\n"${commentData.comment_text}"`;
        
        const subtaskData = {
          name: subtaskName,
          description: subtaskDescription,
          assignees: assignees,
          priority: 3, // Normal priority
          status: 'new claim'
        };

        console.log('Subtask data:', subtaskData);
        const subtaskResponse = await this.createSubtask(taskId, subtaskData);
        
        console.log(`Subtask created successfully: ${subtaskResponse.id}`);
        
        return {
          comment: commentResponse,
          subtask: subtaskResponse
        };
      }
      
      return { comment: commentResponse };
    } catch (error) {
      console.error('Error adding comment with subtask:', error.response?.data || error.message);
      throw error;
    }
  }
}

module.exports = ClickUpService; 