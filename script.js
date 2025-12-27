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
    isHooked: false, // NEW: Tracks if the ring is caught on the bottle
    hasWon: false,
    friction: 0.85,
    ropeSwing: 0,
    ropeVelocity: 0,
    bottleWobble: 0,
    lastMouseX: 0,
    baseVelocity: 0,
    confetti: []
};

function init() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;

    canvas.width = rect.width;
    canvas.height = rect.height;
    
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    gameState.ropeAnchorX = canvas.width / 2;
    
    document.getElementById("bestScore").textContent = gameState.bestScore;
    resetRing();
}

// Reset ring to a hanging position instead of magnetizing it
function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.ringX = gameState.ropeAnchorX;
    gameState.ringY = 180;
}

function updatePhysics() {
    if (gameState.hasWon) return;

    // Level-based difficulty scaling
    const gravity = 0.04 + (gameState.level * 0.01); 
    const snapDistance = Math.max(12, 35 - (gameState.level * 3));

    if (gameState.isHooked && gameState.isDragging) {
        // Calculate where the bottle cap is in space
        const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

        // THE SNAP: If the distance between mouse (ring) and cap is too big, it slips!
        const tensionDist = Math.hypot(gameState.ringX - bottleTopX, gameState.ringY - bottleTopY);
        if (tensionDist > snapDistance) { 
            gameState.isHooked = false;
            gameState.bottleWobble = 15;
            document.getElementById("status").textContent = "SLIPPED! Too fast!";
        }
    }

    if (!gameState.isHooked) {
        // Bottle gravity: falls back down if not held
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;
        
        // Base returns to center
        gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.05;
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= gameState.friction;

    // Update Confetti logic
    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    const isVertical = gameState.bottleAngle <= -Math.PI / 2 * 0.97;
    const isStable = Math.abs(gameState.baseVelocity) < 0.2;

    if (isVertical && isStable) {
        gameState.hasWon = true;
        createVictoryConfetti();
        gameState.score += 100 * gameState.level;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "Stand-by-Me! 🎉";
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            // Make floor slipperier every level
            gameState.friction = Math.max(0.4, 0.85 - (gameState.level * 0.05));
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
    ctx.strokeStyle = "#00f3ff";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 2); ctx.lineTo(canvas.width, gameState.bottleBaseY + 2); ctx.stroke();

    // Rope - Changes color based on hook status
    ctx.strokeStyle = gameState.isHooked ? "#ffee00" : "#555";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.lineTo(gameState.ringX, gameState.ringY);
    ctx.stroke();

    // Bottle
    ctx.save();
    const wobbleX = Math.sin(Date.now() * 0.05) * gameState.bottleWobble;
    ctx.translate(gameState.bottleBaseX + wobbleX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    ctx.fillStyle = "#10b981"; ctx.fillRect(0, -21, 135, 42); 
    ctx.fillStyle = "#10b981"; ctx.fillRect(135, -9, 35, 18); 
    ctx.fillStyle = "#ff0033"; ctx.fillRect(170, -11, 8, 22); // Red Cap
    ctx.restore();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#ffffff";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();

    // Confetti
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused || gameState.hasWon) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 50) {
        gameState.isDragging = true;
    }
});

window.addEventListener("mousemove", (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    gameState.ringX = mx;
    gameState.ringY = my;

    const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

    if (!gameState.isHooked) {
        // MANUAL HOOKING: Must touch the cap to grab the bottle
        if (Math.hypot(mx - bottleTopX, my - bottleTopY) < 25) {
            gameState.isHooked = true;
            document.getElementById("status").textContent = "Hooked! Lift slowly...";
        }
    } else {
        // Apply rotation based on pull
        const dx = mx - gameState.bottleBaseX;
        const dy = my - gameState.bottleBaseY;
        gameState.bottleAngle = Math.atan2(dy, dx);
        
        // Apply movement to the base
        if (Math.abs(mx - bottleTopX) > 10) {
            gameState.baseVelocity += (mx > bottleTopX ? 0.9 : -0.9) * (1.1 - gameState.friction);
        }
    }
    gameState.lastMouseX = mx;
});

window.addEventListener("mouseup", () => {
    if (gameState.isDragging) {
        gameState.isDragging = false;
        gameState.attempts++;
        document.getElementById("attempts").textContent = gameState.attempts;
    }
});

function createVictoryConfetti() {
    for(let i=0; i<40; i++) {
        gameState.confetti.push({
            x: gameState.bottleBaseX + 50, y: gameState.bottleBaseY - 50,
            vx: (Math.random() - 0.5) * 15, vy: -Math.random() * 15 - 5,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`, size: Math.random() * 8 + 3, life: 1
        });
    }
}

// UI Controls
const startGame = () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
};

const togglePause = () => {
    gameState.paused = !gameState.paused;
    document.getElementById("pauseOverlay").classList.toggle("hidden");
};

window.addEventListener("load", () => {
    init();
    const loop = () => {
        if (!gameState.paused) {
            updatePhysics();
            checkWinCondition();
        }
        drawGame();
        requestAnimationFrame(loop);
    };
    loop();
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("resumeBtn").addEventListener("click", togglePause);
document.getElementById("resetBtn").addEventListener("click", () => location.reload());
document.getElementById("exitBtn").addEventListener("click", () => location.reload());
