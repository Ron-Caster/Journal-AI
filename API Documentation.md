# Journal-AI API Documentation

## Overview
Journal-AI is an intelligent journaling application that uses AI to transform daily logs into coherent diary entries and extract actionable tasks. The system integrates with Groq API to provide natural language processing capabilities.

---

## AI Features

### 1. Diary Generation AI
**Primary Function**: Transforms raw daily logs into coherent, reflective diary entries

**AI Model**: Groq Compound Model
- **Model Path**: `groq/compound`
- **Max Tokens**: 1,500
- **Temperature**: 0.7 (moderately creative)

**System Prompt**:
```
You are a thoughtful diary writer assistant. Your task is to either:
1. CREATE a new diary entry from provided logs if no existing diary exists for the date
2. UPDATE an existing diary entry by seamlessly incorporating new logs while maintaining narrative flow
3. And your response must not contain any thinking or explanations, just the diary content.

When updating an existing diary:
- Read the existing diary content carefully
- Identify where new log information fits chronologically
- If existing diary entry is there, add the new information in a way that flows naturally

The logs may contain spelling mistakes, grammar errors, and be in random order. Always maintain a thoughtful, reflective diary tone.
```

### 2. Task Extraction AI
**Primary Function**: Analyzes logs to identify tasks, to-dos, and action items

**AI Model**: Groq Compound Model
- **Model Path**: `groq/compound`
- **Max Tokens**: 1,000
- **Temperature**: 0.3 (more focused, less creative)

**System Prompt**:
```
You are a task identification assistant. Analyze the provided logs and identify any tasks, to-dos, or action items mentioned directly or indirectly.

Look for:
- Direct mentions: "need to", "should", "must", "remember to", "have to"
- Indirect mentions: "running low on" (implies restocking), "forgot to" (implies need to do later)
- Action verbs: "buy", "call", "finish", "complete", "schedule", "book"
- Deadlines and time-sensitive items

For each identified task:
1. Extract clear, actionable description
2. Determine priority: High (urgent/important), Medium (important), Low (nice to have)
3. Note the source log ID for reference

Return ONLY a JSON array with this exact structure:
[{"description": "task description", "priority": "High|Medium|Low", "sourceLogId": logId}]

Do not include any other text or formatting.
```

---

## API Endpoints

### Authentication & Status

#### GET `/api/status`
**Description**: Check API connection and Groq availability
**Response**:
```json
{
  "status": "success",
  "message": "Backend connected",
  "groq_available": true,
  "timestamp": "2025-10-01T12:00:00.000Z"
}
```

### Logs Management

#### GET `/api/logs`
**Description**: Retrieve all log entries
**Response**:
```json
{
  "logs": [
    {
      "id": 1,
      "content": "Had a productive morning meeting",
      "timestamp": "120000011025",
      "wordCount": 5
    }
  ],
  "nextId": 2
}
```

#### POST `/api/logs`
**Description**: Create a new log entry
**Request Body**:
```json
{
  "content": "Meeting with team about project updates"
}
```
**Response**:
```json
{
  "status": "success",
  "log": {
    "id": 1,
    "content": "Meeting with team about project updates",
    "timestamp": "120000011025",
    "wordCount": 6
  }
}
```

#### DELETE `/api/logs/{log_id}`
**Description**: Delete a specific log entry
**Response**:
```json
{
  "status": "success",
  "message": "Log deleted successfully"
}
```

### Diary Management

#### GET `/api/diary`
**Description**: Retrieve all diary entries
**Response**:
```json
{
  "entries": [
    {
      "id": 1,
      "date": "2025-10-01",
      "content": "Today was a productive day...",
      "createdAt": "2025-10-01T12:00:00.000Z",
      "lastUpdated": "2025-10-01T12:00:00.000Z",
      "logIds": [1, 2, 3]
    }
  ],
  "nextId": 2
}
```

#### POST `/api/generate-diary`
**Description**: Generate or update diary entry using AI
**Request Body**:
```json
{
  "date": "2025-10-01"
}
```
**Response**:
```json
{
  "status": "success",
  "message": "Diary entry generated successfully"
}
```

### Tasks Management

#### GET `/api/tasks`
**Description**: Retrieve all tasks
**Response**:
```json
{
  "tasks": [
    {
      "id": 1,
      "description": "Schedule team meeting",
      "priority": "High",
      "completed": false,
      "createdAt": "2025-10-01T12:00:00.000Z",
      "sourceLogId": 1,
      "date": "2025-10-01"
    }
  ],
  "nextId": 2
}
```

#### POST `/api/generate-tasks`
**Description**: Extract tasks from logs using AI
**Request Body**:
```json
{
  "date": "2025-10-01"
}
```
**Response**:
```json
{
  "status": "success",
  "message": "Generated 3 tasks",
  "tasksCount": 3
}
```

#### PUT `/api/tasks/{task_id}/toggle`
**Description**: Toggle task completion status
**Response**:
```json
{
  "status": "success"
}
```

#### DELETE `/api/tasks/{task_id}`
**Description**: Delete a specific task
**Response**:
```json
{
  "status": "success",
  "message": "Task deleted successfully"
}
```

---

## Use Cases

### 1. Daily Logging & Reflection
**Scenario**: User wants to maintain a daily journal without spending time writing coherent entries

