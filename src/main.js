import "./style.css";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const canvas = document.querySelector("#scene");
const messageEl = document.querySelector("#message");
const hitsEl = document.querySelector("#hits");
const comboEl = document.querySelector("#combo");
const scoreEl = document.querySelector("#score");
const meterTextEl = document.querySelector("#meter-text");
const meterFillEl = document.querySelector("#meter-fill");
const gameOverEl = document.querySelector("#game-over");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x667060, 0.048);

const camera = new THREE.PerspectiveCamera(
  56,
  window.innerWidth / window.innerHeight,
  0.1,
  140,
);
camera.position.set(0, 3.5, 10);

const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const gravity = new THREE.Vector3(0, -19, 0);
const upVector = new THREE.Vector3(0, 1, 0);
const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.2);

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

const phoneMetrics = {
  width: 3.1,
  length: 6.8,
  thickness: 0.32,
};

const world = {
  arenaRadius: 18,
  phoneCenter: new THREE.Vector3(0, phoneMetrics.thickness / 2 + 0.02, -6.4),
};

const state = {
  playerPosition: new THREE.Vector3(0, 0, 6.6),
  playerYaw: Math.PI,
  cameraYaw: Math.PI,
  cameraPitch: -0.2,
  moveAmount: 0,
  walkCycle: 0,
  cooldown: 0,
  verticalVelocity: 0,
  grounded: true,
  hemorrhoids: 0,
  score: 0,
  hits: 0,
  combo: 0,
  gameOver: false,
  resetTimer: 0,
  lastPointerX: null,
  lastPointerY: null,
  message: "",
};

const projectiles = [];
const splats = [];
const smokePuffs = [];
const dustPuffs = [];

const phoneRig = createPhone();
const aimMarker = createAimMarker();
const dangerRing = createDangerRing();
const hero = buildHero();

scene.add(phoneRig);
scene.add(aimMarker);
scene.add(dangerRing);
scene.add(hero.root);

setupLights();
setupWorld();
resetRound(true);

window.addEventListener("resize", onResize);
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);

animate();

function setupLights() {
  const hemisphere = new THREE.HemisphereLight(0xf2e8c8, 0x3d332a, 1.45);
  scene.add(hemisphere);

  const sun = new THREE.DirectionalLight(0xfff0c9, 2.5);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  sun.shadow.bias = -0.0001;
  scene.add(sun);

  const rim = new THREE.PointLight(0xd76f33, 18, 34, 2);
  rim.position.set(-12, 5, -14);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x9fb8ff, 1.05);
  fill.position.set(-10, 7, 12);
  scene.add(fill);
}

function setupWorld() {
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(26, 80),
    new THREE.MeshStandardMaterial({
      color: 0x4f4d42,
      roughness: 0.98,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const grime = new THREE.Mesh(
    new THREE.CircleGeometry(6.2, 60),
    new THREE.MeshStandardMaterial({
      color: 0x37362f,
      roughness: 1,
      transparent: true,
      opacity: 0.78,
    }),
  );
  grime.rotation.x = -Math.PI / 2;
  grime.position.set(world.phoneCenter.x, 0.012, world.phoneCenter.z);
  scene.add(grime);

  const curb = new THREE.Mesh(
    new THREE.TorusGeometry(9.8, 0.3, 14, 80),
    new THREE.MeshStandardMaterial({
      color: 0x746555,
      roughness: 0.95,
    }),
  );
  curb.rotation.x = Math.PI / 2;
  curb.position.y = 0.02;
  scene.add(curb);

  const ashTray = new THREE.Mesh(
    new THREE.TorusGeometry(1.05, 0.12, 16, 60),
    new THREE.MeshStandardMaterial({
      color: 0x837569,
      roughness: 0.9,
      metalness: 0.2,
    }),
  );
  ashTray.rotation.x = Math.PI / 2;
  ashTray.position.set(6.6, 0.15, 7.8);
  ashTray.castShadow = true;
  ashTray.receiveShadow = true;
  scene.add(ashTray);

  for (let index = 0; index < 85; index += 1) {
    const butt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.028, 0.028, 0.3, 8),
      new THREE.MeshStandardMaterial({
        color: index % 4 === 0 ? 0xe6cfab : 0xcab48b,
        roughness: 0.96,
      }),
    );
    butt.rotation.z = Math.random() * Math.PI;
    butt.rotation.x = Math.random() * 0.25;
    butt.position.set(
      THREE.MathUtils.randFloatSpread(18),
      0.025,
      THREE.MathUtils.randFloatSpread(18),
    );
    butt.receiveShadow = true;
    scene.add(butt);
  }

  const dustGeometry = new THREE.SphereGeometry(0.05, 6, 6);
  for (let index = 0; index < 44; index += 1) {
    const particle = new THREE.Mesh(
      dustGeometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(0.1, 0.16, 0.75),
        transparent: true,
        opacity: 0.13 + Math.random() * 0.12,
      }),
    );
    particle.position.set(
      THREE.MathUtils.randFloatSpread(22),
      1.4 + Math.random() * 5.8,
      THREE.MathUtils.randFloatSpread(22),
    );
    particle.userData = {
      drift: new THREE.Vector3(
        THREE.MathUtils.randFloat(-0.12, 0.12),
        THREE.MathUtils.randFloat(0.01, 0.05),
        THREE.MathUtils.randFloat(-0.12, 0.12),
      ),
      phase: Math.random() * Math.PI * 2,
    };
    dustPuffs.push(particle);
    scene.add(particle);
  }
}

