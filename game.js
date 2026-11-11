
import * as THREE from "three";

const $ = id => document.getElementById(id);

let scene, camera, renderer, clock;
let heroine, boss, sword, slash;
let playerParts = {};
let keys = {};
let running = false;
let paused = false;
let gameEnded = false;
let selectedStage = "forest";
let health = 100;
let bossHealth = 100;
let velocityY = 0;
let grounded = true;
let attackTime = 0;
let invulnerable = 0;
let elapsed = 0;
let cameraAngle = 0;
let cameraDistance = 6.5;
let joystick = { x: 0, y: 0 };
let lastAttack = 0;
let particles = [];
let trees = [];
let enemies = [];
let audioContext;
let animationFrame;
let playerSpeed = 4.5;

const stages = {
  forest: {
    name: "MOONLIT FOREST",
    sky: 0x10172c,
    ground: 0x263a32,
    fog: 0x172235,
    boss: 0x8d315d
  },
  ice: {
    name: "FROZEN TEMPLE",
    sky: 0x142d48,
    ground: 0x8eb7cb,
    fog: 0x31516c,
    boss: 0x4ca9e0
  },
  lava: {
    name: "LAVA FORTRESS",
    sky: 0x371622,
    ground: 0x503027,
    fog: 0x55231e,
    boss: 0xe85a36
  }
};

function showError(error) {
  console.error(error);
  $("loading").classList.add("hidden");
  $("menu").classList.add("hidden");
  $("errorBox").classList.remove("hidden");
  $("errorText").textContent =
    error?.message || String(error) || "Unknown loading error";
}

function material(color, roughness = 0.8, metalness = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

function box(parent, name, size, color, position, options = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(...size),
    material(color, options.roughness ?? 0.8, options.metalness ?? 0)
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function sphere(parent, name, size, color, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(size, 24, 18),
    material(color)
  );
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function capsule(parent, name, radius, length, color, position) {
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 6, 12),
    material(color)
  );
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.name = name;
  parent.add(mesh);
  return mesh;
}

function makeLimb(parent, name, color, position, radius = 0.095) {
  const pivot = new THREE.Group();
  pivot.position.set(...position);
  parent.add(pivot);
  const limb = capsule(pivot, name, radius, 0.37, color, [0, -0.22, 0]);
  return pivot;
}

