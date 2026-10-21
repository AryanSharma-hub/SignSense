import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/**
 * Rendering kit for the 3D signer: the avatar asset, its materials and shaders, lights,
 * the themed backdrop, and ONE shared WebGL renderer.
 *
 * Every signer on a page (the stage, suggestion previews, lesson and test players) draws
 * through the same renderer and copies its pixels into its own 2D canvas, so a page full of
 * previews never runs out of WebGL contexts.
 */

export const AVATAR_URL = '/avatar/signer.glb';

/* ---------- shared renderer ---------- */

let shared = null;
/** The shared renderer, created on first use. Throws when WebGL2 is unavailable. */
export function sharedRenderer() {
  if (shared) return shared;
  if (typeof window === 'undefined' || typeof window.WebGL2RenderingContext === 'undefined') throw new Error('WebGL2 is unavailable');
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); // views pass sizes in device pixels
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.94;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  shared = { renderer, env, w: 1, h: 1 };
  return shared;
}

/** True when this browser can draw the 3D signer. */
export function canRender3D() {
  try { sharedRenderer(); return true; } catch { return false; }
}

/** Render a view's scene and copy it into the view's own 2D canvas (sizes in device pixels). */
export function renderView(view) {
  const s = sharedRenderer();
  const { w, h } = view.pixels;
  if (w < 2 || h < 2) return;
  if (w > s.w || h > s.h) {
    s.w = Math.max(s.w, w); s.h = Math.max(s.h, h);
    s.renderer.setSize(s.w, s.h, false);
  }
  const r = s.renderer;
  r.setViewport(0, 0, w, h);
  r.setScissor(0, 0, w, h);
  r.setScissorTest(true);
  r.setClearColor(0x000000, 0);
  r.clear();
  r.render(view.scene, view.camera);
  // WebGL's viewport sits at the bottom-left of the shared canvas.
  view.ctx.clearRect(0, 0, w, h);
  view.ctx.drawImage(r.domElement, 0, s.h - h, w, h, 0, 0, w, h);
}

/* ---------- theme ---------- */

const css = (name, fallback) => {
  const v = typeof document !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '';
  const parts = v.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every(Number.isFinite) ? new THREE.Color(`rgb(${parts.join(',')})`) : new THREE.Color(fallback);
};

/** Backdrop + rim colours follow the site theme (CSS custom properties). Shared by every view. */
export const themeUniforms = {
  uTop: { value: new THREE.Color('#f7f2fa') },
  uBottom: { value: new THREE.Color('#e9def3') },
  uGlow: { value: new THREE.Color('#ff7a1a') },
  uHaze: { value: new THREE.Color('#c9b6e8') },
  uDark: { value: 0 },
  uRimColor: { value: new THREE.Color('#ffd7c2') },
  uRim: { value: 0.45 },
};
export function syncTheme() {
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  themeUniforms.uTop.value.copy(css('--surface', '#ffffff'));
  themeUniforms.uBottom.value.copy(css('--surface2', '#f7f2fa'));
  themeUniforms.uGlow.value.copy(css('--glow', '#ff7a1a'));
  themeUniforms.uHaze.value.copy(css('--haze', '#c9b6e8'));
  themeUniforms.uDark.value = dark ? 1 : 0;
  themeUniforms.uRimColor.value.set(dark ? '#f3a6d4' : '#ffd2bd');
  themeUniforms.uRim.value = dark ? 0.6 : 0.42;
}

/* ---------- backdrop shader ---------- */