function buildHero() {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  const headPivot = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const buttAnchor = new THREE.Object3D();
  const cigaretteTip = new THREE.Object3D();

  const coatMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b5544,
    roughness: 0.98,
  });
  const legMaterial = new THREE.MeshStandardMaterial({
    color: 0x4c4c4c,
    roughness: 0.96,
  });
  const bootMaterial = new THREE.MeshStandardMaterial({
    color: 0x23201e,
    roughness: 0.92,
  });
  const skinMaterial = new THREE.MeshStandardMaterial({
    color: 0xc9926d,
    roughness: 0.9,
  });
  const hatMaterial = new THREE.MeshStandardMaterial({
    color: 0x5d473b,
    roughness: 1,
  });

  root.add(torso, leftLeg, rightLeg);
  torso.add(headPivot, leftArm, rightArm, buttAnchor);

  const coat = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.55, 1.28, 8, 16),
    coatMaterial,
  );
  coat.position.y = 1.45;
  coat.scale.z = 0.82;
  coat.castShadow = true;
  coat.receiveShadow = true;
  torso.add(coat);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 18, 18),
    new THREE.MeshStandardMaterial({
      color: 0x646d59,
      roughness: 0.95,
    }),
  );
  belly.position.set(0, 1.32, 0.08);
  belly.scale.set(1.02, 0.9, 0.78);
  belly.castShadow = true;
  torso.add(belly);

  const scarf = new THREE.Mesh(
    new THREE.TorusGeometry(0.39, 0.08, 12, 32),
    new THREE.MeshStandardMaterial({
      color: 0x815142,
      roughness: 0.92,
    }),
  );
  scarf.rotation.x = Math.PI / 2;
  scarf.position.y = 1.97;
  scarf.castShadow = true;
  torso.add(scarf);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 20, 20),
    skinMaterial,
  );
  head.position.y = 2.34;
  head.castShadow = true;
  headPivot.add(head);

  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.08, 0.17, 10),
    new THREE.MeshStandardMaterial({
      color: 0xbf8865,
      roughness: 0.88,
    }),
  );
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 2.3, 0.28);
  headPivot.add(nose);

  const moustache = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.05, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xd1d2c0,
      roughness: 1,
    }),
  );
  moustache.position.set(0, 2.22, 0.23);
  moustache.castShadow = true;
  headPivot.add(moustache);

  const hat = new THREE.Mesh(
    new THREE.CylinderGeometry(0.36, 0.34, 0.22, 18),
    hatMaterial,
  );
  hat.position.y = 2.63;
  hat.castShadow = true;
  headPivot.add(hat);

  const earFlapLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.27, 0.06), hatMaterial);
  earFlapLeft.position.set(-0.35, 2.52, 0);
  const earFlapRight = earFlapLeft.clone();
  earFlapRight.position.x = 0.35;
  headPivot.add(earFlapLeft, earFlapRight);

  const shoulderLeft = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 14, 14),
    coatMaterial,
  );
  shoulderLeft.position.set(-0.55, 1.86, 0);
  shoulderLeft.castShadow = true;
  torso.add(shoulderLeft);

  const shoulderRight = shoulderLeft.clone();
  shoulderRight.position.x = 0.55;
  torso.add(shoulderRight);

  const armGeometry = new THREE.CapsuleGeometry(0.11, 0.7, 6, 12);
  const leftForearm = new THREE.Mesh(armGeometry, coatMaterial);
  leftForearm.position.set(0, -0.34, 0.03);
  leftForearm.rotation.z = 0.12;
  leftForearm.castShadow = true;
  leftArm.position.set(-0.7, 1.72, 0.05);
  leftArm.add(leftForearm);

  const rightForearm = new THREE.Mesh(armGeometry, coatMaterial);
  rightForearm.position.set(0, -0.34, 0.1);
  rightForearm.rotation.z = -0.52;
  rightForearm.rotation.x = 0.24;
  rightForearm.castShadow = true;
  rightArm.position.set(0.74, 1.76, 0.08);
  rightArm.add(rightForearm);

  const hand = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 12, 12),
    new THREE.MeshStandardMaterial({
      color: 0xb78463,
      roughness: 0.86,
    }),
  );
  hand.position.set(0.22, -0.7, 0.37);
  hand.castShadow = true;
  rightArm.add(hand);

  const cigarette = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10),
    new THREE.MeshStandardMaterial({
      color: 0xe4dac0,
      roughness: 0.82,
      metalness: 0.02,
    }),
  );
  cigarette.rotation.z = Math.PI / 2;
  cigarette.position.set(0.36, -0.7, 0.36);
  rightArm.add(cigarette);

  const ember = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xff6a2e,
    }),
  );
  ember.position.set(0.55, -0.7, 0.36);
  rightArm.add(ember);
  cigaretteTip.position.copy(ember.position);
  rightArm.add(cigaretteTip);

  const leftUpperLeg = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.16, 0.86, 12),
    legMaterial,
  );
  leftUpperLeg.position.y = 0.58;
  leftUpperLeg.castShadow = true;
  leftLeg.position.set(-0.2, 0, 0.03);
  leftLeg.add(leftUpperLeg);

  const rightUpperLeg = leftUpperLeg.clone();
  rightLeg.position.set(0.2, 0, 0.03);
  rightLeg.add(rightUpperLeg);

  const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.72), bootMaterial);
  leftBoot.position.set(0, 0.08, 0.08);
  leftBoot.castShadow = true;
  leftBoot.receiveShadow = true;
  leftLeg.add(leftBoot);

  const rightBoot = leftBoot.clone();
  rightLeg.add(rightBoot);

  buttAnchor.position.set(0, 1.06, -0.46);

  return {
    root,
    torso,
    headPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    buttAnchor,
    cigaretteTip,
  };
}

