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
    // Correctly scale canvas for desktop
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Position bottle relative to current screen width
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    gameState.ropeAnchorX = canvas.width / 2;
    
    document.getElementById("bestScore").textContent = gameState.bestScore;
    updateRingPosition();
}

// Auto-adjust when desktop window is resized
window.onresize = init;

function updateRingPosition() {
    const totalLength = 170; 
    gameState.ringX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * totalLength;
    gameState.ringY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * totalLength;
}

function createVictoryConfetti() {
    for(let i=0; i<40; i++) {
        gameState.confetti.push({
            x: gameState.bottleBaseX + 70,
            y: gameState.bottleBaseY - 60,
            vx: (Math.random() - 0.5) * 15,
            vy: -Math.random() * 15 - 5,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`,
            size: Math.random() * 8 + 3,
            life: 1
        });
    }
}

function updatePhysics() {
    if (gameState.hasWon) {
        gameState.baseVelocity *= 0.5;
        gameState.bottleWobble *= 0.5;
    } else {
        gameState.ropeVelocity += (0 - gameState.ropeSwing) * 0.1;
        gameState.ropeVelocity *= 0.92;
        gameState.ropeSwing += gameState.ropeVelocity;
        gameState.bottleWobble *= 0.9;

        if (!gameState.isDragging) {
            gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.05;
            gameState.baseVelocity *= 0.8;
            gameState.bottleBaseX += gameState.baseVelocity;
            if (gameState.bottleAngle < 0) gameState.bottleAngle += 0.04; 
            if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;
        } else {
            gameState.bottleBaseX += gameState.baseVelocity;
            gameState.baseVelocity *= 0.95;
        }
    }
    
    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
    
    updateRingPosition();
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    const isVertical = gameState.bottleAngle <= -Math.PI / 2 * 0.95;
    const isStable = Math.abs(gameState.baseVelocity) < 0.25;

    if (isVertical && isStable) {
        gameState.hasWon = true;
        createVictoryConfetti();
        gameState.score += 100;
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("bestScore", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "WINNER! 🏮";
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.bottleAngle = 0;
            gameState.level++;
            gameState.friction = Math.max(0.4, 0.85 - (gameState.level * 0.03));
            document.getElementById("level").textContent = gameState.level;
            document.getElementById("frictionVal").textContent = gameState.friction.toFixed(2);
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2500);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Table line
    ctx.strokeStyle = `hsl(${200 + (gameState.level * 20)}, 100%, 50%)`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 2); ctx.lineTo(canvas.width, gameState.bottleBaseY + 2); ctx.stroke();

    // Rope
    const tension = Math.min(Math.abs(gameState.ropeVelocity) * 20, 200);
    ctx.strokeStyle = `rgb(255, ${255 - tension}, 0)`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.quadraticCurveTo((gameState.ropeAnchorX + gameState.ringX) / 2 + gameState.ropeSwing, (gameState.ropeAnchorY + gameState.ringY) / 2 + 30, gameState.ringX, gameState.ringY);
    ctx.stroke();

    // Bottle
    ctx.save();
    const wobbleX = Math.sin(Date.now() * 0.05) * gameState.bottleWobble;
    ctx.translate(gameState.bottleBaseX + wobbleX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    ctx.fillStyle = "#10b981"; ctx.fillRect(0, -21, 135, 42); 
    ctx.fillStyle = "#065f46"; ctx.fillRect(40, -21, 50, 42); // Label
    ctx.fillStyle = "#10b981"; ctx.fillRect(135, -9, 35, 18); // Neck
    ctx.fillStyle = "#ff0033"; ctx.fillRect(170, -11, 8, 22); // Cap
    ctx.restore();

    // Ring
    ctx.strokeStyle = "#ff007f"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();

    // Confetti particles
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

function startGame() { document.getElementById("tutorialOverlay").classList.add("hidden"); gameState.paused = false; init(); }
function togglePause() { gameState.paused = !gameState.paused; document.getElementById("pauseOverlay").classList.toggle("hidden"); }

window.addEventListener("load", () => {
    init();
    const loop = () => { if (!gameState.paused) { updatePhysics(); checkWinCondition(); } drawGame(); requestAnimationFrame(loop); };
    loop();
});

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused || gameState.hasWon) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 60) { gameState.isDragging = true; gameState.lastMouseX = mx; }
});

window.addEventListener("mousemove", (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    const speed = mx - gameState.lastMouseX;
    gameState.ropeVelocity += speed * 0.2;
    const dx = mx - gameState.bottleBaseX; const dy = my - gameState.bottleBaseY;
    gameState.bottleAngle = Math.max(-Math.PI / 2 - 0.1, Math.min(Math.atan2(dy, dx), 0.1));
    if (Math.abs(mx - gameState.ringX) > 40) { gameState.baseVelocity += (mx > gameState.bottleBaseX ? 1.2 : -1.2) * (1.1 - gameState.friction); }
    if (Math.abs(speed) > 12) gameState.bottleWobble = Math.abs(speed) * 0.6;
    gameState.lastMouseX = mx;
});

window.addEventListener("mouseup", () => { if (gameState.isDragging) { gameState.isDragging = false; gameState.attempts++; document.getElementById("attempts").textContent = gameState.attempts; } });

document.getElementById("startBtn").addEventListener("click", startGame);
document.getElementById("pauseBtn").addEventListener("click", togglePause);
document.getElementById("resumeBtn").addEventListener("click", togglePause);
document.getElementById("resetBtn").addEventListener("click", () => location.reload());
document.getElementById("exitBtn").addEventListener("click", () => location.reload());
