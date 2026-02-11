// --- State ---
let appMode = 'offline'; // 'online' | 'offline'
let foods = []; // Array of { id, name }
let history = []; // Array of { id, date, food }
let isSpinning = false;
let currentRotation = 0;
let animationId = null;

// Firebase Globals (only loaded in Online mode)
let db = null;
let fb_collection = null;
let fb_addDoc = null;
let fb_deleteDoc = null;
let fb_doc = null;
let fb_onSnapshot = null;
let fb_query = null;
let fb_orderBy = null;
let fb_limit = null;
let fb_writeBatch = null;
let fb_getDocs = null;

// --- DOM Elements ---
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const newFoodInput = document.getElementById('newFoodInput');
const addFoodBtn = document.getElementById('addFoodBtn');
const foodListEl = document.getElementById('foodList');
const historyTableBody = document.querySelector('#historyTable tbody');
const recordDateInput = document.getElementById('recordDate');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const connectionStatus = document.getElementById('connectionStatus');

const modeSelector = document.getElementById('modeSelector');
const onlineBtn = document.getElementById('onlineModeBtn');
const offlineBtn = document.getElementById('offlineModeBtn');

// Modal Elements
const resultModal = document.getElementById('resultModal');
const winnerDisplay = document.getElementById('winnerDisplay');
const acceptBtn = document.getElementById('acceptBtn');
const retryBtn = document.getElementById('retryBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Constants
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

// --- Initialization ---
async function init() {
    setTodayDate();
    determineMode();
    updateModeUI();

    if (appMode === 'online') {
        await initializeFirebase();
    } else {
        initializeOffline();
    }
}

function determineMode() {
    const protocol = window.location.protocol;
    const storedMode = localStorage.getItem("appMode");

    if (protocol.startsWith('file')) {
        appMode = 'offline';
        console.log("File protocol detected: Forcing Offline Mode");
    } else {
        if (storedMode === 'online' || storedMode === 'offline') {
            appMode = storedMode;
        } else {
            appMode = 'online'; // Default
        }
    }
}

function updateModeUI() {
    if (appMode === 'online') {
        onlineBtn.style.opacity = '1';
        onlineBtn.style.boxShadow = '0 0 10px #22c55e';
        offlineBtn.style.opacity = '0.5';
        offlineBtn.style.boxShadow = 'none';
        connectionStatus.style.display = 'inline';
        connectionStatus.textContent = '🔌 Conectando...';
        connectionStatus.style.color = 'var(--text-dim)';
    } else {
        offlineBtn.style.opacity = '1';
        offlineBtn.style.boxShadow = '0 0 10px #ef4444';
        onlineBtn.style.opacity = '0.5';
        onlineBtn.style.boxShadow = 'none';
        connectionStatus.textContent = '🧪 MODO OFFLINE';
        connectionStatus.style.color = '#ef4444';
        connectionStatus.style.display = 'inline';
    }
}

// --- Mode Switching ---
onlineBtn.addEventListener('click', () => {
    if (window.location.protocol.startsWith('file')) {
        alert("El modo Online no está disponible en protocolo file://");
        return;
    }
    setMode('online');
});

offlineBtn.addEventListener('click', () => {
    setMode('offline');
});

function setMode(mode) {
    if (appMode === mode) return;
    localStorage.setItem("appMode", mode);
    window.location.reload(); // Reload to ensure clean state
}

// --- Firebase Setup (Online Only) ---
async function initializeFirebase() {
    try {
        // Dynamic Imports
        const firebaseApp = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
        const firebaseFirestore = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js");

        const { initializeApp } = firebaseApp;
        const { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, writeBatch, getDocs, enableIndexedDbPersistence } = firebaseFirestore;

        // Assign to globals
        fb_collection = collection;
        fb_addDoc = addDoc;
        fb_deleteDoc = deleteDoc;
        fb_doc = doc;
        fb_onSnapshot = onSnapshot;
        fb_query = query;
        fb_orderBy = orderBy;
        fb_limit = limit;
        fb_writeBatch = writeBatch;
        fb_getDocs = getDocs;

        const firebaseConfig = {
            apiKey: "AIzaSyA9knGhSnePFk8nQf7MUA7psKcT6XYR8K8",
            authDomain: "ruleta-20dfe.firebaseapp.com",
            projectId: "ruleta-20dfe",
            storageBucket: "ruleta-20dfe.firebasestorage.app",
            messagingSenderId: "870456448153",
            appId: "1:870456448153:web:522fe1d9b1c586627d1408"
        };

        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);

        // NO enableIndexedDbPersistence as requested

        setupRealtimeListeners();
    } catch (error) {
        console.error("Failed to load Firebase:", error);
        alert("Error cargando Firebase. Pasando a modo offline.");
        setMode('offline');
    }
}

