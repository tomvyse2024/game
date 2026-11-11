
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#11152c");
scene.fog = new THREE.Fog("#11152c", 18, 75);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 150);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById("game").prepend(renderer.domElement);

const clock = new THREE.Clock();
const loader = new GLTFLoader();

let selectedStage = 0;
let playing = false;
let paused = false;
let health = 100;
let coins = 0;
let bossHP = 100;
let attackCooldown = 0;
let damageCooldown = 0;
let jumpVelocity = 0;
let grounded = true;
let attackAnimation = 0;
let messageTimer = 0;
let mixer = null;
let loadedModel = null;

const input = { forward: 0, side: 0, attack: false, jump: false };
let cameraYaw = 0;
let cameraPitch = 0.25;

const stages = [
  {
    name: "MOONLIT FOREST",
    sky: "#111a39",
    ground: "#263d35",
    fog: "#111a39",
    boss: "#a43c69",
    bossName: "FOREST DEMON",
    light: 0x9daaff
  },
  {
    name: "FROZEN TEMPLE",
    sky: "#193650",
    ground: "#7898a9",
    fog: "#193650",
    boss: "#52bce8",
    bossName: "ICE MONSTER",
    light: 0xbbeaff
  },
  {
    name: "LAVA FORTRESS",
    sky: "#411c25",
    ground: "#673126",
    fog: "#411c25",
    boss: "#f05c38",
    bossName: "LAVA KING",
    light: 0xffa36c
  }
];

const mat = (color, roughness = 0.7, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const materials = {
  black: mat("#191522"),
  dark: mat("#292033"),
  red: mat("#c93261"),
  skin: mat("#e6ae9d"),
  hair: mat("#17101f", 0.45),
  gold: mat("#d9ad5d", 0.35, 0.6),
  white: mat("#f2eafa")
};

function box(parent, size, material, position, cast = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    material
  );
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function sphere(parent, radius, material, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 16),
    material
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(parent, top, bottom, height, material, position) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(top, bottom, height, 12),
    material
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

// Lighting
const ambient = new THREE.HemisphereLight(0xbac8ff, 0x30202c, 1.5);
scene.add(ambient);

const moonLight = new THREE.DirectionalLight(0xd5d8ff, 3);
moonLight.position.set(-8, 15, 8);
moonLight.castShadow = true;
moonLight.shadow.mapSize.set(1024, 1024);
scene.add(moonLight);

const rimLight = new THREE.PointLight(0xd34b91, 35, 25);
rimLight.position.set(3, 5, -4);
scene.add(rimLight);

// Ground
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(100, 100),
  mat("#263d35")
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// Decorative environment
const environment = new THREE.Group();
scene.add(environment);

function makeTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);

  cylinder(tree, 0.35, 0.5, 4, mat("#34272b"), [0, 2, 0]);

  for (let i = 0; i < 3; i++) {
    const crown = sphere(
      tree,
      1.3 - i * 0.12,
      mat(i % 2 ? "#233b3a" : "#304a43"),
      [0, 3.1 + i * 0.7, 0],
      [1, 0.8, 1]
    );
  }

  environment.add(tree);
}

function buildEnvironment() {
  environment.clear();

  for (let i = 0; i < 22; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    makeTree(
      side * (7 + Math.random() * 15),
      -20 + Math.random() * 45,
      0.7 + Math.random() * 0.8
    );
  }

  const moon = sphere(
    environment, 2.4, mat("#f0e9ff", 1),
    [-14, 13, -25]
  );

  const glow = new THREE.PointLight(0xc7caff, 25, 40);
  glow.position.set(-14, 13, -23);
  environment.add(glow);

  // Floating atmospheric particles
  const particleGeometry = new THREE.BufferGeometry();
  const positions = [];

  for (let i = 0; i < 150; i++) {
    positions.push(
      (Math.random() - 0.5) * 45,
      Math.random() * 10,
      (Math.random() - 0.5) * 50
    );
  }

  particleGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  const particles = new THREE.Points(
    particleGeometry,
    new THREE.PointsMaterial({
      color: 0xf7b6db,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    })
  );

  environment.add(particles);
}

// Character rig
const player = new THREE.Group();
scene.add(player);

const rig = new THREE.Group();
player.add(rig);

