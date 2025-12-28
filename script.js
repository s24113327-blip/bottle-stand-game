const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// --- AUDIO ENGINE ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClink(volume = 0.1, freq = 1200) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.1);
}

function playWinSound() {
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.12);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.12 + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.12);
        osc.stop(audioCtx.currentTime + i * 0.12 + 0.4);
    });
}

// --- GAME STATE ---
const gameState = {
    paused: true,
    gameOver: false,
    level: 1,
    score: 0,
    lives: 3,
    timeLeft: 30,
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
    confetti: [],
    bottleHue: 150 
};

let timerInterval;

function init() {
    canvas.width = 800;
    canvas.height = 450;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.82;
    gameState.score = 0;
    gameState.lives = 3;
    gameState.level = 1;
    gameState.gameOver = false;
    updateUI();
    resetLevelTimer();
    resetRing();
}

function updateUI() {
    document.getElementById("score").textContent = gameState.score;
    document.getElementById("level").textContent = gameState.level;
    document.getElementById("lives").textContent = gameState.lives;
    document.getElementById("timer").textContent = Math.ceil(gameState.timeLeft);
    document.getElementById("bestScore").textContent = gameState.bestScore;
}

function resetLevelTimer() {
    clearInterval(timerInterval);
    // Timer decreases: L1=30s, L10=12s
    gameState.timeLeft = Math.max(30 - (gameState.level * 2), 10);
    timerInterval = setInterval(() => {
        if (!gameState.paused && !gameState.gameOver && !gameState.hasWon) {
            gameState.timeLeft -= 1;
            document.getElementById("timer").textContent = Math.max(0, Math.ceil(gameState.timeLeft));
            if (gameState.timeLeft <= 0) {
                failAttempt("TIME OUT!");
            }
        }
    }, 1000);
}

function failAttempt(reason) {
    gameState.lives -= 1;
    playClink(0.3, 150);
    document.getElementById("status").textContent = reason;
    
    if (gameState.lives <= 0) {
        triggerGameOver(reason);
    } else {
        gameState.bottleAngle = 0;
        gameState.bottleBaseX = gameState.originalBaseX;
        gameState.baseVelocity = 0;
        resetRing();
        updateUI();
    }
}

function triggerGameOver(reason) {
    gameState.gameOver = true;
    clearInterval(timerInterval);
    document.getElementById("failReason").textContent = reason;
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.ringX = canvas.width / 2;
    gameState.ringY = 150;
}

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
}

