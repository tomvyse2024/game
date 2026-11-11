
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = 900;
const H = 500;
const WORLD = 2600;

let player, enemies, coins, stars, bullets;
let camera = 0;
let score = 0;
let health = 3;
let running = false;
let frame = 0;

const keys = {
    left: false,
    right: false
};

const gravity = 0.65;

const platforms = [
    {x:0, y:440, w:600, h:60},
    {x:680, y:440, w:450, h:60},
    {x:1200, y:440, w:500, h:60},
    {x:1770, y:440, w:830, h:60},

    {x:300, y:340, w:150, h:20},
    {x:790, y:330, w:180, h:20},
    {x:1350, y:340, w:180, h:20},
    {x:1900, y:330, w:180, h:20},
    {x:2250, y:350, w:150, h:20}
];

function resetGame() {
    player = {
        x: 60,
        y: 300,
        w: 34,
        h: 48,
        vx: 0,
        vy: 0,
        speed: 4.5,
        jumpPower: -13,
        grounded: false,
        facing: 1,
        attack: 0,
        invincible: 0
    };

    enemies = [
        {x:500,y:395,w:35,h:45,dir:1},
        {x:900,y:395,w:35,h:45,dir:-1},
        {x:1500,y:395,w:35,h:45,dir:1},
        {x:2050,y:395,w:35,h:45,dir:-1}
    ];

    coins = [];

    [220,360,550,820,950,1300,1450,1650,1900,2200,2400]
    .forEach((x,i) => {
        coins.push({
            x,
            y: i % 2 === 0 ? 300 : 380,
            collected:false
        });
    });

    bullets = [];
    camera = 0;
    score = 0;
    health = 3;
    updateStats();
}

function updateStats() {
    document.getElementById("score").textContent = score;
    document.getElementById("health").textContent = health;
}

function jump() {
    if (!running) return;

    if (player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }
}

function attack() {
    if (!running || player.attack > 0) return;

    player.attack = 18;

    bullets.push({
        x: player.x + player.w / 2,
        y: player.y + 22,
        vx: player.facing * 9,
        life: 75
    });
}

function startGame() {
    resetGame();

    document.getElementById("startScreen").classList.add("hidden");
    document.getElementById("gameOverScreen").classList.add("hidden");
    document.getElementById("winScreen").classList.add("hidden");

    running = true;
    requestAnimationFrame(gameLoop);
}

function gameOver() {
    running = false;

    document.getElementById("finalScore").textContent = score;
    document.getElementById("gameOverScreen").classList.remove("hidden");
}

function victory() {
    running = false;
    document.getElementById("winScreen").classList.remove("hidden");
}

// PLAYER MOVEMENT
function updatePlayer() {
    player.vx = 0;

    if (keys.left) {
        player.vx = -player.speed;
        player.facing = -1;
    }

    if (keys.right) {
        player.vx = player.speed;
        player.facing = 1;
    }

    player.x += player.vx;

    player.vy += gravity;
    player.y += player.vy;

    player.grounded = false;

    platforms.forEach(p => {
        if (
            player.x + player.w > p.x &&
            player.x < p.x + p.w &&
            player.y + player.h >= p.y &&
            player.y + player.h <= p.y + 25 &&
            player.vy >= 0
        ) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.grounded = true;
        }
    });

    if (player.y > H + 100) {
        damagePlayer();
    }

    player.x = Math.max(0, Math.min(WORLD-player.w, player.x));

    if (player.attack > 0) player.attack--;
    if (player.invincible > 0) player.invincible--;

    camera = Math.max(
        0,
        Math.min(WORLD-W, player.x-W/3)
    );
}

// DAMAGE
function damagePlayer() {
    if (player.invincible > 0) return;

    health--;
    player.invincible = 90;
    player.vy = -8;
    player.vx = -player.facing * 4;

    updateStats();

    if (health <= 0) gameOver();
}

