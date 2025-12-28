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
    bestScore: localStorage.getItem("standByMeBest") || 0,
    bottleAngle: 0,
    bottleBaseX: 0,
    originalBaseX: 0,
    bottleBaseY: 0,
    ringX: 400,
    ringY: 150,
    isDragging: false,
    isHooked: false,
    hasWon: false,
    baseVelocity: 0,
    wind: 0,
    confetti: []
};

document.getElementById("bestScore").textContent = gameState.bestScore;

// Helper to map mouse to internal 800x450 resolution
function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

function init() {
    canvas.width = 800;
    canvas.height = 450;
    gameState.originalBaseX = canvas.width / 2 - 80;
    gameState.bottleBaseX = gameState.originalBaseX;
    gameState.bottleBaseY = canvas.height * 0.82;
    gameState.score = 0;
    gameState.level = 1;
    gameState.gameOver = false;
    gameState.hasWon = false;
    gameState.baseVelocity = 0;
    gameState.bottleAngle = 0;
    document.getElementById("score").textContent = "0";
    document.getElementById("level").textContent = "1";
    resetRing();
}

function resetRing() {
    gameState.isHooked = false;
    gameState.isDragging = false;
    gameState.ringX = canvas.width / 2;
    gameState.ringY = 150;
}

function handleMovement(pos) {
    if (!gameState.isDragging || gameState.paused || gameState.hasWon || gameState.gameOver) return;
    
    gameState.ringX = pos.x;
    gameState.ringY = pos.y;

    if (!gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        if (Math.hypot(gameState.ringX - capX, gameState.ringY - capY) < 35) {
            gameState.isHooked = true;
            playClink(0.2);
            document.getElementById("status").textContent = "HOOKED!";
        }
    }
}

function updatePhysics() {
    if (gameState.hasWon || gameState.paused || gameState.gameOver) return;
    
    gameState.wind += 0.02;

    // GRADUAL DIFFICULTY SCALING
    const levelMod = Math.min(gameState.level, 20);
    const gravity = 0.035 + (levelMod * 0.003); 
    const friction = Math.min(0.92 + (levelMod * 0.002), 0.98); 
    const slipThreshold = Math.max(60 - (levelMod * 1.0), 30); 

    if (gameState.isHooked) {
        const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
        const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
        const tension = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);

        if (tension > slipThreshold) {
            gameState.isHooked = false;
            playClink(0.1, 400);
            document.getElementById("status").textContent = "SLIPPED!";
        } else {
            const targetAngle = Math.atan2(gameState.ringY - gameState.bottleBaseY, gameState.ringX - gameState.bottleBaseX);
            gameState.bottleAngle += (targetAngle - gameState.bottleAngle) * 0.07;
            const uprightFactor = Math.abs(Math.sin(gameState.bottleAngle)); 
            const horizontalPull = (gameState.ringX - capX) * 0.04;
            gameState.baseVelocity += horizontalPull * (1 + uprightFactor);
        }
    } else {
        if (gameState.bottleAngle < 0) gameState.bottleAngle += gravity;
        if (gameState.bottleAngle >= 0) {
            if (gameState.bottleAngle !== 0) playClink(0.05, 200);
            gameState.bottleAngle = 0;
            const dist = gameState.originalBaseX - gameState.bottleBaseX;
            if (Math.abs(dist) > 0.5) gameState.baseVelocity += dist * 0.01;
            else { gameState.bottleBaseX = gameState.originalBaseX; gameState.baseVelocity = 0; }
        }
    }

    gameState.bottleBaseX += gameState.baseVelocity;
    gameState.baseVelocity *= friction;

    // Safety check to prevent the bottle from vanishing due to NaN
    if (isNaN(gameState.bottleBaseX)) {
        gameState.bottleBaseX = gameState.originalBaseX;
        gameState.baseVelocity = 0;
    }

    if (gameState.bottleBaseX < -60 || gameState.bottleBaseX > canvas.width + 60) {
        triggerGameOver();
    }

    gameState.confetti.forEach((p, i) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.4; p.life -= 0.02;
        if(p.life <= 0) gameState.confetti.splice(i, 1);
    });
}

