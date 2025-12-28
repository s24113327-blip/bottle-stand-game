const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const gameState = {
    paused: true,
    level: 1,
    score: 0,
    bestScore: localStorage.getItem("standByMeBest") || 0,
    bottleAngle: 0,
    bottleBaseX: 0,
    originalBaseX: 0,
    bottleBaseY: 0,
    ringX: 0,
    ringY: 0,
    isDragging: false,
    isHooked: false,
    hasWon: false,
    baseVelocity: 0,
    wind: 0,
    confetti: []
};

// Initialize Score UI
document.getElementById("bestScore").textContent = gameState.bestScore;

function init() {
    canvas.width = 800; // Fixed internal coordinate system
    canvas.height = 450;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.85;
    resetRing();
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.ringX = canvas.width / 2;
    gameState.ringY = 150;
    gameState.baseVelocity = 0;
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused) return;
    gameState.wind += 0.02;

    const gravity = 0.03 + (gameState.level * 0.005);

    if (gameState.isHooked) {
        const tx = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const ty = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        if (Math.hypot(gameState.ringX - tx, gameState.ringY - ty) > 40) {
            gameState.isHooked = false;
            document.getElementById("status").textContent = "SLIPPED!";
        }
    }

    if (!gameState.isHooked) {
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle >= 0) {
            gameState.bottleAngle = 0;
            const dist = gameState.originalBaseX - gameState.bottleBaseX;
            if (Math.abs(dist) > 0.5) gameState.baseVelocity += dist * 0.01;
            else { gameState.bottleBaseX = gameState.originalBaseX; gameState.baseVelocity = 0; }
        }
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= 0.94;

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Rope
    const sway = Math.sin(gameState.wind) * 15;
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 20);
    const cpX = (canvas.width/2 + gameState.ringX)/2 + (gameState.isHooked ? 0 : sway);
    const cpY = (20 + gameState.ringY)/2 + (gameState.isHooked ? -10 : 30);
    ctx.quadraticCurveTo(cpX, cpY, gameState.ringX, gameState.ringY);
    ctx.stroke();

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, "#064e3b"); g.addColorStop(0.5, "#10b981"); g.addColorStop(1, "#064e3b");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(0, -21, 130, 42, [5, 15, 15, 5]); ctx.fill();
    ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; ctx.roundRect(170, -10, 10, 20, 3); ctx.fill();
    ctx.restore();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1;
}

function checkWin() {
    if (gameState.hasWon) return;
    if (gameState.bottleAngle <= -Math.PI/2 * 0.98 && Math.abs(gameState.baseVelocity) < 0.1) {
        gameState.hasWon = true;
        gameState.score += 100;
        document.getElementById("score").textContent = gameState.score;
        
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }

        document.getElementById("status").textContent = "PERFECT! 🏮";
        for(let i=0; i<30; i++) {
            gameState.confetti.push({
                x: gameState.bottleBaseX + 50, y: gameState.bottleBaseY - 50,
                vx: (Math.random()-0.5)*10, vy: -Math.random()*10-5,
                color: `hsl(${Math.random()*360}, 100%, 50%)`, life: 1
            });
        }

        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            gameState.bottleAngle = 0;
            gameState.bottleBaseX = gameState.originalBaseX;
            resetRing();
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
}

canvas.onmousedown = (e) => {
    if (gameState.paused) return;
    const pos = getMousePos(e);
    if (Math.hypot(pos.x - gameState.ringX, pos.y - gameState.ringY) < 40) gameState.isDragging = true;
};

window.onmousemove = (e) => {
    if (!gameState.isDragging || gameState.paused) return;
    const pos = getMousePos(e);
    gameState.ringX = pos.x;
    gameState.ringY = pos.y;
    const tx = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const ty = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;

    if (!gameState.isHooked) {
        if (Math.hypot(gameState.ringX - tx, gameState.ringY - ty) < 25) {
            gameState.isHooked = true;
            document.getElementById("status").textContent = "HOOKED!";
        }
    } else {
        gameState.bottleAngle = Math.atan2(gameState.ringY - gameState.bottleBaseY, gameState.ringX - gameState.bottleBaseX);
        if (Math.abs(gameState.ringX - tx) > 5) gameState.baseVelocity += (gameState.ringX > tx ? 0.3 : -0.3);
    }
};

window.onmouseup = () => gameState.isDragging = false;
document.getElementById("startBtn").onclick = () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
};
document.getElementById("pauseBtn").onclick = () => {
    gameState.paused = true;
    document.getElementById("pauseOverlay").classList.remove("hidden");
};
document.getElementById("resumeBtn").onclick = () => {
    gameState.paused = false;
    document.getElementById("pauseOverlay").classList.add("hidden");
};
document.getElementById("resetBtn").onclick = () => location.reload();

window.onload = () => {
    init();
    const loop = () => { updatePhysics(); checkWin(); drawGame(); requestAnimationFrame(loop); };
    loop();
};