function createPhone() {
  const texture = new THREE.TextureLoader().load("/models/s25-screen.png");
  texture.colorSpace = THREE.SRGBColorSpace;

  const group = new THREE.Group();
  group.position.copy(world.phoneCenter);
  group.rotation.y = -0.32;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width, phoneMetrics.thickness, phoneMetrics.length),
    new THREE.MeshStandardMaterial({
      color: 0x14181c,
      roughness: 0.24,
      metalness: 0.62,
    }),
  );
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.97, phoneMetrics.thickness * 0.82, phoneMetrics.length * 0.98),
    new THREE.MeshStandardMaterial({
      color: 0x46525f,
      roughness: 0.2,
      metalness: 0.82,
    }),
  );
  frame.position.y = 0.01;
  group.add(frame);

  const screenBase = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.9, 0.02, phoneMetrics.length * 0.92),
    new THREE.MeshStandardMaterial({
      color: 0x07090d,
      roughness: 0.16,
      metalness: 0.12,
    }),
  );
  screenBase.position.y = phoneMetrics.thickness / 2 + 0.004;
  group.add(screenBase);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(phoneMetrics.width * 0.84, phoneMetrics.length * 0.88),
    new THREE.MeshBasicMaterial({
      map: texture,
    }),
  );
  screen.rotation.x = -Math.PI / 2;
  screen.position.y = phoneMetrics.thickness / 2 + 0.016;
  group.add(screen);

  const cameraHole = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 18),
    new THREE.MeshBasicMaterial({
      color: 0x020304,
    }),
  );
  cameraHole.rotation.x = -Math.PI / 2;
  cameraHole.position.set(0, phoneMetrics.thickness / 2 + 0.02, -phoneMetrics.length * 0.34);
  group.add(cameraHole);

  const speaker = new THREE.Mesh(
    new THREE.BoxGeometry(phoneMetrics.width * 0.22, 0.012, 0.06),
    new THREE.MeshStandardMaterial({
      color: 0xa6afba,
      roughness: 0.3,
      metalness: 0.6,
    }),
  );
  speaker.position.set(0, phoneMetrics.thickness / 2 + 0.011, -phoneMetrics.length * 0.44);
  group.add(speaker);

  const buttonMaterial = new THREE.MeshStandardMaterial({
    color: 0x57616d,
    roughness: 0.26,
    metalness: 0.7,
  });
  const sideButtonA = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.58), buttonMaterial);
  sideButtonA.position.set(phoneMetrics.width / 2 + 0.01, 0.01, -0.45);
  const sideButtonB = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), buttonMaterial);
  sideButtonB.position.set(phoneMetrics.width / 2 + 0.01, 0.01, 0.32);
  group.add(sideButtonA, sideButtonB);

  return group;
}