function handleMovement(pos) {
    if (!gameState.isDragging || gameState.paused || gameState.hasWon || gameState.gameOver) return;
    gameState.ringX = pos.x;
    gameState.ringY = pos.y;

    if (!gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 25) {
            gameState.isHooked = true;
            playClink(0.2, 1400);
            document.getElementById("status").textContent = "HOOKED!";
        }
    }
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;
    gameState.wind += 0.02;

    const levelMod = Math.min(gameState.level, 10);
    const gravity = 0.035 + (levelMod * 0.007);
    const friction = Math.min(0.90 + (levelMod * 0.007), 0.975); 
    const slipThreshold = Math.max(55 - (levelMod * 1.5), 32);

    if (gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        const tension = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);

        if (tension > slipThreshold) {
            gameState.isHooked = false;
            document.getElementById("status").textContent = "SLIPPED!";
        } else {
            const targetAngle = Math.atan2(gameState.ringY - gameState.bottleBaseY, gameState.ringX - gameState.bottleBaseX);
            gameState.bottleAngle += (targetAngle - gameState.bottleAngle) * 0.07;
            const uprightFactor = Math.abs(Math.sin(gameState.bottleAngle)); 
            const horizontalPull = (gameState.ringX - capX) * 0.045;
            gameState.baseVelocity += horizontalPull * (1 + uprightFactor);
        }
    } else {
        if (gameState.bottleAngle < 0) {
            gameState.bottleAngle += gravity;
            if (gameState.bottleAngle >= 0) {
                gameState.bottleAngle = 0;
                playClink(0.05, 300);
            }
        }
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    if (gameState.bottleBaseX < -50 || gameState.bottleBaseX > canvas.width + 50) {
        failAttempt("FELL OFF TABLE!");
    }

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const tableHue = Math.max(210 - (gameState.level * 20), 0);
    ctx.strokeStyle = `hsl(${tableHue}, 60%, 25%)`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 22); ctx.lineTo(canvas.width, gameState.bottleBaseY + 22); ctx.stroke();

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath(); ctx.ellipse(gameState.bottleBaseX, gameState.bottleBaseY + 20, 50, 10, 0, 0, Math.PI * 2); ctx.fill();

    const sway = Math.sin(gameState.wind) * 15;
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 20);
    const cpX = (canvas.width/2 + gameState.ringX)/2 + (gameState.isHooked ? 0 : sway);
    const cpY = (20 + gameState.ringY)/2 + (gameState.isHooked ? -10 : 30);
    ctx.quadraticCurveTo(cpX, cpY, gameState.ringX, gameState.ringY); ctx.stroke();

    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    
    // Custom Level-Based Hue
    const currentHue = (gameState.bottleHue + (gameState.level * 50)) % 360;
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, `hsl(${currentHue}, 80%, 15%)`); 
    g.addColorStop(0.4, `hsl(${currentHue}, 90%, 50%)`); 
    g.addColorStop(1, `hsl(${currentHue}, 80%, 15%)`);
    
    ctx.fillStyle = g;
    if (gameState.bottleAngle < -Math.PI / 3) {
        ctx.shadowBlur = 20; ctx.shadowColor = `hsl(${currentHue}, 100%, 50%)`;
    }
    ctx.beginPath(); ctx.roundRect(0, -21, 130, 42, [5, 15, 15, 5]); ctx.fill();
    ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; 
    ctx.beginPath(); ctx.roundRect(170, -10, 10, 20, 3); ctx.fill();
    ctx.restore();

    const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
    const tension = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);
    ctx.strokeStyle = (gameState.isHooked && tension > 38) ? "#ff4444" : (gameState.isHooked ? "#ff007f" : "#fff");
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, 4, 4);
    });
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver) return;
    if (gameState.bottleAngle <= -Math.PI/2 * 0.96 && Math.abs(gameState.baseVelocity) < 0.2) {
        gameState.hasWon = true;
        gameState.score += (gameState.level * 100);
        playWinSound();
        updateUI();

        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
        }

        document.getElementById("status").textContent = "EXCELLENT! 🏮";
        for(let i=0; i<50; i++) {
            gameState.confetti.push({
                x: gameState.bottleBaseX, y: gameState.bottleBaseY - 120,
                vx: (Math.random()-0.5)*15, vy: -Math.random()*10-5, color: `hsl(${Math.random()*360}, 100%, 50%)`, life: 1
            });
        }
        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            gameState.lives = 3; // Reset lives for new level
            gameState.bottleAngle = 0;
            gameState.bottleBaseX = gameState.originalBaseX;
            resetRing();
            resetLevelTimer();
            updateUI();
            document.getElementById("status").textContent = "LEVEL " + gameState.level;
        }, 2000);
    }
}

canvas.onmousedown = (e) => {
    if (gameState.paused || gameState.gameOver) return;
    const pos = getMousePos(e);
    if (Math.hypot(pos.x - gameState.ringX, pos.y - gameState.ringY) < 40) gameState.isDragging = true;
};
window.onmousemove = (e) => handleMovement(getMousePos(e));
window.onmouseup = () => gameState.isDragging = false;

document.getElementById("startBtn").onclick = () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
};
document.getElementById("restartBtn").onclick = () => {
    document.getElementById("gameOverOverlay").classList.add("hidden");
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
