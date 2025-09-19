// Daily Log Application with Flask Backend Integration
class DailyLogApp {
    constructor() {
        // Configuration
        this.API_BASE_URL = 'http://localhost:3001/api';
        
        // Initialize data structures
        this.logs = [];
        this.diaryEntries = [];
        this.tasks = [];
        this.currentTab = 'logs';
        this.nextLogId = 1;
        this.nextTaskId = 1;
        this.nextDiaryId = 1;
        this.apiConnected = false;
    }

    async init() {
        // Check API connection
        await this.checkApiConnection();
        
        this.setupEventListeners();
        this.updateCharCounter();
        await this.loadData();
        this.renderLogs();
        this.updateLogsStats();
        this.updateLastSync();
        this.showEmptyStates();
    }

    async checkApiConnection() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/status`);
            if (response.ok) {
                this.apiConnected = true;
                this.updateApiStatus('connected', '✅ API Connected');
            } else {
                throw new Error('API not responding');
            }
        } catch (error) {
            this.apiConnected = false;
            this.updateApiStatus('error', '❌ Backend Not Available');
            console.error('API connection failed:', error);
        }
    }

    // Data Persistence using Flask Backend
    async loadData() {
        try {
            // Load logs
            const logsResponse = await fetch(`${this.API_BASE_URL}/logs`);
            if (logsResponse.ok) {
                const logsData = await logsResponse.json();
                this.logs = logsData.logs || [];
                this.nextLogId = logsData.nextId || 1;
            }

            // Load diary entries
            const diaryResponse = await fetch(`${this.API_BASE_URL}/diary`);
            if (diaryResponse.ok) {
                const diaryData = await diaryResponse.json();
                this.diaryEntries = diaryData.entries || [];
                this.nextDiaryId = diaryData.nextId || 1;
            }

            // Load tasks
            const tasksResponse = await fetch(`${this.API_BASE_URL}/tasks`);
            if (tasksResponse.ok) {
                const tasksData = await tasksResponse.json();
                this.tasks = tasksData.tasks || [];
                this.nextTaskId = tasksData.nextId || 1;
            }
        } catch (error) {
            console.error('Error loading data:', error);
            this.showToast('Failed to load data from server', 'error');
        }
    }

    saveToStorage() {
        // Data is automatically saved on the server for each operation
        this.updateLastSync();
    }

    loadFromStorage() {
        // No longer needed - data is loaded from server
    }

    updateLastSync() {
        const lastSyncElement = document.getElementById('last-sync');
        if (lastSyncElement) {
            lastSyncElement.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }

    updateApiStatus(type, message) {
        const statusIndicator = document.getElementById('api-status-indicator');
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${type}`;
            statusIndicator.textContent = message;
        }
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Log input character counter
        const logInput = document.getElementById('log-input');
        if (logInput) {
            logInput.addEventListener('input', () => this.updateCharCounter());
        }

        // Add log button
        const addLogBtn = document.getElementById('add-log-btn');
        if (addLogBtn) {
            addLogBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.addLog();
            });
        }

        // Diary generation
        const generateDiaryBtn = document.getElementById('generate-diary-btn');
        if (generateDiaryBtn) {
            generateDiaryBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.generateDiary();
            });
        }

        const regenerateDiaryBtn = document.getElementById('regenerate-diary-btn');
        if (regenerateDiaryBtn) {
            regenerateDiaryBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.generateDiary(true);
            });
        }

        const updateDiaryBtn = document.getElementById('update-diary-btn');
        if (updateDiaryBtn) {
            updateDiaryBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.generateDiary(false, true);
            });
        }

        const exportDiaryBtn = document.getElementById('export-diary-btn');
        if (exportDiaryBtn) {
            exportDiaryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.exportDiary();
            });
        }

        // Diary history controls
        const diaryHistoryBtn = document.getElementById('diary-history-btn');
        if (diaryHistoryBtn) {
            diaryHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.showDiaryHistory();
            });
        }

        const closeHistoryBtn = document.getElementById('close-history-btn');
        if (closeHistoryBtn) {
            closeHistoryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.hideDiaryHistory();
            });
        }

        // Task extraction
        const extractTasksBtn = document.getElementById('extract-tasks-btn');
        if (extractTasksBtn) {
            extractTasksBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                await this.extractTasks();
            });
        }

        // Task filtering
        const taskFilter = document.getElementById('task-filter');
        if (taskFilter) {
            taskFilter.addEventListener('change', (e) => {
                this.filterTasks(e.target.value);
            });
        }

        // Manual task addition
        const addManualTaskBtn = document.getElementById('add-manual-task-btn');
        if (addManualTaskBtn) {
            addManualTaskBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.addManualTask();
            });
        }

        // Enter key handling for inputs
        if (logInput) {
            logInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    await this.addLog();
                }
            });
        }

        const manualTaskInput = document.getElementById('manual-task-input');
        if (manualTaskInput) {
            manualTaskInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addManualTask();
                }
            });
        }
    }

    switchTab(tabName) {
        if (!tabName) return;

        console.log('Switching to tab:', tabName); // Debug log

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        // Update tab content - Fixed implementation
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`${tabName}-section`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.currentTab = tabName;

        // Update content based on current tab
        if (tabName === 'logs') {
            this.renderLogs();
            this.updateLogsStats();
        } else if (tabName === 'diary') {
            this.updateDiarySection();
        } else if (tabName === 'tasks') {
            this.updateTasksSection();
        }
    }

    generateTimestamp() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = String(now.getFullYear());
        
        return `${hours}${minutes}${seconds}${day}${month}${year}`;
    }

    formatTimestamp(timestamp) {
        if (!timestamp || timestamp.length !== 12) return 'Invalid timestamp';
        
        const hours = timestamp.substring(0, 2);
        const minutes = timestamp.substring(2, 4);
        const seconds = timestamp.substring(4, 6);
        const day = timestamp.substring(6, 8);
        const month = timestamp.substring(8, 10);
        const year = timestamp.substring(10, 12);
        
        return `${day}/${month}/20${year} at ${hours}:${minutes}:${seconds}`;
    }

    updateCharCounter() {
        const logInput = document.getElementById('log-input');
        const counter = document.getElementById('char-counter');
        if (logInput && counter) {
            const count = logInput.value.length;
            counter.textContent = `${count} characters`;
        }
    }

    async addLog() {
        const logInput = document.getElementById('log-input');
        const addLogBtn = document.getElementById('add-log-btn');
        if (!logInput) return;
        
        const content = logInput.value.trim();

        if (!content) {
            this.showToast('Please enter some content for your log', 'error');
            return;
        }

        // Show loading state
        if (addLogBtn) {
            addLogBtn.classList.add('loading');
            addLogBtn.disabled = true;
        }

        try {
            const response = await fetch(`${this.API_BASE_URL}/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ content: content })
            });

            if (!response.ok) {
                throw new Error('Failed to save log');
            }

            const result = await response.json();
            
            // Add the new log to local state
            this.logs.push(result.log);
            this.nextLogId = result.log.id + 1;
            
            logInput.value = '';
            this.updateCharCounter();
            
            this.renderLogs();
            this.updateLogsStats();
            this.showToast('Log entry added successfully!', 'success');

            // Check if automatic generation is enabled
            const autoDiary = document.getElementById('auto-diary');
            const autoTasks = document.getElementById('auto-tasks');

            if (autoDiary && autoDiary.checked) {
                await this.generateDiary(false, true); // Incremental update
            }

            if (autoTasks && autoTasks.checked) {
                await this.extractTasks(true); // Extract only new tasks
            }

        } catch (error) {
            console.error('Error adding log:', error);
            this.showToast('Failed to add log entry', 'error');
        } finally {
            if (addLogBtn) {
                addLogBtn.classList.remove('loading');
                addLogBtn.disabled = false;
            }
        }
    }

    async editLog(logId) {
        const log = this.logs.find(l => l.id === logId);
        if (!log) return;

        const newContent = prompt('Edit your log:', log.content);
        if (newContent !== null && newContent.trim() !== '') {
            log.content = newContent.trim();
            this.renderLogs();
            this.saveToStorage();
            this.showToast('Log updated successfully!', 'success');
            
            // Update diary if it exists
            await this.handleLogChange();
        }
    }

    async deleteLog(logId) {
        if (confirm('Are you sure you want to delete this log?')) {
            try {
                if (this.apiConnected) {
                    // Call backend API to delete
                    const response = await fetch(`${this.API_BASE_URL}/logs/${logId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to delete log from server');
                    }
                }
                
                // Update local data
                this.logs = this.logs.filter(l => l.id !== logId);
                this.renderLogs();
                this.updateLogsStats();
                this.saveToStorage();
                this.showToast('Log deleted successfully!', 'success');
                
                // Update diary if it exists
                await this.handleLogChange();
            } catch (error) {
                console.error('Error deleting log:', error);
                this.showToast(`Failed to delete log: ${error.message}`, 'error');
            }
        }
    }

    async handleLogChange() {
        // If diary exists for today, offer to update it
        const today = new Date().toISOString().split('T')[0];
        const existingDiary = this.diaryEntries.find(entry => entry.date === today);
        
        if (existingDiary) {
            const updateBtn = document.getElementById('update-diary-btn');
            if (updateBtn) {
                updateBtn.classList.remove('hidden');
            }
        }
    }

    renderLogs() {
        const logsList = document.getElementById('logs-list');
        if (!logsList) return;
        
        if (this.logs.length === 0) {
            logsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📝</div>
                    <h3>No logs yet</h3>
                    <p>Start by adding your first log entry above</p>
                </div>
            `;
            return;
        }

        // Sort logs by timestamp (newest first)
        const sortedLogs = [...this.logs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        logsList.innerHTML = sortedLogs.map(log => `
            <div class="log-entry">
                <div class="log-entry-header">
                    <span class="log-timestamp">${this.formatTimestamp(log.timestamp)}</span>
                    <div class="log-actions">
                        <button class="log-action-btn" onclick="app.editLog(${log.id})" title="Edit log">
                            ✏️
                        </button>
                        <button class="log-action-btn" onclick="app.deleteLog(${log.id})" title="Delete log">
                            🗑️
                        </button>
                    </div>
                </div>
                <div class="log-content">${this.escapeHtml(log.content)}</div>
            </div>
        `).join('');
    }

    updateLogsStats() {
        const logsCount = document.getElementById('logs-count');
        if (logsCount) {
            const count = this.logs.length;
            logsCount.textContent = `${count} log${count !== 1 ? 's' : ''} today`;
        }
    }

    async generateDiary(isRegenerate = false, isIncremental = false) {
        if (this.logs.length === 0) {
            this.showToast('Add some logs first to generate a diary entry', 'error');
            return;
        }

        if (!this.apiConnected) {
            this.showToast('Backend server not available', 'error');
            return;
        }

        // Show loading state
        const loadingElement = document.getElementById('diary-loading');
        const loadingText = document.getElementById('diary-loading-text');
        const contentElement = document.getElementById('diary-content');
        const emptyStateElement = document.getElementById('diary-empty-state');
        
        if (loadingElement) loadingElement.classList.remove('hidden');
        if (contentElement) contentElement.classList.add('hidden');
        if (emptyStateElement) emptyStateElement.classList.add('hidden');
        
        const generateBtn = document.getElementById('generate-diary-btn');
        const regenerateBtn = document.getElementById('regenerate-diary-btn');
        const updateBtn = document.getElementById('update-diary-btn');
        
        if (generateBtn) generateBtn.disabled = true;
        if (regenerateBtn) regenerateBtn.disabled = true;
        if (updateBtn) updateBtn.disabled = true;

        if (loadingText) {
            loadingText.textContent = isIncremental ? 
                'Updating diary with new logs...' : 
                'Analyzing your logs and generating diary entry...';
        }

        try {
            const today = new Date().toISOString().split('T')[0];

            const response = await fetch(`${this.API_BASE_URL}/generate-diary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date: today })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate diary');
            }

            const result = await response.json();
            
            // Reload diary data from server
            await this.loadData();
            
            // Find and display the diary entry for today
            const diaryEntry = this.diaryEntries.find(entry => entry.date === today);
            if (diaryEntry) {
                this.displayDiaryEntry(diaryEntry);
            }
            
            const actionText = isRegenerate ? 'regenerated' : isIncremental ? 'updated' : 'generated';
            this.showToast(`Diary entry ${actionText} successfully!`, 'success');

        } catch (error) {
            console.error('Error generating diary:', error);
            this.showToast(`Failed to generate diary entry: ${error.message}`, 'error');
            if (emptyStateElement) emptyStateElement.classList.remove('hidden');
        } finally {
            if (loadingElement) loadingElement.classList.add('hidden');
            if (generateBtn) generateBtn.disabled = false;
            if (regenerateBtn) regenerateBtn.disabled = false;
            if (updateBtn) updateBtn.disabled = false;
        }
    }

    displayDiaryEntry(diaryEntry) {
        const contentElement = document.getElementById('diary-content');
        const emptyStateElement = document.getElementById('diary-empty-state');
        const dateElement = document.getElementById('diary-date');
        const sourceCountElement = document.getElementById('diary-source-count');
        const lastUpdatedElement = document.getElementById('diary-last-updated');
        const textElement = document.getElementById('diary-text');
        const regenerateBtn = document.getElementById('regenerate-diary-btn');
        const updateBtn = document.getElementById('update-diary-btn');
        
        if (contentElement) contentElement.classList.remove('hidden');
        if (emptyStateElement) emptyStateElement.classList.add('hidden');
        
        if (dateElement) dateElement.textContent = "Today's Entry";
        if (sourceCountElement) sourceCountElement.textContent = `Based on ${diaryEntry.logIds.length} logs`;
        if (lastUpdatedElement) {
            const updatedDate = new Date(diaryEntry.lastUpdated);
            lastUpdatedElement.textContent = `Updated: ${updatedDate.toLocaleTimeString()}`;
        }
        if (textElement) textElement.textContent = diaryEntry.content;
        if (regenerateBtn) regenerateBtn.classList.remove('hidden');
        if (updateBtn) updateBtn.classList.add('hidden'); // Hide update button after showing content
    }

    exportDiary() {
        const diaryText = document.getElementById('diary-text');
        if (!diaryText || !diaryText.textContent) {
            this.showToast('No diary entry to export', 'error');
            return;
        }

        const date = new Date().toLocaleDateString();
        const content = `Daily Diary Entry - ${date}\n\n${diaryText.textContent}`;
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `diary-${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showToast('Diary exported successfully!', 'success');
    }

    showDiaryHistory() {
        const historyElement = document.getElementById('diary-history');
        const contentElement = document.getElementById('diary-content');
        const emptyStateElement = document.getElementById('diary-empty-state');
        
        if (historyElement) historyElement.classList.remove('hidden');
        if (contentElement) contentElement.classList.add('hidden');
        if (emptyStateElement) emptyStateElement.classList.add('hidden');
        
        this.renderDiaryHistory();
    }

    hideDiaryHistory() {
        const historyElement = document.getElementById('diary-history');
        const contentElement = document.getElementById('diary-content');
        const emptyStateElement = document.getElementById('diary-empty-state');
        
        if (historyElement) historyElement.classList.add('hidden');
        
        // Show today's diary if exists, otherwise show empty state
        const today = new Date().toISOString().split('T')[0];
        const todaysDiary = this.diaryEntries.find(entry => entry.date === today);
        
        if (todaysDiary) {
            this.displayDiaryEntry(todaysDiary);
        } else {
            if (contentElement) contentElement.classList.add('hidden');
            if (emptyStateElement) emptyStateElement.classList.remove('hidden');
        }
    }

    renderDiaryHistory() {
        const historyListElement = document.getElementById('diary-history-list');
        if (!historyListElement) return;

        if (this.diaryEntries.length === 0) {
            historyListElement.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📔</div>
                    <h3>No diary entries found</h3>
                    <p>Generate your first diary entry to start building your history</p>
                </div>
            `;
            return;
        }

        // Sort entries by date (most recent first)
        const sortedEntries = [...this.diaryEntries].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );

        historyListElement.innerHTML = sortedEntries.map(entry => {
            const date = new Date(entry.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
            
            const preview = entry.content.substring(0, 150) + (entry.content.length > 150 ? '...' : '');
            
            return `
                <div class="diary-history-item" onclick="app.viewHistoryEntry('${entry.date}')">
                    <div class="diary-history-header">
                        <h4 class="diary-history-date">${formattedDate}</h4>
                        <span class="diary-history-time">${new Date(entry.lastUpdated).toLocaleTimeString()}</span>
                    </div>
                    <p class="diary-history-preview">${preview}</p>
                    <div class="diary-history-meta">
                        <span>${entry.logIds.length} logs processed</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    viewHistoryEntry(date) {
        const entry = this.diaryEntries.find(e => e.date === date);
        if (entry) {
            this.hideDiaryHistory();
            this.displayDiaryEntry(entry);
        }
    }

    async extractTasks(onlyNew = false) {
        if (this.logs.length === 0) {
            this.showToast('Add some logs first to extract tasks', 'error');
            return;
        }

        if (!this.apiConnected) {
            this.showToast('Backend server not available', 'error');
            return;
        }

        // Show loading state
        const loadingElement = document.getElementById('tasks-loading');
        const loadingText = document.getElementById('tasks-loading-text');
        const emptyStateElement = document.getElementById('tasks-empty-state');
        
        if (loadingElement) loadingElement.classList.remove('hidden');
        if (emptyStateElement) emptyStateElement.classList.add('hidden');
        
        const extractBtn = document.getElementById('extract-tasks-btn');
        if (extractBtn) extractBtn.disabled = true;

        if (loadingText) {
            loadingText.textContent = onlyNew ? 
                'Extracting tasks from new logs...' : 
                'Analyzing logs for tasks and action items...';
        }

        try {
            const today = new Date().toISOString().split('T')[0];

            const response = await fetch(`${this.API_BASE_URL}/generate-tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ date: today })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to generate tasks');
            }

            const result = await response.json();
            
            // Reload task data from server
            await this.loadData();
            
            this.renderTasks();
            this.updateTasksStats();
            
            this.showToast(result.message || 'Tasks extracted successfully!', 'success');

        } catch (error) {
            console.error('Error extracting tasks:', error);
            this.showToast(`Failed to extract tasks: ${error.message}`, 'error');
        } finally {
            if (loadingElement) loadingElement.classList.add('hidden');
            if (extractBtn) extractBtn.disabled = false;
        }
    }

    async toggleTaskComplete(taskId) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/tasks/${taskId}/toggle`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Failed to update task');
            }

            // Update local state
            const task = this.tasks.find(t => t.id === taskId);
            if (task) {
                task.completed = !task.completed;
                this.renderTasks();
                this.updateTasksStats();
                
                const status = task.completed ? 'completed' : 'reopened';
                this.showToast(`Task ${status}!`, 'success');
            }
        } catch (error) {
            console.error('Error toggling task:', error);
            this.showToast('Failed to update task', 'error');
        }
    }

    async deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                if (this.apiConnected) {
                    // Call backend API to delete
                    const response = await fetch(`${this.API_BASE_URL}/tasks/${taskId}`, {
                        method: 'DELETE'
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to delete task from server');
                    }
                }
                
                // Update local data
                this.tasks = this.tasks.filter(t => t.id !== taskId);
                this.saveToStorage();
                this.renderTasks();
                this.updateTasksStats();
                this.showToast('Task deleted successfully!', 'success');
            } catch (error) {
                console.error('Error deleting task:', error);
                this.showToast(`Failed to delete task: ${error.message}`, 'error');
            }
        }
    }

    addManualTask() {
        const input = document.getElementById('manual-task-input');
        const prioritySelect = document.getElementById('manual-task-priority');
        
        if (!input || !prioritySelect) return;
        
        const description = input.value.trim();
        const priority = prioritySelect.value;

        if (!description) {
            this.showToast('Please enter a task description', 'error');
            return;
        }

        const task = {
            id: this.nextTaskId++,
            description: description,
            completed: false,
            priority: priority,
            sourceLogId: null,
            extractedAt: this.generateTimestamp()
        };

        this.tasks.push(task);
        
        input.value = '';
        this.saveToStorage();
        this.renderTasks();
        this.updateTasksStats();
        this.showToast('Manual task added successfully!', 'success');
    }

    filterTasks(filter = 'all') {
        this.renderTasks(filter);
    }

    renderTasks(filter = 'all') {
        const tasksList = document.getElementById('tasks-list');
        if (!tasksList) return;
        
        let filteredTasks = this.tasks;
        if (filter === 'completed') {
            filteredTasks = this.tasks.filter(task => task.completed);
        } else if (filter === 'pending') {
            filteredTasks = this.tasks.filter(task => !task.completed);
        }

        if (filteredTasks.length === 0) {
            tasksList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3>No tasks found</h3>
                    <p>${filter === 'all' ? 'Extract tasks from your logs or add manual tasks' : `No ${filter} tasks`}</p>
                </div>
            `;
            return;
        }

        // Sort tasks by priority and completion status
        const priorityOrder = { 'High': 3, 'Medium': 2, 'Low': 1 };
        filteredTasks.sort((a, b) => {
            if (a.completed !== b.completed) {
                return a.completed - b.completed; // Completed tasks last
            }
            return priorityOrder[b.priority] - priorityOrder[a.priority]; // High priority first
        });

        tasksList.innerHTML = filteredTasks.map(task => `
            <div class="task-item ${task.completed ? 'completed' : ''}">
                <input 
                    type="checkbox" 
                    class="task-checkbox" 
                    ${task.completed ? 'checked' : ''}
                    onchange="app.toggleTaskComplete(${task.id})"
                >
                <div class="task-content">
                    <div class="task-description">${this.escapeHtml(task.description)}</div>
                    <div class="task-meta">
                        <span class="priority-badge priority-${task.priority.toLowerCase()}">${task.priority} Priority</span>
                        ${task.sourceLogId ? `<span>From log #${task.sourceLogId}</span>` : '<span>Manual task</span>'}
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn" onclick="app.deleteTask(${task.id})" title="Delete task">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('');
    }

    updateTasksStats() {
        const totalTasks = this.tasks.length;
        const completedTasks = this.tasks.filter(task => task.completed).length;
        const pendingTasks = totalTasks - completedTasks;

        const totalElement = document.getElementById('total-tasks');
        const completedElement = document.getElementById('completed-tasks');
        const pendingElement = document.getElementById('pending-tasks');
        const statsElement = document.getElementById('tasks-stats');

        if (totalElement) totalElement.textContent = totalTasks;
        if (completedElement) completedElement.textContent = completedTasks;
        if (pendingElement) pendingElement.textContent = pendingTasks;

        if (statsElement) {
            if (totalTasks > 0) {
                statsElement.classList.remove('hidden');
            } else {
                statsElement.classList.add('hidden');
            }
        }
    }

    updateDiarySection() {
        const today = new Date().toISOString().split('T')[0];
        const hasDiary = this.diaryEntries.find(entry => entry.date === today);
        const hasLogs = this.logs.length > 0;

        const emptyStateElement = document.getElementById('diary-empty-state');
        const contentElement = document.getElementById('diary-content');

        if (!hasLogs) {
            if (emptyStateElement) emptyStateElement.classList.remove('hidden');
            if (contentElement) contentElement.classList.add('hidden');
        } else if (hasDiary) {
            this.displayDiaryEntry(hasDiary);
        } else {
            if (emptyStateElement) emptyStateElement.classList.add('hidden');
            if (contentElement) contentElement.classList.add('hidden');
        }
    }

    updateTasksSection() {
        this.renderTasks();
        this.updateTasksStats();

        const emptyStateElement = document.getElementById('tasks-empty-state');
        if (emptyStateElement) {
            if (this.tasks.length === 0 && this.logs.length === 0) {
                emptyStateElement.classList.remove('hidden');
            } else {
                emptyStateElement.classList.add('hidden');
            }
        }
    }

    showEmptyStates() {
        // Show appropriate empty states based on current data
        if (this.currentTab === 'diary') {
            this.updateDiarySection();
        } else if (this.currentTab === 'tasks') {
            this.updateTasksSection();
        }
    }

    showToast(message, type = 'success') {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Remove toast after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }, 4000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DailyLogApp();
    window.app.init(); // Explicitly call init
});