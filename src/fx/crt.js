import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Scanlines + barrel distortion + chromatic aberration + vignette + noise.
// Runs after OutputPass, so it works on display-ready (sRGB) colors.
const CrtShader = {
  name: 'CrtShader',
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform float uTime;
    varying vec2 vUv;

    vec2 barrel(vec2 uv) {
      vec2 c = uv * 2.0 - 1.0;
      c *= 1.0 + 0.06 * dot(c, c);
      return c * 0.5 + 0.5;
    }

    float rand(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = barrel(vUv);
      if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // Chromatic aberration: ~1px opposing shifts on R and B
      vec2 shift = vec2(1.2) / uResolution;
      vec3 color = vec3(
        texture2D(tDiffuse, uv + shift).r,
        texture2D(tDiffuse, uv).g,
        texture2D(tDiffuse, uv - shift).b
      );

      // Horizontal scanlines, one per physical pixel row pair
      color *= 0.88 + 0.12 * sin(uv.y * uResolution.y * 3.14159);

      // Vignette
      vec2 d = uv - 0.5;
      color *= 1.0 - 0.9 * dot(d, d);

      // Phosphor noise + mains flicker
      color += (rand(uv + fract(uTime)) - 0.5) * 0.035;
      color *= 0.985 + 0.015 * sin(uTime * 47.0);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function createCrt(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const bloom = new UnrealBloomPass(size.clone(), 0.1, 0.05, 0.35);
  composer.addPass(bloom);

  composer.addPass(new OutputPass());

  const crtPass = new ShaderPass(CrtShader);
  crtPass.uniforms.uResolution.value.copy(size);
  composer.addPass(crtPass);

  function setSize(width, height) {
    composer.setSize(width, height);
    renderer.getDrawingBufferSize(crtPass.uniforms.uResolution.value);
  }

  function render(elapsedSec) {
    crtPass.uniforms.uTime.value = elapsedSec;
    composer.render();
  }

  return { render, setSize };
}
