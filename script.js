const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playClink(v = 0.1, f = 1200) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.1);
}

function playWinSound() {
    [523, 659, 783, 1046].forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.frequency.setValueAtTime(f, audioCtx.currentTime + i * 0.1);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.3);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + i * 0.1); o.stop(audioCtx.currentTime + i * 0.1 + 0.3);
    });
}

// --- STATE ---
const gameState = {
    paused: true, gameOver: false, hasWon: false,
    level: 1, score: 0, bestScore: localStorage.getItem("standByMeBest") || 0,
    bottleAngle: 0, bottleBaseX: 0, originalBaseX: 0, bottleBaseY: 0,
    ringX: 400, ringY: 150, isDragging: false, isHooked: false,
    baseVelocity: 0, wind: 0, confetti: [],
    timeLeft: 20, maxTime: 20, lastTime: 0
};

document.getElementById("bestScore").textContent = gameState.bestScore;

function updateLevelSidebar() {
    const list = document.getElementById("levelList");
    list.innerHTML = "";
    // Display range: Level 1 to Current Level + 3
    for (let i = 1; i <= Math.max(5, gameState.level + 2); i++) {
        const li = document.createElement("li");
        li.className = "level-item";
        if (i < gameState.level) {
            li.classList.add("cleared");
            li.innerHTML = `<span>Level ${i}</span> <span>✓</span>`;
        } else if (i === gameState.level) {
            li.classList.add("active");
            li.innerHTML = `<span>Level ${i}</span> <span>LIVE</span>`;
        } else {
            li.innerHTML = `<span>Level ${i}</span> <span>🔒</span>`;
        }
        list.appendChild(li);
    }
}

function init() {
    canvas.width = 800; canvas.height = 450;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.82;
    gameState.score = 0; gameState.level = 1;
    gameState.gameOver = false; gameState.hasWon = false;
    gameState.baseVelocity = 0; gameState.bottleAngle = 0;
    gameState.maxTime = 20; gameState.timeLeft = 20;
    gameState.lastTime = performance.now();
    document.getElementById("score").textContent = "0";
    document.getElementById("level").textContent = "1";
    updateLevelSidebar();
    resetRing();
}

function resetRing() {
    gameState.isHooked = false; gameState.isDragging = false;
    gameState.ringX = canvas.width / 2; gameState.ringY = 150;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height)
    };
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;

    const now = performance.now();
    const dt = (now - gameState.lastTime) / 1000;
    gameState.lastTime = now;
    gameState.timeLeft -= dt;

    if (gameState.timeLeft <= 0) triggerGameOver("TIME'S UP!");

    // UI Feedback
    const statusEl = document.getElementById("status");
    if (gameState.timeLeft < 5 && Math.floor(now / 200) % 2 === 0) {
        statusEl.style.color = "#ff4444";
        statusEl.textContent = `HURRY! ${Math.ceil(gameState.timeLeft)}s`;
    } else {
        statusEl.style.color = "white";
        statusEl.textContent = gameState.isHooked ? "STEADY..." : "Hook the Cap!";
    }

    gameState.wind += 0.02;
    const levelMod = Math.min(gameState.level, 20);
    const gravity = 0.035 + (levelMod * 0.003); 
    const friction = Math.min(0.92 + (levelMod * 0.002), 0.98); 
    const slipThreshold = Math.max(60 - (levelMod * 1.0), 30); 

    if (gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        const dist = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);

        if (dist > slipThreshold) {
            gameState.isHooked = false; playClink(0.1, 400);
        } else {
            const target = Math.atan2(gameState.ringY - gameState.bottleBaseY, gameState.ringX - gameState.bottleBaseX);
            gameState.bottleAngle += (target - gameState.bottleAngle) * 0.07;
            gameState.baseVelocity += (gameState.ringX - capX) * 0.04;
        }
    } else {
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle >= 0) {
            if (gameState.bottleAngle !== 0) playClink(0.05, 200);
            gameState.bottleAngle = 0;
            const drift = gameState.originalBaseX - gameState.bottleBaseX;
            if (Math.abs(drift) > 0.5) gameState.baseVelocity += drift * 0.01;
            else { gameState.bottleBaseX = gameState.originalBaseX; gameState.baseVelocity = 0; }
        }
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < -60 || gameState.bottleBaseX > canvas.width + 60) triggerGameOver("BOTTLE FELL!");

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0; 

    // Time Bar
    const prog = gameState.timeLeft / gameState.maxTime;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(canvas.width - 25, 125, 8, 200);
    ctx.fillStyle = prog > 0.5 ? "#10b981" : (prog > 0.25 ? "#fbbf24" : "#ef4444");
    ctx.fillRect(canvas.width - 25, 125 + (200 * (1 - prog)), 8, 200 * prog);

    // Table line
    ctx.strokeStyle = `#334155`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 22); ctx.lineTo(canvas.width, gameState.bottleBaseY + 22); ctx.stroke();

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    const grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, "#064e3b"); grad.addColorStop(0.4, "#10b981"); grad.addColorStop(1, "#064e3b");
    ctx.fillStyle = grad;
    ctx.fillRect(0, -21, 130, 42); 
    ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; ctx.fillRect(170, -10, 10, 20);
    ctx.restore();

    // Rope
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 0);
    ctx.quadraticCurveTo((canvas.width/2 + gameState.ringX)/2, (gameState.ringY)/2 + (gameState.isHooked ? -10 : 30), gameState.ringX, gameState.ringY);
    ctx.stroke();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    // Confetti
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 4, 4);
    });
    ctx.globalAlpha = 1.0;
}

