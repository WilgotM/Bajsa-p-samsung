import * as THREE from "three";

export const MINECRAFT_SKIN_WIDTH = 64;
export const MINECRAFT_SKIN_HEIGHT = 64;

const PIXEL = 0.085;
const OVERLAY_SCALE = 1.065;
const NAME_TAG_WIDTH = 3.4;
const NAME_TAG_HEIGHT = 0.72;
const NAME_TAG_Y = 3.2;

let defaultSkinDataUrl = "";
let defaultSkinCanvas = null;

function fillRect(context, color, x, y, width, height) {
  context.fillStyle = color;
  context.fillRect(x, y, width, height);
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const clampedRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + clampedRadius, y);
  context.lineTo(x + width - clampedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + clampedRadius);
  context.lineTo(x + width, y + height - clampedRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - clampedRadius, y + height);
  context.lineTo(x + clampedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - clampedRadius);
  context.lineTo(x, y + clampedRadius);
  context.quadraticCurveTo(x, y, x + clampedRadius, y);
  context.closePath();
}

function createDefaultSkinCanvas() {
  if (defaultSkinCanvas) {
    return defaultSkinCanvas;
  }

  const canvas = document.createElement("canvas");
  canvas.width = MINECRAFT_SKIN_WIDTH;
  canvas.height = MINECRAFT_SKIN_HEIGHT;
  const context = canvas.getContext("2d");

  fillRect(context, "#00000000", 0, 0, canvas.width, canvas.height);

  fillRect(context, "#8d5a32", 8, 0, 8, 8);
  fillRect(context, "#7e4927", 0, 8, 8, 8);
  fillRect(context, "#9e6a3e", 8, 8, 8, 8);
  fillRect(context, "#8a562f", 16, 8, 8, 8);
  fillRect(context, "#744222", 24, 8, 8, 8);

  fillRect(context, "#6fa8dc", 20, 16, 8, 4);
  fillRect(context, "#5d91c1", 20, 20, 8, 12);
  fillRect(context, "#4a7daa", 16, 20, 4, 12);
  fillRect(context, "#75b1ea", 28, 20, 4, 12);
  fillRect(context, "#427099", 32, 20, 8, 12);

  fillRect(context, "#557b42", 4, 16, 4, 4);
  fillRect(context, "#496b38", 4, 20, 4, 12);
  fillRect(context, "#3e5d2f", 0, 20, 4, 12);
  fillRect(context, "#608a4b", 8, 20, 4, 12);
  fillRect(context, "#345026", 12, 20, 4, 12);

  fillRect(context, "#557b42", 20, 48, 4, 4);
  fillRect(context, "#496b38", 20, 52, 4, 12);
  fillRect(context, "#3e5d2f", 16, 52, 4, 12);
  fillRect(context, "#608a4b", 24, 52, 4, 12);
  fillRect(context, "#345026", 28, 52, 4, 12);

  fillRect(context, "#d8b27a", 44, 16, 4, 4);
  fillRect(context, "#c69a66", 44, 20, 4, 12);
  fillRect(context, "#b98856", 40, 20, 4, 12);
  fillRect(context, "#e7c18e", 48, 20, 4, 12);
  fillRect(context, "#ab7a4d", 52, 20, 4, 12);

  fillRect(context, "#d8b27a", 36, 48, 4, 4);
  fillRect(context, "#c69a66", 36, 52, 4, 12);
  fillRect(context, "#b98856", 32, 52, 4, 12);
  fillRect(context, "#e7c18e", 40, 52, 4, 12);
  fillRect(context, "#ab7a4d", 44, 52, 4, 12);

  fillRect(context, "#2c1d0f", 10, 2, 4, 2);
  fillRect(context, "#ffffff", 10, 9, 2, 2);
  fillRect(context, "#ffffff", 13, 9, 2, 2);
  fillRect(context, "#2b1c10", 10, 12, 4, 1);
  fillRect(context, "#c98962", 11, 11, 2, 2);

  defaultSkinCanvas = canvas;
  return defaultSkinCanvas;
}

