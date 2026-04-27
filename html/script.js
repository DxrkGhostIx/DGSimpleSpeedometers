const vehicleHud = document.getElementById('vehicleHud');
const vehicleSpeedText = document.getElementById('vehicleSpeed');
const fuelRing = document.getElementById('fuelRing');

const bikeHud = document.getElementById('bikeHud');
const bikeSpeedValue = document.getElementById('bikeSpeedValue');
const bikeTempValue = document.getElementById('bikeTempValue');
const bikeClockValue = document.getElementById('bikeClockValue');

const totalLength = fuelRing.getTotalLength();
const STORAGE_KEY = 'combinedVehicleBikeHud.speedometerSettings.v1';
const huds = {
    vehicle: vehicleHud,
    bike: bikeHud
};
const defaultSettings = {
    vehicle: { x: window.innerWidth - 395, y: window.innerHeight - 395, scale: 1 },
    bike: { x: Math.round(window.innerWidth * 0.72 - 142.5), y: window.innerHeight - 376, scale: 1 }
};

let currentFuel = 100.0;
let targetFuel = 100.0;
let lastFrame = performance.now();
let currentBikeSpeed = 0;
let targetBikeSpeed = 0;
let currentBikeTemp = 26.0;
let editMode = false;
let activeDrag = null;
let settings = loadSettings();

fuelRing.style.strokeDasharray = totalLength;
fuelRing.style.strokeDashoffset = 0;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function formatBikeSpeed(speed) {
    const value = clamp(Number(speed) || 0, 0, 199.9);
    return value.toFixed(1);
}

function formatBikeTemp(temp) {
    const value = clamp(Number(temp) || 0, -9.9, 99.9);
    return value.toFixed(1);
}

function deepCopy(value) {
    return JSON.parse(JSON.stringify(value));
}

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return normalizeSettings(saved || defaultSettings);
    } catch (_) {
        return deepCopy(defaultSettings);
    }
}

function normalizeSettings(input) {
    const next = deepCopy(defaultSettings);

    for (const key of Object.keys(huds)) {
        if (!input || !input[key]) continue;
        next[key].x = Number.isFinite(input[key].x) ? input[key].x : next[key].x;
        next[key].y = Number.isFinite(input[key].y) ? input[key].y : next[key].y;
        next[key].scale = Number.isFinite(input[key].scale) ? input[key].scale : next[key].scale;
        next[key].scale = clamp(next[key].scale, 0.5, 1.8);
    }

    return next;
}

function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applyHudSettings() {
    for (const [key, element] of Object.entries(huds)) {
        const item = settings[key];
        element.style.left = `${item.x}px`;
        element.style.top = `${item.y}px`;
        element.style.right = 'auto';
        element.style.bottom = 'auto';
        element.style.transform = `scale(${item.scale})`;
        element.style.transformOrigin = 'top left';
    }
}

function resetSettings() {
    settings = deepCopy(defaultSettings);
    saveSettings();
    applyHudSettings();
}

function updateBikeClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    bikeClockValue.textContent = `${hours}:${minutes}`;
}

function animateHud() {
    const now = performance.now();
    const delta = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    const smoothing = 3.5;
    currentFuel += (targetFuel - currentFuel) * clamp(delta * smoothing, 0, 1);
    fuelRing.style.strokeDashoffset = totalLength * (1 - currentFuel / 100);

    currentBikeSpeed += (targetBikeSpeed - currentBikeSpeed) * 0.30;
    bikeSpeedValue.textContent = formatBikeSpeed(currentBikeSpeed);
    bikeTempValue.textContent = formatBikeTemp(currentBikeTemp);
    updateBikeClock();

    requestAnimationFrame(animateHud);
}

function getHudKey(element) {
    return element.id === 'vehicleHud' ? 'vehicle' : 'bike';
}

function setEditMode(enabled) {
    editMode = enabled;
    document.body.classList.toggle('editing-speedometers', editMode);

    if (editMode) {
        vehicleHud.style.display = 'block';
        bikeHud.style.display = 'block';
        bikeHud.classList.add('preview-visible');
        vehicleSpeedText.innerText = '88';
        targetFuel = 75;
        targetBikeSpeed = 25;
        currentBikeSpeed = 25;
        currentBikeTemp = 26;
    } else {
        bikeHud.classList.remove('preview-visible');
    }
}

function closeEditor() {
    fetch(`https://${GetParentResourceName()}/closeSpeedometerEditor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({})
    }).catch(() => setEditMode(false));
}

function makeEditable(element) {
    element.addEventListener('mousedown', (event) => {
        if (!editMode || event.button !== 0) return;
        const key = getHudKey(element);
        activeDrag = {
            key,
            startX: event.clientX,
            startY: event.clientY,
            originX: settings[key].x,
            originY: settings[key].y
        };
        event.preventDefault();
    });

    element.addEventListener('wheel', (event) => {
        if (!editMode) return;
        const key = getHudKey(element);
        const oldScale = settings[key].scale;
        const direction = event.deltaY < 0 ? 1 : -1;
        const newScale = clamp(oldScale + direction * 0.05, 0.5, 1.8);
        const rect = element.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;

        settings[key].x -= localX * (newScale / oldScale - 1);
        settings[key].y -= localY * (newScale / oldScale - 1);
        settings[key].scale = newScale;
        applyHudSettings();
        saveSettings();
        event.preventDefault();
    }, { passive: false });
}

window.addEventListener('mousemove', (event) => {
    if (!editMode || !activeDrag) return;
    settings[activeDrag.key].x = activeDrag.originX + event.clientX - activeDrag.startX;
    settings[activeDrag.key].y = activeDrag.originY + event.clientY - activeDrag.startY;
    applyHudSettings();
});

window.addEventListener('mouseup', () => {
    if (!activeDrag) return;
    activeDrag = null;
    saveSettings();
});

window.addEventListener('keydown', (event) => {
    if (editMode && event.key === 'Escape') {
        closeEditor();
    }
});

window.addEventListener('message', (event) => {
    const data = event.data || {};

    if (data.action === 'setEditMode') {
        setEditMode(data.enabled === true);
    }

    if (data.action === 'resetSpeedometerSettings') {
        resetSettings();
    }

    if (editMode) return;

    if (data.action === 'showVehicle') {
        vehicleHud.style.display = 'block';
        bikeHud.style.display = 'none';
        vehicleSpeedText.innerText = data.speed ?? 0;
        targetFuel = clamp(data.fuel ?? 0, 0, 100);
        targetBikeSpeed = 0;
        currentBikeSpeed = 0;
    }

    if (data.action === 'showBike') {
        bikeHud.classList.remove('preview-visible');
        bikeHud.style.display = 'block';
        vehicleHud.style.display = 'none';
        targetBikeSpeed = Number(data.speed) || 0;
        currentBikeTemp = Number(data.temp) || currentBikeTemp;
    }

    if (data.action === 'hideAll') {
        vehicleHud.style.display = 'none';
        bikeHud.classList.remove('preview-visible');
        bikeHud.style.display = 'none';
        targetBikeSpeed = 0;
        currentBikeSpeed = 0;
    }
});

makeEditable(vehicleHud);
makeEditable(bikeHud);
applyHudSettings();

if (!window.invokeNative) {
    bikeHud.classList.add('preview-visible');
    targetBikeSpeed = 25.0;
    currentBikeSpeed = 25.0;
}

requestAnimationFrame(animateHud);
