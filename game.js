
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const gameScreen = document.getElementById("gameScreen");
const overlay = document.getElementById("overlay");

const characters = {
  akira: { name: "AKIRA", speed: 4.4, jump: -13, color: "#ed4777", hair: "#17101f", scarf: "#ed4777" },
  volt:  { name: "VOLT", speed: 5.5, jump: -12.5, color: "#35cfff", hair: "#17243d", scarf: "#35cfff" },
  shade: { name: "SHADE", speed: 4.1, jump: -15, color: "#bd72ff", hair: "#21132f", scarf: "#bd72ff" }
};

const stages = [
  { name: "MOONLIT FOREST", sky: "#101b39", ground: "#243b36", boss: "#9c315f", bossName: "FOREST DEMON", unlock: 0 },
  { name: "FROZEN TEMPLE", sky: "#122d4c", ground: "#547e9a", boss: "#55bce9", bossName: "ICE MONSTER", unlock: 1 },
  { name: "LAVA FORTRESS", sky: "#421b25", ground: "#6b3025", boss: "#ff663b", bossName: "LAVA KING", unlock: 2 }
];

let selectedCharacter = "akira";
let selectedStage = 0;
let save = JSON.parse(localStorage.getItem("shadowNinjaV3") || '{"coins":0,"best":0,"unlocked":0,"cleared":[]}');

let player, boss, coins, projectiles, score;
let keys = {};
let gameRunning = false;
let paused = false;
let lastTime = 0;
let animationId = 0;
let attackCooldown = 0;
let invincible = 0;
let jumpRequested = false;
let attackRequested = false;
let audioCtx;

function saveGame() {
  localStorage.setItem("shadowNinjaV3", JSON.stringify(save));
  updateMenu();
}

function updateMenu() {
  document.getElementById("menuCoins").textContent = save.coins;
  document.getElementById("menuBest").textContent = save.best;

  document.querySelectorAll(".stage").forEach((button, index) => {
    const unlocked = index <= save.unlocked;
    button.classList.toggle("locked", !unlocked);
    button.classList.toggle("selected", index === selectedStage);
    button.querySelector("small").textContent = unlocked
      ? `Stage ${index + 1} · Available`
      : `Stage ${index + 1} · Locked`;
  });
}

document.querySelectorAll(".character").forEach(button => {
  button.addEventListener("click", () => {
    selectedCharacter = button.dataset.character;
    document.querySelectorAll(".character").forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
    sound(450);
  });
});

document.querySelectorAll(".stage").forEach(button => {
  button.addEventListener("click", () => {
    const index = Number(button.dataset.stage);
    if (index > save.unlocked) return;

    selectedStage = index;
    document.querySelectorAll(".stage").forEach(b => b.classList.remove("selected"));
    button.classList.add("selected");
    sound(500);
  });
});

document.getElementById("startBtn").onclick = startGame;
document.getElementById("menuBtn").onclick = goHome;
document.getElementById("pauseBtn").onclick = pauseGame;
document.getElementById("resumeBtn").onclick = resumeGame;
document.getElementById("retryBtn").onclick = startGame;
document.getElementById("homeBtn").onclick = goHome;
document.getElementById("nextBtn").onclick = () => {
  selectedStage = Math.min(2, selectedStage + 1);
  startGame();
};

function sound(freq = 400) {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = freq;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  } catch (e) {}
}

function startGame() {
  cancelAnimationFrame(animationId);

  player = {
    x: 75, y: 390, w: 38, h: 70,
    vx: 0, vy: 0, health: 3,
    grounded: false,
    facing: 1,
    frame: 0
  };

  boss = {
    x: 790, y: 360, w: 95, h: 100,
    health: 100, maxHealth: 100,
    direction: -1,
    attackTimer: 0
  };

  coins = [
    { x: 220, y: 390, taken: false },
    { x: 340, y: 330, taken: false },
    { x: 470, y: 390, taken: false },
    { x: 590, y: 310, taken: false },
    { x: 690, y: 390, taken: false }
  ];

  projectiles = [];
  score = 0;
  attackCooldown = 0;
  invincible = 0;
  keys = {};
  jumpRequested = false;
  attackRequested = false;
  paused = false;
  gameRunning = true;

  menu.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  overlay.classList.add("hidden");

  document.getElementById("stageName").textContent = stages[selectedStage].name;
  updateHUD();

  lastTime = performance.now();
  animationId = requestAnimationFrame(loop);
}

