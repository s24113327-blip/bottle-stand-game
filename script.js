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
    friction: 0.94, 
    baseVelocity: 0,
    windOffset: 0, // NEW: For wind swing
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

    // Wind animation logic
    gameState.windOffset += 0.03;

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

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. THE ROPE (Natural Swing & Curve)
    const windBreeze = Math.sin(gameState.windOffset) * 15;
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    
    ctx.beginPath();
    ctx.moveTo(gameState.ropeAnchorX, gameState.ropeAnchorY);
    
    // The Control Point creates the "Swing" and the "Curve"
    // If hooked, it tightens. If loose, it sags with wind.
    const cpX = ((gameState.ropeAnchorX + gameState.ringX) / 2) + (gameState.isHooked ? 0 : windBreeze);
    const cpY = (gameState.ropeAnchorY + gameState.ringY) / 2 + (gameState.isHooked ? -10 : 30);
    
    ctx.quadraticCurveTo(cpX, cpY, gameState.ringX, gameState.ringY);
    ctx.stroke();

    // 2. THE BOTTLE (Detailed Glass Shape)
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);

    // Body Gradient
    const glassGrad = ctx.createLinearGradient(0, -20, 0, 20);
    glassGrad.addColorStop(0, "#064e3b");
    glassGrad.addColorStop(0.5, "#10b981");
    glassGrad.addColorStop(1, "#064e3b");

    ctx.fillStyle = glassGrad;
    
    // Main Body
    ctx.beginPath();
    ctx.roundRect(0, -21, 130, 42, [5, 15, 15, 5]); 
    ctx.fill();

    // The Shoulder (Curve into neck)
    ctx.beginPath();
    ctx.moveTo(130, -21);
    ctx.bezierCurveTo(155, -21, 155, -10, 155, -10);
    ctx.lineTo(155, 10);
    ctx.bezierCurveTo(155, 21, 130, 21, 130, 21);
    ctx.fill();

    // The Neck
    ctx.fillRect(155, -8, 20, 16);

    // The Cap (Red)
    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.roundRect(175, -11, 8, 22, 2);
    ctx.fill();

    // Glass Shine Highlight
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(15, -14); ctx.lineTo(115, -14); ctx.stroke();

    ctx.restore();

    // 3. THE RING (Glowing Metal)
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff";
    ctx.lineWidth = 6;
    if(gameState.isHooked) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ff007f";
    }
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, gameState.ringRadius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // Confetti
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
}

function checkWinCondition() {
    if (gameState.hasWon) return;
    if (gameState.bottleAngle <= -Math.PI / 2 * 0.98 && Math.abs(gameState.baseVelocity) < 0.1) {
        gameState.hasWon = true;
        gameState.score += 100;
        document.getElementById("score").textContent = gameState.score;
        document.getElementById("status").textContent = "STOOD UP! 🏮";
        createVictoryConfetti();
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            gameState.baseVelocity = 0; 
            gameState.bottleBaseX = gameState.originalBaseX;
            document.getElementById("level").textContent = gameState.level;
            resetRing();
            gameState.bottleAngle = 0;
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
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
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
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
