const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let audioCtx;

// --- AUDIO SYSTEM WITH UNLOCK ---
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playClink(v = 0.1, f = 1200) {
    if (!audioCtx) return;
    initAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.1);
}

function playWinSound() {
    if (!audioCtx) return;
    initAudio();
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
    bottleAngle: 0, bottleBaseX: 320, originalBaseX: 320, bottleBaseY: 350,
    ringX: 400, ringY: 150, isDragging: false, isHooked: false,
    baseVelocity: 0, confetti: [], smoke: [],
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

// --- SUBTLE SMOKE LOGIC ---
function updateSmoke() {
    if (Math.random() > 0.96) { // Reduced frequency
        gameState.smoke.push({
            x: Math.random() * 800,
            y: 450,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -Math.random() * 0.5 - 0.2,
            size: Math.random() * 30 + 20,
            opacity: 0.15 // Fainter
        });
    }
    for (let i = gameState.smoke.length - 1; i >= 0; i--) {
        let s = gameState.smoke[i];
        s.x += s.vx; s.y += s.vy;
        s.opacity -= 0.0005;
        if (s.opacity <= 0) gameState.smoke.splice(i, 1);
    }
}

function checkObjectives() {
    let unlockedLv = 1;
    if (gameState.level >= 20) unlockedLv = 20;
    else if (gameState.level >= 15) unlockedLv = 15;
    else if (gameState.level >= 10) unlockedLv = 10;
    else if (gameState.level >= 5) unlockedLv = 5;
    gameState.currentPalette = gameState.skins[unlockedLv];
    
    document.getElementById("skinStatus").textContent = 
        Object.keys(gameState.skins).find(lv => lv > gameState.level) ? 
        `Next: Lv ${Object.keys(gameState.skins).find(lv => lv > gameState.level)}` : "MAX SKINS";

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
        li.innerHTML = `<span>LV ${i}</span> <span>${i < gameState.level ? '✓' : (i === gameState.level ? 'LIVE' : '🔒')}</span>`;
        list.appendChild(li);
    }
}

function init() {
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.score = 0; gameState.level = 1;
    gameState.gameOver = false; gameState.timeLeft = 20;
    document.getElementById("score").textContent = "0";
    document.getElementById("level").textContent = "1";
    document.getElementById("bestScore").textContent = gameState.bestScore;
    updateLevelSidebar();
    checkObjectives();
    resetRing();
}

function resetRing() {
    gameState.isHooked = false; gameState.isDragging = false;
    gameState.ringX = 400; gameState.ringY = 150;
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;
    const now = performance.now();
    const dt = (now - gameState.lastTime) / 1000;
    gameState.lastTime = now;
    gameState.timeLeft -= dt;
    updateSmoke();

    if (gameState.timeLeft <= 0) triggerGameOver("TIME'S UP!");

    const gravity = 0.038 + (Math.min(gameState.level, 20) * 0.003); 
    const friction = 0.96;

    if (gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) > 55) {
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
            gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.02;
        }
    }
    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < -60 || gameState.bottleBaseX > 860) triggerGameOver("BOTTLE FELL!");

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, 800, 450);

    // 1. Smoke (Background Layer)
    gameState.smoke.forEach(s => {
        ctx.beginPath();
        let g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.size);
        const color = gameState.currentPalette[1];
        g.addColorStop(0, `${color}${Math.floor(s.opacity*255).toString(16).padStart(2,'0')}`);
        g.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g;
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // 2. Table Line (Drawn at Y = 350)
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00f2ff";
    ctx.fillStyle = "#00f2ff"; 
    ctx.fillRect(0, 350, 800, 2);
    ctx.shadowBlur = 0;

    // 3. Bottle (Fixed Offset to sit ON the line)
    ctx.save();
    ctx.translate(gameState.bottleBaseX, 350); // Pivot is exactly on the table line
    ctx.rotate(gameState.bottleAngle);
    ctx.shadowBlur = 15;
    ctx.shadowColor = gameState.currentPalette[1];
    
    const grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, gameState.currentPalette[0]); 
    grad.addColorStop(0.4, gameState.currentPalette[1]); 
    grad.addColorStop(1, gameState.currentPalette[2]);
    
    ctx.fillStyle = grad;
    // Drawn from -21 to +21 so the vertical center is at the pivot point
    // but the bottom edge touches the floor.
    ctx.fillRect(0, -21, 130, 42); 
    ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; 
    ctx.fillRect(170, -10, 10, 20);
    ctx.restore();

    // 4. UI/Rope
    const prog = gameState.timeLeft / gameState.maxTime;
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(780, 125, 8, 200);
    ctx.fillStyle = prog > 0.5 ? "#39ff14" : (prog > 0.25 ? "#ffeb3b" : "#ff4444");
    ctx.fillRect(780, 125 + (200 * (1 - prog)), 8, 200 * prog);

    ctx.strokeStyle = gameState.isHooked ? "#ffeb3b" : "#444"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(400, 0);
    ctx.quadraticCurveTo((400 + gameState.ringX)/2, (gameState.ringY)/2 + 30, gameState.ringX, gameState.ringY);
    ctx.stroke();
    ctx.strokeStyle = gameState.isHooked ? "#ff007f" : "#fff"; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    gameState.confetti.forEach(p => { 
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 4, 4); 
    });
}