export function getDefaultMinecraftSkinDataUrl() {
  if (!defaultSkinDataUrl) {
    defaultSkinDataUrl = createDefaultSkinCanvas().toDataURL("image/png");
  }
  return defaultSkinDataUrl;
}

function configureSkinTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createSkinTextureFromCanvas(canvas) {
  return configureSkinTexture(new THREE.CanvasTexture(canvas));
}

function createDefaultSkinTextures() {
  return {
    baseTexture: createSkinTextureFromCanvas(createBaseSkinCanvasFromImage(createDefaultSkinCanvas())),
    overlayTexture: createSkinTextureFromCanvas(createOverlaySkinCanvasFromImage(createDefaultSkinCanvas())),
  };
}

function createOpaqueSkinnedMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: false,
    roughness: 0.96,
    metalness: 0,
  });
}

function createTransparentSkinnedMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    roughness: 0.96,
    metalness: 0,
  });
}

function setFaceUv(uvAttribute, faceIndex, x, y, width, height) {
  const offset = faceIndex * 4;
  const u0 = x / MINECRAFT_SKIN_WIDTH;
  const u1 = (x + width) / MINECRAFT_SKIN_WIDTH;
  const v0 = 1 - (y + height) / MINECRAFT_SKIN_HEIGHT;
  const v1 = 1 - y / MINECRAFT_SKIN_HEIGHT;

  uvAttribute.setXY(offset + 0, u0, v1);
  uvAttribute.setXY(offset + 1, u1, v1);
  uvAttribute.setXY(offset + 2, u0, v0);
  uvAttribute.setXY(offset + 3, u1, v0);
}

function applyBoxUv(geometry, faces) {
  const uvAttribute = geometry.attributes.uv;
  setFaceUv(uvAttribute, 0, faces.right.x, faces.right.y, faces.right.width, faces.right.height);
  setFaceUv(uvAttribute, 1, faces.left.x, faces.left.y, faces.left.width, faces.left.height);
  setFaceUv(uvAttribute, 2, faces.top.x, faces.top.y, faces.top.width, faces.top.height);
  setFaceUv(uvAttribute, 3, faces.bottom.x, faces.bottom.y, faces.bottom.width, faces.bottom.height);
  setFaceUv(uvAttribute, 4, faces.front.x, faces.front.y, faces.front.width, faces.front.height);
  setFaceUv(uvAttribute, 5, faces.back.x, faces.back.y, faces.back.width, faces.back.height);
  uvAttribute.needsUpdate = true;
}

function createBoxMesh(widthPixels, heightPixels, depthPixels, faces, material) {
  const geometry = new THREE.BoxGeometry(
    widthPixels * PIXEL,
    heightPixels * PIXEL,
    depthPixels * PIXEL,
  );
  applyBoxUv(geometry, faces);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createNameTagSprite(text = "") {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(NAME_TAG_WIDTH, NAME_TAG_HEIGHT, 1);
  sprite.renderOrder = 1000;

  return {
    sprite,
    canvas,
    context,
    texture,
    text: "",
  };
}

function renderNameTag(nameTag, text) {
  const label = text.trim() || "Spelare";
  if (nameTag.text === label) {
    return;
  }

  const { canvas, context, texture } = nameTag;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(11, 16, 22, 0.86)";
  context.strokeStyle = "rgba(255, 255, 255, 0.94)";
  context.lineWidth = 10;
  drawRoundedRect(context, 18, 22, canvas.width - 36, canvas.height - 44, 28);
  context.fill();
  context.stroke();
  context.font = '900 52px "Outfit", sans-serif';
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.strokeStyle = "rgba(0, 0, 0, 0.8)";
  context.lineWidth = 12;
  context.strokeText(label, canvas.width / 2, canvas.height / 2 + 2);
  context.fillText(label, canvas.width / 2, canvas.height / 2 + 2);
  texture.needsUpdate = true;
  nameTag.text = label;
}

function createSkinCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = MINECRAFT_SKIN_WIDTH;
  canvas.height = MINECRAFT_SKIN_HEIGHT;
  return canvas;
}

