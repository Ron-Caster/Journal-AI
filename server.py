from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import json
import os
from datetime import datetime, timedelta
from groq import Groq
from dotenv import load_dotenv
import traceback

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Groq client
groq_client = None
try:
    groq_api_key = os.getenv('GROQ_API_KEY')
    if groq_api_key:
        groq_client = Groq(api_key=groq_api_key)
        print("✅ Groq client initialized successfully")
    else:
        print("❌ GROQ_API_KEY not found in environment variables")
except Exception as e:
    print(f"❌ Failed to initialize Groq client: {e}")
    groq_client = None

# Data storage paths
DATA_DIR = 'data'
LOGS_FILE = os.path.join(DATA_DIR, 'logs.json')
DIARY_FILE = os.path.join(DATA_DIR, 'diary.json')
TASKS_FILE = os.path.join(DATA_DIR, 'tasks.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Initialize data files if they don't exist
def init_data_file(file_path, default_data):
    try:
        if not os.path.exists(file_path):
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                json.dump(default_data, f, indent=2)
            print(f"✅ Created {file_path} with default data")
        else:
            # Validate existing file structure
            try:
                with open(file_path, 'r') as f:
                    data = json.load(f)
                # Check if the file has the expected structure
                if 'logs.json' in file_path and ('logs' not in data or 'nextId' not in data):
                    raise ValueError("Invalid logs.json structure")
                elif 'diary.json' in file_path and ('entries' not in data or 'nextId' not in data):
                    raise ValueError("Invalid diary.json structure")
                elif 'tasks.json' in file_path and ('tasks' not in data or 'nextId' not in data):
                    raise ValueError("Invalid tasks.json structure")
            except (json.JSONDecodeError, ValueError) as e:
                print(f"⚠️  Invalid or corrupted {file_path}, recreating with default data")
                with open(file_path, 'w') as f:
                    json.dump(default_data, f, indent=2)
    except Exception as e:
        print(f"❌ Error initializing {file_path}: {e}")
        # Try to create with default data anyway
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, 'w') as f:
                json.dump(default_data, f, indent=2)
            print(f"✅ Successfully created {file_path} after error recovery")
        except Exception as recovery_error:
            print(f"❌ Failed to recover {file_path}: {recovery_error}")

# Initialize all data files
init_data_file(LOGS_FILE, {"logs": [], "nextId": 1})
init_data_file(DIARY_FILE, {"entries": [], "nextId": 1})
init_data_file(TASKS_FILE, {"tasks": [], "nextId": 1})

# Helper functions for data persistence
def load_json_file(file_path):
    try:
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Validate and repair data structure
        if 'logs.json' in file_path:
            data = validate_and_repair_data(data, 'logs')
        elif 'diary.json' in file_path:
            data = validate_and_repair_data(data, 'diary')
        elif 'tasks.json' in file_path:
            data = validate_and_repair_data(data, 'tasks')
        
        return data
    except Exception as e:
        print(f"Error loading {file_path}: {e}")
        # Return appropriate default structure based on file path
        if 'logs.json' in file_path:
            return {"logs": [], "nextId": 1}
        elif 'diary.json' in file_path:
            return {"entries": [], "nextId": 1}
        elif 'tasks.json' in file_path:
            return {"tasks": [], "nextId": 1}
        else:
            return {}

def save_json_file(file_path, data):
    try:
        # Ensure directory exists before saving
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving {file_path}: {e}")
        return False

def validate_and_repair_data(data, file_type):
    """Validate data structure and repair if needed"""
    if file_type == 'logs':
        if not isinstance(data, dict):
            return {"logs": [], "nextId": 1}
        if 'logs' not in data:
            data['logs'] = []
        if 'nextId' not in data:
            data['nextId'] = 1
        if not isinstance(data['logs'], list):
            data['logs'] = []
    elif file_type == 'diary':
        if not isinstance(data, dict):
            return {"entries": [], "nextId": 1}
        if 'entries' not in data:
            data['entries'] = []
        if 'nextId' not in data:
            data['nextId'] = 1
        if not isinstance(data['entries'], list):
            data['entries'] = []
    elif file_type == 'tasks':
        if not isinstance(data, dict):
            return {"tasks": [], "nextId": 1}
        if 'tasks' not in data:
            data['tasks'] = []
        if 'nextId' not in data:
            data['nextId'] = 1
        if not isinstance(data['tasks'], list):
            data['tasks'] = []
    return data

