// Global variables
let connected = false;
let updateInterval = null;
let lastUpdateTimestamp = 0;
let activityLog = [];

// DOM elements
const connectBtn = document.getElementById('connect-btn');
const portSelect = document.getElementById('port-select');
const refreshBtn = document.getElementById('refresh-btn');
const connectionIndicator = document.getElementById('connection-indicator');
const connectionText = document.getElementById('connection-text');
const connectionStatus = document.getElementById('connection-status');

// Initialize when the page loads
document.addEventListener('DOMContentLoaded', () => {
    updateDateTime();
    loadPortList();
    setupEventListeners();
    startDataPolling();
});

// Update date and time
function updateDateTime() {
    const currentTimeElement = document.getElementById('current-time');
    
    function updateTime() {
        const now = new Date();
        const formattedTime = now.toLocaleString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        currentTimeElement.textContent = formattedTime;
    }
    
    updateTime();
    setInterval(updateTime, 1000);
}

// Load available Arduino ports
function loadPortList() {
    fetch('/api/ports')
        .then(response => response.json())
        .then(ports => {
            portSelect.innerHTML = '<option value="">Select Arduino Port</option>';
            ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port.port;
                option.textContent = `${port.port} - ${port.description}`;
                portSelect.appendChild(option);
            });
        })
        .catch(error => console.error('Error loading ports:', error));
}

// Set up event listeners for buttons
function setupEventListeners() {
    connectBtn.addEventListener('click', toggleConnection);
    refreshBtn.addEventListener('click', loadPortList);
}

// Toggle connection to Arduino
function toggleConnection() {
    if (connected) {
        // Disconnect
        fetch('/api/disconnect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                setConnectionStatus(false);
                connectBtn.textContent = 'Connect';
                addActivityItem({
                    type: 'system',
                    title: 'System Disconnected',
                    time: new Date()
                });
            }
        })
        .catch(error => console.error('Error disconnecting:', error));
    } else {
        // Connect
        const selectedPort = portSelect.value;
        if (!selectedPort) {
            alert('Please select a port first');
            return;
        }
        
        fetch('/api/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ port: selectedPort })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                setConnectionStatus(true);
                connectBtn.textContent = 'Disconnect';
                addActivityItem({
                    type: 'system',
                    title: 'System Connected',
                    time: new Date()
                });
            } else {
                alert(`Connection failed: ${data.message}`);
            }
        })
        .catch(error => console.error('Error connecting:', error));
    }
}

// Update connection status indicators
function setConnectionStatus(status) {
    connected = status;
    
    if (status) {
        connectionIndicator.classList.remove('disconnected');
        connectionIndicator.classList.add('connected');
        connectionText.textContent = 'Connected';
        connectionStatus.textContent = 'Connected';
        connectionStatus.classList.remove('disconnected');
        connectionStatus.classList.add('connected');
    } else {
        connectionIndicator.classList.remove('connected');
        connectionIndicator.classList.add('disconnected');
        connectionText.textContent = 'Disconnected';
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.classList.remove('connected');
        connectionStatus.classList.add('disconnected');
    }
}

// Poll server for updated data
function startDataPolling() {
    // Initial data load
    fetchData();
    
    // Set up polling interval
    updateInterval = setInterval(fetchData, 1000);
}

// Fetch current data from API
function fetchData() {
    fetch('/api/data')
        .then(response => response.json())
        .then(data => {
            updateDashboard(data);
        })
        .catch(error => console.error('Error fetching data:', error));
}