function setupRealtimeListeners() {
    // 1. Foods Listener
    const qFoods = fb_query(fb_collection(db, "foods"));

    fb_onSnapshot(qFoods, (snapshot) => {
        connectionStatus.textContent = "🌐 Online";
        connectionStatus.style.color = "#22c55e";

        foods = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        renderFoodList();
        renderWheel();
    }, (error) => {
        console.error("Snapshot error:", error);
        connectionStatus.textContent = "⚠️ Error de Conexión";
    });

    // 2. History Listener
    const qHistory = fb_query(
        fb_collection(db, "history"),
        fb_orderBy("date", "desc"),
        fb_limit(20)
    );

    fb_onSnapshot(qHistory, (snapshot) => {
        history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderHistory();
    });
}

// --- Offline Setup ---
function initializeOffline() {
    // In-memory defaults
    foods = [
        { id: 'off1', name: 'Pizza' },
        { id: 'off2', name: 'Hamburguesa' },
        { id: 'off3', name: 'Tacos' },
        { id: 'off4', name: 'Sushi' },
        { id: 'off5', name: 'Pasta' }
    ];
    history = [];

    renderFoodList();
    renderWheel();
    renderHistory();
}

// --- Data Operations (Mode Abstraction) ---
async function addFood(name) {
    if (appMode === 'online') {
        try {
            await fb_addDoc(fb_collection(db, "foods"), { name });
        } catch (e) {
            console.error(e);
            alert("Error al guardar en nube.");
        }
    } else {
        foods.push({ id: `temp_${Date.now()}`, name });
        renderFoodList();
        renderWheel();
    }
}

async function removeFoodItem(id) {
    if (appMode === 'online') {
        try {
            await fb_deleteDoc(fb_doc(db, "foods", id));
        } catch (e) {
            console.error(e);
            alert("Error al borrar de nube.");
        }
    } else {
        foods = foods.filter(f => f.id !== id);
        renderFoodList();
        renderWheel();
    }
}

async function addHistoryItem(item) {
    if (appMode === 'online') {
        try {
            await fb_addDoc(fb_collection(db, "history"), item);
        } catch (e) {
            console.error(e);
            alert("Error al guardar historial.");
        }
    } else {
        history.unshift({ id: `hist_${Date.now()}`, ...item });
        if (history.length > 20) history.pop();
        renderHistory();
    }
}

async function clearAllHistory() {
    if (appMode === 'online') {
        try {
            const q = fb_query(fb_collection(db, "history"));
            const snapshot = await fb_getDocs(q);
            const batch = fb_writeBatch(db);
            snapshot.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        } catch (e) {
            console.error(e);
            alert("Error al limpiar historial.");
        }
    } else {
        history = [];
        renderHistory();
    }
}