function createHeroine() {
  const root = new THREE.Group();
  root.position.set(0, 0, 0);
  scene.add(root);

  const body = new THREE.Group();
  root.add(body);

  const dark = 0x191522;
  const skin = 0xe7ae9e;
  const red = 0xb52c55;
  const hairColor = 0x11101b;

  // Legs
  playerParts.leftLeg = makeLimb(body, "leftLeg", dark, [-0.13, 0.88, 0]);
  playerParts.rightLeg = makeLimb(body, "rightLeg", dark, [0.13, 0.88, 0]);

  // Boots
  box(body, "leftBoot", [0.23, 0.14, 0.37], dark, [-0.13, 0.16, 0.07]);
  box(body, "rightBoot", [0.23, 0.14, 0.37], dark, [0.13, 0.16, 0.07]);

  // Torso and waist
  const torso = capsule(body, "torso", 0.22, 0.45, dark, [0, 1.35, 0]);
  torso.scale.set(1.08, 1, 0.76);

  const waist = box(body, "waist", [0.4, 0.14, 0.28], red, [0, 1.08, 0]);
  waist.rotation.z = -0.04;

  // Chest armor
  const armor = sphere(body, "chestArmor", 0.22, 0x30213a, [0, 1.53, 0.04], [1.1, 0.9, 0.65]);
  armor.material.metalness = 0.25;

  // Belt
  box(body, "belt", [0.43, 0.055, 0.3], red, [0, 1.11, 0.02]);

  // Neck and head
  capsule(body, "neck", 0.09, 0.12, skin, [0, 1.76, 0]);
  sphere(body, "face", 0.2, skin, [0, 1.98, 0.02], [0.82, 1.13, 0.82]);

  // Face mask
  const mask = box(body, "faceMask", [0.29, 0.09, 0.25], dark, [0, 1.89, 0.14]);
  mask.rotation.x = -0.1;

  // Hair cap
  sphere(body, "hairCap", 0.22, hairColor, [0, 2.09, -0.015], [1.05, 0.72, 1]);

  // Long hair back
  const longHair = capsule(body, "longHair", 0.105, 0.62, hairColor, [0, 1.83, -0.13]);
  longHair.rotation.x = -0.18;

  // Ponytail
  playerParts.ponytail = new THREE.Group();
  playerParts.ponytail.position.set(0, 2.08, -0.12);
  body.add(playerParts.ponytail);
  const tail = capsule(playerParts.ponytail, "ponytail", 0.075, 0.65, hairColor, [0, -0.36, -0.13]);
  tail.rotation.x = -0.65;

  // Headband
  const band = box(body, "headband", [0.38, 0.055, 0.28], red, [0, 2.08, 0.01]);
  band.rotation.z = 0.08;

  // Eyes
  sphere(body, "leftEye", 0.025, 0x231321, [-0.065, 1.98, 0.193], [1.2, 0.7, 0.4]);
  sphere(body, "rightEye", 0.025, 0x231321, [0.065, 1.98, 0.193], [1.2, 0.7, 0.4]);

  // Arms
  playerParts.leftArm = makeLimb(body, "leftArm", dark, [-0.28, 1.53, 0], 0.09);
  playerParts.rightArm = makeLimb(body, "rightArm", dark, [0.28, 1.53, 0], 0.09);

  // Gloves
  sphere(body, "leftGlove", 0.1, red, [-0.28, 1.23, 0.02]);
  sphere(body, "rightGlove", 0.1, red, [0.28, 1.23, 0.02]);

  // Scarf
  playerParts.scarf = new THREE.Group();
  playerParts.scarf.position.set(0, 1.69, -0.08);
  body.add(playerParts.scarf);

  const scarfTail = box(
    playerParts.scarf, "scarfTail",
    [0.12, 0.52, 0.045], red, [-0.18, -0.27, -0.05]
  );
  scarfTail.rotation.z = -0.38;

  // Katana attached to right hand
  sword = new THREE.Group();
  sword.position.set(0.32, 1.25, 0.02);
  sword.rotation.z = -0.4;
  body.add(sword);

  box(sword, "handle", [0.055, 0.38, 0.055], 0x291b25, [0, -0.13, 0]);
  box(sword, "guard", [0.22, 0.045, 0.07], 0xc5a16a, [0, 0.08, 0]);
  box(sword, "blade", [0.055, 0.92, 0.035], 0xcbd8ed, [0, 0.55, 0], { metalness: 0.85, roughness: 0.2 });

  playerParts.body = body;
  heroine = root;
  return root;
}

function createBoss() {
  boss = new THREE.Group();
  boss.position.set(0, 0, -9);
  scene.add(boss);

  const color = stages[selectedStage].boss;

  capsule(boss, "bossBody", 0.65, 1.1, color, [0, 1.15, 0]);
  sphere(boss, "bossHead", 0.58, color, [0, 2.15, 0]);
  sphere(boss, "bossEyeL", 0.11, 0xff3131, [-0.22, 2.18, 0.49]);
  sphere(boss, "bossEyeR", 0.11, 0xff3131, [0.22, 2.18, 0.49]);

  const hornL = capsule(boss, "hornL", 0.12, 0.45, 0xe7d5d4, [-0.42, 2.65, 0]);
  const hornR = capsule(boss, "hornR", 0.12, 0.45, 0xe7d5d4, [0.42, 2.65, 0]);
  hornL.rotation.z = 0.5;
  hornR.rotation.z = -0.5;

  makeLimb(boss, "bossArmL", color, [-0.75, 1.55, 0], 0.22);
  makeLimb(boss, "bossArmR", color, [0.75, 1.55, 0], 0.22);

  boss.userData.attackClock = 0;
}

function createTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.scale.setScalar(scale);
  scene.add(tree);

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.22, 3.4, 8),
    material(0x342a2c)
  );
  trunk.position.y = 1.7;
  trunk.castShadow = true;
  tree.add(trunk);

  const leafColor = selectedStage === "ice" ? 0x7399ae :
    selectedStage === "lava" ? 0x63312a : 0x173d37;

  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(
      new THREE.ConeGeometry(1.15 - i * 0.18, 2, 8),
      material(leafColor)
    );
    leaf.position.y = 2.8 + i * 0.9;
    leaf.castShadow = true;
    tree.add(leaf);
  }

  trees.push(tree);
}

