import * as THREE from 'three';

/**
 * Playing a recorded-signing clip (lib/rig3d/clipData.js decodeClip) on the avatar: per frame
 * the local rotation of each driven bone and the face blend-shape weights.
 */

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
/**
 * Pose a model from a clip at time `t` (seconds): bones by name, interpolated between frames
 * (slerp), and face weights on every mesh that carries them.
 */
export function applyClip(clip, t, bones, meshes) {
  const x = Math.max(0, Math.min(clip.frames.length - 1, t * clip.fps));
  const i = Math.floor(x), j = Math.min(i + 1, clip.frames.length - 1), u = x - i;
  const A = clip.frames[i], B = clip.frames[j];
  clip.bones.forEach((name, b) => {
    const bone = bones[name];
    if (!bone) return;
    const o = b * 4;
    qa.set(A[o], A[o + 1], A[o + 2], A[o + 3]);
    qb.set(B[o], B[o + 1], B[o + 2], B[o + 3]);
    bone.quaternion.copy(qa.slerp(qb, u));
  });
  const fa = clip.face[i], fb = clip.face[j];
  for (const mesh of meshes) {
    const dict = mesh.morphTargetDictionary, inf = mesh.morphTargetInfluences;
    clip.faceShapes.forEach((name, k) => {
      const idx = dict[name];
      if (idx !== undefined) inf[idx] = fa[k] + (fb[k] - fa[k]) * u;
    });
  }
}
