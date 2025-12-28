const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
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

function updateSmoke() {
    if (Math.random() > 0.92) { 
        gameState.smoke.push({
            x: Math.random() * 800,
            y: 450,
            vx: (Math.random() - 0.5) * 0.4,
            vy: -Math.random() * 0.6 - 0.3,
            size: Math.random() * 40 + 30,
            opacity: 0.25 
        });
    }
    for (let i = gameState.smoke.length - 1; i >= 0; i--) {
        let s = gameState.smoke[i];
        s.x += s.vx; s.y += s.vy;
        s.opacity -= 0.001;
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
    
    document.querySelectorAll('.dot').forEach((dot, idx) => {
        const thresholds = [1, 5, 10, 15, 20];
        if (gameState.level >= thresholds[idx]) dot.classList.add('active');
    });
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

function init() {
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleAngle = 0;
    gameState.score = 0; 
    gameState.level = 1;
    gameState.gameOver = false; 
    gameState.timeLeft = 20;
    gameState.baseVelocity = 0;
    document.getElementById("score").textContent = "0";
    document.getElementById("level").textContent = "1";
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
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;
    const now = performance.now();
    const dt = (now - gameState.lastTime) / 1000;
    gameState.lastTime = now;
    gameState.timeLeft -= dt;
    updateSmoke();

    if (gameState.timeLeft <= 0) triggerGameOver("TIME'S UP!");

    const gravity = 0.04 + (Math.min(gameState.level, 20) * 0.005); 
    const friction = 0.96;

    if (gameState.isHooked) {
        // Calculate the cap position relative to the base and current angle
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = 350 + Math.sin(gameState.bottleAngle) * 170;
        
        const dist = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);
        
        if (dist > 65) {
            gameState.isHooked = false; 
            playClink(0.1, 400);
        } else {
            // Pull the bottle toward the ring position
            const targetAngle = Math.atan2(gameState.ringY - 350, gameState.ringX - gameState.bottleBaseX);
            gameState.bottleAngle += (targetAngle - gameState.bottleAngle) * 0.12;
            // The base slides if the ring pulls hard horizontally
            gameState.baseVelocity += (gameState.ringX - capX) * 0.05;
        }
    } else {
        // Gravity pulls the bottle back to the floor (0 radians)
        if (gameState.bottleAngle < 0) {
            gameState.bottleAngle += gravity;
        }
        if (gameState.bottleAngle > 0) gameState.bottleAngle = 0;

        // Slide the base back to the center of the table
        gameState.baseVelocity += (gameState.originalBaseX - gameState.bottleBaseX) * 0.03;
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < 50 || gameState.bottleBaseX > 750) triggerGameOver("BOTTLE FELL!");

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, 800, 450);

    // 1. Smoke (Background)
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

    // 2. Floor / Table
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#00f2ff";
    ctx.fillStyle = "#00f2ff"; 
    ctx.fillRect(0, 350, 800, 4);
    ctx.shadowBlur = 0;

    // 3. Bottle Shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(gameState.bottleBaseX + 85, 360, 90, 8, 0, 0, Math.PI*2);
    ctx.fill();

    // 4. Bottle Drawing
    ctx.save();
    ctx.translate(gameState.bottleBaseX, 350); 
    ctx.rotate(gameState.bottleAngle);
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = gameState.currentPalette[1];
    
    const grad = ctx.createLinearGradient(0, -20, 0, 20);
    grad.addColorStop(0, gameState.currentPalette[0]); 
    grad.addColorStop(0.5, gameState.currentPalette[1]); 
    grad.addColorStop(1, gameState.currentPalette[2]);
    
    ctx.fillStyle = grad;
    // Bottle Body
    ctx.beginPath();
    ctx.roundRect(0, -21, 130, 42, 5);
    ctx.fill();
    // Neck
    ctx.fillRect(130, -10, 40, 20);
    // Cap
    ctx.fillStyle = "#ff4444"; 
    ctx.fillRect(170, -12, 10, 24);
    ctx.restore();

    // 5. Timer UI
    const prog = Math.max(0, gameState.timeLeft / gameState.maxTime);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(780, 125, 8, 200);
    ctx.fillStyle = prog > 0.5 ? "#39ff14" : (prog > 0.25 ? "#ffeb3b" : "#ff4444");
    ctx.fillRect(780, 125 + (200 * (1 - prog)), 8, 200 * prog);

    // 6. Rope
    ctx.strokeStyle = gameState.isHooked ? "#39ff14" : "#444"; 
    ctx.lineWidth = 2;
    ctx.beginPath(); 
    ctx.moveTo(400, 0);
    ctx.lineTo(gameState.ringX, gameState.ringY - 22);
    ctx.stroke();

    // 7. Ring
    ctx.strokeStyle = gameState.isHooked ? "#39ff14" : "#fff"; 
    ctx.lineWidth = 4;
    ctx.beginPath(); 
    ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); 
    ctx.stroke();

    // 8. Confetti
    gameState.confetti.forEach(p => { 
        ctx.fillStyle = p.color; 
        ctx.globalAlpha = p.life; 
        ctx.fillRect(p.x, p.y, 5, 5); 
    });
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
    // Upright is -PI/2 (approx -1.57)
    if (gameState.bottleAngle <= -1.48 && Math.abs(gameState.baseVelocity) < 0.25) {
        gameState.hasWon = true; 
        gameState.score += 100; 
        playWinSound();
        document.getElementById("score").textContent = gameState.score;
        
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }
        
        for(let i=0; i<40; i++) {
            gameState.confetti.push({
                x: gameState.bottleBaseX, 
                y: 250, 
                vx: (Math.random()-0.5)*10, 
                vy: -Math.random()*10, 
                color: `hsl(${Math.random()*360},100%,50%)`, 
                life: 1
            });
        }

        setTimeout(() => {
            gameState.hasWon = false; 
            gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            gameState.bottleAngle = 0; 
            gameState.bottleBaseX = gameState.originalBaseX;
            gameState.timeLeft = 20;
            gameState.lastTime = performance.now();
            checkObjectives(); 
            updateLevelSidebar(); 
            resetRing();
        }, 2000);
    }
}