function updateHUD() {
  document.getElementById("health").textContent = player.health;
  document.getElementById("coins").textContent = save.coins;
  document.getElementById("score").textContent = score;
}

function loop(time) {
  if (!gameRunning) return;

  const dt = Math.min((time - lastTime) / 16.67, 2);
  lastTime = time;

  if (!paused) {
    update(dt);
    draw();
  }

  animationId = requestAnimationFrame(loop);
}

function update(dt) {
  const character = characters[selectedCharacter];

  player.vx = 0;
  if (keys.left) {
    player.vx = -character.speed;
    player.facing = -1;
  }
  if (keys.right) {
    player.vx = character.speed;
    player.facing = 1;
  }

  player.x += player.vx * dt;
  player.x = Math.max(0, Math.min(900 - player.w, player.x));

  player.vy += 0.65 * dt;
  player.y += player.vy * dt;

  if (player.y + player.h >= 460) {
    player.y = 460 - player.h;
    player.vy = 0;
    player.grounded = true;
  } else {
    player.grounded = false;
  }

  if (jumpRequested && player.grounded) {
    player.vy = character.jump;
    player.grounded = false;
    sound(600);
  }
  jumpRequested = false;

  attackCooldown -= dt;
  invincible -= dt;

  if (attackRequested && attackCooldown <= 0) {
    projectiles.push({
      x: player.x + (player.facing > 0 ? 35 : -5),
      y: player.y + 30,
      vx: player.facing * 10,
      life: 90
    });
    attackCooldown = 22;
    sound(750);
  }
  attackRequested = false;

  coins.forEach(coin => {
    if (!coin.taken &&
      Math.abs(player.x + 19 - coin.x) < 30 &&
      Math.abs(player.y + 35 - coin.y) < 38) {
      coin.taken = true;
      save.coins++;
      score += 100;
      sound(900);
      saveGame();
    }
  });

  projectiles.forEach(p => {
    p.x += p.vx * dt;
    p.life -= dt;

    if (
      p.life > 0 &&
      p.x > boss.x - 20 &&
      p.x < boss.x + boss.w + 20 &&
      p.y > boss.y &&
      p.y < boss.y + boss.h
    ) {
      p.life = 0;
      boss.health -= 12;
      score += 25;
      sound(250);
    }
  });

  projectiles = projectiles.filter(p => p.life > 0);

  // Boss movement and contact damage
  boss.attackTimer += dt;
  boss.x += boss.direction * 1.15 * dt;

  if (boss.x < 600 || boss.x > 820) boss.direction *= -1;

  if (boss.attackTimer > 85) {
    boss.attackTimer = 0;
    if (Math.abs(player.x - boss.x) < 330) {
      projectiles.push({
        x: boss.x,
        y: boss.y + 40,
        vx: player.x < boss.x ? -5 : 5,
        life: 100,
        enemy: true
      });
    }
  }

  projectiles.forEach(p => {
    if (p.enemy &&
      p.x > player.x &&
      p.x < player.x + player.w &&
      p.y > player.y &&
      p.y < player.y + player.h) {
      p.life = 0;
      damagePlayer();
    }
  });

  if (
    player.x + player.w > boss.x &&
    player.x < boss.x + boss.w &&
    player.y + player.h > boss.y &&
    player.y < boss.y + boss.h
  ) {
    damagePlayer();
  }

  if (boss.health <= 0) winGame();
  if (player.health <= 0) loseGame();

  updateHUD();
}

function damagePlayer() {
  if (invincible > 0) return;
  player.health--;
  invincible = 75;
  player.vy = -5;
  sound(130);
}