function createWorld() {
  const stage = stages[selectedStage];

  scene.background = new THREE.Color(stage.sky);
  scene.fog = new THREE.Fog(stage.fog, 14, 55);

  const hemi = new THREE.HemisphereLight(0xa7c4ff, 0x22202b, 2);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xc4d6ff, 2.3);
  moonLight.position.set(-8, 14, 8);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -20;
  moonLight.shadow.camera.right = 20;
  moonLight.shadow.camera.top = 20;
  moonLight.shadow.camera.bottom = -20;
  scene.add(moonLight);

  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xe9edff })
  );
  moon.position.set(-12, 13, -22);
  scene.add(moon);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    material(stage.ground)
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // Path
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 40),
    material(selectedStage === "ice" ? 0x9bbccc : selectedStage === "lava" ? 0x765044 : 0x35443b)
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, 0.015, -10);
  scene.add(path);

  // Trees along both sides
  trees = [];
  for (let z = -27; z < 14; z += 4) {
    createTree(-5 - Math.random() * 3, z, 0.8 + Math.random() * 0.8);
    createTree(5 + Math.random() * 3, z - 1, 0.8 + Math.random() * 0.8);
  }

  // Rocks
  for (let i = 0; i < 22; i++) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.35 + Math.random() * 0.5, 0),
      material(selectedStage === "ice" ? 0x7e9cae : 0x383642)
    );
    rock.position.set((Math.random() - 0.5) * 18, 0.25, -24 + Math.random() * 38);
    rock.rotation.set(Math.random(), Math.random(), Math.random());
    rock.castShadow = true;
    scene.add(rock);
  }

  // Ground glow lights
  if (selectedStage === "lava") {
    for (let i = 0; i < 8; i++) {
      const light = new THREE.PointLight(0xff512f, 2, 7);
      light.position.set((Math.random() - 0.5) * 12, 0.6, -25 + Math.random() * 35);
      scene.add(light);
    }
  }
}

function createParticles(position, color, amount = 12) {
  for (let i = 0; i < amount; i++) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 6, 6),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(position);
    scene.add(mesh);
    particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        Math.random() * 4,
        (Math.random() - 0.5) * 5
      ),
      life: 0.55
    });
  }
}

function playSound(frequency = 450, duration = 0.12) {
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state === "suspended") audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.07, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (e) {
    console.warn("Audio unavailable", e);
  }
}

function init() {
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(
    65, window.innerWidth / window.innerHeight, 0.1, 150
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  document.body.appendChild(renderer.domElement);
  renderer.domElement.id = "world";

  createWorld();
  createHeroine();
  createBoss();

  camera.position.set(0, 4, 7);
  camera.lookAt(0, 1.5, 0);

  setupControls();
  window.addEventListener("resize", resize);

  $("loading").classList.add("hidden");
  $("menu").classList.remove("hidden");
  $("loadingText").textContent = "WORLD READY";

  animate();
}

function setupControls() {
  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "Space") e.preventDefault();
    if (e.code === "KeyJ" && running && !paused) attack();
  });

  window.addEventListener("keyup", e => {
    keys[e.code] = false;
  });

  // Drag to rotate camera
  let dragging = false;
  let previousX = 0;

  renderer.domElement.addEventListener("pointerdown", e => {
    if (e.pointerType === "mouse" || e.clientY < window.innerHeight * 0.65) {
      dragging = true;
      previousX = e.clientX;
    }
  });

  window.addEventListener("pointermove", e => {
    if (!dragging || paused) return;
    cameraAngle -= (e.clientX - previousX) * 0.006;
    previousX = e.clientX;
  });

  window.addEventListener("pointerup", () => dragging = false);

  $("jumpBtn").addEventListener("pointerdown", e => {
    e.preventDefault();
    jump();
  });

  $("attackBtn").addEventListener("pointerdown", e => {
    e.preventDefault();
    attack();
  });

  // Joystick
  const joy = $("joystick");
  const stick = $("stick");
  let joyPointer = null;

  function moveStick(e) {
    const rect = joy.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = e.clientX - centerX;
    let dy = e.clientY - centerY;
    const max = 30;
    const length = Math.hypot(dx, dy);
    if (length > max) {
      dx = dx / length * max;
      dy = dy / length * max;
    }
    joystick.x = dx / max;
    joystick.y = dy / max;
    stick.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  joy.addEventListener("pointerdown", e => {
    e.preventDefault();
    joyPointer = e.pointerId;
    joy.setPointerCapture(e.pointerId);
    moveStick(e);
  });

  joy.addEventListener("pointermove", e => {
    if (e.pointerId === joyPointer) moveStick(e);
  });

  function releaseJoy() {
    joyPointer = null;
    joystick.x = 0;
    joystick.y = 0;
    stick.style.transform = "translate(0,0)";
  }

  joy.addEventListener("pointerup", releaseJoy);
  joy.addEventListener("pointercancel", releaseJoy);

  $("pauseBtn").onclick = pauseGame;
  $("resumeBtn").onclick = resumeGame;
  $("quitBtn").onclick = goHome;
  $("homeBtn").onclick = goHome;
  $("againBtn").onclick = startGame;

  $("enterBtn").onclick = startGame;

  document.querySelectorAll(".stage").forEach(button => {
    button.onclick = () => {
      selectedStage = button.dataset.stage;
      document.querySelectorAll(".stage").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
    };
  });
}