function createAimMarker() {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.028, 12, 36),
    new THREE.MeshBasicMaterial({
      color: 0xf0c878,
      transparent: true,
      opacity: 0.75,
    }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const dot = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 10, 10),
    new THREE.MeshBasicMaterial({
      color: 0xfffbdb,
    }),
  );
  dot.position.y = 0.02;
  group.add(dot);

  return group;
}

function createDangerRing() {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.6, 6.8, 64),
    new THREE.MeshBasicMaterial({
      color: 0xe88b4b,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.copy(world.phoneCenter);
  ring.position.y = 0.025;
  return ring;
}

function resetRound(initial = false) {
  clearProjectiles();
  clearSplats();

  state.playerPosition.set(0, 0, 6.6);
  state.playerYaw = Math.PI;
  state.cameraYaw = Math.PI;
  state.cameraPitch = -0.2;
  state.moveAmount = 0;
  state.walkCycle = 0;
  state.cooldown = 0;
  state.verticalVelocity = 0;
  state.grounded = true;
  state.hemorrhoids = 0;
  state.score = 0;
  state.hits = 0;
  state.combo = 0;
  state.gameOver = false;
  state.resetTimer = 0;
  state.lastPointerX = null;
  state.lastPointerY = null;

  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;

  gameOverEl.classList.add("hidden");
  updateHud();
  setMessage(
    initial
      ? "WASD gar runt, musen vrider kameran, Space hoppar."
      : "Ny runda. Spring in i riskzonen om du vill framkalla hemorrojder.",
  );
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(event) {
  if (event.code === "KeyW") {
    input.forward = true;
  }
  if (event.code === "KeyS") {
    input.backward = true;
  }
  if (event.code === "KeyA") {
    input.left = true;
  }
  if (event.code === "KeyD") {
    input.right = true;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!state.gameOver && state.grounded) {
      state.verticalVelocity = 7.6;
      state.grounded = false;
      setMessage("Hoppla.");
    }
  }
  if (event.code === "KeyF") {
    shootPoop();
  }
  if (event.code === "KeyR" && state.gameOver) {
    resetRound();
  }
}

function onKeyUp(event) {
  if (event.code === "KeyW") {
    input.forward = false;
  }
  if (event.code === "KeyS") {
    input.backward = false;
  }
  if (event.code === "KeyA") {
    input.left = false;
  }
  if (event.code === "KeyD") {
    input.right = false;
  }
}

function onPointerDown(event) {
  if (event.button !== 0) {
    return;
  }
  shootPoop();
}

function onPointerMove(event) {
  const nextX =
    typeof event.movementX === "number" && event.movementX !== 0
      ? event.movementX
      : state.lastPointerX === null
        ? 0
        : event.clientX - state.lastPointerX;
  const nextY =
    typeof event.movementY === "number" && event.movementY !== 0
      ? event.movementY
      : state.lastPointerY === null
        ? 0
        : event.clientY - state.lastPointerY;

  state.cameraYaw -= nextX * 0.0052;
  state.cameraPitch = THREE.MathUtils.clamp(state.cameraPitch - nextY * 0.0038, -0.65, 0.22);
  state.lastPointerX = event.clientX;
  state.lastPointerY = event.clientY;
}

function shootPoop() {
  if (state.gameOver || state.cooldown > 0) {
    return;
  }

  const start = hero.buttAnchor.getWorldPosition(new THREE.Vector3());
  let target = aimMarker.position.clone();
  const phoneAimCenter = world.phoneCenter.clone();
  phoneAimCenter.y = getPhoneTopY() + 0.03;
  if (target.distanceTo(phoneAimCenter) < 7) {
    const localTarget = phoneRig.worldToLocal(target.clone());
    localTarget.x = THREE.MathUtils.clamp(localTarget.x, -phoneMetrics.width * 0.42, phoneMetrics.width * 0.42);
    localTarget.z = THREE.MathUtils.clamp(localTarget.z, -phoneMetrics.length * 0.42, phoneMetrics.length * 0.42);
    localTarget.y = phoneMetrics.thickness / 2 + 0.03;
    target = phoneRig.localToWorld(localTarget);
  }

  const flightTime = 0.58;
  const velocity = target
    .clone()
    .sub(start)
    .sub(gravity.clone().multiplyScalar(0.5 * flightTime * flightTime))
    .divideScalar(flightTime);

  const material = new THREE.MeshStandardMaterial({
    color: 0x5b3218,
    roughness: 1,
  });

  const projectile = new THREE.Group();
  const mainBlob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 12), material);
  const nuggetA = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), material);
  const nuggetB = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), material);
  nuggetA.position.set(0.09, 0.03, 0);
  nuggetB.position.set(-0.08, -0.02, 0.03);
  projectile.add(mainBlob, nuggetA, nuggetB);
  projectile.position.copy(start);
  scene.add(projectile);

  projectiles.push({
    group: projectile,
    velocity,
    age: 0,
    target,
  });

  state.cooldown = 0.52;
  setMessage("Leverans fran rumpan pa vag.");
}

