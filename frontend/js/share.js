// ⚠️ IMPORTANT: Replace this URL with your actual Render backend URL
const BACKEND_URL = 'https://smart-chip-2-backend.onrender.com';
const socket = io(BACKEND_URL);

const btnShare = document.getElementById('btn-share');
const btnStop = document.getElementById('btn-stop');
const statusText = document.getElementById('status-text');
const loading = document.getElementById('loading');
const sessionInfo = document.getElementById('session-info');
const sessionIdEl = document.getElementById('session-id');
const shareLink = document.getElementById('share-link');

let watchId = null;
let currentSessionId = null;
let locationInterval = null;
let lastLocation = null;

btnShare.addEventListener('click', startSharing);
btnStop.addEventListener('click', stopSharing);

function startSharing() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    loading.classList.remove('hidden');
    statusText.innerText = 'Requesting permission...';
    btnShare.classList.add('hidden');

    // Get initial position and setup watching
    navigator.geolocation.getCurrentPosition(
        (position) => {
            setupSession();
            updateLocation(position);

            // Watch for changes continuously
            watchId = navigator.geolocation.watchPosition(
                updateLocation,
                handleError,
                { enableHighAccuracy: true, maximumAge: 0 }
            );

            // Emit location every 3 seconds
            locationInterval = setInterval(() => {
                if (lastLocation && currentSessionId) {
                    socket.emit('update-location', {
                        sessionId: currentSessionId,
                        lat: lastLocation.lat,
                        lng: lastLocation.lng,
                        timestamp: Date.now()
                    });
                }
            }, 3000);

            statusText.innerText = 'Sharing location securely';
            loading.classList.remove('hidden');
            btnStop.classList.remove('hidden');
        },
        handleError,
        { enableHighAccuracy: true }
    );
}

function updateLocation(position) {
    lastLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
    };

    // We also emit immediately on initial fix or big changes if we want,
    // but the 3 second interval will handle regular updates.
}

function setupSession() {
    // Generate a 6-digit numeric session ID
    currentSessionId = Math.floor(100000 + Math.random() * 900000).toString();

    sessionIdEl.innerText = currentSessionId;

    const viewerUrl = `${window.location.origin}/viewer.html?session=${currentSessionId}`;
    shareLink.href = viewerUrl;
    shareLink.innerText = viewerUrl;

    sessionInfo.classList.remove('hidden');

    // Join room for this session
    socket.emit('host-session', currentSessionId);
}

function stopSharing() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (locationInterval !== null) {
        clearInterval(locationInterval);
        locationInterval = null;
    }

    if (currentSessionId) {
        socket.emit('stop-session', currentSessionId);
        currentSessionId = null;
    }

    lastLocation = null;

    sessionInfo.classList.add('hidden');
    btnStop.classList.add('hidden');
    btnShare.classList.remove('hidden');

    loading.classList.add('hidden');
    statusText.innerText = 'Not sharing';
}

function handleError(error) {
    loading.classList.add('hidden');
    btnShare.classList.remove('hidden');
    btnStop.classList.add('hidden');

    switch (error.code) {
        case error.PERMISSION_DENIED:
            statusText.innerText = "Error: Permission denied.";
            break;
        case error.POSITION_UNAVAILABLE:
            statusText.innerText = "Error: Location information unavailable.";
            break;
        case error.TIMEOUT:
            statusText.innerText = "Error: Location request timed out.";
            break;
        default:
            statusText.innerText = "Error: An unknown error occurred.";
            break;
    }
    alert(statusText.innerText);
}