function jump() {
  if (!running || paused || !grounded) return;
  velocityY = 8.3;
  grounded = false;
  playSound(620);
}

function attack() {
  if (!running || paused || gameEnded || elapsed - lastAttack < 0.55) return;

  lastAttack = elapsed;
  attackTime = 0.38;
  sword.rotation.z = -1.6;
  playSound(760, 0.18);

  const distance = heroine.position.distanceTo(boss.position);
  if (distance < 3.6) {
    bossHealth = Math.max(0, bossHealth - 22);
    createParticles(
      boss.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
      0xff7aa8,
      16
    );
    updateHUD();

    if (bossHealth <= 0) finishGame(true);
  }
}

function updateHUD() {
  $("healthBar").style.width = health + "%";
  $("bossBar").style.width = bossHealth + "%";
}

function updatePlayer(dt) {
  const forwardInput =
    (keys.KeyW || keys.ArrowUp ? 1 : 0) -
    (keys.KeyS || keys.ArrowDown ? 1 : 0) - joystick.y;

  const sideInput =
    (keys.KeyD || keys.ArrowRight ? 1 : 0) -
    (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joystick.x;

  const input = new THREE.Vector2(sideInput, forwardInput);
  if (input.length() > 1) input.normalize();

  const moving = input.length() > 0.08;
  const angle = cameraAngle;

  const forward = new THREE.Vector3(
    -Math.sin(angle), 0, -Math.cos(angle)
  );
  const right = new THREE.Vector3(
    Math.cos(angle), 0, -Math.sin(angle)
  );

  const direction = new THREE.Vector3()
    .addScaledVector(forward, input.y)
    .addScaledVector(right, input.x);

  if (moving) {
    direction.normalize();
    heroine.position.addScaledVector(direction, playerSpeed * dt);

    const targetRotation = Math.atan2(direction.x, direction.z);
    heroine.rotation.y = THREE.MathUtils.lerp(
      heroine.rotation.y,
      targetRotation,
      Math.min(1, dt * 12)
    );
  }

  heroine.position.x = THREE.MathUtils.clamp(heroine.position.x, -13, 13);
  heroine.position.z = THREE.MathUtils.clamp(heroine.position.z, -29, 12);

  // Gravity
  velocityY -= 19 * dt;
  heroine.position.y += velocityY * dt;

  if (heroine.position.y <= 0) {
    heroine.position.y = 0;
    velocityY = 0;
    grounded = true;
  }

  // Character animation
  const swing = moving ? Math.sin(elapsed * 11) * 0.7 : Math.sin(elapsed * 2) * 0.04;
  playerParts.leftLeg.rotation.x = swing;
  playerParts.rightLeg.rotation.x = -swing;
  playerParts.leftArm.rotation.x = -swing * 0.6;
  playerParts.rightArm.rotation.x = swing * 0.6;

  playerParts.ponytail.rotation.x = Math.sin(elapsed * 5) * 0.18;
  playerParts.scarf.rotation.z = moving ? Math.sin(elapsed * 9) * 0.2 : Math.sin(elapsed * 2) * 0.06;

  playerParts.body.position.y = grounded
    ? Math.abs(Math.sin(elapsed * (moving ? 11 : 2))) * (moving ? 0.07 : 0.018)
    : 0.05;

  if (attackTime > 0) {
    attackTime -= dt;
    sword.rotation.z = -1.6 + (0.9 * (attackTime / 0.38));
  } else {
    sword.rotation.z = THREE.MathUtils.lerp(sword.rotation.z, -0.4, dt * 12);
  }

  if (invulnerable > 0) {
    invulnerable -= dt;
    playerParts.body.visible = Math.floor(elapsed * 15) % 2 === 0;
  } else {
    playerParts.body.visible = true;
  }
}

function updateBoss(dt) {
  if (bossHealth <= 0) return;

  const distance = boss.position.distanceTo(heroine.position);

  if (distance > 2.4) {
    const direction = heroine.position.clone().sub(boss.position);
    direction.y = 0;
    direction.normalize();
    boss.position.addScaledVector(direction, 1.3 * dt);
    boss.rotation.y = Math.atan2(direction.x, direction.z);
  } else {
    boss.userData.attackClock += dt;

    if (boss.userData.attackClock > 1.5) {
      boss.userData.attackClock = 0;

      if (invulnerable <= 0) {
        health = Math.max(0, health - 12);
        invulnerable = 1;
        updateHUD();
        playSound(130, 0.2);
        createParticles(heroine.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff536d, 8);

        if (health <= 0) finishGame(false);
      }
    }
  }

  boss.position.x = THREE.MathUtils.clamp(boss.position.x, -14, 14);
}

function updateParticles(dt) {
  particles = particles.filter(p => {
    p.life -= dt;
    p.mesh.position.addScaledVector(p.velocity, dt);
    p.velocity.y -= 6 * dt;
    p.mesh.scale.multiplyScalar(0.97);

    if (p.life <= 0) {
      scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
      return false;
    }
    return true;
  });
}

function updateCamera(dt) {
  const offset = new THREE.Vector3(
    Math.sin(cameraAngle) * cameraDistance,
    3.1,
    Math.cos(cameraAngle) * cameraDistance
  );

  const desired = heroine.position.clone().add(offset);
  camera.position.lerp(desired, Math.min(1, dt * 5));
  camera.lookAt(heroine.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
}

function animate() {
  animationFrame = requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.04);
  elapsed += dt;

  if (running && !paused && !gameEnded) {
    updatePlayer(dt);
    updateBoss(dt);
    updateParticles(dt);
    updateCamera(dt);
  } else if (heroine) {
    updateCamera(dt);
  }

  if (boss && bossHealth > 0) {
    boss.children[0].rotation.z = Math.sin(elapsed * 2) * 0.04;
  }

  renderer.render(scene, camera);
}

function resize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
}

