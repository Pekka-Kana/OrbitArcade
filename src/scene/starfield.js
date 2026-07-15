import * as THREE from 'three';

const STAR_COUNT = 1500;
const MIN_RADIUS = 150;
const MAX_RADIUS = 400;

export function createStarfield() {
  const positions = new Float32Array(STAR_COUNT * 3);

  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform direction on the sphere, random distance in [MIN, MAX]
    const u = Math.random() * 2 - 1;
    const theta = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = MIN_RADIUS + Math.random() * (MAX_RADIUS - MIN_RADIUS);
    positions[i * 3] = r * s * Math.cos(theta);
    positions[i * 3 + 1] = r * u;
    positions[i * 3 + 2] = r * s * Math.sin(theta);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.7,
  });

  return new THREE.Points(geometry, material);
}
