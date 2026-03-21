import * as THREE from "three";

function createMaterial(color) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.06,
  });
}

export function createRemotePlayerAvatar(color) {
  const root = new THREE.Group();
  const torso = new THREE.Group();
  const headPivot = new THREE.Group();
  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  const buttAnchor = new THREE.Object3D();

  const coatMaterial = createMaterial(color);
  const bodyMaterial = createMaterial(0xf2d0b0);
  const accentMaterial = createMaterial(0x2d3843);

  const torsoMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 4, 8), coatMaterial);
  torsoMesh.position.y = 1.45;
  torso.add(torsoMesh);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 12, 12), bodyMaterial);
  head.position.y = 2.42;
  headPivot.add(head);

  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.44, 0.24, 12), accentMaterial);
  hat.position.y = 2.74;
  headPivot.add(hat);

  const armGeometry = new THREE.CapsuleGeometry(0.1, 0.62, 4, 8);
  const legGeometry = new THREE.CapsuleGeometry(0.11, 0.84, 4, 8);

  const leftArmMesh = new THREE.Mesh(armGeometry, coatMaterial);
  leftArmMesh.position.y = -0.3;
  leftArm.add(leftArmMesh);

  const rightArmMesh = new THREE.Mesh(armGeometry, coatMaterial);
  rightArmMesh.position.y = -0.3;
  rightArm.add(rightArmMesh);

  const leftLegMesh = new THREE.Mesh(legGeometry, accentMaterial);
  leftLegMesh.position.y = 0.42;
  leftLeg.add(leftLegMesh);

  const rightLegMesh = new THREE.Mesh(legGeometry, accentMaterial);
  rightLegMesh.position.y = 0.42;
  rightLeg.add(rightLegMesh);

  leftArm.position.set(-0.52, 1.78, 0);
  rightArm.position.set(0.52, 1.78, 0);
  leftLeg.position.set(-0.2, 0, 0);
  rightLeg.position.set(0.2, 0, 0);
  buttAnchor.position.set(0, 1.06, -0.46);

  torso.add(buttAnchor);
  root.add(torso, headPivot, leftArm, rightArm, leftLeg, rightLeg);
  root.scale.setScalar(0.34);

  return {
    root,
    torso,
    headPivot,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    buttAnchor,
    motionTime: Math.random() * Math.PI * 2,
  };
}

export function updateRemotePlayerAvatar(avatar, pose, delta) {
  avatar.motionTime += delta * (2.6 + pose.moveAmount * 4.2);
  const swing = Math.sin(avatar.motionTime) * pose.moveAmount;
  const counterSwing = Math.sin(avatar.motionTime + Math.PI) * pose.moveAmount;
  const strikeAmount = pose.strikeAmount ?? 0;
  const poopAmount = pose.poopAmount ?? 0;

  avatar.root.position.set(pose.x, pose.y, pose.z);
  avatar.root.rotation.y = pose.yaw;
  avatar.leftLeg.rotation.x = swing * 0.62 - poopAmount * 0.28;
  avatar.rightLeg.rotation.x = counterSwing * 0.62 - poopAmount * 0.28;
  avatar.leftArm.rotation.x = counterSwing * 0.62 - 0.08 + poopAmount * 0.08 + strikeAmount * 0.34;
  avatar.rightArm.rotation.x = swing * 0.24 + 0.1 + poopAmount * 0.12 - strikeAmount * 1.7;
  avatar.leftArm.rotation.z = 0.08 - strikeAmount * 0.12;
  avatar.rightArm.rotation.z = -0.22 - poopAmount * 0.08 + strikeAmount * 0.44;
  avatar.torso.rotation.x = -pose.moveAmount * 0.12 + poopAmount * 0.18;
  avatar.torso.rotation.y = -strikeAmount * 0.24;
  avatar.headPivot.rotation.y = Math.sin(avatar.motionTime * 0.5) * 0.08;
}