function clearWorld() {
  if (!scene) return;

  for (const child of [...scene.children]) {
    scene.remove(child);
    child.traverse?.(object => {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) object.material.forEach(m => m.dispose());
        else object.material.dispose();
      }
    });
  }
  particles = [];
  trees = [];
  heroine = null;
  boss = null;
}

function startGame() {
  running = false;
  paused = false;
  gameEnded = false;
  health = 100;
  bossHealth = 100;
  velocityY = 0;
  grounded = true;
  elapsed = 0;
  lastAttack = -1;
  invulnerable = 0;
  joystick.x = 0;
  joystick.y = 0;
  $("stick").style.transform = "translate(0,0)";

  $("menu").classList.add("hidden");
  $("result").classList.add("hidden");
  $("pausePanel").classList.add("hidden");
  $("hud").classList.remove("hidden");
  $("message").textContent = "DEFEAT THE " + (
    selectedStage === "forest" ? "FOREST DEMON" :
    selectedStage === "ice" ? "ICE MONSTER" : "LAVA KING"
  );

  clearWorld();
  createWorld();
  createHeroine();
  createBoss();

  boss.position.set(0, 0, -9);
  cameraAngle = 0;
  updateHUD();
  running = true;
  playSound(500);
}

function finishGame(victory) {
  if (gameEnded) return;
  gameEnded = true;
  running = false;

  $("hud").classList.add("hidden");
  $("result").classList.remove("hidden");
  $("resultTitle").textContent = victory ? "VICTORY!" : "GAME OVER";
  $("resultMessage").textContent = victory
    ? "The shadow world is safe. You are a true warrior."
    : "Your mission has failed. Train and try again.";
  $("againBtn").textContent = victory ? "PLAY AGAIN" : "RETRY";
  playSound(victory ? 950 : 120, 0.3);
}

function pauseGame() {
  if (!running || gameEnded) return;
  paused = true;
  $("pausePanel").classList.remove("hidden");
}

function resumeGame() {
  paused = false;
  $("pausePanel").classList.add("hidden");
}

function goHome() {
  running = false;
  paused = false;
  gameEnded = false;
  $("hud").classList.add("hidden");
  $("result").classList.add("hidden");
  $("pausePanel").classList.add("hidden");
  $("menu").classList.remove("hidden");
  clearWorld();
  createWorld();
  createHeroine();
  createBoss();
}

try {
  init();
} catch (error) {
  showError(error);
}