function draw() {
  const stage = stages[selectedStage];

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Sky
  const gradient = ctx.createLinearGradient(0, 0, 0, 540);
  gradient.addColorStop(0, stage.sky);
  gradient.addColorStop(1, "#171326");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 960, 540);

  // Moon
  ctx.fillStyle = "#f4e8ff";
  ctx.beginPath();
  ctx.arc(770, 95, 42, 0, Math.PI * 2);
  ctx.fill();

  // Distant mountains
  ctx.fillStyle = "#292746";
  ctx.beginPath();
  ctx.moveTo(0, 380);
  for (let x = 0; x <= 960; x += 120) {
    ctx.lineTo(x + 60, 245 + Math.sin(x) * 20);
    ctx.lineTo(x + 120, 380);
  }
  ctx.fill();

  // Trees / background
  for (let i = 0; i < 9; i++) {
    const x = i * 120;
    ctx.fillStyle = "#172c2b";
    ctx.fillRect(x + 35, 260, 16, 200);
    ctx.beginPath();
    ctx.moveTo(x + 43, 160);
    ctx.lineTo(x - 15, 300);
    ctx.lineTo(x + 100, 300);
    ctx.fill();
  }

  // Ground
  ctx.fillStyle = stage.ground;
  ctx.fillRect(0, 460, 960, 80);

  ctx.fillStyle = "#ffffff22";
  for (let i = 0; i < 960; i += 45) {
    ctx.fillRect(i, 468, 20, 3);
  }

  // Coins
  coins.forEach(coin => {
    if (coin.taken) return;
    ctx.fillStyle = "#ffd44f";
    ctx.beginPath();
    ctx.arc(coin.x, coin.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff3a5";
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  drawBoss();
  drawNinja();

  // Shuriken
  projectiles.forEach(p => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = p.enemy ? "#ff634f" : "#e9eaff";
    ctx.rotate(performance.now() / 60);
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? 13 : 4;
      ctx.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  // Boss health bar
  ctx.fillStyle = "#241728";
  ctx.fillRect(335, 18, 290, 18);
  ctx.fillStyle = stage.boss;
  ctx.fillRect(335, 18, 290 * Math.max(0, boss.health / boss.maxHealth), 18);
  ctx.strokeStyle = "#ffffff";
  ctx.strokeRect(335, 18, 290, 18);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px Arial";
  ctx.textAlign = "center";
  ctx.fillText(stage.bossName, 480, 13);
}

function drawNinja() {
  const c = characters[selectedCharacter];
  const x = player.x;
  const y = player.y;
  const facing = player.facing;

  ctx.save();
  ctx.translate(x + player.w / 2, y);
  ctx.scale(facing, 1);

  if (invincible > 0 && Math.floor(invincible / 6) % 2 === 0) {
    ctx.globalAlpha = 0.4;
  }

  // Long flowing ponytail
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.moveTo(-4, 12);
  ctx.quadraticCurveTo(-30, 0, -37, 32);
  ctx.quadraticCurveTo(-17, 23, -8, 37);
  ctx.fill();

  // Legs
  ctx.strokeStyle = "#191523";
  ctx.lineWidth = 11;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-7, 49);
  ctx.lineTo(-13, 67);
  ctx.moveTo(7, 49);
  ctx.lineTo(14, 67);
  ctx.stroke();

  // Boots
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(-13, 67);
  ctx.lineTo(-21, 68);
  ctx.moveTo(14, 67);
  ctx.lineTo(23, 68);
  ctx.stroke();

  // Body / fitted ninja suit
  ctx.fillStyle = "#21182b";
  ctx.beginPath();
  ctx.moveTo(-13, 18);
  ctx.lineTo(13, 18);
  ctx.lineTo(17, 49);
  ctx.lineTo(-17, 49);
  ctx.closePath();
  ctx.fill();

  // Suit details
  ctx.strokeStyle = c.color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, 24);
  ctx.lineTo(10, 44);
  ctx.moveTo(10, 24);
  ctx.lineTo(-10, 44);
  ctx.stroke();

  // Belt
  ctx.fillStyle = c.color;
  ctx.fillRect(-15, 43, 30, 5);

  // Arms
  ctx.strokeStyle = "#d99a9a";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-12, 23);
  ctx.lineTo(-23, 39);
  ctx.moveTo(12, 23);
  ctx.lineTo(22, 34);
  ctx.stroke();

  // Gloves
  ctx.strokeStyle = "#21182b";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-23, 39);
  ctx.lineTo(-28, 43);
  ctx.moveTo(22, 34);
  ctx.lineTo(29, 34);
  ctx.stroke();

  // Neck
  ctx.fillStyle = "#d99a9a";
  ctx.fillRect(-5, 12, 10, 10);

  // Face
  ctx.fillStyle = "#f0b8a7";
  ctx.beginPath();
  ctx.ellipse(0, 9, 13, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Long hair
  ctx.fillStyle = c.hair;
  ctx.beginPath();
  ctx.arc(0, 4, 14, Math.PI, Math.PI * 2);
  ctx.lineTo(13, 12);
  ctx.quadraticCurveTo(4, 1, -12, 12);
  ctx.closePath();
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#302039";
  ctx.fillRect(3, 8, 3, 2);

  // Ninja headband
  ctx.fillStyle = c.color;
  ctx.fillRect(-13, 2, 26, 4);
  ctx.beginPath();
  ctx.moveTo(11, 4);
  ctx.lineTo(25, 11);
  ctx.lineTo(13, 9);
  ctx.fill();

  // Scarf tail
  ctx.fillStyle = c.scarf;
  ctx.beginPath();
  ctx.moveTo(-7, 20);
  ctx.quadraticCurveTo(-27, 13, -35, 25);
  ctx.lineTo(-17, 29);
  ctx.lineTo(-8, 25);
  ctx.fill();

  ctx.restore();
}