const leftArm = new THREE.Group();
const rightArm = new THREE.Group();
const leftLeg = new THREE.Group();
const rightLeg = new THREE.Group();

function makeLimb(parent, length, material, radius = 0.13) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 4, 8),
    material
  );
  mesh.position.y = -length / 2;
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function buildNinja() {
  rig.clear();

  // Legs
  leftLeg.position.set(-0.19, 0.9, 0);
  rightLeg.position.set(0.19, 0.9, 0);
  rig.add(leftLeg, rightLeg);

  makeLimb(leftLeg, 0.75, materials.black, 0.14);
  makeLimb(rightLeg, 0.75, materials.black, 0.14);

  // Boots
  box(leftLeg, [0.32, 0.16, 0.48], materials.red, [0, -0.78, 0.08]);
  box(rightLeg, [0.32, 0.16, 0.48], materials.red, [0, -0.78, 0.08]);

  // Body
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.31, 0.6, 5, 12),
    materials.dark
  );
  torso.position.y = 1.48;
  torso.castShadow = true;
  rig.add(torso);

  // Suit details
  box(rig, [0.48, 0.12, 0.48], materials.red, [0, 1.15, 0]);
  box(rig, [0.12, 0.65, 0.04], materials.gold, [0, 1.45, 0.29]);

  // Neck and head
  cylinder(rig, 0.11, 0.13, 0.2, materials.skin, [0, 1.91, 0]);
  sphere(rig, 0.29, materials.skin, [0, 2.22, 0], [0.84, 1.05, 0.86]);

  // Hair cap and long hair
  sphere(rig, 0.3, materials.hair, [0, 2.36, -0.06], [1.02, 0.75, 1.0]);

  const ponytail = sphere(
    rig, 0.18, materials.hair,
    [0, 2.18, -0.4],
    [0.75, 2.8, 0.75]
  );

  ponytail.rotation.x = -0.3;

  // Side hair
  sphere(rig, 0.13, materials.hair, [-0.25, 2.08, 0.02], [0.6, 1.7, 0.7]);
  sphere(rig, 0.13, materials.hair, [0.25, 2.08, 0.02], [0.6, 1.7, 0.7]);

  // Eyes and headband
  box(rig, [0.42, 0.055, 0.05], materials.red, [0, 2.3, 0.245]);
  sphere(rig, 0.035, materials.dark, [-0.1, 2.23, 0.25]);
  sphere(rig, 0.035, materials.dark, [0.1, 2.23, 0.25]);

  // Scarf
  const scarf = box(rig, [0.18, 0.1, 0.7], materials.red, [-0.2, 1.72, -0.42]);
  scarf.rotation.x = -0.3;

  // Arms
  leftArm.position.set(-0.38, 1.72, 0);
  rightArm.position.set(0.38, 1.72, 0);
  rig.add(leftArm, rightArm);

  makeLimb(leftArm, 0.65, materials.black, 0.12);
  makeLimb(rightArm, 0.65, materials.black, 0.12);

  sphere(leftArm, 0.12, materials.skin, [0, -0.7, 0]);
  sphere(rightArm, 0.12, materials.skin, [0, -0.7, 0]);

  // Katana
  const sword = new THREE.Group();
  sword.position.set(0, -0.72, 0.12);
  rightArm.add(sword);

  cylinder(sword, 0.035, 0.035, 0.55, materials.gold, [0, -0.28, 0]);
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, 1.2, 0.035),
    mat("#dbe9ff", 0.2, 0.8)
  );
  blade.position.y = -1.05;
  sword.add(blade);

  player.userData.sword = sword;
  player.userData.ponytail = ponytail;
}

buildNinja();

// Optional replacement with a proper animated GLB character model.
// Example: loadNinjaModel("./assets/akira.glb")
window.loadNinjaModel = async function(url) {
  try {
    const gltf = await loader.loadAsync(url);

    if (loadedModel) player.remove(loadedModel);

    loadedModel = gltf.scene;
    loadedModel.scale.setScalar(1.5);
    loadedModel.position.set(0, 0, 0);

    player.add(loadedModel);
    rig.visible = false;

    if (mixer) mixer.stopAllAction();
    mixer = new THREE.AnimationMixer(loadedModel);

    if (gltf.animations.length) {
      mixer.clipAction(gltf.animations[0]).play();
    }

    console.log("3D Ninja model loaded.");
  } catch (error) {
    console.error("Could not load the GLB model:", error);
  }
};

