const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameState = {
    paused: true,
    level: 1,
    score: 0,
    bestScore: parseInt(localStorage.getItem("bestScore")) || 0,
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
    isHooked: false, // NEW: Tracks if the ring is actually caught on the bottle
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
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    gameState.ropeAnchorX = canvas.width / 2;
    document.getElementById("bestScore").textContent = gameState.bestScore;
    resetRing();
}

function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.bottleAngle = 0;
    // Ring drops back to a neutral hanging position
    gameState.ringX = gameState.ropeAnchorX;
    gameState.ringY = 200;
}

window.onresize = init;

function updatePhysics() {
    if (gameState.hasWon) {
        gameState.baseVelocity *= 0.5;
    } else {
        // Rope physics
        gameState.ropeVelocity += (0 - gameState.ropeSwing) * 0.1;
        gameState.ropeVelocity *= 0.92;
        gameState.ropeSwing += gameState.ropeVelocity;

        if (gameState.isHooked && gameState.isDragging) {
            // HARDER: Calculation of "Slip"
            const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
            const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
            
            // If pulled too fast or too far from the neck, it slips!
            const pullTension = Math.abs(gameState.baseVelocity) + Math.abs(gameState.ropeVelocity);
            const breakThreshold = 15 - (gameState.level * 0.5); // Gets harder every level

            if (pullTension > breakThreshold) {
                gameState.isHooked = false;
                gameState.bottleWobble = 15;
                document.getElementById("status").textContent = "Slipped! Too fast!";
            } else {
                // Update ring to follow bottle neck while hooked
                gameState.ringX = bottleTopX;
                gameState.ringY = bottleTopY;
            }
        }

        // Gravity/Base movement
        if (!gameState.isHooked) {
            gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.05;
            if (gameState.bottleAngle < 0) gameState.bottleAngle += 0.06; // Falls faster now
            if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;
        }
        
        gameState.bottleBaseX += gameState.baseVelocity;
        gameState.baseVelocity *= 0.85;
    }
    
    // Confetti
    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    const isVertical = gameState.bottleAngle <= -Math.PI / 2 * 0.96;
    const isStable = Math.abs(gameState.baseVelocity) < 0.2;

    if (isVertical && isStable) {
        gameState.hasWon = true;
        createVictoryConfetti();
        gameState.score += 100 * gameState.level;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "PERFECT! 🏮";
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            gameState.friction = Math.max(0.3, 0.85 - (gameState.level * 0.04));
            document.getElementById("level").textContent = gameState.level;
            document.getElementById("frictionVal").textContent = gameState.friction.toFixed(2);
            resetRing();
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2500);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Table
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 5); ctx.lineTo(canvas.width, gameState.bottleBaseY + 5); ctx.stroke();

    // Rope
    ctx.strokeStyle = gameState.isHooked ? varProp("--neon-yellow") : "#555";
    ctx.lineWidth = 3;
    ctx.beginPath(); 
    ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.quadraticCurveTo(
        (gameState.ropeAnchorX + gameState.ringX) / 2 + gameState.ropeSwing, 
        (gameState.ropeAnchorY + gameState.ringY) / 2, 
        gameState.ringX, gameState.ringY
    );
    ctx.stroke();

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    ctx.fillStyle = "#10b981"; ctx.fillRect(0, -21, 135, 42); // Body
    ctx.fillStyle = "#10b981"; ctx.fillRect(135, -9, 35, 18); // Neck
    ctx.fillStyle = "#ff0033"; ctx.fillRect(170, -11, 8, 22); // Cap
    ctx.restore();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();

    // Confetti
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

// Help function for colors
function varProp(name) { return getComputedStyle(document.documentElement).getPropertyValue(name); }

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused || gameState.hasWon) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Check if clicking ring
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 40) {
        gameState.isDragging = true;
    }
});

window.addEventListener("mousemove", (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const speed = mx - gameState.lastMouseX;
    gameState.ropeVelocity += speed * 0.1;

    if (!gameState.isHooked) {
        // Move ring freely until it hits the bottle neck
        gameState.ringX = mx;
        gameState.ringY = my;

        const bottleTopX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const bottleTopY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

        if (Math.hypot(mx - bottleTopX, my - bottleTopY) < 20) {
            gameState.isHooked = true; // HOOKED!
            document.getElementById("status").textContent = "Hooked! Lift slowly...";
        }
    } else {
        // Calculate bottle movement based on mouse pull
        const dx = mx - gameState.bottleBaseX;
        const dy = my - gameState.bottleBaseY;
        gameState.bottleAngle = Math.max(-Math.PI / 2 - 0.1, Math.min(Math.atan2(dy, dx), 0.1));
        
        // Slide the base
        if (Math.abs(mx - gameState.ringX) > 20) {
            gameState.baseVelocity += (mx > gameState.bottleBaseX ? 1 : -1) * (1.2 - gameState.friction);
        }
    }
    gameState.lastMouseX = mx;
});

window.addEventListener("mouseup", () => {
    gameState.isDragging = false;
    if (!gameState.isHooked) resetRing();
});

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("resumeBtn").addEventListener("click", togglePause);
document.getElementById("resetBtn").addEventListener("click", () => location.reload());