function drawBoss() {
  const stage = stages[selectedStage];

  ctx.fillStyle = stage.boss;
  ctx.beginPath();
  ctx.roundRect(boss.x, boss.y, boss.w, boss.h, 18);
  ctx.fill();

  // Horns
  ctx.fillStyle = "#eee1f2";
  ctx.beginPath();
  ctx.moveTo(boss.x + 20, boss.y + 12);
  ctx.lineTo(boss.x + 5, boss.y - 18);
  ctx.lineTo(boss.x + 35, boss.y + 5);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(boss.x + 72, boss.y + 12);
  ctx.lineTo(boss.x + 90, boss.y - 18);
  ctx.lineTo(boss.x + 60, boss.y + 5);
  ctx.fill();

  // Eyes
  ctx.fillStyle = "#fff";
  ctx.fillRect(boss.x + 20, boss.y + 30, 17, 8);
  ctx.fillRect(boss.x + 58, boss.y + 30, 17, 8);
  ctx.fillStyle = "#ff2424";
  ctx.fillRect(boss.x + 26, boss.y + 31, 7, 6);
  ctx.fillRect(boss.x + 64, boss.y + 31, 7, 6);

  ctx.fillStyle = "#1a101e";
  ctx.fillRect(boss.x + 30, boss.y + 70, 35, 7);
}

function showResult(title, message, showNext = false) {
  gameRunning = false;
  cancelAnimationFrame(animationId);

  document.getElementById("resultTitle").textContent = title;
  document.getElementById("resultText").textContent = message;

  document.getElementById("resumeBtn").classList.toggle("hidden", title !== "PAUSED");
  document.getElementById("nextBtn").classList.toggle("hidden", !showNext);
  overlay.classList.remove("hidden");
}

function winGame() {
  score += 500;
  save.best = Math.max(save.best, score);

  if (!save.cleared.includes(selectedStage)) {
    save.cleared.push(selectedStage);
  }

  if (selectedStage < 2) {
    save.unlocked = Math.max(save.unlocked, selectedStage + 1);
  }

  saveGame();
  updateHUD();

  showResult(
    "VICTORY!",
    `${characters[selectedCharacter].name} defeated ${stages[selectedStage].bossName}! Score: ${score}`,
    selectedStage < 2
  );

  sound(1000);
}

function loseGame() {
  save.best = Math.max(save.best, score);
  saveGame();
  showResult("GAME OVER", "The shadow world is waiting. Try again!");
}

function pauseGame() {
  if (!gameRunning) return;
  paused = true;
  showResult("PAUSED", "Your adventure is waiting.");
}

function resumeGame() {
  paused = false;
  gameRunning = true;
  overlay.classList.add("hidden");
  lastTime = performance.now();
}

function goHome() {
  gameRunning = false;
  paused = false;
  cancelAnimationFrame(animationId);
  overlay.classList.add("hidden");
  gameScreen.classList.add("hidden");
  menu.classList.remove("hidden");
  updateMenu();
}

// Keyboard controls
window.addEventListener("keydown", e => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) {
    e.preventDefault();
  }

  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "ArrowUp" || e.code === "Space" || e.code === "KeyW") jumpRequested = true;
  if (e.code === "KeyJ" || e.code === "KeyK") attackRequested = true;
});

window.addEventListener("keyup", e => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});

// Mobile buttons: hold to move
function holdButton(id, key) {
  const button = document.getElementById(id);

  button.addEventListener("pointerdown", e => {
    e.preventDefault();
    keys[key] = true;
    button.setPointerCapture(e.pointerId);
  });

  ["pointerup", "pointercancel", "lostpointercapture"].forEach(event => {
    button.addEventListener(event, () => keys[key] = false);
  });
}

holdButton("leftBtn", "left");
holdButton("rightBtn", "right");

document.getElementById("jumpBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  jumpRequested = true;
});

document.getElementById("attackBtn").addEventListener("pointerdown", e => {
  e.preventDefault();
  attackRequested = true;
});

updateMenu();