function getPhoneTopY() {
  return phoneRig.position.y + phoneMetrics.thickness / 2;
}

function getMoveIntent() {
  const axisX = Number(input.right) - Number(input.left);
  const axisZ = Number(input.forward) - Number(input.backward);

  if (axisX === 0 && axisZ === 0) {
    return new THREE.Vector3();
  }

  const cameraForward = new THREE.Vector3(
    Math.sin(state.cameraYaw),
    0,
    Math.cos(state.cameraYaw),
  );
  const cameraRight = new THREE.Vector3(-cameraForward.z, 0, cameraForward.x);

  return cameraForward.multiplyScalar(axisZ).add(cameraRight.multiplyScalar(axisX)).normalize();
}

function updatePlayer(delta) {
  if (state.gameOver) {
    return;
  }

  const moveIntent = getMoveIntent();
  const isMoving = moveIntent.lengthSq() > 0;
  const speed = 6.9;

  if (isMoving) {
    state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 1, 1 - Math.exp(-delta * 10));
    state.walkCycle += delta * 10.5;
    state.playerYaw = dampAngle(state.playerYaw, Math.atan2(moveIntent.x, moveIntent.z), delta * 14);

    const nextPosition = state.playerPosition.clone().addScaledVector(moveIntent, speed * delta);
    keepInsideArena(nextPosition);
    if (state.playerPosition.y < 0.42) {
      resolvePhoneCollision(nextPosition);
    }
    state.playerPosition.copy(nextPosition);
  } else {
    state.moveAmount = THREE.MathUtils.lerp(state.moveAmount, 0, 1 - Math.exp(-delta * 9));
  }

  if (!state.grounded) {
    state.verticalVelocity -= 19.5 * delta;
    state.playerPosition.y += state.verticalVelocity * delta;
    if (state.playerPosition.y <= 0) {
      state.playerPosition.y = 0;
      state.verticalVelocity = 0;
      state.grounded = true;
    }
  }

  hero.root.position.copy(state.playerPosition);
  hero.root.rotation.y = state.playerYaw;

  const walkSwing = Math.sin(state.walkCycle) * state.moveAmount;
  const counterSwing = Math.sin(state.walkCycle + Math.PI) * state.moveAmount;
  const jumpLean = state.grounded ? 0 : Math.min(0.28, Math.max(-0.18, state.verticalVelocity * 0.04));

  hero.leftLeg.rotation.x = walkSwing * 0.55;
  hero.rightLeg.rotation.x = counterSwing * 0.55;
  hero.leftArm.rotation.x = counterSwing * 0.48 - 0.08;
  hero.rightArm.rotation.x = walkSwing * 0.28 + 0.1;
  hero.leftArm.rotation.z = 0.08;
  hero.rightArm.rotation.z = -0.22;
  hero.torso.rotation.x = -state.moveAmount * 0.08 - jumpLean;
  hero.torso.position.y = Math.abs(Math.sin(state.walkCycle * 2)) * state.moveAmount * 0.08 + state.playerPosition.y * 0.08;
  hero.headPivot.rotation.y = Math.sin(clock.elapsedTime * 0.8) * 0.1;
  hero.headPivot.rotation.x = -0.05 + Math.cos(clock.elapsedTime * 1.4) * 0.02;
}