function isRegionMostlyTransparent(context, x, y, width, height) {
  const { data } = context.getImageData(x, y, width, height);
  let opaquePixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    if (data[index] > 8) {
      opaquePixels += 1;
    }
  }

  return opaquePixels <= Math.max(2, Math.floor(width * height * 0.08));
}

function copyRegion(context, sourceX, sourceY, width, height, targetX, targetY) {
  const imageData = context.getImageData(sourceX, sourceY, width, height);
  context.putImageData(imageData, targetX, targetY);
}

function forceRegionOpaque(context, x, y, width, height) {
  const imageData = context.getImageData(x, y, width, height);
  for (let index = 3; index < imageData.data.length; index += 4) {
    imageData.data[index] = 255;
  }
  context.putImageData(imageData, x, y);
}

function createBaseSkinCanvasFromImage(image) {
  const canvas = createSkinCanvas();
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (isRegionMostlyTransparent(context, 16, 48, 16, 16)) {
    copyRegion(context, 0, 16, 16, 16, 16, 48);
  }

  if (isRegionMostlyTransparent(context, 32, 48, 16, 16)) {
    copyRegion(context, 40, 16, 16, 16, 32, 48);
  }

  [
    [0, 0, 32, 16],
    [0, 16, 16, 16],
    [16, 16, 24, 16],
    [40, 16, 16, 16],
    [16, 48, 16, 16],
    [32, 48, 16, 16],
  ].forEach(([x, y, width, height]) => {
    forceRegionOpaque(context, x, y, width, height);
  });

  return canvas;
}