// --- Wheel & Logic (Shared) ---
function renderWheel() {
    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;

    ctx.clearRect(0, 0, width, height);

    if (foods.length === 0) {
        ctx.font = "20px Outfit";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("Agrega comidas", width / 2, height / 2);
        return;
    }

    const sliceAngle = (2 * Math.PI) / foods.length;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(currentRotation);

    foods.forEach((item, index) => {
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, index * sliceAngle, (index + 1) * sliceAngle);
        ctx.fillStyle = COLORS[index % COLORS.length];
        ctx.fill();
        ctx.stroke();

        ctx.save();
        ctx.rotate(index * sliceAngle + sliceAngle / 2);
        ctx.textAlign = "right";
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 20px Outfit";
        ctx.fillText(item.name, radius - 20, 5);
        ctx.restore();
    });
    ctx.restore();
}

function spinWheel() {
    if (isSpinning) return;
    if (foods.length < 2) {
        alert("¡Necesitas al menos 2 opciones!");
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;

    const duration = 5000;
    const minRotations = 5;
    const maxRotations = 10;
    const randomRotations = minRotations + Math.random() * (maxRotations - minRotations);
    const totalRotationAngle = randomRotations * 2 * Math.PI;

    const sliceAngle = (2 * Math.PI) / foods.length;
    const randomOffset = Math.random() * sliceAngle * 0.8;

    const startTime = performance.now();
    const startRotation = currentRotation % (2 * Math.PI);
    const targetRotation = startRotation + totalRotationAngle + randomOffset;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        currentRotation = startRotation + (targetRotation - startRotation) * easeOut;
        renderWheel();

        if (progress < 1) {
            animationId = requestAnimationFrame(animate);
        } else {
            isSpinning = false;
            spinBtn.disabled = false;
            determineWinner(currentRotation);
        }
    }
    animationId = requestAnimationFrame(animate);
}

function determineWinner(rotation) {
    const sliceAngle = (2 * Math.PI) / foods.length;
    let normalizedRotation = rotation % (2 * Math.PI);
    let pointerAngle = (1.5 * Math.PI - normalizedRotation) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const winningIndex = Math.floor(pointerAngle / sliceAngle);
    if (foods[winningIndex]) {
        showResult(foods[winningIndex].name);
    }
}

function showResult(winnerName) {
    winnerDisplay.textContent = winnerName;
    resultModal.classList.remove('hidden');
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    recordDateInput.value = today;
}

function formatDate(dateString) {
    if (!dateString) return "";
    const parts = dateString.split('-');
    if (parts.length !== 3) return dateString;
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
}

function renderFoodList() {
    foodListEl.innerHTML = '';
    foods.forEach((item) => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${item.name}</span> <button class="delete-btn" onclick="removeFood('${item.id}')">&times;</button>`;
        foodListEl.appendChild(li);
    });
}

function renderHistory() {
    historyTableBody.innerHTML = '';
    history.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${formatDate(item.date)}</td><td>${item.food}</td>`;
        historyTableBody.appendChild(row);
    });
}

// --- Event Listeners ---
spinBtn.addEventListener('click', spinWheel);

addFoodBtn.addEventListener('click', () => {
    const name = newFoodInput.value.trim();
    if (name) {
        const exists = foods.some(f => f.name.toLowerCase() === name.toLowerCase());
        if (!exists) {
            addFood(name);
            newFoodInput.value = '';
        } else {
            alert("Esa comida ya existe.");
        }
    }
});

newFoodInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addFoodBtn.click(); });

acceptBtn.addEventListener('click', () => {
    const winnerName = winnerDisplay.textContent;
    const date = recordDateInput.value;
    addHistoryItem({ date, food: winnerName });
    resultModal.classList.add('hidden');
});

retryBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    spinWheel();
});

cancelBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
});

clearHistoryBtn.addEventListener('click', () => {
    if (confirm("¿Borrar todo el historial?")) {
        clearAllHistory();
    }
});

// Global for delete button
window.removeFood = function (id) {
    if (foods.length <= 2) {
        alert("Mínimo 2 opciones.");
        return;
    }
    removeFoodItem(id);
};

// Start
init();