function keepInsideArena(position) {
  tempVecA.copy(position);
  tempVecA.y = 0;
  if (tempVecA.length() > world.arenaRadius) {
    tempVecA.setLength(world.arenaRadius);
    position.x = tempVecA.x;
    position.z = tempVecA.z;
  }
}

function resolvePhoneCollision(position) {
  const local = phoneRig.worldToLocal(position.clone());
  const collisionX = phoneMetrics.width * 0.7;
  const collisionZ = phoneMetrics.length * 0.72;

  if (Math.abs(local.x) < collisionX && Math.abs(local.z) < collisionZ) {
    const pushX = collisionX - Math.abs(local.x);
    const pushZ = collisionZ - Math.abs(local.z);

    if (pushX < pushZ) {
      local.x = Math.sign(local.x || 1) * collisionX;
    } else {
      local.z = Math.sign(local.z || 1) * collisionZ;
    }

    const pushedWorld = phoneRig.localToWorld(local);
    position.x = pushedWorld.x;
    position.z = pushedWorld.z;
  }
}

function updateCamera(delta) {
  const flatForward = new THREE.Vector3(
    Math.sin(state.cameraYaw),
    0,
    Math.cos(state.cameraYaw),
  ).normalize();
  const cameraRight = new THREE.Vector3(-flatForward.z, 0, flatForward.x);
  const lookDirection = new THREE.Vector3(
    Math.sin(state.cameraYaw) * Math.cos(state.cameraPitch),
    Math.sin(state.cameraPitch),
    Math.cos(state.cameraYaw) * Math.cos(state.cameraPitch),
  ).normalize();
  const anchor = state.playerPosition.clone().add(new THREE.Vector3(0, 1.55, 0));
  const desiredPosition = anchor
    .clone()
    .sub(flatForward.clone().multiplyScalar(5.6))
    .add(cameraRight.multiplyScalar(0.95))
    .add(new THREE.Vector3(0, 1.9 - state.cameraPitch * 1.7, 0));
  const lookAt = anchor.clone().add(lookDirection.multiplyScalar(12));

  camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 13));
  camera.lookAt(lookAt);
}

function updateAimMarker() {
  aimPlane.constant = -(getPhoneTopY() + 0.03);
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);

  const targetPoint = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(aimPlane, targetPoint)) {
    targetPoint.copy(state.playerPosition).add(new THREE.Vector3(0, getPhoneTopY() + 0.03, -8));
  }

  const playerChest = state.playerPosition.clone().setY(1.2);
  const aimOffset = targetPoint.sub(playerChest);
  const aimDistance = THREE.MathUtils.clamp(aimOffset.length(), 2.8, 18);
  aimOffset.setLength(aimDistance);
  targetPoint.copy(playerChest.add(aimOffset));
  targetPoint.y = getPhoneTopY() + 0.03;

  const phoneAimCenter = world.phoneCenter.clone();
  phoneAimCenter.y = getPhoneTopY() + 0.03;
  if (targetPoint.distanceTo(phoneAimCenter) < 3.6) {
    const localTarget = phoneRig.worldToLocal(targetPoint.clone());
    localTarget.x = THREE.MathUtils.clamp(localTarget.x, -phoneMetrics.width * 0.42, phoneMetrics.width * 0.42);
    localTarget.z = THREE.MathUtils.clamp(localTarget.z, -phoneMetrics.length * 0.42, phoneMetrics.length * 0.42);
    localTarget.y = phoneMetrics.thickness / 2 + 0.03;
    targetPoint.copy(phoneRig.localToWorld(localTarget));
  }

  aimMarker.position.copy(targetPoint);
  const pulse = 1 + Math.sin(clock.elapsedTime * 6) * 0.05;
  aimMarker.scale.setScalar(pulse);
}