# System prompts for Groq API
DIARY_SYSTEM_PROMPT = """You are a thoughtful diary writer assistant. Your task is to either:

1. CREATE a new diary entry from provided logs if no existing diary exists for the date
2. UPDATE an existing diary entry by seamlessly incorporating new logs while maintaining narrative flow

When updating an existing diary:
- Read the existing diary content carefully
- Identify where new log information fits chronologically
- Seamlessly weave new experiences into the existing narrative
- Maintain consistent tone and writing style
- Ensure the updated diary flows naturally as a single cohesive entry
- Preserve important details from both existing content and new logs

When creating new diary:
- Transform chaotic, potentially misspelled logs into a coherent diary entry
- Maintain chronological order when possible
- Focus on emotions, experiences, and insights
- Write in first person with a personal, reflective tone

The logs may contain spelling mistakes, grammar errors, and be in random order. Always maintain a thoughtful, reflective diary tone."""

TASK_SYSTEM_PROMPT = """You are a task identification assistant. Analyze the provided logs and identify any tasks, to-dos, or action items mentioned directly or indirectly.

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

Do not include any other text or formatting."""

# Routes

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:filename>')
def serve_static(filename):
    return send_from_directory('.', filename)

@app.route('/api/status', methods=['GET'])
def api_status():
    """Check if the Groq API is available"""
    return jsonify({
        'status': 'success',
        'message': 'Backend connected',
        'groq_available': groq_client is not None,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get all logs"""
    data = load_json_file(LOGS_FILE)
    return jsonify(data)

@app.route('/api/logs', methods=['POST'])
def add_log():
    """Add a new log entry"""
    try:
        log_data = request.get_json()
        
        # Load current logs
        data = load_json_file(LOGS_FILE)
        
        # Create new log entry
        now = datetime.now()
        timestamp = f"{now.hour:02d}{now.minute:02d}{now.second:02d}{now.day:02d}{now.month:02d}{now.year}"
        new_log = {
            'id': data.get('nextId', 1),
            'content': log_data.get('content', ''),
            'timestamp': timestamp,
            'wordCount': len(log_data.get('content', '').split())
        }
        
        # Add to logs and increment nextId
        data['logs'].append(new_log)
        data['nextId'] = data.get('nextId', 1) + 1
        
        # Save to file
        if save_json_file(LOGS_FILE, data):
            return jsonify({
                'status': 'success',
                'log': new_log
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save log'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/logs/<int:log_id>', methods=['DELETE'])
def delete_log(log_id):
    """Delete a log entry"""
    try:
        data = load_json_file(LOGS_FILE)
        
        # Find and remove the log
        original_count = len(data.get('logs', []))
        data['logs'] = [log for log in data.get('logs', []) if log['id'] != log_id]
        
        if len(data['logs']) == original_count:
            return jsonify({'status': 'error', 'message': 'Log not found'}), 404
        
        # Save to file
        if save_json_file(LOGS_FILE, data):
            return jsonify({'status': 'success', 'message': 'Log deleted successfully'})
        else:
            return jsonify({'status': 'error', 'message': 'Failed to delete log'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/diary', methods=['GET'])
def get_diary():
    """Get all diary entries"""
    data = load_json_file(DIARY_FILE)
    return jsonify(data)

@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    """Get all tasks"""
    data = load_json_file(TASKS_FILE)
    return jsonify(data)

@app.route('/api/generate-diary', methods=['POST'])
def generate_diary():
    """Generate diary entry from logs using Groq API"""
    try:
        if groq_client is None:
            return jsonify({
                'status': 'error',
                'message': 'Groq API not available'
            }), 500

        request_data = request.get_json()
        target_date = request_data.get('date')
        
        # Load logs for the target date
        logs_data = load_json_file(LOGS_FILE)
        
        # Filter logs for the target date
        target_logs = []
        for log in logs_data.get('logs', []):
            # Handle both new timestamp format and old ISO format
            try:
                if 'T' in log['timestamp']:
                    # Old ISO format
                    log_date = datetime.fromisoformat(log['timestamp']).date().isoformat()
                else:
                    # New HHMMSSDDMMYYYY format  
                    timestamp = log['timestamp']
                    if len(timestamp) >= 12:  # Allow for different year formats
                        day = int(timestamp[6:8])
                        month = int(timestamp[8:10])
                        if len(timestamp) == 14:  # Full year format HHMMSSDDMMYYYY
                            year = int(timestamp[10:14])
                        elif len(timestamp) == 12:  # Short year format HHMMSSDDMMYY
                            year = int(timestamp[10:12]) + 2000
                        else:
                            continue  # Skip invalid timestamps
                        log_date = f"{year:04d}-{month:02d}-{day:02d}"
                    else:
                        continue  # Skip invalid timestamps
                
                if log_date == target_date:
                    target_logs.append(log)
            except (ValueError, IndexError):
                # Skip logs with invalid timestamps
                continue
        
        if not target_logs:
            return jsonify({
                'status': 'error',
                'message': 'No logs found for the specified date'
            }), 400
        
        # Load existing diary entries
        diary_data = load_json_file(DIARY_FILE)
        existing_entry = None
        
        for entry in diary_data.get('entries', []):
            if entry['date'] == target_date:
                existing_entry = entry
                break
        
        # Prepare prompt for Groq
        logs_text = "\n\n".join([f"Log {log['id']}: {log['content']}" for log in target_logs])
        
        if existing_entry:
            user_prompt = f"""EXISTING DIARY ENTRY for {target_date}:
{existing_entry['content']}

NEW LOGS to incorporate:
{logs_text}

Please update the existing diary entry by seamlessly incorporating the new logs while maintaining narrative flow."""
        else:
            user_prompt = f"""LOGS for {target_date}:
{logs_text}

Please create a cohesive diary entry from these logs."""
        
        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="groq/compound",
            messages=[
                {"role": "system", "content": DIARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1500,
            temperature=0.7
        )
        
        diary_content = completion.choices[0].message.content
        
        # Save or update diary entry
        if existing_entry:
            existing_entry['content'] = diary_content
            existing_entry['lastUpdated'] = datetime.now().isoformat()
            existing_entry['logIds'] = list(set(existing_entry.get('logIds', []) + [log['id'] for log in target_logs]))
        else:
            new_entry = {
                'id': diary_data.get('nextId', 1),
                'date': target_date,
                'content': diary_content,
                'createdAt': datetime.now().isoformat(),
                'lastUpdated': datetime.now().isoformat(),
                'logIds': [log['id'] for log in target_logs]
            }
            diary_data['entries'].append(new_entry)
            diary_data['nextId'] = diary_data.get('nextId', 1) + 1
        
        # Save to file
        if save_json_file(DIARY_FILE, diary_data):
            return jsonify({
                'status': 'success',
                'message': 'Diary entry generated successfully'
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save diary entry'}), 500
            
    except Exception as e:
        print(f"Error in generate_diary: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to generate diary: {str(e)}'
        }), 500

@app.route('/api/generate-tasks', methods=['POST'])
def generate_tasks():
    """Generate tasks from logs using Groq API"""
    try:
        if groq_client is None:
            return jsonify({
                'status': 'error',
                'message': 'Groq API not available'
            }), 500

        request_data = request.get_json()
        target_date = request_data.get('date')
        
        # Load logs for the target date
        logs_data = load_json_file(LOGS_FILE)
        
        # Filter logs for the target date and check which haven't been processed for tasks
        tasks_data = load_json_file(TASKS_FILE)
        processed_log_ids = set()
        
        # Get all log IDs that have already been processed for this date
        for task in tasks_data.get('tasks', []):
            if task.get('date') == target_date and task.get('sourceLogId'):
                # Handle both string and integer source log IDs
                source_id = task.get('sourceLogId')
                if isinstance(source_id, str) and source_id.startswith('Log'):
                    # Extract number from "Log2" format
                    try:
                        processed_log_ids.add(int(source_id[3:]))
                    except ValueError:
                        pass
                elif isinstance(source_id, int):
                    processed_log_ids.add(source_id)
        
        # Filter logs for the target date that haven't been processed yet
        target_logs = []
        for log in logs_data.get('logs', []):
            # Handle both new timestamp format and old ISO format
            try:
                if 'T' in log['timestamp']:
                    # Old ISO format
                    log_date = datetime.fromisoformat(log['timestamp']).date().isoformat()
                else:
                    # New HHMMSSDDMMYYYY format  
                    timestamp = log['timestamp']
                    if len(timestamp) >= 12:  # Allow for different year formats
                        day = int(timestamp[6:8])
                        month = int(timestamp[8:10])
                        if len(timestamp) == 14:  # Full year format HHMMSSDDMMYYYY
                            year = int(timestamp[10:14])
                        elif len(timestamp) == 12:  # Short year format HHMMSSDDMMYY
                            year = int(timestamp[10:12]) + 2000
                        else:
                            continue  # Skip invalid timestamps
                        log_date = f"{year:04d}-{month:02d}-{day:02d}"
                    else:
                        continue  # Skip invalid timestamps
                
                if log_date == target_date and log['id'] not in processed_log_ids:
                    target_logs.append(log)
            except (ValueError, IndexError):
                # Skip logs with invalid timestamps
                continue
        
        if not target_logs:
            return jsonify({
                'status': 'error',
                'message': 'No new logs found for the specified date to process'
            }), 400
        
        # Prepare prompt for Groq
        logs_text = "\n\n".join([f"Log {log['id']}: {log['content']}" for log in target_logs])
        
        user_prompt = f"""Analyze these logs and extract tasks:

{logs_text}"""
        
        # Call Groq API
        completion = groq_client.chat.completions.create(
            model="groq/compound",
            messages=[
                {"role": "system", "content": TASK_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        # Parse the response
        try:
            tasks_response = completion.choices[0].message.content.strip()
            extracted_tasks = json.loads(tasks_response)
        except json.JSONDecodeError:
            # If JSON parsing fails, try to extract tasks manually
            extracted_tasks = []
        
        # Load current tasks and add new ones
        tasks_data = load_json_file(TASKS_FILE)
        new_tasks_count = 0
        
        for task in extracted_tasks:
            if isinstance(task, dict) and 'description' in task:
                new_task = {
                    'id': tasks_data.get('nextId', 1),
                    'description': task['description'],
                    'priority': task.get('priority', 'Medium'),
                    'completed': False,
                    'createdAt': datetime.now().isoformat(),
                    'sourceLogId': task.get('sourceLogId', None),
                    'date': target_date
                }
                tasks_data['tasks'].append(new_task)
                tasks_data['nextId'] = tasks_data.get('nextId', 1) + 1
                new_tasks_count += 1
        
        # Save to file
        if save_json_file(TASKS_FILE, tasks_data):
            return jsonify({
                'status': 'success',
                'message': f'Generated {new_tasks_count} tasks',
                'tasksCount': new_tasks_count
            })
        else:
            return jsonify({'status': 'error', 'message': 'Failed to save tasks'}), 500
            
    except Exception as e:
        print(f"Error in generate_tasks: {traceback.format_exc()}")
        return jsonify({
            'status': 'error',
            'message': f'Failed to generate tasks: {str(e)}'
        }), 500

@app.route('/api/tasks/<int:task_id>/toggle', methods=['PUT'])
def toggle_task(task_id):
    """Toggle task completion status"""
    try:
        tasks_data = load_json_file(TASKS_FILE)
        
        for task in tasks_data.get('tasks', []):
            if task['id'] == task_id:
                task['completed'] = not task.get('completed', False)
                task['completedAt'] = datetime.now().isoformat() if task['completed'] else None
                break
        
        if save_json_file(TASKS_FILE, tasks_data):
            return jsonify({'status': 'success'})
        else:
            return jsonify({'status': 'error', 'message': 'Failed to update task'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Delete a task"""
    try:
        data = load_json_file(TASKS_FILE)
        
        # Find and remove the task
        original_count = len(data.get('tasks', []))
        data['tasks'] = [task for task in data.get('tasks', []) if task['id'] != task_id]
        
        if len(data['tasks']) == original_count:
            return jsonify({'status': 'error', 'message': 'Task not found'}), 404
        
        # Save to file
        if save_json_file(TASKS_FILE, data):
            return jsonify({'status': 'success', 'message': 'Task deleted successfully'})
        else:
            return jsonify({'status': 'error', 'message': 'Failed to delete task'}), 500
            
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3001))
    print(f"🚀 Starting Daily Log server on http://localhost:{port}")
    print(f"📁 Data directory: {os.path.abspath(DATA_DIR)}")
    
    if groq_client:
        print("✅ Groq API integration ready")
    else:
        print("❌ Groq API not configured - check your .env file")
    
    app.run(debug=True, host='0.0.0.0', port=port)