// Update dashboard with new data
function updateDashboard(data) {
    // Update connection status
    setConnectionStatus(data.connected);
    
    // Update stats
    document.getElementById('total-slots').textContent = data.total_slots;
    document.getElementById('available-slots').textContent = data.available_slots;
    document.getElementById('occupied-slots').textContent = data.total_slots - data.available_slots;
    
    // Calculate utilization percentage
    const utilization = Math.round((data.total_slots - data.available_slots) / data.total_slots * 100);
    document.getElementById('utilization').textContent = `${utilization}%`;
    
    // Update parking slots
    data.slots.forEach(slot => {
        const slotElement = document.getElementById(`slot-${slot.id}`);
        if (slotElement) {
            // Remove old status
            slotElement.classList.remove('free', 'occupied');
            // Add new status
            slotElement.classList.add(slot.status.toLowerCase());
            
            // Check if status changed and add to activity log if it did
            const oldStatus = slotElement.getAttribute('data-status');
            if (oldStatus && oldStatus !== slot.status) {
                addActivityItem({
                    type: 'parking',
                    title: `Slot ${slot.id} ${slot.status}`,
                    time: new Date()
                });
            }
            
            // Store current status
            slotElement.setAttribute('data-status', slot.status);
        }
    });
    
    // Update gate statuses
    const entryGateStatus = document.getElementById('entry-gate-status');
    entryGateStatus.textContent = data.entry_gate;
    entryGateStatus.classList.remove('triggered');
    if (data.entry_gate === 'Triggered') {
        entryGateStatus.classList.add('triggered');
        
        // Check if this is a new trigger
        const oldStatus = entryGateStatus.getAttribute('data-status');
        if (oldStatus && oldStatus !== data.entry_gate) {
            addActivityItem({
                type: 'entry',
                title: 'Car Entered',
                time: new Date()
            });
        }
    }
    entryGateStatus.setAttribute('data-status', data.entry_gate);
    
    const exitGateStatus = document.getElementById('exit-gate-status');
    exitGateStatus.textContent = data.exit_gate;
    exitGateStatus.classList.remove('triggered');
    if (data.exit_gate === 'Triggered') {
        exitGateStatus.classList.add('triggered');
        
        // Check if this is a new trigger
        const oldStatus = exitGateStatus.getAttribute('data-status');
        if (oldStatus && oldStatus !== data.exit_gate) {
            addActivityItem({
                type: 'exit',
                title: 'Car Exited',
                time: new Date()
            });
        }
    }
    exitGateStatus.setAttribute('data-status', data.exit_gate);
    
    // Update last update timestamp
    if (data.last_updated !== lastUpdateTimestamp) {
        lastUpdateTimestamp = data.last_updated;
        
        // Format the timestamp
        const lastUpdateDate = new Date(lastUpdateTimestamp * 1000);
        document.getElementById('last-update').textContent = lastUpdateDate.toLocaleTimeString();
        
        // Update rate
        document.getElementById('update-rate').textContent = data.connected ? '~1 sec' : '-';
    }
}

// Add item to activity log
function addActivityItem(item) {
    // Add to activity log array (limit to 20 items)
    activityLog.unshift(item);
    if (activityLog.length > 20) {
        activityLog.pop();
    }
    
    // Update the activity log display
    updateActivityLog();
}

// Update the activity log in the UI
function updateActivityLog() {
    const activityLogElement = document.getElementById('activity-log');
    activityLogElement.innerHTML = '';
    
    activityLog.forEach(item => {
        // Calculate time difference
        const now = new Date();
        const timeDiff = Math.floor((now - item.time) / 1000 / 60); // minutes
        
        let timeString;
        if (timeDiff < 1) {
            timeString = 'Just now';
        } else if (timeDiff === 1) {
            timeString = '1 min ago';
        } else if (timeDiff < 60) {
            timeString = `${timeDiff} mins ago`;
        } else {
            const hours = Math.floor(timeDiff / 60);
            timeString = `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        }
        
        // Create activity item element
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        
        let iconClass;
        switch (item.type) {
            case 'entry':
                iconClass = 'entry';
                break;
            case 'exit':
                iconClass = 'exit';
                break;
            case 'parking':
                iconClass = 'parking';
                break;
            default:
                iconClass = 'system';
                break;
        }
        
        let iconHtml;
        switch (item.type) {
            case 'entry':
                iconHtml = '<i class="fas fa-sign-in-alt"></i>';
                break;
            case 'exit':
                iconHtml = '<i class="fas fa-sign-out-alt"></i>';
                break;
            case 'parking':
                iconHtml = '<i class="fas fa-parking"></i>';
                break;
            default:
                iconHtml = '<i class="fas fa-server"></i>';
                break;
        }
        
        activityItem.innerHTML = `
            <div class="activity-icon ${iconClass}">${iconHtml}</div>
            <div class="activity-details">
                <div class="activity-title">${item.title}</div>
                <div class="activity-time">${timeString}</div>
            </div>
        `;
        
        activityLogElement.appendChild(activityItem);
    });
} 