function updateProjectiles(delta) {
  const phoneTopY = getPhoneTopY();

  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    const previousPosition = projectile.group.position.clone();
    projectile.age += delta;
    projectile.velocity.addScaledVector(gravity, delta);
    projectile.group.position.addScaledVector(projectile.velocity, delta);
    projectile.group.rotation.x += delta * 7;
    projectile.group.rotation.y += delta * 10;

    const crossedPhonePlane =
      previousPosition.y > phoneTopY + 0.02 && projectile.group.position.y <= phoneTopY + 0.02;

    if (crossedPhonePlane) {
      const impactPoint = projectile.target.clone();
      const hitPhone = isPointOnPhone(impactPoint);
      if (hitPhone) {
        impactPoint.y = phoneTopY + 0.012 + splats.length * 0.0002;
        createSplat(impactPoint, true);
        registerHit();
      } else {
        createSplat(
          new THREE.Vector3(projectile.group.position.x, 0.02, projectile.group.position.z),
          false,
        );
        registerMiss();
      }
      destroyProjectile(index);
      continue;
    }

    if (projectile.group.position.y <= 0.02 || projectile.age > 1.6) {
      createSplat(
        new THREE.Vector3(projectile.group.position.x, 0.02, projectile.group.position.z),
        false,
      );
      destroyProjectile(index);
      registerMiss();
    }
  }
}

function destroyProjectile(index) {
  const projectile = projectiles[index];
  scene.remove(projectile.group);
  projectile.group.traverse(disposeObject);
  projectiles.splice(index, 1);
}

function isPointOnPhone(point) {
  const local = phoneRig.worldToLocal(point.clone());
  return (
    Math.abs(local.x) <= phoneMetrics.width * 0.46 &&
    Math.abs(local.z) <= phoneMetrics.length * 0.46
  );
}

function createSplat(position, onPhone) {
  const radius = onPhone ? THREE.MathUtils.randFloat(0.26, 0.48) : THREE.MathUtils.randFloat(0.18, 0.34);
  const splat = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 18),
    new THREE.MeshStandardMaterial({
      color: onPhone ? 0x5a3014 : 0x402514,
      roughness: 1,
      metalness: 0.02,
      transparent: true,
      opacity: onPhone ? 0.92 : 0.8,
    }),
  );

  splat.rotation.x = -Math.PI / 2;
  splat.rotation.z = Math.random() * Math.PI * 2;
  splat.position.copy(position);
  splat.receiveShadow = true;
  scene.add(splat);
  splats.push(splat);

  for (let index = 0; index < 3; index += 1) {
    const droplet = new THREE.Mesh(
      new THREE.SphereGeometry(radius * THREE.MathUtils.randFloat(0.12, 0.2), 8, 8),
      new THREE.MeshStandardMaterial({
        color: 0x6b3815,
        roughness: 1,
      }),
    );
    droplet.position.copy(position);
    droplet.position.x += THREE.MathUtils.randFloatSpread(radius * 0.8);
    droplet.position.z += THREE.MathUtils.randFloatSpread(radius * 0.8);
    droplet.position.y = position.y + 0.018;
    scene.add(droplet);
    splats.push(droplet);
  }
}

function registerHit() {
  state.hits += 1;
  state.combo += 1;
  state.score += 22 + state.combo * 8;
  setMessage(state.combo > 1 ? `Rak svit x${state.combo}. Riktigt obehagligt.` : "Direkt traff pa telefonen.");
  updateHud();
}

function registerMiss() {
  state.combo = 0;
  state.score = Math.max(0, state.score - 5);
  setMessage("Miss. Bara marken fick ta smallen.");
  updateHud();
}