// ENEMY MOVEMENT
function updateEnemies() {
    enemies.forEach(enemy => {
        enemy.x += enemy.dir * 1.3;

        if (enemy.x < 400) enemy.dir = 1;
        if (enemy.x > WORLD-100) enemy.dir = -1;

        let hit =
            player.x + player.w > enemy.x &&
            player.x < enemy.x + enemy.w &&
            player.y + player.h > enemy.y &&
            player.y < enemy.y + enemy.h;

        if (hit) damagePlayer();
    });
}

// COIN COLLECTION
function updateCoins() {
    coins.forEach(coin => {
        if (coin.collected) return;

        let distance = Math.hypot(
            player.x + 17 - coin.x,
            player.y + 24 - coin.y
        );

        if (distance < 35) {
            coin.collected = true;
            score += 10;
            updateStats();
        }
    });
}

// SHURIKEN
function updateBullets() {
    bullets.forEach(b => {
        b.x += b.vx;
        b.life--;

        enemies.forEach((enemy,i) => {
            if (
                b.x > enemy.x &&
                b.x < enemy.x + enemy.w &&
                b.y > enemy.y &&
                b.y < enemy.y + enemy.h
            ) {
                enemies.splice(i,1);
                b.life = 0;
                score += 20;
                updateStats();
            }
        });
    });

    bullets = bullets.filter(b => b.life > 0);
}

// DRAW BACKGROUND
function drawBackground() {
    let gradient = ctx.createLinearGradient(0,0,0,H);

    gradient.addColorStop(0,"#090d24");
    gradient.addColorStop(1,"#25123d");

    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,W,H);

    // Moon
    ctx.fillStyle = "#d8c5ff";
    ctx.beginPath();
    ctx.arc(740-camera*.1,90,38,0,Math.PI*2);
    ctx.fill();

    // Stars
    for(let i=0;i<45;i++){
        let x = (i*173-camera*.2)%W;
        if(x<0)x+=W;

        ctx.fillStyle = "#ffffff88";
        ctx.fillRect(x,(i*67)%230,3,3);
    }

    // Distant buildings
    for(let i=0;i<15;i++){
        let x = i*190-camera*.35;

        ctx.fillStyle = "#11152f";
        ctx.fillRect(x,270,100,170);

        ctx.fillStyle = "#a855f7";
        for(let j=0;j<4;j++){
            ctx.fillRect(x+15+j*20,290,7,9);
        }
    }
}

// DRAW PLATFORMS
function drawPlatforms() {
    platforms.forEach(p => {
        let x = p.x-camera;

        if(x+p.w < 0 || x > W) return;

        ctx.fillStyle = "#191b35";
        ctx.fillRect(x,p.y,p.w,p.h);

        ctx.fillStyle = "#9333ea";
        ctx.fillRect(x,p.y,p.w,5);
    });
}

// DRAW NINJA
function drawPlayer() {
    ctx.save();

    if(player.invincible>0 && frame%8<4){
        ctx.globalAlpha = 0.35;
    }

    let x = player.x-camera;
    let y = player.y;

    ctx.translate(x+17,y+24);

    if(player.facing===-1){
        ctx.scale(-1,1);
    }

    // Shadow
    ctx.fillStyle = "#0008";
    ctx.beginPath();
    ctx.ellipse(0,27,22,6,0,0,Math.PI*2);
    ctx.fill();

    // Body
    ctx.fillStyle = "#111";
    ctx.fillRect(-12,-7,24,28);

    // Head
    ctx.fillStyle = "#27213f";
    ctx.beginPath();
    ctx.arc(0,-16,16,0,Math.PI*2);
    ctx.fill();

    // Mask
    ctx.fillStyle = "#c084fc";
    ctx.fillRect(2,-20,14,5);

    // Eye
    ctx.fillStyle = "white";
    ctx.fillRect(8,-20,5,4);

    // Scarf
    ctx.fillStyle = "#9333ea";
    ctx.fillRect(-15,-5,10,7);

    // Legs
    ctx.fillStyle = "#080810";
    ctx.fillRect(-10,17,8,12);
    ctx.fillRect(3,17,8,12);

    ctx.restore();
}