function triggerGameOver() {
    gameState.gameOver = true;
    gameState.isDragging = false;
    playClink(0.3, 100);
    document.getElementById("finalScore").textContent = gameState.score;
    document.getElementById("gameOverOverlay").classList.remove("hidden");
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // IMPORTANT: Reset global opacity so the bottle isn't "faded"
    ctx.globalAlpha = 1.0; 

    // Table line
    ctx.strokeStyle = `#334155`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, gameState.bottleBaseY + 22); ctx.lineTo(canvas.width, gameState.bottleBaseY + 22); ctx.stroke();

    // Shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.beginPath(); ctx.ellipse(gameState.bottleBaseX, gameState.bottleBaseY + 20, 50, 10, 0, 0, Math.PI * 2); ctx.fill();

    // Rope
    const sway = Math.sin(gameState.wind) * 15;
    ctx.strokeStyle = gameState.isHooked ? "#fbbf24" : "#475569"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(canvas.width / 2, 20);
    const cpX = (canvas.width/2 + gameState.ringX)/2 + (gameState.isHooked ? 0 : sway);
    const cpY = (20 + gameState.ringY)/2 + (gameState.isHooked ? -10 : 30);
    ctx.quadraticCurveTo(cpX, cpY, gameState.ringX, gameState.ringY); ctx.stroke();

    // Bottle
    ctx.save();
    ctx.translate(gameState.bottleBaseX, gameState.bottleBaseY);
    ctx.rotate(gameState.bottleAngle);
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, "#064e3b"); g.addColorStop(0.4, "#10b981"); g.addColorStop(1, "#064e3b");
    ctx.fillStyle = g;
    ctx.beginPath(); 
    ctx.rect(0, -21, 130, 42); 
    ctx.fill();
    ctx.fillRect(130, -8, 40, 16);
    ctx.fillStyle = "#ef4444"; 
    ctx.beginPath(); ctx.rect(170, -10, 10, 20); ctx.fill();
    ctx.restore();

    // Ring
    const capX = gameState.bottleBaseX + Math.cos(gameState.bottleAngle) * 170;
    const capY = gameState.bottleBaseY + Math.sin(gameState.bottleAngle) * 170;
    const tension = Math.hypot(gameState.ringX - capX, gameState.ringY - capY);
    ctx.strokeStyle = (gameState.isHooked && tension > 40) ? "#ff4444" : (gameState.isHooked ? "#ff007f" : "#fff");
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(gameState.ringX, gameState.ringY, 22, 0, Math.PI*2); ctx.stroke();

    // Confetti (uses transparency)
    gameState.confetti.forEach(p => {
        ctx.fillStyle = p.color; 
        ctx.globalAlpha = p.life; 
        ctx.fillRect(p.x, p.y, 4, 4);
    });
    
    // Safety Reset for next frame
    ctx.globalAlpha = 1.0;
}

function checkWin() {
    if (gameState.hasWon || gameState.gameOver) return;
    
    if (gameState.bottleAngle <= -Math.PI/2 * 0.96 && Math.abs(gameState.baseVelocity) < 0.25) {
        gameState.hasWon = true;
        gameState.isHooked = false;
        gameState.isDragging = false;
        gameState.baseVelocity = 0; // Freeze momentum
        
        gameState.score += 100;
        playWinSound();
        document.getElementById("score").textContent = gameState.score;
        
        if (gameState.score > gameState.bestScore) {
            gameState.bestScore = gameState.score;
            localStorage.setItem("standByMeBest", gameState.bestScore);
            document.getElementById("bestScore").textContent = gameState.bestScore;
        }
        
        document.getElementById("status").textContent = "PERFECT! 🏮";
        
        for(let i=0; i<40; i++) {
            gameState.confetti.push({
                x: gameState.bottleBaseX, y: gameState.bottleBaseY - 120,
                vx: (Math.random()-0.5)*12, vy: -Math.random()*10-5, color: `hsl(${Math.random()*360}, 100%, 50%)`, life: 1
            });
        }

        setTimeout(() => {
            gameState.hasWon = false;
            gameState.level++;
            document.getElementById("level").textContent = gameState.level;
            
            // Hard physics reset for level transition
            gameState.bottleAngle = 0;
            gameState.bottleBaseX = gameState.originalBaseX;
            gameState.baseVelocity = 0;
            
            resetRing();
            document.getElementById("status").textContent = "Level " + gameState.level;
        }, 2000);
    }
}

// --- CONTROLS ---
canvas.addEventListener('mousedown', (e) => {
    if (gameState.paused || gameState.gameOver || gameState.hasWon) return;
    const pos = getMousePos(e);
    if (Math.hypot(pos.x - gameState.ringX, pos.y - gameState.ringY) < 60) {
        gameState.isDragging = true;
    }
});

window.addEventListener('mousemove', (e) => {
    if (gameState.isDragging) {
        handleMovement(getMousePos(e));
    }
});

window.addEventListener('mouseup', () => {
    gameState.isDragging = false;
});

// UI Buttons
document.getElementById("startBtn").onclick = () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    gameState.paused = false;
    init();
};
document.getElementById("restartBtn").onclick = () => {
    document.getElementById("gameOverOverlay").classList.add("hidden");
    init();
    gameState.paused = false;
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