const backdropMaterial = new THREE.ShaderMaterial({
  uniforms: themeUniforms,
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop, uBottom, uGlow, uHaze;
    uniform float uDark;
    varying vec2 vUv;
    void main() {
      vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
      // a lavender halo behind the head and shoulders, a faint warm ember low down
      float halo = smoothstep(0.62, 0.0, length((vUv - vec2(0.5, 0.66)) * vec2(1.0, 1.25)));
      col = mix(col, uHaze, halo * mix(0.38, 0.30, uDark));
      float ember = smoothstep(0.75, 0.0, length((vUv - vec2(0.5, -0.12)) * vec2(0.9, 1.6)));
      col += uGlow * ember * mix(0.07, 0.10, uDark);
      // vignette and fine grain keep large flat areas from banding
      col *= 1.0 - 0.10 * smoothstep(0.45, 0.95, length(vUv - 0.5));
      float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
      col += (n - 0.5) * 0.010;
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
    }
  `,
});
const backdropGeometry = new THREE.PlaneGeometry(2, 2);
export function createBackdrop() {
  const m = new THREE.Mesh(backdropGeometry, backdropMaterial);
  m.frustumCulled = false;
  m.renderOrder = -1;
  return m;
}

/* ---------- avatar asset + materials ---------- */

/** Rim light on skin and clothes: a soft back-lit edge that lifts the figure off the backdrop. */
function addRim(material, strength = 1) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = themeUniforms.uRimColor;
    shader.uniforms.uRim = themeUniforms.uRim;
    shader.uniforms.uRimScale = { value: strength };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRim;\nuniform float uRimScale;')
      .replace('#include <opaque_fragment>', /* glsl */ `
        float facing = clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0);
        outgoingLight += uRimColor * pow(1.0 - facing, 3.0) * uRim * uRimScale;
        #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `signsense-rim-${strength}`;
}

function prepareMaterials(scene) {
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false; // skinned: the bind-pose bounds don't follow the arms
    const m = o.material;
    const name = m.name || '';
    if (name.includes('body')) { m.roughness = 0.62; addRim(m, 1); }
    else if (name.includes('casualsuit')) { m.roughness = 0.86; addRim(m, 0.7); }
    else if (name.includes('ponytail')) { m.roughness = 0.75; m.alphaTest = 0.3; addRim(m, 0.5); }
    else if (name.includes('teeth')) { m.roughness = 0.35; }
    m.envMapIntensity = 0.55;
  });
}

let assetPromise = null;
/** Load (once) and prepare the avatar glTF. */
export function loadAvatar() {
  if (!assetPromise) {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    assetPromise = loader.loadAsync(AVATAR_URL).then((gltf) => { prepareMaterials(gltf.scene); return gltf; });
    assetPromise.catch(() => { assetPromise = null; }); // allow a retry
  }
  return assetPromise;
}

/** A fresh, independently posable copy of the avatar (geometry and textures are shared). */
export const instantiateAvatar = (gltf) => cloneSkinned(gltf.scene);

/** Key, fill, two rims and a sky/ground fill, tuned for skin under the site's palette. */
export function addLights(scene) {
  scene.add(new THREE.HemisphereLight('#fff7f0', '#6d4b78', 0.95));
  const key = new THREE.DirectionalLight('#fff1e4', 2.2); key.position.set(1.3, 2.7, 3.2); scene.add(key);
  const fill = new THREE.DirectionalLight('#e3dcff', 0.85); fill.position.set(-2.2, 1.9, 2.2); scene.add(fill);
  const rimWarm = new THREE.DirectionalLight('#ffbf9a', 1.5); rimWarm.position.set(-1.6, 2.4, -2.6); scene.add(rimWarm);
  const rimCool = new THREE.DirectionalLight('#cdb8ff', 1.2); rimCool.position.set(1.9, 2.1, -2.2); scene.add(rimCool);
}

/** Camera framings (model-space heights and half-width to keep in view), matching the 2D framings. */
export const FRAMES_3D = {
  full: { y0: 0.84, y1: 1.84, halfW: 0.58 },
  upper: { y0: 1.0, y1: 1.83, halfW: 0.52 },
  face: { y0: 1.47, y1: 1.8, halfW: 0.17 },
};
export const CAMERA_FOV = 24;

/** Place the camera so the framing fits the view at its aspect ratio. */
export function frameCamera(camera, framing, aspect) {
  const f = FRAMES_3D[framing] || FRAMES_3D.full;
  const t = Math.tan((CAMERA_FOV * Math.PI) / 360);
  const halfH = (f.y1 - f.y0) / 2;
  const dist = Math.max(halfH / t, f.halfW / (t * Math.max(aspect, 0.1)));
  const yc = (f.y0 + f.y1) / 2;
  camera.fov = CAMERA_FOV;
  camera.aspect = aspect;
  camera.near = 0.05;
  camera.far = 20;
  camera.position.set(0, yc, 0.12 + dist);
  camera.lookAt(0, yc, 0.12);
  camera.updateProjectionMatrix();
}