// DRAW ENEMIES
function drawEnemies() {
    enemies.forEach(e => {
        let x=e.x-camera;

        ctx.fillStyle="#b91c1c";
        ctx.fillRect(x,e.y,e.w,e.h);

        ctx.fillStyle="#fff";
        ctx.fillRect(x+7,e.y+10,6,6);
        ctx.fillRect(x+23,e.y+10,6,6);

        ctx.fillStyle="#111";
        ctx.fillRect(x+9,e.y+12,3,3);
        ctx.fillRect(x+25,e.y+12,3,3);
    });
}

// DRAW COINS
function drawCoins() {
    coins.forEach(c => {
        if(c.collected)return;

        ctx.save();

        ctx.shadowColor="#facc15";
        ctx.shadowBlur=15;

        ctx.fillStyle="#facc15";
        ctx.beginPath();
        ctx.arc(c.x-camera,c.y,10,0,Math.PI*2);
        ctx.fill();

        ctx.restore();
    });
}

// DRAW SHURIKEN
function drawBullets() {
    bullets.forEach(b => {
        ctx.save();

        ctx.translate(b.x-camera,b.y);
        ctx.rotate(frame*.2);

        ctx.fillStyle="#d8b4fe";
        ctx.beginPath();

        for(let i=0;i<8;i++){
            let a=i*Math.PI/4;
            let r=i%2===0?12:4;

            ctx.lineTo(
                Math.cos(a)*r,
                Math.sin(a)*r
            );
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    });
}

// MAIN LOOP
function update() {
    frame++;

    updatePlayer();

    if(!running)return;

    updateEnemies();
    updateCoins();
    updateBullets();

    if(player.x > WORLD-100){
        victory();
    }
}

function draw() {
    drawBackground();
    drawPlatforms();
    drawCoins();
    drawEnemies();
    drawBullets();
    drawPlayer();
}

function gameLoop() {
    if(!running)return;

    update();
    draw();

    if(running) requestAnimationFrame(gameLoop);
}

// KEYBOARD
window.addEventListener("keydown",e=>{
    if(["ArrowLeft","ArrowRight","ArrowUp"," ","ArrowDown"].includes(e.key)){
        e.preventDefault();
    }

    if(e.key==="ArrowLeft" || e.key==="a")keys.left=true;
    if(e.key==="ArrowRight" || e.key==="d")keys.right=true;

    if((e.key==="ArrowUp" || e.key==="w") && !e.repeat)jump();

    if(e.code==="Space" && !e.repeat)attack();
});

window.addEventListener("keyup",e=>{
    if(e.key==="ArrowLeft" || e.key==="a")keys.left=false;
    if(e.key==="ArrowRight" || e.key==="d")keys.right=false;
});

// MOBILE TOUCH BUTTONS
function holdButton(id,key){
    const button=document.getElementById(id);

    button.addEventListener("pointerdown",e=>{
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        keys[key]=true;
    });

    button.addEventListener("pointerup",()=>{
        keys[key]=false;
    });

    button.addEventListener("pointercancel",()=>{
        keys[key]=false;
    });
}

holdButton("leftBtn","left");
holdButton("rightBtn","right");

document.getElementById("jumpBtn").addEventListener(
    "pointerdown",e=>{
        e.preventDefault();
        jump();
    }
);

document.getElementById("attackBtn").addEventListener(
    "pointerdown",e=>{
        e.preventDefault();
        attack();
    }
);

// BUTTONS
document.getElementById("startBtn").onclick=startGame;
document.getElementById("restartBtn").onclick=startGame;
document.getElementById("nextBtn").onclick=startGame;

resetGame();
draw();
