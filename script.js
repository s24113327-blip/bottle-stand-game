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
    hasWon: false,
    friction: 0.85,
    ropeSwing: 0,
    ropeVelocity: 0,
    bottleWobble: 0,
    lastMouseX: 0,
    baseVelocity: 0
};

function init() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // Prevent init if elements aren't sized yet

    canvas.width = rect.width;
    canvas.height = rect.height;
  
    
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    gameState.ropeAnchorX = canvas.width / 2;
    
    document.getElementById("bestScore").textContent = gameState.bestScore;
    updateRingPosition();
}

function updateRingPosition() {
    const totalLength = 170; 
    gameState.ringX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * totalLength;
    gameState.ringY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * totalLength;
}

function updatePhysics() {
    if (gameState.hasWon) return;

    gameState.ropeVelocity += (0 - gameState.ropeSwing) * 0.1;
    gameState.ropeVelocity *= 0.92;
    gameState.ropeSwing += gameState.ropeVelocity;
    gameState.bottleWobble *= 0.9;

    if (!gameState.isDragging) {
        gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.05;
        gameState.baseVelocity *= 0.8;
        gameState.bottleBaseX += gameState.baseVelocity;
        if (gameState.bottleAngle < 0) gameState.bottleAngle += 0.05;
        if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;
    } else {
        gameState.bottleBaseX += gameState.baseVelocity;
        gameState.baseVelocity *= 0.9;
    }
    updateRingPosition();
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    if (gameState.bottleAngle <= -Math.PI / 2 * 0.97 && Math.abs(gameState.baseVelocity) < 0.3) {
        gameState.hasWon = true;
        gameState.score += 100;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "ç«‹èµ·ä¾†äº†! ðŸŽ‰";
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.bottleAngle = 0;
            gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Table line
    ctx.strokeStyle = "#00f3ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, gameState.bottleBaseY + 2);
    ctx.lineTo(canvas.width, gameState.bottleBaseY + 2);
    ctx.stroke();

    // Rope
    ctx.strokeStyle = "#ffee00";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.quadraticCurveTo(
        (gameState.ropeAnchorX + gameState.ringX) / 2 + gameState.ropeSwing,
        (gameState.ropeAnchorY + gameState.ringY) / 2 + 30,
        gameState.ringX, gameState.ringY
    );
    ctx.stroke();

    // Bottle
    ctx.save();
    const wobbleX = Math.sin(Date.now() * 0.05) * gameState.bottleWobble;
    ctx.translate(gameState.bottleBaseX + wobbleX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(0, -21, 135, 42); 
    ctx.fillRect(135, -9, 35, 18); 
    ctx.fillStyle = "#ff0033";
    ctx.fillRect(170, -11, 8, 22);  
    ctx.restore();

    // Ring
    ctx.strokeStyle = "#ff007f";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2);
    ctx.stroke();
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

// Event Listeners
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

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused || gameState.hasWon) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 50) {
        gameState.isDragging = true;
        gameState.lastMouseX = mx;
    }
});

window.addEventListener("mousemove", (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const speed = mx - gameState.lastMouseX;
    gameState.ropeVelocity += speed * 0.15;
    if (Math.abs(speed) > 10) gameState.bottleWobble = Math.abs(speed) * 0.4;

    const dx = mx - gameState.bottleBaseX;
    const dy = my - gameState.bottleBaseY;
    gameState.bottleAngle = Math.max(-Math.PI / 2, Math.min(Math.atan2(dy, dx), 0));

    if (Math.abs(mx - gameState.ringX) > 40) {
        gameState.baseVelocity += (mx > gameState.bottleBaseX ? 1 : -1) * (1.1 - gameState.friction);
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

// Bind Buttons
document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("resumeBtn").addEventListener("click", togglePause);
document.getElementById("resetBtn").addEventListener("click", () => location.reload());
document.getElementById("exitBtn").addEventListener("click", () => location.reload());