// Boss
const boss = new THREE.Group();
scene.add(boss);

const bossBody = new THREE.Mesh(
  new THREE.CapsuleGeometry(0.65, 1.15, 5, 12),
  mat("#a43c69", 0.45)
);
bossBody.position.y = 1.3;
bossBody.castShadow = true;
boss.add(bossBody);

sphere(boss, 0.48, mat("#4a263f"), [0, 2.2, 0], [1, 1.1, 0.9]);
sphere(boss, 0.08, mat("#ff302e", 0.2, 0.2), [-0.19, 2.25, 0.4]);
sphere(boss, 0.08, mat("#ff302e", 0.2, 0.2), [0.19, 2.25, 0.4]);

// Boss horns
const hornMat = mat("#eee2e9");
const horn1 = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.65, 8), hornMat);
horn1.position.set(-0.35, 2.8, 0);
horn1.rotation.z = 0.35;
boss.add(horn1);

const horn2 = horn1.clone();
horn2.position.x = 0.35;
horn2.rotation.z = -0.35;
boss.add(horn2);

// Coin objects
const coinObjects = [];

function makeCoins() {
  coinObjects.forEach(c => scene.remove(c));
  coinObjects.length = 0;

  for (let i = 0; i < 9; i++) {
    const coin = new THREE.Mesh(
      new THREE.TorusGeometry(0.22, 0.07, 8, 18),
      mat("#ffd65b", 0.25, 0.7)
    );

    coin.position.set(
      -7 + i * 1.8,
      1.1 + (i % 2) * 0.5,
      -4 - (i % 3) * 2
    );

    coin.userData.collected = false;
    scene.add(coin);
    coinObjects.push(coin);
  }
}

// Stage setup
function setupStage() {
  const s = stages[selectedStage];

  scene.background = new THREE.Color(s.sky);
  scene.fog.color.set(s.fog);
  ground.material.color.set(s.ground);
  bossBody.material.color.set(s.boss);
  rimLight.color.set(s.light);

  document.getElementById("stageName").textContent = s.name;
  document.getElementById("bossName").textContent = s.bossName;

  buildEnvironment();
  makeCoins();

  player.position.set(0, 0, 5);
  player.rotation.y = Math.PI;

  boss.position.set(0, 0, -9);
  bossHP = 100;
  health = 100;
  coins = 0;

  updateHUD();
}

// HUD
function updateHUD() {
  document.getElementById("health").textContent = health;
  document.getElementById("coins").textContent = coins;
  document.getElementById("bossHealth").style.width = bossHP + "%";
}

function showMessage(text) {
  const el = document.getElementById("message");
  el.textContent = text;
  messageTimer = 1.5;
}

// Start game
function startGame() {
  document.getElementById("menu").classList.add("hidden");
  document.getElementById("pausePanel").classList.add("hidden");
  document.getElementById("resultPanel").classList.add("hidden");
  document.getElementById("hud").classList.remove("hidden");

  if (innerWidth < 850 || "ontouchstart" in window) {
    document.getElementById("mobileControls").classList.remove("hidden");
  }

  document.getElementById("help").style.display = "none";

  setupStage();
  playing = true;
  paused = false;
  clock.start();
  showMessage("DEFEAT THE BOSS!");
}

document.getElementById("start").onclick = startGame;

// Stage selection
document.querySelectorAll(".stage").forEach(button => {
  button.onclick = () => {
    selectedStage = Number(button.dataset.stage);
    document.querySelectorAll(".stage").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
  };
});

// Pause and result screens
function pauseGame() {
  if (!playing) return;
  paused = true;
  document.getElementById("pausePanel").classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  document.getElementById("pausePanel").classList.add("hidden");
  clock.getDelta();
}

function endGame(victory) {
  playing = false;

  document.getElementById("resultPanel").classList.remove("hidden");
  document.getElementById("resultTitle").textContent =
    victory ? "VICTORY!" : "GAME OVER";

  document.getElementById("resultText").textContent =
    victory
      ? "The shadow world is safe... for now."
      : "The darkness has won this time. Try again.";
}

