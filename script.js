const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let audioCtx = null;

function initAudio() {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { console.error("Audio not supported"); }
}

function playClink(v = 0.1, f = 1200) {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.frequency.setValueAtTime(f, audioCtx.currentTime);
    g.gain.setValueAtTime(v, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 0.1);
    triggerShake(4); 
}

function playWinSound() {
    if (!audioCtx || audioCtx.state !== 'running') return;
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
    bottleAngle: 0, bottleBaseX: 300, originalBaseX: 300, 
    ringX: 400, ringY: 150, isDragging: false, isHooked: false,
    baseVelocity: 0, confetti: [], smoke: [], rain: [],
    timeLeft: 20, maxTime: 20, lastTime: 0,
    shakeTime: 0, shakeIntensity: 0,
    windForce: 0, windTarget: 0, windLines: [],
    currentPalette: ["#064e3b", "#10b981", "#064e3b"],
    skins: {
        1: ["#064e3b", "#10b981", "#064e3b"], 5: ["#1e3a8a", "#3b82f6", "#1e3a8a"],
        10: ["#7f1d1d", "#ef4444", "#7f1d1d"], 15: ["#171717", "#525252", "#171717"],
        20: ["#4c1d95", "#a855f7", "#4c1d95"]
    }
};

function triggerShake(intensity) {
    gameState.shakeTime = 10;
    gameState.shakeIntensity = intensity;
}

function updateWeather() {
    // 1. STRONGER WIND LOGIC
    if (gameState.level >= 3) {
        // High frequency changes + higher multiplier
        if (Math.random() > 0.95) {
            const intensity = 0.04 + (gameState.level * 0.015); 
            gameState.windTarget = (Math.random() - 0.5) * intensity;
        }
        gameState.windForce += (gameState.windTarget - gameState.windForce) * 0.08;

        if (Math.random() > 0.7) {
            gameState.windLines.push({
                x: gameState.windForce > 0 ? -100 : 900,
                y: Math.random() * 400,
                w: 40 + Math.random() * 60,
                speed: gameState.windForce * 100 + (gameState.windForce > 0 ? 5 : -5)
            });
        }
    }

    // 2. RAIN LOGIC (Starts LV 5)
    if (gameState.level >= 5) {
        if (gameState.rain.length < 100) {
            gameState.rain.push({
                x: Math.random() * 800, y: -20,
                speed: 10 + Math.random() * 10,
                len: 15 + Math.random() * 10
            });
        }
    }
    
    gameState.rain.forEach((r, i) => {
        r.y += r.speed;
        r.x += gameState.windForce * 50; // Rain slants with wind
        if (r.y > 450) { r.y = -20; r.x = Math.random() * 800; }
    });

    for (let i = gameState.windLines.length - 1; i >= 0; i--) {
        let l = gameState.windLines[i];
        l.x += l.speed;
        if (l.x < -150 || l.x > 950) gameState.windLines.splice(i, 1);
    }
}

function updateLevelSidebar() {
    const list = document.getElementById("levelList");
    if (!list) return;
    list.innerHTML = "";
    for (let i = 1; i <= Math.max(5, gameState.level + 2); i++) {
        const li = document.createElement("li");
        li.className = "level-item" + (i < gameState.level ? " cleared" : (i === gameState.level ? " active" : ""));
        li.innerHTML = `<span>LV ${i}</span> <span>${i < gameState.level ? '✓' : (i === gameState.level ? 'LIVE' : '🔒')}</span>`;
        list.appendChild(li);
    }
}

function checkObjectives() {
    let unlockedLv = 1;
    if (gameState.level >= 20) unlockedLv = 20;
    else if (gameState.level >= 15) unlockedLv = 15;
    else if (gameState.level >= 10) unlockedLv = 10;
    else if (gameState.level >= 5) unlockedLv = 5;
    gameState.currentPalette = gameState.skins[unlockedLv];
    
    document.querySelectorAll('.dot').forEach((dot, idx) => {
        const thresholds = [1, 5, 10, 15, 20];
        if (gameState.level >= thresholds[idx]) dot.classList.add('active');
    });
}

