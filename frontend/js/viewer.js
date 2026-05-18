// ⚠️ IMPORTANT: Replace this URL with your actual Render backend URL
const BACKEND_URL = 'https://smart-chip-2-backend.onrender.com'; 
const socket = io(BACKEND_URL);

const inputSessionId = document.getElementById('input-session-id');
const btnTrack = document.getElementById('btn-track');
const viewerOverlay = document.getElementById('viewer-overlay');
const trackingInfo = document.getElementById('tracking-info');
const displaySessionId = document.getElementById('display-session-id');
const lastUpdatedText = document.getElementById('last-updated');
const locationNameText = document.getElementById('location-name');
const viewerStatus = document.getElementById('viewer-status');
const btnStopTracking = document.getElementById('btn-stop-tracking');

let map = null;
let marker = null;
let currentSessionId = null;

// Check URL for session ID
const urlParams = new URLSearchParams(window.location.search);
const sessionParam = urlParams.get('session');

if (sessionParam) {
    inputSessionId.value = sessionParam.toUpperCase();
}

btnTrack.addEventListener('click', () => {
    const sid = inputSessionId.value.trim().toUpperCase();
    if (!sid) {
        viewerStatus.innerText = 'Please enter a valid session ID.';
        viewerStatus.style.color = '#ff0844';
        return;
    }
    
    startTracking(sid);
});

btnStopTracking.addEventListener('click', stopTracking);

function startTracking(sid) {
    currentSessionId = sid;
    viewerStatus.innerText = 'Connecting...';
    viewerStatus.style.color = '#4b5563';
    
    socket.emit('join-session', sid);
}

function stopTracking() {
    if (currentSessionId) {
        socket.emit('leave-session', currentSessionId);
        currentSessionId = null;
    }
    
    viewerOverlay.classList.remove('hidden');
    trackingInfo.classList.add('hidden');
    viewerStatus.innerText = '';
    
    if (map) {
        map.remove();
        map = null;
        marker = null;
    }
}

// Socket events
socket.on('session-joined', (sid) => {
    viewerOverlay.classList.add('hidden');
    trackingInfo.classList.remove('hidden');
    displaySessionId.innerText = sid;
    
    // Init map but don't set view yet
    initMap();
});

socket.on('session-error', (msg) => {
    viewerStatus.innerText = msg;
    viewerStatus.style.color = '#ff0844';
    currentSessionId = null;
});

socket.on('location-updated', (data) => {
    const { lat, lng, timestamp } = data;
    
    updateMap(lat, lng);
    fetchLocationName(lat, lng);
    
    const date = new Date(timestamp);
    lastUpdatedText.innerText = date.toLocaleTimeString();
});

socket.on('session-ended', () => {
    alert('The host has stopped sharing their location.');
    stopTracking();
});

function initMap() {
    // Basic initialization, wait for first coordinates to set view
    map = L.map('map').setView([0, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
}

function updateMap(lat, lng) {
    if (!map) return;
    
    const latLng = [lat, lng];
    
    if (!marker) {
        // Create marker
        marker = L.marker(latLng).addTo(map);
        map.setView(latLng, 15);
    } else {
        // Animate marker to new position smoothly
        marker.setLatLng(latLng);
        map.panTo(latLng);
    }
}

let lastFetchedCoords = null;

async function fetchLocationName(lat, lng) {
    // To avoid spamming the API, only fetch if moved significantly (approx 50 meters) or first time
    if (lastFetchedCoords) {
        const dLat = Math.abs(lastFetchedCoords.lat - lat);
        const dLng = Math.abs(lastFetchedCoords.lng - lng);
        if (dLat < 0.0005 && dLng < 0.0005) {
            return;
        }
    }
    
    lastFetchedCoords = { lat, lng };
    locationNameText.innerText = 'Fetching location...';
    
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`);
        const data = await response.json();
        
        if (data && data.display_name) {
            // Simplify the display name to avoid it being too long
            const parts = data.display_name.split(', ');
            locationNameText.innerText = parts.slice(0, 3).join(', ');
            locationNameText.title = data.display_name; // Full name on hover
        } else {
            locationNameText.innerText = 'Location name not found';
        }
    } catch (error) {
        console.error('Error fetching location name:', error);
        locationNameText.innerText = 'Failed to fetch name';
    }
}