// Controls
document.getElementById("startBtn").onclick = () => { 
    initAudio(); 
    document.getElementById("tutorialOverlay").classList.add("hidden"); 
    gameState.paused = false; 
    gameState.lastTime = performance.now(); 
    init(); 
};
document.getElementById("restartBtn").onclick = () => { 
    initAudio(); 
    document.getElementById("gameOverOverlay").classList.add("hidden"); 
    init(); 
    gameState.paused = false; 
    gameState.lastTime = performance.now(); 
};
document.getElementById("resumeBtn").onclick = () => { 
    initAudio(); 
    gameState.paused = false; 
    gameState.lastTime = performance.now(); 
    document.getElementById("pauseOverlay").classList.add("hidden"); 
};
document.getElementById("pauseBtn").onclick = () => { 
    gameState.paused = true; 
    document.getElementById("pauseOverlay").classList.remove("hidden"); 
};
document.getElementById("resetBtn").onclick = () => location.reload();

canvas.addEventListener('mousedown', (e) => {
    initAudio();
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (800 / rect.width);
    const y = (e.clientY - rect.top) * (450 / rect.height);
    if (Math.hypot(x - gameState.ringX, y - gameState.ringY) < 55) gameState.isDragging = true;
});

window.addEventListener('mousemove', (e) => {
    if (gameState.isDragging && !gameState.paused) {
        const rect = canvas.getBoundingClientRect();
        gameState.ringX = (e.clientX - rect.left) * (800 / rect.width);
        gameState.ringY = (e.clientY - rect.top) * (450 / rect.height);
        
        if (!gameState.isHooked) {
            const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
            const capY = 350 + Math.sin(gameState.bottleAngle) * 170;
            if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 32) {
                gameState.isHooked = true; 
                playClink(0.2);
            }
        }
    }
});

window.addEventListener('mouseup', () => gameState.isDragging = false);

window.onload = () => { 
    canvas.width = 800; 
    canvas.height = 450; 
    init(); 
    const loop = () => { 
        updatePhysics(); 
        checkWin(); 
        drawGame(); 
        requestAnimationFrame(loop); 
    }; 
    loop(); 
};
