const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const state = {
    paused: true,
    level: 1,
    score: 0,
    bestScore: localStorage.getItem("standBest") || 0,
    bottleAngle: 0,
    bottleBaseX: 0,
    bottleBaseY: 0,
    originalX: 0,
    baseVel: 0,
    ringX: 0,
    ringY: 0,
    isDragging: false,
    isHooked: false,
    win: false,
    wind: 0,
    confetti: []
};

// Fixed coordinates so objects never disappear
function init() {
    canvas.width = 850;
    canvas.height = 500;
    state.originalX = canvas.width / 2 - 80;
    state.bottleBaseX = state.originalX;
    state.bottleBaseY = canvas.height * 0.82;
    state.ringX = canvas.width / 2;
    state.ringY = 150;
    document.getElementById("bestScore").textContent = state.bestScore;
}

function update() {
    if (state.paused || state.win) return;
    state.wind += 0.03;

    // Slipped logic
    if (state.isHooked && state.isDragging) {
        const topX = state.bottleBaseX + Math.cos(state.bottleAngle) * 170;
        const topY = state.bottleBaseY + Math.sin(state.bottleAngle) * 170;
        if (Math.hypot(state.ringX - topX, state.ringY - topY) > 40) {
            state.isHooked = false;
            document.getElementById("status").textContent = "SLIPPED!";
        }
    }

    // Fall back and center logic
    if (!state.isHooked) {
        if (state.bottleAngle < 0) state.bottleAngle += 0.04;
        if (state.bottleAngle >= 0) {
            state.bottleAngle = 0;
            const dist = state.originalX - state.bottleBaseX;
            if (Math.abs(dist) > 0.5) state.baseVel += dist * 0.01;
            else { state.bottleBaseX = state.originalX; state.baseVel = 0; }
        }
    }

    state.bottleBaseX += state.baseVel;
    state.baseVel *= 0.94;

    // Victory check
    if (!state.win && state.bottleAngle <= -Math.PI / 2 * 0.98 && Math.abs(state.baseVel) < 0.1) {
        triggerWin();
    }
}

function triggerWin() {
    state.win = true;
    state.score += 100;
    document.getElementById("score").textContent = state.score;
    document.getElementById("status").textContent = "LEVEL CLEARED! 🏮";
    
    if (state.score > state.bestScore) {
        state.bestScore = state.score;
        localStorage.setItem("standBest", state.bestScore);
        document.getElementById("bestScore").textContent = state.bestScore;
    }

    // Level Transition
    setTimeout(() => {
        state.level++;
        document.getElementById("level").textContent = state.level;
        state.bottleAngle = 0;
        state.baseVel = 0;
        state.bottleBaseX = state.originalX;
        state.isHooked = false;
        state.isDragging = false;
        state.ringX = canvas.width / 2;
        state.ringY = 150;
        state.win = false;
        document.getElementById("status").textContent = "Level " + state.level;
    }, 2000);
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. LIGHTING PLATFORM (Changes with level)
    const platformHue = (state.level * 40) % 360;
    ctx.shadowBlur = 15;
    ctx.shadowColor = `hsl(${platformHue}, 100%, 50%)`;
    ctx.strokeStyle = `hsl(${platformHue}, 100%, 70%)`;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(state.originalX - 50, state.bottleBaseY + 5);
    ctx.lineTo(state.originalX + 180, state.bottleBaseY + 5);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 2. SWINGING ROPE
    const windBreeze = Math.sin(state.wind) * 15;
    ctx.strokeStyle = state.isHooked ? "#fbbf24" : "#64748b";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 20);
    const cpX = ((canvas.width/2 + state.ringX)/2) + (state.isHooked ? 0 : windBreeze);
    const cpY = (20 + state.ringY)/2 + (state.isHooked ? -10 : 30);
    ctx.quadraticCurveTo(cpX, cpY, state.ringX, state.ringY);
    ctx.stroke();

    // 3. BEER BOTTLE
    ctx.save();
    ctx.translate(state.bottleBaseX, state.bottleBaseY);
    ctx.rotate(state.bottleAngle);
    
    // Glass Body
    const g = ctx.createLinearGradient(0, -20, 0, 20);
    g.addColorStop(0, "#064e3b"); g.addColorStop(0.5, "#10b981"); g.addColorStop(1, "#064e3b");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.roundRect(0, -21, 130, 42, [5, 15, 15, 5]); ctx.fill();
    
    // Shoulder and Neck
    ctx.beginPath(); ctx.moveTo(130,-21); ctx.bezierCurveTo(155,-21,155,-10,155,-10); ctx.lineTo(155,10); ctx.bezierCurveTo(155,21,130,21,130,21); ctx.fill();
    ctx.fillRect(155, -8, 20, 16);
    
    // Cap
    ctx.fillStyle = "#ef4444"; ctx.roundRect(175, -11, 8, 22, 2); ctx.fill();
    ctx.restore();

    // 4. THE RING
    ctx.strokeStyle = state.isHooked ? varColor("--neon-pink") : "#fff";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(state.ringX, state.ringY, 22, 0, Math.PI*2); ctx.stroke();
}

function varColor(name) { return getComputedStyle(document.documentElement).getPropertyValue(name); }

// BUTTONS
document.getElementById("startBtn").onclick = () => {
    document.getElementById("tutorialOverlay").classList.add("hidden");
    state.paused = false;
};
document.getElementById("pauseBtn").onclick = () => {
    state.paused = true;
    document.getElementById("pauseOverlay").classList.remove("hidden");
};
document.getElementById("resumeBtn").onclick = () => {
    state.paused = false;
    document.getElementById("pauseOverlay").classList.add("hidden");
};
document.getElementById("exitBtn").onclick = () => location.reload();

// MOUSE HANDLING
canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    if (Math.hypot(mx - state.ringX, my - state.ringY) < 45) state.isDragging = true;
};
window.onmousemove = (e) => {
    if (!state.isDragging || state.paused) return;
    const rect = canvas.getBoundingClientRect();
    state.ringX = (e.clientX - rect.left) * (canvas.width / rect.width);
    state.ringY = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    const tx = state.bottleBaseX + Math.cos(state.bottleAngle) * 170;
    const ty = state.bottleBaseY + Math.sin(state.bottleAngle) * 170;
    
    if (!state.isHooked && Math.hypot(state.ringX - tx, state.ringY - ty) < 25) {
        state.isHooked = true;
        document.getElementById("status").textContent = "HOOKED!";
    } else if (state.isHooked) {
        state.bottleAngle = Math.atan2(state.ringY - state.bottleBaseY, state.ringX - state.bottleBaseX);
        if (Math.abs(state.ringX - tx) > 10) state.baseVel += (state.ringX > tx ? 0.4 : -0.4);
    }
};
window.onmouseup = () => state.isDragging = false;

window.onload = () => {
    init();
    const loop = () => { update(); draw(); requestAnimationFrame(loop); };
    loop();
};