function updateHemorrhoids(delta) {
  if (state.gameOver) {
    state.resetTimer -= delta;
    if (state.resetTimer <= 0) {
      resetRound();
    }
    return;
  }

  tempVecA.copy(state.playerPosition).setY(0);
  tempVecB.copy(world.phoneCenter).setY(0);
  const distanceToPhone = tempVecA.distanceTo(tempVecB);
  const pressure = THREE.MathUtils.clamp(
    THREE.MathUtils.mapLinear(distanceToPhone, 9.2, 2.6, 0, 1),
    0,
    1,
  );

  if (pressure > 0) {
    state.hemorrhoids = THREE.MathUtils.clamp(
      state.hemorrhoids + delta * (10 + pressure * 28),
      0,
      100,
    );
  } else {
    state.hemorrhoids = THREE.MathUtils.clamp(state.hemorrhoids - delta * 10, 0, 100);
  }

  dangerRing.material.opacity = 0.14 + pressure * 0.3 + Math.sin(clock.elapsedTime * 5) * pressure * 0.05;
  dangerRing.scale.setScalar(1 + pressure * 0.06);

  if (state.hemorrhoids >= 100) {
    triggerGameOver();
  }
}

function triggerGameOver() {
  state.gameOver = true;
  state.resetTimer = 2.6;
  setMessage("Game over. Du stod for lange vid telefonen och fick hemorrojder.");
  gameOverEl.classList.remove("hidden");
}

function updateHud() {
  hitsEl.textContent = String(state.hits);
  comboEl.textContent = `x${state.combo}`;
  scoreEl.textContent = String(state.score);
  const hemorrhoidPercent = Math.round(state.hemorrhoids);
  meterTextEl.textContent = `${hemorrhoidPercent}%`;
  meterFillEl.style.width = `${hemorrhoidPercent}%`;
}

function setMessage(text) {
  state.message = text;
  messageEl.textContent = text;
}

function updateSmoke(delta) {
  if (Math.random() < 0.4) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xd5d0c5,
        transparent: true,
        opacity: 0.45,
      }),
    );
    puff.position.copy(hero.cigaretteTip.getWorldPosition(new THREE.Vector3()));
    puff.userData = {
      velocity: new THREE.Vector3(
        THREE.MathUtils.randFloat(-0.1, 0.12),
        THREE.MathUtils.randFloat(0.24, 0.38),
        THREE.MathUtils.randFloat(-0.08, 0.08),
      ),
      life: 0,
      maxLife: THREE.MathUtils.randFloat(1.5, 2.3),
    };
    smokePuffs.push(puff);
    scene.add(puff);
  }

  for (let index = smokePuffs.length - 1; index >= 0; index -= 1) {
    const puff = smokePuffs[index];
    puff.userData.life += delta;
    puff.position.addScaledVector(puff.userData.velocity, delta);
    puff.scale.multiplyScalar(1 + delta * 0.28);
    puff.material.opacity = THREE.MathUtils.mapLinear(
      puff.userData.life,
      0,
      puff.userData.maxLife,
      0.45,
      0,
    );

    if (puff.userData.life >= puff.userData.maxLife) {
      scene.remove(puff);
      puff.traverse(disposeObject);
      smokePuffs.splice(index, 1);
    }
  }

  dustPuffs.forEach((particle) => {
    particle.position.addScaledVector(particle.userData.drift, delta);
    particle.position.y += Math.sin(clock.elapsedTime + particle.userData.phase) * delta * 0.07;

    if (particle.position.y > 8) {
      particle.position.y = 1.2;
    }
    if (Math.abs(particle.position.x) > 13) {
      particle.position.x *= -0.96;
    }
    if (Math.abs(particle.position.z) > 13) {
      particle.position.z *= -0.96;
    }
  });
}

function clearProjectiles() {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    scene.remove(projectiles[index].group);
    projectiles[index].group.traverse(disposeObject);
    projectiles.splice(index, 1);
  }
}

function clearSplats() {
  for (let index = splats.length - 1; index >= 0; index -= 1) {
    scene.remove(splats[index]);
    splats[index].traverse(disposeObject);
    splats.splice(index, 1);
  }
}

function dampAngle(current, target, amount) {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * Math.min(amount, 1);
}

function disposeObject(object) {
  if (object.geometry) {
    object.geometry.dispose();
  }
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
    } else {
      object.material.dispose();
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  const delta = Math.min(clock.getDelta(), 0.033);
  if (state.cooldown > 0) {
    state.cooldown = Math.max(0, state.cooldown - delta);
  }

  updatePlayer(delta);
  updateCamera(delta);
  updateAimMarker();
  updateProjectiles(delta);
  updateSmoke(delta);
  updateHemorrhoids(delta);
  updateHud();

  renderer.render(scene, camera);
}