// --- BUTTON LOGIC WITH AUDIO UNLOCK ---
document.getElementById("startBtn").onclick = () => { 
    initAudio(); // Unlock audio
    document.getElementById("tutorialOverlay").classList.add("hidden"); 
    gameState.paused = false; gameState.lastTime = performance.now(); init(); 
};
document.getElementById("restartBtn").onclick = () => { 
    initAudio();
    document.getElementById("gameOverOverlay").classList.add("hidden"); 
    init(); gameState.paused = false; gameState.lastTime = performance.now(); 
};
document.getElementById("resumeBtn").onclick = () => { 
    initAudio();
    gameState.paused = false; gameState.lastTime = performance.now(); 
    document.getElementById("pauseOverlay").classList.add("hidden"); 
};

function triggerGameOver(reason) {
    gameState.gameOver = true;
    document.getElementById("deathReason").textContent = reason;
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver) return;
    if (gameState.bottleAngle <= -1.52 && Math.abs(gameState.baseVelocity) < 0.25) {
        gameState.hasWon = true; gameState.score += 100; playWinSound();
        document.getElementById("score").textContent = gameState.score;
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }
        for(let i=0; i<40; i++) gameState.confetti.push({x: gameState.bottleBaseX, y: 250, vx: (Math.random()-0.5)*10, vy: -Math.random()*10, color: `hsl(${Math.random()*360},100%,50%)`, life: 1});
        setTimeout(() => {
            gameState.hasWon = false; gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            gameState.bottleAngle = 0; gameState.bottleBaseX = gameState.originalBaseX;
            gameState.timeLeft = 20;
            gameState.lastTime = performance.now();
            checkObjectives(); updateLevelSidebar(); resetRing();
        }, 2000);
    }
}

canvas.addEventListener('mousedown', (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (450 / rect.height);
    if (Math.hypot(x - gameState.ringX, y - gameState.ringY) < 55) gameState.isDragging = true;
});

window.addEventListener('mousemove', (e) => {
    if (gameState.isDragging) {
        const rect = canvas.getBoundingClientRect();
        gameState.ringX = (e.clientX - rect.left) * (800 / rect.width);
        gameState.ringY = (e.clientY - rect.top) * (450 / rect.height);
        if (!gameState.isHooked) {
            const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
            const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
            if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 32) {
                gameState.isHooked = true; playClink(0.2);
            }
        }
    }
});

window.addEventListener('mouseup', () => gameState.isDragging = false);
document.getElementById("pauseBtn").onclick = () => { gameState.paused = true; document.getElementById("pauseOverlay").classList.remove("hidden"); };
document.getElementById("resetBtn").onclick = () => location.reload();

window.onload = () => { 
    canvas.width = 800; canvas.height = 450; init(); 
    const loop = () => { updatePhysics(); checkWin(); drawGame(); requestAnimationFrame(loop); }; loop(); 
};