function createOverlaySkinCanvasFromImage(image) {
  const canvas = createSkinCanvas();
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function createSkinTexturesFromImage(image) {
  return {
    baseTexture: createSkinTextureFromCanvas(createBaseSkinCanvasFromImage(image)),
    overlayTexture: createSkinTextureFromCanvas(createOverlaySkinCanvasFromImage(image)),
  };
}

function buildClassicAvatarMeshes(baseMaterial, overlayMaterial) {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  const headPivot = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const buttAnchor = new THREE.Object3D();
  const strikeAnchor = new THREE.Object3D();
  const weaponAnchor = new THREE.Object3D();
  const nameTagAnchor = new THREE.Object3D();

  root.add(torso, leftLeg, rightLeg);
  torso.add(headPivot, leftArm, rightArm, buttAnchor, nameTagAnchor);

  const body = createBoxMesh(8, 12, 4, {
    top: { x: 20, y: 16, width: 8, height: 4 },
    bottom: { x: 28, y: 16, width: 8, height: 4 },
    left: { x: 28, y: 20, width: 4, height: 12 },
    front: { x: 20, y: 20, width: 8, height: 12 },
    right: { x: 16, y: 20, width: 4, height: 12 },
    back: { x: 32, y: 20, width: 8, height: 12 },
  }, baseMaterial);
  body.position.y = 18 * PIXEL;
  torso.add(body);

  const jacket = createBoxMesh(8 * OVERLAY_SCALE, 12 * OVERLAY_SCALE, 4 * OVERLAY_SCALE, {
    top: { x: 20, y: 32, width: 8, height: 4 },
    bottom: { x: 28, y: 32, width: 8, height: 4 },
    left: { x: 28, y: 36, width: 4, height: 12 },
    front: { x: 20, y: 36, width: 8, height: 12 },
    right: { x: 16, y: 36, width: 4, height: 12 },
    back: { x: 32, y: 36, width: 8, height: 12 },
  }, overlayMaterial);
  jacket.position.copy(body.position);
  torso.add(jacket);

  const head = createBoxMesh(8, 8, 8, {
    top: { x: 8, y: 0, width: 8, height: 8 },
    bottom: { x: 16, y: 0, width: 8, height: 8 },
    left: { x: 16, y: 8, width: 8, height: 8 },
    front: { x: 8, y: 8, width: 8, height: 8 },
    right: { x: 0, y: 8, width: 8, height: 8 },
    back: { x: 24, y: 8, width: 8, height: 8 },
  }, baseMaterial);
  head.position.y = 4 * PIXEL;
  headPivot.position.y = 24 * PIXEL;
  headPivot.add(head);

  const hat = createBoxMesh(8 * OVERLAY_SCALE, 8 * OVERLAY_SCALE, 8 * OVERLAY_SCALE, {
    top: { x: 40, y: 0, width: 8, height: 8 },
    bottom: { x: 48, y: 0, width: 8, height: 8 },
    left: { x: 48, y: 8, width: 8, height: 8 },
    front: { x: 40, y: 8, width: 8, height: 8 },
    right: { x: 32, y: 8, width: 8, height: 8 },
    back: { x: 56, y: 8, width: 8, height: 8 },
  }, overlayMaterial);
  hat.position.copy(head.position);
  headPivot.add(hat);

  const rightArmInner = createBoxMesh(4, 12, 4, {
    top: { x: 44, y: 16, width: 4, height: 4 },
    bottom: { x: 48, y: 16, width: 4, height: 4 },
    left: { x: 48, y: 20, width: 4, height: 12 },
    front: { x: 44, y: 20, width: 4, height: 12 },
    right: { x: 40, y: 20, width: 4, height: 12 },
    back: { x: 52, y: 20, width: 4, height: 12 },
  }, baseMaterial);
  rightArmInner.position.y = -6 * PIXEL;
  rightArm.position.set(6.35 * PIXEL, 23 * PIXEL, 0);
  rightArm.add(rightArmInner);

  const rightArmOuter = createBoxMesh(4 * OVERLAY_SCALE, 12 * OVERLAY_SCALE, 4 * OVERLAY_SCALE, {
    top: { x: 44, y: 32, width: 4, height: 4 },
    bottom: { x: 48, y: 32, width: 4, height: 4 },
    left: { x: 48, y: 36, width: 4, height: 12 },
    front: { x: 44, y: 36, width: 4, height: 12 },
    right: { x: 40, y: 36, width: 4, height: 12 },
    back: { x: 52, y: 36, width: 4, height: 12 },
  }, overlayMaterial);
  rightArmOuter.position.copy(rightArmInner.position);
  rightArm.add(rightArmOuter);

  const leftArmInner = createBoxMesh(4, 12, 4, {
    top: { x: 36, y: 48, width: 4, height: 4 },
    bottom: { x: 40, y: 48, width: 4, height: 4 },
    left: { x: 40, y: 52, width: 4, height: 12 },
    front: { x: 36, y: 52, width: 4, height: 12 },
    right: { x: 32, y: 52, width: 4, height: 12 },
    back: { x: 44, y: 52, width: 4, height: 12 },
  }, baseMaterial);
  leftArmInner.position.y = -6 * PIXEL;
  leftArm.position.set(-6.35 * PIXEL, 23 * PIXEL, 0);
  leftArm.add(leftArmInner);

  const leftArmOuter = createBoxMesh(4 * OVERLAY_SCALE, 12 * OVERLAY_SCALE, 4 * OVERLAY_SCALE, {
    top: { x: 52, y: 48, width: 4, height: 4 },
    bottom: { x: 56, y: 48, width: 4, height: 4 },
    left: { x: 56, y: 52, width: 4, height: 12 },
    front: { x: 52, y: 52, width: 4, height: 12 },
    right: { x: 48, y: 52, width: 4, height: 12 },
    back: { x: 60, y: 52, width: 4, height: 12 },
  }, overlayMaterial);
  leftArmOuter.position.copy(leftArmInner.position);
  leftArm.add(leftArmOuter);

  const rightLegInner = createBoxMesh(4, 12, 4, {
    top: { x: 4, y: 16, width: 4, height: 4 },
    bottom: { x: 8, y: 16, width: 4, height: 4 },
    left: { x: 8, y: 20, width: 4, height: 12 },
    front: { x: 4, y: 20, width: 4, height: 12 },
    right: { x: 0, y: 20, width: 4, height: 12 },
    back: { x: 12, y: 20, width: 4, height: 12 },
  }, baseMaterial);
  rightLegInner.position.y = -6 * PIXEL;
  rightLeg.position.set(2 * PIXEL, 12 * PIXEL, 0);
  rightLeg.add(rightLegInner);

  const rightLegOuter = createBoxMesh(4 * OVERLAY_SCALE, 12 * OVERLAY_SCALE, 4 * OVERLAY_SCALE, {
    top: { x: 4, y: 32, width: 4, height: 4 },
    bottom: { x: 8, y: 32, width: 4, height: 4 },
    left: { x: 8, y: 36, width: 4, height: 12 },
    front: { x: 4, y: 36, width: 4, height: 12 },
    right: { x: 0, y: 36, width: 4, height: 12 },
    back: { x: 12, y: 36, width: 4, height: 12 },
  }, overlayMaterial);
  rightLegOuter.position.copy(rightLegInner.position);
  rightLeg.add(rightLegOuter);

  const leftLegInner = createBoxMesh(4, 12, 4, {
    top: { x: 20, y: 48, width: 4, height: 4 },
    bottom: { x: 24, y: 48, width: 4, height: 4 },
    left: { x: 24, y: 52, width: 4, height: 12 },
    front: { x: 20, y: 52, width: 4, height: 12 },
    right: { x: 16, y: 52, width: 4, height: 12 },
    back: { x: 28, y: 52, width: 4, height: 12 },
  }, baseMaterial);
  leftLegInner.position.y = -6 * PIXEL;
  leftLeg.position.set(-2 * PIXEL, 12 * PIXEL, 0);
  leftLeg.add(leftLegInner);

  const leftLegOuter = createBoxMesh(4 * OVERLAY_SCALE, 12 * OVERLAY_SCALE, 4 * OVERLAY_SCALE, {
    top: { x: 4, y: 48, width: 4, height: 4 },
    bottom: { x: 8, y: 48, width: 4, height: 4 },
    left: { x: 8, y: 52, width: 4, height: 12 },
    front: { x: 4, y: 52, width: 4, height: 12 },
    right: { x: 0, y: 52, width: 4, height: 12 },
    back: { x: 12, y: 52, width: 4, height: 12 },
  }, overlayMaterial);
  leftLegOuter.position.copy(leftLegInner.position);
  leftLeg.add(leftLegOuter);

  buttAnchor.position.set(0, 13.4 * PIXEL, -2.3 * PIXEL);
  strikeAnchor.position.set(-0.14, -0.65, 0.2);
  leftArm.add(strikeAnchor);
  weaponAnchor.position.set(-0.05, -0.72, -0.02);
  rightArm.add(weaponAnchor);
  nameTagAnchor.position.set(0, NAME_TAG_Y, 0);

  return {
    root,
    torso,
    headPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    buttAnchor,
    strikeAnchor,
    weaponAnchor,
    nameTagAnchor,
  };
}

export function createMinecraftAvatar({ name = "", skinDataUrl = "" } = {}) {
  const defaultTextures = createDefaultSkinTextures();
  const baseSkinMaterial = createOpaqueSkinnedMaterial(defaultTextures.baseTexture);
  const overlaySkinMaterial = createTransparentSkinnedMaterial(defaultTextures.overlayTexture);
  const avatar = {
    ...buildClassicAvatarMeshes(
      baseSkinMaterial,
      overlaySkinMaterial,
    ),
    defaultTextures,
    skinTextures: defaultTextures,
    skinRequestId: 0,
    skinDataUrl: getDefaultMinecraftSkinDataUrl(),
    nameTag: createNameTagSprite(name),
    baseSkinMaterial,
    overlaySkinMaterial,
  };

  avatar.nameTagAnchor.add(avatar.nameTag.sprite);
  renderNameTag(avatar.nameTag, name);
  setMinecraftAvatarSkin(avatar, skinDataUrl);
  return avatar;
}

export function setMinecraftAvatarName(avatar, name) {
  renderNameTag(avatar.nameTag, name);
}

function disposeCurrentTextures(avatar) {
  if (avatar.skinTextures.baseTexture !== avatar.defaultTextures.baseTexture) {
    avatar.skinTextures.baseTexture.dispose();
  }
  if (avatar.skinTextures.overlayTexture !== avatar.defaultTextures.overlayTexture) {
    avatar.skinTextures.overlayTexture.dispose();
  }
}

export function setMinecraftAvatarSkin(avatar, skinDataUrl) {
  const resolvedSkin = skinDataUrl || getDefaultMinecraftSkinDataUrl();
  avatar.skinDataUrl = resolvedSkin;
  avatar.skinRequestId += 1;
  const requestId = avatar.skinRequestId;

  if (resolvedSkin === getDefaultMinecraftSkinDataUrl()) {
    disposeCurrentTextures(avatar);
    avatar.baseSkinMaterial.map = avatar.defaultTextures.baseTexture;
    avatar.overlaySkinMaterial.map = avatar.defaultTextures.overlayTexture;
    avatar.baseSkinMaterial.needsUpdate = true;
    avatar.overlaySkinMaterial.needsUpdate = true;
    avatar.skinTextures = avatar.defaultTextures;
    return;
  }

  const image = new Image();
  image.addEventListener("load", () => {
    if (avatar.skinRequestId !== requestId) {
      return;
    }

    const textures = createSkinTexturesFromImage(image);
    disposeCurrentTextures(avatar);
    avatar.baseSkinMaterial.map = textures.baseTexture;
    avatar.overlaySkinMaterial.map = textures.overlayTexture;
    avatar.baseSkinMaterial.needsUpdate = true;
    avatar.overlaySkinMaterial.needsUpdate = true;
    avatar.skinTextures = textures;
    avatar.skinDataUrl = resolvedSkin;
  });
  image.addEventListener("error", () => {
    if (avatar.skinRequestId !== requestId) {
      return;
    }

    disposeCurrentTextures(avatar);
    avatar.baseSkinMaterial.map = avatar.defaultTextures.baseTexture;
    avatar.overlaySkinMaterial.map = avatar.defaultTextures.overlayTexture;
    avatar.baseSkinMaterial.needsUpdate = true;
    avatar.overlaySkinMaterial.needsUpdate = true;
    avatar.skinTextures = avatar.defaultTextures;
    avatar.skinDataUrl = getDefaultMinecraftSkinDataUrl();
  });
  image.src = resolvedSkin;
}

export function updateMinecraftRemoteAvatar(avatar, pose, delta) {
  avatar.motionTime = (avatar.motionTime ?? Math.random() * Math.PI * 2) + delta * (2.6 + pose.moveAmount * 4.2);
  const swing = Math.sin(avatar.motionTime) * pose.moveAmount;
  const counterSwing = Math.sin(avatar.motionTime + Math.PI) * pose.moveAmount;
  const strikeAmount = pose.strikeAmount ?? 0;
  const poopAmount = pose.poopAmount ?? 0;
  const weaponHoldAmount = pose.weaponHoldAmount ?? 0;
  const weaponPitch = pose.weaponPitch ?? 0;

  avatar.root.position.set(pose.x, pose.y, pose.z);
  avatar.root.rotation.y = pose.yaw;
  avatar.leftLeg.rotation.x = swing * 0.62 - poopAmount * 0.28;
  avatar.rightLeg.rotation.x = counterSwing * 0.62 - poopAmount * 0.28;
  avatar.leftArm.rotation.x =
    counterSwing * 0.62 - 0.08 + poopAmount * 0.08 - strikeAmount * 1.7 - weaponHoldAmount * 0.18;
  avatar.rightArm.rotation.x =
    swing * 0.24 + 0.1 + poopAmount * 0.12 + strikeAmount * 0.34 - weaponHoldAmount * (0.8 + weaponPitch * 0.45);
  avatar.leftArm.rotation.z = 0.03 + poopAmount * 0.02 + strikeAmount * 0.22 - weaponHoldAmount * 0.08;
  avatar.rightArm.rotation.z = -0.03 - poopAmount * 0.02 - strikeAmount * 0.08 + weaponHoldAmount * 0.12;
  avatar.torso.rotation.x = -pose.moveAmount * 0.12 + poopAmount * 0.18;
  avatar.torso.rotation.y = strikeAmount * 0.24 - weaponHoldAmount * 0.08;
  avatar.headPivot.rotation.y = Math.sin(avatar.motionTime * 0.5) * 0.08;
  avatar.headPivot.rotation.x = -weaponPitch * 0.22;
}