document.getElementById("pause").onclick = pauseGame;
document.getElementById("resume").onclick = resumeGame;
document.getElementById("retry").onclick = startGame;

function goHome() {
  playing = false;
  paused = false;

  document.getElementById("menu").classList.remove("hidden");
  document.getElementById("hud").classList.add("hidden");
  document.getElementById("mobileControls").classList.add("hidden");
  document.getElementById("pausePanel").classList.add("hidden");
  document.getElementById("resultPanel").classList.add("hidden");
}

document.getElementById("home").onclick = goHome;
document.getElementById("resultHome").onclick = goHome;

// Keyboard
window.addEventListener("keydown", e => {
  if (e.code === "KeyW" || e.code === "ArrowUp") input.forward = 1;
  if (e.code === "KeyS" || e.code === "ArrowDown") input.forward = -1;
  if (e.code === "KeyA" || e.code === "ArrowLeft") input.side = -1;
  if (e.code === "KeyD" || e.code === "ArrowRight") input.side = 1;
  if (e.code === "Space") input.jump = true;
  if (e.code === "KeyJ" || e.code === "KeyK") input.attack = true;
  if (e.code === "Escape") pauseGame();
});

window.addEventListener("keyup", e => {
  if (["KeyW", "ArrowUp", "KeyS", "ArrowDown"].includes(e.code)) input.forward = 0;
  if (["KeyA", "ArrowLeft", "KeyD", "ArrowRight"].includes(e.code)) input.side = 0;
  if (e.code === "Space") input.jump = false;
  if (e.code === "KeyJ" || e.code === "KeyK") input.attack = false;
});

// Touch joystick
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");
let joyPointer = null;

joystick.addEventListener("pointerdown", e => {
  joyPointer = e.pointerId;
  joystick.setPointerCapture(joyPointer);
  moveStick(e);
});

joystick.addEventListener("pointermove", e => {
  if (e.pointerId === joyPointer) moveStick(e);
});

function moveStick(e) {
  const rect = joystick.getBoundingClientRect();
  const dx = e.clientX - (rect.left + rect.width / 2);
  const dy = e.clientY - (rect.top + rect.height / 2);
  const distance = Math.min(36, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance;

  stick.style.transform = `translate(${x}px, ${y}px)`;

  input.side = Math.abs(dx) > 12 ? Math.sign(dx) : 0;
  input.forward = Math.abs(dy) > 12 ? -Math.sign(dy) : 0;
}

function resetStick() {
  joyPointer = null;
  stick.style.transform = "translate(0,0)";
  input.side = 0;
  input.forward = 0;
}

["pointerup", "pointercancel", "lostpointercapture"].forEach(event => {
  joystick.addEventListener(event, resetStick);
});

document.getElementById("jump").addEventListener("pointerdown", () => input.jump = true);
document.getElementById("jump").addEventListener("pointerup", () => input.jump = false);
document.getElementById("attack").addEventListener("pointerdown", () => input.attack = true);
document.getElementById("attack").addEventListener("pointerup", () => input.attack = false);

// Camera drag
let dragging = false;
let lastX = 0;
let lastY = 0;

renderer.domElement.addEventListener("pointerdown", e => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});

window.addEventListener("pointerup", () => dragging = false);

window.addEventListener("pointermove", e => {
  if (!dragging || !playing || paused) return;

  cameraYaw -= (e.clientX - lastX) * 0.005;
  cameraPitch += (e.clientY - lastY) * 0.003;
  cameraPitch = THREE.MathUtils.clamp(cameraPitch, -0.05, 0.8);

  lastX = e.clientX;
  lastY = e.clientY;
});

// Main update
const clockDelta = new THREE.Vector3();
const forward = new THREE.Vector3();
const right = new THREE.Vector3();
const moveDirection = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();

