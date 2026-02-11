// DOM Elements
const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const newFoodInput = document.getElementById('newFoodInput');
const addFoodBtn = document.getElementById('addFoodBtn');
const foodListEl = document.getElementById('foodList');
const historyTableBody = document.querySelector('#historyTable tbody');
const recordDateInput = document.getElementById('recordDate');

// Modal Elements
const resultModal = document.getElementById('resultModal');
const winnerDisplay = document.getElementById('winnerDisplay');
const acceptBtn = document.getElementById('acceptBtn');
const retryBtn = document.getElementById('retryBtn');
const cancelBtn = document.getElementById('cancelBtn');

// State
let foods = JSON.parse(localStorage.getItem('lunchFoods')) || ["Pizza", "Ensalada", "Sushi", "Hamburguesa", "Tacos", "Pasta"];
let history = JSON.parse(localStorage.getItem('lunchHistory')) || [];
let isSpinning = false;
let currentRotation = 0;
let animationId = null;

// Constants
const COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#10b981'];

// Initialization
function init() {
    renderWheel();
    renderFoodList();
    renderHistory();
    setTodayDate();

    // Resize handling for responsive canvas
    // (In a production app, we'd handle resizing more robustly)
}

function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    recordDateInput.value = today;
}

// Wheel Rendering
function renderWheel() {
    const width = canvas.width;
    const height = canvas.height;
    const radius = width / 2;
    const sliceAngle = (2 * Math.PI) / foods.length;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.rotate(currentRotation);

    foods.forEach((food, index) => {
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
        ctx.fillText(food, radius - 20, 5);
        ctx.restore();
    });

    ctx.restore();
}

// Spin Logic
function spinWheel() {
    if (isSpinning) return;
    if (foods.length < 2) {
        alert("¡Necesitas al menos 2 opciones para girar!");
        return;
    }

    isSpinning = true;
    spinBtn.disabled = true;

    // Calculate random spin duration and rotations
    const duration = 5000; // 5 seconds
    const minRotations = 5;
    const maxRotations = 10;
    const randomRotations = minRotations + Math.random() * (maxRotations - minRotations);
    const totalRotationAngle = randomRotations * 2 * Math.PI;

    // Randomize winning index slightly to not always land in center of slice
    const sliceAngle = (2 * Math.PI) / foods.length;
    const randomOffset = Math.random() * sliceAngle * 0.8; // within 80% of slice

    // We want to land on a specific slice.
    // The pointer is at 270 degrees (Top) or -90 degrees.
    // But our drawing starts at 0 (Right).
    // So to check winner visually, we need to account for this.
    // However, simplest way is: just rotate effectively and calculate winner at end based on final rotation.

    const startTime = performance.now();
    const startRotation = currentRotation % (2 * Math.PI); // Normalize starting pos
    const targetRotation = startRotation + totalRotationAngle + randomOffset;

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function: cubic-bezier-like ease out
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
    // Normalize rotation to 0 - 2PI
    let normalizedRotation = rotation % (2 * Math.PI);

    // Pointer is at Top (effectively -PI/2 or 3PI/2 relative to 0 start at Right)
    // The wheel rotates CLOCKWISE.
    // Example: If 0 rotation, index 0 is at (0 to sliceAngle). 
    // To bring index 0 to top, we rotate -90deg (-PI/2) or 270deg.

    // Let's do a reverse calculation.
    // The angle of the pointer relative to the wheel's 0 is:
    // pointerAngle = (3 * Math.PI / 2) - normalizedRotation;
    // Just easier to Map:

    // If we rotate the context by R, the item at angle A is now at A + R.
    // We want A + R = 3PI/2 (270 deg - top).
    // A = 3PI/2 - R.

    let pointerAngle = (1.5 * Math.PI - normalizedRotation) % (2 * Math.PI);
    if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

    const winningIndex = Math.floor(pointerAngle / sliceAngle);
    const winner = foods[winningIndex];

    showResult(winner);
}

function showResult(winner) {
    winnerDisplay.textContent = winner;
    resultModal.classList.remove('hidden');

    // Celebrate!
    confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// Event Listeners
spinBtn.addEventListener('click', spinWheel);

addFoodBtn.addEventListener('click', () => {
    const food = newFoodInput.value.trim();
    if (food && !foods.includes(food)) {
        foods.push(food);
        newFoodInput.value = '';
        saveFoods();
        renderFoodList();
        renderWheel();
    }
});

newFoodInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addFoodBtn.click();
});

// Modal Actions
acceptBtn.addEventListener('click', () => {
    addToHistory(winnerDisplay.textContent);
    resultModal.classList.add('hidden');
});

retryBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
    spinWheel();
});

cancelBtn.addEventListener('click', () => {
    resultModal.classList.add('hidden');
});

// History Logic
function addToHistory(food) {
    const date = recordDateInput.value;
    history.unshift({ date, food }); // Add to beginning
    if (history.length > 20) history.pop(); // Keep only 20

    saveHistory();
    renderHistory();
}

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
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

// Data Persistence
function saveFoods() {
    localStorage.setItem('lunchFoods', JSON.stringify(foods));
}

function saveHistory() {
    localStorage.setItem('lunchHistory', JSON.stringify(history));
}

function renderFoodList() {
    foodListEl.innerHTML = '';
    foods.forEach((food, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${food}</span>
            <button class="delete-btn" onclick="removeFood(${index})">&times;</button>
        `;
        foodListEl.appendChild(li);
    });
}

// Expose removeFood globally so onclick works
window.removeFood = function (index) {
    if (foods.length <= 2) {
        alert("Debe haber al menos 2 opciones.");
        return;
    }
    foods.splice(index, 1);
    saveFoods();
    renderFoodList();
    renderWheel();
};

// Start
init();
