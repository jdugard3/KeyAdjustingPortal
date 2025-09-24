# ClickUp Subtask Creation Feature

## Overview
This feature automatically creates subtasks in ClickUp when comments are left by sales/contractor users in the portal, providing better follow-up tracking and task management.

## Implementation Details

### 1. User Type System
- Added `userType` field to User model with options: `contractor`, `sales`, `admin`
- Updated JWT tokens to include user type information
- Modified authentication middleware to pass user type to requests

### 2. ClickUp Service Enhancements
Added new methods to `services/clickup.js`:
- `createSubtask(parentTaskId, subtaskData)` - Creates a subtask under a parent task
- `addTaskCommentWithSubtask(taskId, commentData, createSubtask, userInfo)` - Adds comment and optionally creates subtask

### 3. Comment Endpoint Enhancement
Modified `routes/claims.js` comment endpoint to:
- Check user type and determine if subtask should be created
- Use enhanced comment method when subtask creation is needed
- Support explicit subtask creation via `create_subtask` parameter

### 4. Frontend Updates
Updated `views/claim.ejs` to:
- Show subtask creation checkbox for regular contractors
- Display automatic subtask creation notice for sales/admin contractor users
- Include subtask preference in comment form submission

### 5. Admin Panel Updates
Updated `routes/admin.js` to support user type selection when creating new users.

## User Behavior

### Automatic Subtask Creation
Subtasks are automatically created when:
- User type is `sales`
- User type is `contractor` AND user is admin

### Manual Subtask Creation
Regular contractor users (non-admin) can opt-in to subtask creation using the checkbox in the comment form.

### Subtask Details
Created subtasks include:
- Name: "Follow-up: [first 50 chars of comment]..."
- Description: Full comment text with author information
- Assignee: Key PA from the parent task (if available)
- Priority: Medium (level 2)
- Status: Open

## API Changes

### Comment Endpoint
**POST** `/claims/:claimId/comment`

New optional parameter:
- `create_subtask` (boolean) - Explicitly request subtask creation

Response now includes:
```json
{
  "comment": { ... },
  "subtask": { ... }  // Only present when subtask is created
}
```

### User Creation
**POST** `/admin/users`

New parameter:
- `userType` (string) - One of: contractor, sales, admin

## Database Schema Changes

### User Model
```javascript
userType: {
  type: String,
  enum: ['contractor', 'sales', 'admin'],
  default: 'contractor'
}
```

## Configuration
No additional environment variables required. Uses existing ClickUp API configuration.

## Testing
To test the feature:
1. Create users with different `userType` values
2. Log in as different user types
3. Add comments to claims
4. Verify subtask creation behavior matches user type rules
5. Check that subtasks are properly assigned to Key PA

## Future Enhancements
Potential improvements:
- Custom subtask templates based on comment content
- Configurable subtask priorities per user type
- Integration with ClickUp automations
- Bulk subtask management