**Workflow**:
1. User adds quick, unstructured logs throughout the day via POST `/api/logs`
2. At end of day, user calls POST `/api/generate-diary` to create a thoughtful diary entry
3. AI analyzes all logs for the date and creates a coherent narrative
4. User can regenerate or update the diary as more logs are added

**Benefits**:
- Captures thoughts in the moment without interrupting flow
- Creates meaningful reflection without time investment
- Maintains chronological narrative flow

### 2. Task Management & Productivity
**Scenario**: User mentions tasks and todos in casual logs but wants organized task tracking

**Workflow**:
1. User logs daily activities that may contain implicit tasks: "Need to buy groceries, forgot to call mom"
2. User calls POST `/api/generate-tasks` to extract actionable items
3. AI identifies direct and indirect task mentions with priority levels
4. Tasks appear in organized task list with source log references
5. User can toggle completion via PUT `/api/tasks/{id}/toggle`

**Benefits**:
- Never lose track of mentioned tasks
- Automatic priority assessment
- Seamless capture without breaking thought process

### 3. Meeting & Work Log Processing
**Scenario**: Professional user logs meeting notes and work activities throughout the day

**Workflow**:
1. User quickly logs meeting outcomes, decisions, and next steps
2. AI diary generation creates professional daily summary
3. AI task extraction identifies follow-up actions and deadlines
4. User has both reflective summary and actionable task list

**Benefits**:
- Professional documentation without admin overhead
- Automatic action item tracking
- Clear daily work summaries

### 4. Personal Development & Habit Tracking
**Scenario**: User wants to track personal growth and maintain awareness of daily patterns

**Workflow**:
1. User logs mood, activities, challenges, and wins throughout day
2. AI creates reflective diary entry highlighting patterns and growth
3. Task extraction identifies improvement opportunities and commitments
4. Over time, user builds comprehensive personal development history

**Benefits**:
- Pattern recognition through AI analysis
- Consistent reflection habit
- Actionable insights for personal growth

### 5. Creative Project Management
**Scenario**: Creative professional managing multiple projects and ideas

**Workflow**:
1. User logs inspiration, project updates, client feedback, and ideas
2. AI diary creates narrative connecting different project threads
3. Task extraction identifies project deadlines and creative tasks
4. User maintains creative flow while ensuring nothing falls through cracks

**Benefits**:
- Captures creative inspiration without interrupting flow
- Organizes complex project landscapes
- Balances creativity with project management

### 6. Health & Wellness Journaling
**Scenario**: User tracking health, exercise, nutrition, and wellness activities

**Workflow**:
1. User logs meals, exercise, symptoms, mood, and wellness activities
2. AI creates health-focused diary entries showing daily wellness picture
3. Task extraction identifies health goals and medical follow-ups
4. User builds comprehensive wellness history with actionable insights

**Benefits**:
- Holistic daily health tracking
- Identifies health patterns and trends
- Ensures medical and wellness tasks aren't forgotten

### 7. Student Academic Tracking
**Scenario**: Student managing coursework, assignments, and academic activities

**Workflow**:
1. Student logs class notes, assignment progress, study sessions, and academic insights
2. AI creates academic diary showing learning progression and challenges
3. Task extraction identifies assignments, study goals, and academic deadlines
4. Student maintains comprehensive academic record with built-in task management

**Benefits**:
- Academic progress tracking without extra overhead
- Automatic assignment and deadline management
- Reflective learning enhancement

### 8. Travel & Experience Documentation
**Scenario**: Traveler wanting to document experiences without constant writing

**Workflow**:
1. User logs quick thoughts, experiences, and observations during travel
2. AI creates rich travel diary entries capturing the essence of each day
3. Task extraction identifies travel logistics and planning items
4. User builds comprehensive travel memories with minimal effort

**Benefits**:
- Rich travel documentation without time investment
- Captures moments without interrupting experiences
- Organized travel planning and logistics

---

## Technical Implementation Notes

### Timestamp Format
- **Current Format**: `HHMMSSDDMMYYYY` (e.g., "120000011025" = 12:00:00 on 01/10/2025)
- **Legacy Support**: ISO format timestamps are still supported for backward compatibility

### Data Persistence
- All data stored in JSON files in `/data` directory
- Files: `logs.json`, `diary.json`, `tasks.json`
- Automatic data validation and repair on load
- Incremental ID assignment for all entities

### Error Handling
- Comprehensive error handling with user-friendly messages
- Graceful degradation when Groq API is unavailable
- Data integrity validation and automatic repair

### AI Processing
- Smart incremental updates for diary entries
- Duplicate task prevention through source log tracking
- Context-aware prompt engineering for different use cases

---

## Configuration Requirements

### Environment Variables
```
GROQ_API_KEY=your_groq_api_key_here
PORT=3001 (optional, defaults to 3001)
```

### Dependencies
- Flask with CORS support
- Groq Python SDK
- python-dotenv for environment management

### File Structure
```
/
├── server.py          # Flask backend with AI integration
├── app.js            # Frontend JavaScript application
├── index.html        # Main application interface
├── style.css         # Application styling
├── requirements.txt   # Python dependencies
├── .env              # Environment configuration
└── data/             # Data storage directory
    ├── logs.json     # User log entries
    ├── diary.json    # Generated diary entries
    └── tasks.json    # Extracted tasks
```