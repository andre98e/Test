import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, orderBy, limit, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// --- Firebase Configuration ---
const firebaseConfig = {
    apiKey: "AIzaSyA9knGhSnePFk8nQf7MUA7psKcT6XYR8K8",
    authDomain: "ruleta-20dfe.firebaseapp.com",
    projectId: "ruleta-20dfe",
    storageBucket: "ruleta-20dfe.firebasestorage.app",
    messagingSenderId: "870456448153",
    appId: "1:870456448153:web:522fe1d9b1c586627d1408"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

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

// Modal Elements
const resultModal = document.getElementById('resultModal');
const winnerDisplay = document.getElementById('winnerDisplay');
const acceptBtn = document.getElementById('acceptBtn');
const retryBtn = document.getElementById('retryBtn');
const cancelBtn = document.getElementById('cancelBtn');

// --- State ---
let foods = []; // Array of { id, name }
let history = []; // Array of { id, date, food }
let isSpinning = false;
let currentRotation = 0;
let animationId = null;

// Constants
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

// --- Initialization ---
function init() {
    setTodayDate();
    setupRealtimeListeners();
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    recordDateInput.value = today;
}

// --- Firebase Listeners ---
function setupRealtimeListeners() {
    // 1. Foods Listener
    const qFoods = query(collection(db, "foods"));
    onSnapshot(qFoods, (snapshot) => {
        foods = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // If empty, user can add foods. We won't auto-seed to avoid loop if they delete all.
        renderFoodList();
        renderWheel();
    });

    // 2. History Listener (Last 20 ordered by date desc)
    // Note: 'date' string sort works for ISO format YYYY-MM-DD
    const qHistory = query(
        collection(db, "history"),
        orderBy("date", "desc"),
        limit(20)
    );

    onSnapshot(qHistory, (snapshot) => {
        history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderHistory();
    });
}

// --- Wheel Rendering ---
function renderWheel() {
    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;

    ctx.clearRect(0, 0, width, height);

    if (foods.length === 0) {
        ctx.font = "20px Outfit";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.fillText("Agrega comidas para empezar", width / 2, height / 2);
        return;
    }

    const sliceAngle = (2 * Math.PI) / foods.length;

    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(currentRotation);

    foods.forEach((item, index) => {
        // Draw Slice
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius, index * sliceAngle, (index + 1) * sliceAngle);
        ctx.fillStyle = COLORS[index % COLORS.length];
        ctx.fill();
        ctx.stroke();

        // Draw Text
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

// --- Spin Logic ---
function spinWheel() {
    if (isSpinning) return;
    if (foods.length < 2) {
        alert("¡Necesitas al menos 2 opciones para girar!");
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
    // Safety check
    if (foods[winningIndex]) {
        showResult(foods[winningIndex].name);
    }
}

function showResult(winnerName) {
    winnerDisplay.textContent = winnerName;
    resultModal.classList.remove('hidden');

    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// --- Event Listeners ---
spinBtn.addEventListener('click', spinWheel);

addFoodBtn.addEventListener('click', async () => {
    const foodName = newFoodInput.value.trim();
    if (foodName) {
        // Prevent strictly empty strings, duplicates allowed? 
        // User didn't specify strict duplicate check for Firestore, but let's keep it simple.
        // Checking local array for name existence is good UX.
        const exists = foods.some(f => f.name.toLowerCase() === foodName.toLowerCase());
        if (!exists) {
            try {
                await addDoc(collection(db, "foods"), { name: foodName });
                newFoodInput.value = '';
            } catch (e) {
                console.error("Error adding food: ", e);
                alert("Error al guardar comida.");
            }
        } else {
            alert("Esa comida ya está en la lista.");
        }
    }
});

newFoodInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addFoodBtn.click();
});

// Modal Actions
acceptBtn.addEventListener('click', async () => {
    const winnerName = winnerDisplay.textContent;
    const date = recordDateInput.value;

    try {
        await addDoc(collection(db, "history"), {
            date: date,
            food: winnerName
        });
        resultModal.classList.add('hidden');
    } catch (e) {
        console.error("Error saving history: ", e);
        alert("Error al guardar historial.");
    }
});

retryBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    spinWheel();
});

cancelBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
});

clearHistoryBtn.addEventListener('click', async () => {
    if (confirm("¿Estás seguro de borrar TODO el historial? Esta acción no se puede deshacer.")) {
        try {
            const q = query(collection(db, "history"));
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);

            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        } catch (e) {
            console.error("Error clearing history: ", e);
            alert("Error al vaciar el historial.");
        }
    }
});

// --- UI Rendering ---
function renderHistory() {
    historyTableBody.innerHTML = '';
    history.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(item.date)}</td>
            <td>${item.food}</td>
        `;
        historyTableBody.appendChild(row);
    });
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
        li.innerHTML = `
            <span>${item.name}</span>
            <button class="delete-btn" onclick="removeFood('${item.id}')">&times;</button>
        `;
        foodListEl.appendChild(li);
    });
}

// --- Global helper for Delete Button ---
window.removeFood = async function (docId) {
    if (foods.length <= 2) {
        alert("Debe haber al menos 2 opciones.");
        return;
    }

    if (confirm("¿Borrar comida?")) {
        try {
            await deleteDoc(doc(db, "foods", docId));
        } catch (e) {
            console.error("Error removing food: ", e);
            alert("Error al borrar.");
        }
    }
};

// Start
init();
