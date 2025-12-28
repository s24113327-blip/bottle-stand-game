const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameState = {
    paused: true,
    level: 1,
    score: 0,
    bestScore: localStorage.getItem("bestScore") || 0,
    attempts: 0,
    bottleAngle: 0,
    bottleBaseX: 0,
    originalBaseX: 0,
    bottleBaseY: 0,
    ropeAnchorX: 0,
    ropeAnchorY: 40,
    ringX: 0,
    ringY: 0,
    ringRadius: 22,
    isDragging: false,
    isHooked: false, 
    hasWon: false,
    friction: 0.92, // Increased for smoother, heavier movement
    baseVelocity: 0,
    confetti: []
};

function init() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    gameState.ropeAnchorX = canvas.width / 2;
    resetRing();
}

function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.ringX = gameState.ropeAnchorX;
    gameState.ringY = 150;
    if(document.getElementById("boardFrame")) {
        document.getElementById("boardFrame").classList.remove("hooked-active");
    }
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused) return;

    const gravity = 0.03 + (gameState.level * 0.01); 
    const snapDistance = Math.max(15, 35 - (gameState.level * 3));

    if (gameState.isHooked && gameState.isDragging) {
        const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

        const dist = Math.hypot(gameState.ringX - bottleTopX, gameState.ringY - bottleTopY);
        if (dist > snapDistance) { 
            gameState.isHooked = false;
            document.getElementById("status").textContent = "SLIPPED!";
        }
    }

    if (!gameState.isHooked) {
        // Smoother gravity fall
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;
        
        // Softened centering force (0.02 instead of 0.05) to prevent shaking
        gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.02;
    }

    // Apply movement
    gameState.bottleBaseX += gameState.baseVelocity;
    
    // Higher friction (0.92) acts as a shock absorber
    gameState.baseVelocity *= gameState.friction;
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    // Require a more stable stop to count as a win
    if (gameState.bottleAngle <= -Math.PI / 2 * 0.98 && Math.abs(gameState.baseVelocity) < 0.1) {
        gameState.hasWon = true;
        gameState.score += 100 * gameState.level;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "WINNER! 🏮";
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            // Slowly decrease friction each level, but keep it high enough to stay stable
            gameState.friction = Math.max(0.88, 0.92 - (gameState.level * 0.01));
            document.getElementById("level").textContent = gameState.level;
            resetRing();
            gameState.bottleAngle = 0;
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Table
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 5); ctx.lineTo(canvas.width, gameState.bottleBaseY + 5); ctx.stroke();

    // Rope
    ctx.strokeStyle = gameState.isHooked ? "#ffee00" : "#666";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.lineTo(gameState.ringX, gameState.ringY); ctx.stroke();

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    ctx.fillStyle = "#10b981"; ctx.fillRect(0, -21, 135, 42); 
    ctx.fillStyle = "#ff0033"; ctx.fillRect(170, -11, 8, 22); // Cap
    ctx.restore();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();
}

function startGame() {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
}

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 40) gameState.isDragging = true;
});

window.addEventListener("mousemove", (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    gameState.ringX = e.clientX - rect.left;
    gameState.ringY = e.clientY - rect.top;

    const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

    if (!gameState.isHooked) {
        if (Math.hypot(gameState.ringX - bottleTopX, gameState.ringY - bottleTopY) < 25) {
            gameState.isHooked = true;
            document.getElementById("status").textContent = "HOOKED!";
        }
    } else {
        const dx = gameState.ringX - gameState.bottleBaseX;
        const dy = gameState.ringY - gameState.bottleBaseY;
        gameState.bottleAngle = Math.atan2(dy, dx);
        
        // Softened base movement (0.5 instead of 0.8) for more weight
        if (Math.abs(gameState.ringX - bottleTopX) > 10) {
            gameState.baseVelocity += (gameState.ringX > bottleTopX ? 0.5 : -0.5) * (1.1 - gameState.friction);
        }
    }
});

window.addEventListener("mouseup", () => gameState.isDragging = false);

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("resetBtn").addEventListener("click", () => location.reload());

window.addEventListener("load", () => {
    init();
    const loop = () => {
        updatePhysics();
        checkWinCondition();
        drawGame();
        requestAnimationFrame(loop);
    };
    loop();
});