function init() {
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleAngle = 0;
    gameState.gameOver = false; 
    gameState.timeLeft = 20;
    gameState.baseVelocity = 0;
    gameState.hasWon = false;
    gameState.confetti = [];
    gameState.windLines = [];
    gameState.rain = [];
    gameState.windForce = 0;
    gameState.windTarget = 0;
    document.getElementById("score").textContent = gameState.score;
    document.getElementById("level").textContent = gameState.level;
    document.getElementById("bestScore").textContent = gameState.bestScore;
    updateLevelSidebar();
    checkObjectives();
    resetRing();
}

function resetRing() {
    gameState.isHooked = false; 
    gameState.isDragging = false;
    gameState.ringX = 400; 
    gameState.ringY = 150;
}

function updatePhysics() {
    if (gameState.paused || gameState.gameOver) return;
    
    if (gameState.hasWon) {
        gameState.confetti.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
            if(p.life <= 0) gameState.confetti.splice(i, 1);
        });
        return;
    }

    const now = performance.now();
    const dt = (now - gameState.lastTime) / 1000;
    gameState.lastTime = now;
    gameState.timeLeft -= dt;
    
    updateWeather();

    if (gameState.timeLeft <= 0) triggerGameOver("TIME'S UP!");

    // Gravity becomes more "slippery" at high levels
    const gravity = 0.045 + (Math.min(gameState.level, 20) * 0.006); 
    const friction = 0.965; // Slightly less friction = harder to stop

    const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const capY = 350 + Math.sin(gameState.bottleAngle) * 170;

    // Apply Wind Force to Bottle
    gameState.baseVelocity += gameState.windForce;

    if (gameState.isHooked) {
        const dist = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);
        if (dist > 80) {
            gameState.isHooked = false; 
            playClink(0.1, 400);
        } else {
            const targetAngle = Math.atan2(gameState.ringY - 350, gameState.ringX - gameState.bottleBaseX);
            gameState.bottleAngle += (targetAngle - gameState.bottleAngle) * 0.12;
            gameState.baseVelocity += (gameState.ringX - capX) * 0.04;
        }
    } else {
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle > 0) {
            if (gameState.bottleAngle > 0.1) playClink(0.05, 200);
            gameState.bottleAngle = 0;
        }
        gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.035;
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < 30 || gameState.bottleBaseX > 770) triggerGameOver("BOTTLE FELL!");

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.save();
    if (gameState.shakeTime > 0) {
        ctx.translate((Math.random()-0.5)*gameState.shakeIntensity, (Math.random()-0.5)*gameState.shakeIntensity);
        gameState.shakeTime--;
    }

    ctx.clearRect(0, 0, 800, 450);

    // Wind Lines (Background)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
    ctx.lineWidth = 1;
    gameState.windLines.forEach(l => {
        ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.w, l.y); ctx.stroke();
    });

    // Rain
    ctx.strokeStyle = "rgba(0, 242, 255, 0.3)";
    ctx.lineWidth = 1;
    gameState.rain.forEach(r => {
        ctx.beginPath();
        ctx.moveTo(r.x, r.y);
        // Rain slants based on wind
        ctx.lineTo(r.x + (gameState.windForce * 100), r.y + r.len);
        ctx.stroke();
    });

    // Table Line
    ctx.shadowBlur = 15; ctx.shadowColor = "#00f2ff";
    ctx.fillStyle = "#00f2ff"; ctx.fillRect(0, 350, 800, 4);
    ctx.shadowBlur = 0;

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, 350); ctx.rotate(gameState.bottleAngle);
    ctx.shadowBlur = 20; ctx.shadowColor = gameState.currentPalette[1];
    const grad = ctx.createLinearGradient(0, -42, 0, 0);
    grad.addColorStop(0, gameState.currentPalette[0]); grad.addColorStop(0.5, gameState.currentPalette[1]); grad.addColorStop(1, gameState.currentPalette[2]);
    ctx.fillStyle = grad;
    ctx.roundRect(0, -42, 130, 42, 8); ctx.fill();
    ctx.fillRect(130, -31, 40, 20);
    ctx.fillStyle = "#ff4444"; ctx.fillRect(170, -33, 10, 24);
    ctx.restore();

    // Curved Rope
    ctx.strokeStyle = gameState.isHooked ? "#39ff14" : "#666"; 
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(400, 0);
    const controlX = (400 + gameState.ringX) / 2 + (gameState.windForce * 2500); // Stronger curve
    const controlY = (0 + gameState.ringY) / 2;
    ctx.quadraticCurveTo(controlX, controlY, gameState.ringX, gameState.ringY);
    ctx.stroke();

    // Ring
    ctx.strokeStyle = gameState.isHooked ? "#39ff14" : "#fff"; 
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    // UI Timer Bar
    const prog = Math.max(0, gameState.timeLeft / gameState.maxTime);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)"; ctx.fillRect(780, 125, 8, 200);
    ctx.fillStyle = prog > 0.5 ? "#39ff14" : (prog > 0.25 ? "#ffeb3b" : "#ff4444");
    ctx.fillRect(780, 125 + (200 * (1 - prog)), 8, 200 * prog);

    // Confetti
    gameState.confetti.forEach(p => { 
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life; ctx.fillRect(p.x, p.y, 5, 5); 
    });
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

