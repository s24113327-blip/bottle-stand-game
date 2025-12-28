const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameState = {
    paused: true,
    level: 1,
    score: 0,
    bottleAngle: 0,
    bottleBaseX: 0,
    originalBaseX: 0,
    bottleBaseY: 0,
    ropeAnchorX: 0,
    ropeAnchorY: 20,
    ringX: 0,
    ringY: 0,
    ringRadius: 22,
    isDragging: false,
    isHooked: false, 
    hasWon: false,
    friction: 0.94, // High friction for heavy stable feel
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
    gameState.baseVelocity = 0;
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused) return;

    const gravity = 0.03 + (gameState.level * 0.01); 
    const snapDistance = Math.max(15, 38 - (gameState.level * 3));

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
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        
        if (gameState.bottleAngle >= 0) {
            gameState.bottleAngle = 0;
            // Only center when flat to prevent shaking
            const distToCenter = gameState.originalBaseX - gameState.bottleBaseX;
            if (Math.abs(distToCenter) > 0.5) {
                gameState.baseVelocity += distToCenter * 0.01;
            } else {
                gameState.bottleBaseX = gameState.originalBaseX;
                gameState.baseVelocity = 0;
            }
        }
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= gameState.friction;

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.015;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    if (gameState.bottleAngle <= -Math.PI / 2 * 0.98 && Math.abs(gameState.baseVelocity) < 0.1) {
        gameState.hasWon = true;
        gameState.score += 100 * gameState.level;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "PERFECT! 🏮";
        createVictoryConfetti();
        
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            gameState.baseVelocity = 0; 
            gameState.bottleBaseX = gameState.originalBaseX;
            gameState.friction = Math.max(0.90, 0.94 - (gameState.level * 0.01));
            document.getElementById("level").textContent = gameState.level;
            resetRing();
            gameState.bottleAngle = 0;
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // --- TABLE ---
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 5); ctx.lineTo(canvas.width, gameState.bottleBaseY + 5); ctx.stroke();

    // --- ROPE (Curved) ---
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    ctx.quadraticCurveTo(gameState.ropeAnchorX, (gameState.ropeAnchorY + gameState.ringY)/2, gameState.ringX, gameState.ringY);
    ctx.stroke();

    // --- BOTTLE (Polished) ---
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);

    // Glass Body
    const glassGrad = ctx.createLinearGradient(0, -20, 0, 20);
    glassGrad.addColorStop(0, "#065f46"); glassGrad.addColorStop(0.5, "#10b981"); glassGrad.addColorStop(1, "#064e3b");
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.roundRect(0, -21, 130, 42, [0, 10, 10, 0]); ctx.fill();

    // Label
    ctx.fillStyle = "#fbbf24"; ctx.fillRect(45, -21, 40, 42);
    ctx.fillStyle = "#b91c1c"; ctx.font = "bold 10px sans-serif"; ctx.fillText("TAIWAN", 48, 4);

    // Neck & Cap
    ctx.fillStyle = glassGrad;
    ctx.beginPath(); ctx.moveTo(130, -21); ctx.quadraticCurveTo(145, -21, 145, -10); ctx.lineTo(145, 10); ctx.quadraticCurveTo(145, 21, 130, 21); ctx.fill();
    ctx.fillRect(145, -8, 25, 16);
    ctx.fillStyle = "#ef4444"; ctx.roundRect(170, -10, 10, 20, 3); ctx.fill();
    ctx.restore();

    // --- RING ---
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff";
    ctx.lineWidth = 5;
    if(gameState.isHooked) { ctx.shadowBlur = 15; ctx.shadowColor = "#ff007f"; }
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Confetti
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
}

function createVictoryConfetti() {
    for(let i=0; i<30; i++) {
        gameState.confetti.push({
            x: gameState.bottleBaseX + 50, y: gameState.bottleBaseY - 50,
            vx: (Math.random() - 0.5) * 10, vy: -Math.random() * 10 - 5,
            color: `hsl(${Math.random() * 360}, 100%, 50%)`, size: Math.random() * 5 + 2, life: 1
        });
    }
}

canvas.addEventListener("mousedown", (e) => {
    if (gameState.paused) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
    if (Math.hypot(mx - gameState.ringX, my - gameState.ringY) < 45) gameState.isDragging = true;
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
        if (Math.abs(gameState.ringX - bottleTopX) > 10) {
            gameState.baseVelocity += (gameState.ringX > bottleTopX ? 0.4 : -0.4) * (1.1 - gameState.friction);
        }
    }
});

window.addEventListener("mouseup", () => gameState.isDragging = false);

document.getElementById("startBtn").addEventListener("click", () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
});

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