function triggerGameOver(reason) {
    gameState.gameOver = true;
    playClink(0.3, 100);
    document.querySelector("#gameOverOverlay h2").textContent = reason;
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver) return;
    if (gameState.bottleAngle <= -Math.PI/2 * 0.97 && Math.abs(gameState.baseVelocity) < 0.2) {
        gameState.hasWon = true; gameState.isHooked = false; gameState.baseVelocity = 0;
        gameState.score += 100; playWinSound();
        document.getElementById("score").textContent = gameState.score;
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }
        for(let i=0; i<40; i++) gameState.confetti.push({x: gameState.bottleBaseX, y: gameState.bottleBaseY - 120, vx: (Math.random()-0.5)*12, vy: -Math.random()*10-5, color: `hsl(${Math.random()*360}, 100%, 50%)`, life: 1});
        
        setTimeout(() => {
            gameState.hasWon = false; 
            gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            gameState.bottleAngle = 0; 
            gameState.bottleBaseX = gameState.originalBaseX;
            gameState.maxTime = Math.max(20 - (gameState.level - 1), 10);
            gameState.timeLeft = gameState.maxTime;
            gameState.lastTime = performance.now();
            updateLevelSidebar();
            resetRing();
        }, 2000);
    }
}

// Events
canvas.addEventListener('mousedown', (e) => {
    if (gameState.paused || gameState.gameOver || gameState.hasWon) return;
    const pos = getMousePos(e);
    if (Math.hypot(pos.x - gameState.ringX, pos.y - gameState.ringY) < 50) gameState.isDragging = true;
});
window.addEventListener('mousemove', (e) => {
    if (gameState.isDragging) {
        const pos = getMousePos(e);
        gameState.ringX = pos.x; gameState.ringY = pos.y;
        if (!gameState.isHooked) {
            const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
            const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
            if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 35) {
                gameState.isHooked = true; playClink(0.2);
            }
        }
    }
});
window.addEventListener('mouseup', () => { gameState.isDragging = false; });

document.getElementById("startBtn").onclick = () => { document.getElementById("tutorialOverlay").classList.add("hidden"); gameState.paused = false; init(); };
document.getElementById("restartBtn").onclick = () => { document.getElementById("gameOverOverlay").classList.add("hidden"); init(); gameState.paused = false; };
document.getElementById("pauseBtn").onclick = () => { gameState.paused = true; document.getElementById("pauseOverlay").classList.remove("hidden"); };
document.getElementById("resumeBtn").onclick = () => { gameState.paused = false; gameState.lastTime = performance.now(); document.getElementById("pauseOverlay").classList.add("hidden"); };
document.getElementById("resetBtn").onclick = () => location.reload();

window.onload = () => {
    init();
    const loop = () => { updatePhysics(); checkWin(); drawGame(); requestAnimationFrame(loop); };
    loop();
};