function triggerGameOver(reason) {
    gameState.gameOver = true;
    document.getElementById("deathReason").textContent = reason;
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver || gameState.paused) return;
    // Win condition: Bottle is vertical and stable despite the wind!
    if (gameState.bottleAngle <= -1.46 && Math.abs(gameState.baseVelocity) < 0.3) {
        gameState.hasWon = true; gameState.score += 100; playWinSound(); triggerShake(12);
        for(let i=0; i<80; i++) {
            gameState.confetti.push({
                x: gameState.bottleBaseX + 60, y: 280, vx: (Math.random()-0.5)*15, 
                vy: (Math.random()-0.5)*15 - 5, color: `hsl(${Math.random()*360}, 100%, 50%)`, life: 1.0
            });
        }
        document.getElementById("score").textContent = gameState.score;
        setTimeout(() => { gameState.level++; init(); gameState.lastTime = performance.now(); }, 2000);
    }
}

// Button Listeners
document.getElementById("pauseBtn").onclick = () => {
    gameState.paused = true;
    document.getElementById("pauseOverlay").classList.remove("hidden");
};
document.getElementById("resumeBtn").onclick = () => {
    initAudio();
    gameState.paused = false;
    gameState.lastTime = performance.now();
    document.getElementById("pauseOverlay").classList.add("hidden");
};
document.getElementById("resetBtn").onclick = () => location.reload();
document.getElementById("startBtn").onclick = () => {
    initAudio(); gameState.paused = false;
    document.getElementById("tutorialOverlay").classList.add("hidden");
    init(); gameState.lastTime = performance.now();
};
document.getElementById("restartBtn").onclick = () => {
    initAudio(); gameState.paused = false;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
    init(); gameState.lastTime = performance.now();
};

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (450 / rect.height);
    if (Math.hypot(x - gameState.ringX, y - gameState.ringY) < 60) gameState.isDragging = true;
});

window.addEventListener('mousemove', (e) => {
    if (gameState.isDragging && !gameState.paused) {
        const rect = canvas.getBoundingClientRect();
        gameState.ringX = (e.clientX - rect.left) * (800 / rect.width);
        gameState.ringY = (e.clientY - rect.top) * (450 / rect.height);
        if (!gameState.isHooked) {
            const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
            const capY = 350 + Math.sin(gameState.bottleAngle) * 170;
            if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 30) {
                gameState.isHooked = true; playClink(0.2);
            }
        }
    }
});

window.addEventListener('mouseup', () => gameState.isDragging = false);

window.onload = () => { 
    canvas.width = 800; canvas.height = 450; init();
    const loop = () => { updatePhysics(); checkWin(); drawGame(); requestAnimationFrame(loop); }; 
    loop(); 
};