function updateGame(dt) {
  if (!playing || paused) return;

  attackCooldown -= dt;
  damageCooldown -= dt;

  if (messageTimer > 0) {
    messageTimer -= dt;
    if (messageTimer <= 0) {
      document.getElementById("message").textContent = "";
    }
  }

  // Camera-relative movement
  forward.set(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  right.set(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

  moveDirection.set(0, 0, 0);
  moveDirection.addScaledVector(forward, input.forward);
  moveDirection.addScaledVector(right, input.side);

  if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();

    player.position.addScaledVector(moveDirection, 5.5 * dt);

    const targetRotation = Math.atan2(moveDirection.x, moveDirection.z);
    player.rotation.y = THREE.MathUtils.lerp(
      player.rotation.y,
      targetRotation,
      Math.min(1, dt * 10)
    );
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -20, 20);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -25, 18);

  // Jump physics
  if (input.jump && grounded) {
    jumpVelocity = 7.5;
    grounded = false;
  }

  if (!grounded) {
    jumpVelocity -= 18 * dt;
    player.position.y += jumpVelocity * dt;

    if (player.position.y <= 0) {
      player.position.y = 0;
      jumpVelocity = 0;
      grounded = true;
    }
  }

  // Procedural running animation
  const moving = moveDirection.lengthSq() > 0;
  const t = clock.elapsedTime;

  if (!loadedModel) {
    const swing = moving ? Math.sin(t * 12) * 0.65 : Math.sin(t * 2) * 0.04;

    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = -swing;
    leftArm.rotation.x = -swing * 0.8;
    rightArm.rotation.x = swing * 0.8;

    player.userData.ponytail.rotation.x = -0.3 + Math.sin(t * 8) * 0.08;
  }

  if (mixer) mixer.update(dt);

  // Attack
  if (input.attack && attackCooldown <= 0) {
    attackCooldown = 0.65;
    attackAnimation = 0.3;

    const distance = player.position.distanceTo(boss.position);

    if (distance < 3.7) {
      const toBoss = boss.position.clone().sub(player.position).normalize();
      const facing = new THREE.Vector3(
        Math.sin(player.rotation.y), 0, Math.cos(player.rotation.y)
      );

      if (toBoss.dot(facing) > 0.15) {
        bossHP = Math.max(0, bossHP - 18);
        boss.position.addScaledVector(toBoss, 0.45);
        showMessage("KATANA STRIKE!");
        updateHUD();
      }
    }
  }

  if (attackAnimation > 0) {
    attackAnimation -= dt;
    player.userData.sword.rotation.x = -Math.sin(attackAnimation * 10) * 1.4;
  } else {
    player.userData.sword.rotation.x = 0;
  }

  // Collect coins
  for (const coin of coinObjects) {
    if (coin.userData.collected) continue;

    coin.rotation.y += dt * 2.5;

    if (coin.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1, 0))) < 1.1) {
      coin.userData.collected = true;
      coin.visible = false;
      coins++;
      updateHUD();
    }
  }

  // Boss follows player
  const bossDistance = boss.position.distanceTo(player.position);

  if (bossHP > 0 && bossDistance > 1.8) {
    const direction = player.position.clone().sub(boss.position);
    direction.y = 0;
    direction.normalize();
    boss.position.addScaledVector(direction, 1.5 * dt);
    boss.rotation.y = Math.atan2(direction.x, direction.z);
  }

  // Boss contact damage
  if (bossDistance < 1.8 && damageCooldown <= 0) {
    health = Math.max(0, health - 12);
    damageCooldown = 1.0;
    showMessage("DANGER!");
    updateHUD();
  }

  // Boss defeated
  if (bossHP <= 0) {
    endGame(true);
    showMessage("BOSS DEFEATED!");
  }

  if (health <= 0) endGame(false);

  // Camera follow
  const cameraOffset = new THREE.Vector3(
    Math.sin(cameraYaw) * 6,
    3.4 + cameraPitch * 2,
    Math.cos(cameraYaw) * 6
  );

  cameraTarget.copy(player.position).add(new THREE.Vector3(0, 1.4, 0));

  const desiredCamera = cameraTarget.clone().add(cameraOffset);
  camera.position.lerp(desiredCamera, 1 - Math.pow(0.001, dt));
  camera.lookAt(cameraTarget);
}

// Render loop
function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (playing && !paused) {
    updateGame(dt);
  }

  renderer.render(scene, camera);
}

animate();

// Responsive screen
window.addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
});

// Initial view
buildEnvironment();
camera.position.set(0, 4, 10);
camera.lookAt(0, 1, 0);

document.getElementById("loading").style.display = "none";
