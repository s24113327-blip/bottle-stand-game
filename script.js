const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
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

const gameState = {
    paused: true, gameOver: false, hasWon: false,
    level: 1, score: 0, bestScore: localStorage.getItem("standByMeBest") || 0,
    bottleAngle: 0, bottleBaseX: 0, originalBaseX: 0, bottleBaseY: 0,
    ringX: 400, ringY: 150, isDragging: false, isHooked: false,
    baseVelocity: 0, wind: 0, confetti: [],
    timeLeft: 20, maxTime: 20, lastTime: 0,
    currentPalette: ["#064e3b", "#10b981", "#064e3b"],
    skins: {
        1: ["#064e3b", "#10b981", "#064e3b"],
        5: ["#1e3a8a", "#3b82f6", "#1e3a8a"],
        10: ["#7f1d1d", "#ef4444", "#7f1d1d"],
        15: ["#171717", "#525252", "#171717"],
        20: ["#4c1d95", "#a855f7", "#4c1d95"]
    }
};

function checkObjectives() {
    let unlockedLv = 1;
    if (gameState.level >= 20) unlockedLv = 20;
    else if (gameState.level >= 15) unlockedLv = 15;
    else if (gameState.level >= 10) unlockedLv = 10;
    else if (gameState.level >= 5) unlockedLv = 5;

    gameState.currentPalette = gameState.skins[unlockedLv];
    const skinText = document.getElementById("skinStatus");
    
    const targets = {5:"Sapphire", 10:"Ruby", 15:"Obsidian", 20:"Royal"};
    let next = Object.keys(targets).find(lv => lv > gameState.level);
    skinText.innerHTML = next ? `Next: Lv ${next} ${targets[next]}` : "✨ Max Skins!";

    document.querySelectorAll('.dot').forEach((dot, idx) => {
        const thresholds = [1, 5, 10, 15, 20];
        if (gameState.level >= thresholds[idx]) dot.classList.add('active');
    });
}

function updateLevelSidebar() {
    const list = document.getElementById("levelList");
    list.innerHTML = "";
    for (let i = 1; i <= Math.max(5, gameState.level + 2); i++) {
        const li = document.createElement("li");
        li.className = "level-item" + (i < gameState.level ? " cleared" : (i === gameState.level ? " active" : ""));
        li.innerHTML = `<span>Level ${i}</span> <span>${i < gameState.level ? '✓' : (i === gameState.level ? 'LIVE' : '🔒')}</span>`;
        list.appendChild(li);
    }
}

function init() {
    gameState.originalBaseX = 320;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = 370;
    gameState.score = 0; gameState.level = 1;
    gameState.gameOver = false; gameState.timeLeft = 20;
    document.getElementById("bestScore").textContent = gameState.bestScore;
    updateLevelSidebar();
    checkObjectives();
    resetRing();
}

function resetRing() {
    gameState.isHooked = false; gameState.isDragging = false;
    gameState.ringX = 400; gameState.ringY = 150;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * (800 / rect.width), y: (e.clientY - rect.top) * (450 / rect.height) };
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;
    const now = performance.now();
    const dt = (now - gameState.lastTime) / 1000;
    gameState.lastTime = now;
    gameState.timeLeft -= dt;

    if (gameState.timeLeft <= 0) triggerGameOver("TIME'S UP!");

    const statusEl = document.getElementById("status");
    statusEl.textContent = gameState.isHooked ? "STEADY..." : "Hook the Cap!";
    statusEl.style.color = (gameState.timeLeft < 5 && Math.floor(now / 200) % 2 === 0) ? "#ff4444" : "white";

    const levelMod = Math.min(gameState.level, 20);
    const gravity = 0.035 + (levelMod * 0.003); 
    const friction = 0.95;

    if (gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) > 50) {
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
            gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.01;
        }
    }
    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < -50 || gameState.bottleBaseX > 850) triggerGameOver("BOTTLE FELL!");

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, 800, 450);
    ctx.globalAlpha = 1.0; 

    // Time Bar
    const prog = gameState.timeLeft / gameState.maxTime;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(775, 125, 10, 200);
    ctx.fillStyle = prog > 0.5 ? "#10b981" : (prog > 0.25 ? "#fbbf24" : "#ef4444");
    ctx.fillRect(775, 125 + (200 * (1 - prog)), 10, 200 * prog);

    // Table
    ctx.fillStyle = "#334155"; ctx.fillRect(0, 390, 800, 4);

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, gameState.currentPalette[0]); g.addColorStop(0.4, gameState.currentPalette[1]); g.addColorStop(1, gameState.currentPalette[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, -21, 130, 42); ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; ctx.fillRect(170, -10, 10, 20);
    ctx.restore();

    // Rope & Ring
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(400, 0);
    ctx.quadraticCurveTo((400 + gameState.ringX)/2, (gameState.ringY)/2 + 30, gameState.ringX, gameState.ringY);
    ctx.stroke();
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    gameState.confetti.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 4, 4); });
    ctx.globalAlpha = 1.0;
}

function triggerGameOver(reason) {
    gameState.gameOver = true;
    document.getElementById("deathReason").textContent = reason;
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver) return;
    if (gameState.bottleAngle <= -1.5 && Math.abs(gameState.baseVelocity) < 0.2) {
        gameState.hasWon = true; gameState.score += 100; playWinSound();
        document.getElementById("score").textContent = gameState.score;
        for(let i=0; i<40; i++) gameState.confetti.push({x: gameState.bottleBaseX, y: 250, vx: (Math.random()-0.5)*10, vy: -Math.random()*10, color: `hsl(${Math.random()*360},100%,50%)`, life: 1});
        
        setTimeout(() => {
            gameState.hasWon = false; gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            gameState.bottleAngle = 0; gameState.bottleBaseX = gameState.originalBaseX;
            gameState.maxTime = Math.max(20 - (gameState.level - 1), 10);
            gameState.timeLeft = gameState.maxTime;
            gameState.lastTime = performance.now();
            checkObjectives();
            updateLevelSidebar();
            resetRing();
        }, 2000);
    }
}

canvas.addEventListener('mousedown', (e) => {
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
            if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 30) {
                gameState.isHooked = true; playClink(0.2);
            }
        }
    }
});
window.addEventListener('mouseup', () => gameState.isDragging = false);

document.getElementById("startBtn").onclick = () => { document.getElementById("tutorialOverlay").classList.add("hidden"); gameState.paused = false; init(); };
document.getElementById("restartBtn").onclick = () => { document.getElementById("gameOverOverlay").classList.add("hidden"); init(); gameState.paused = false; };
document.getElementById("pauseBtn").onclick = () => { gameState.paused = true; document.getElementById("pauseOverlay").classList.remove("hidden"); };
document.getElementById("resumeBtn").onclick = () => { gameState.paused = false; gameState.lastTime = performance.now(); document.getElementById("pauseOverlay").classList.add("hidden"); };
document.getElementById("resetBtn").onclick = () => location.reload();

window.onload = () => { canvas.width = 800; canvas.height = 450; init(); const loop = () => { updatePhysics(); checkWin(); drawGame(); requestAnimationFrame(loop); }; loop(); };
