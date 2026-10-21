import * as THREE from 'three';

/**
 * The avatar's skeleton (bones only), rebuilt from a .glb file's JSON chunk — node
 * transforms are never compressed — so code without WebGL (the server, tests) solves onto
 * exactly the rig the browser renders.
 */

/** The glTF JSON chunk of a .glb file (a Buffer / Uint8Array). */
export function readGltfJson(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a .glb file');
  const len = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + len)));
}

/** A THREE.Group holding the file's node hierarchy; skin joints are THREE.Bone, named as in the file. */
export function skeletonFromGltf(json) {
  const jointSet = new Set(json.skins.flatMap((s) => s.joints));
  const objs = json.nodes.map((n, i) => {
    const o = jointSet.has(i) ? new THREE.Bone() : new THREE.Object3D();
    o.name = n.name ?? '';
    if (n.translation) o.position.fromArray(n.translation);
    if (n.rotation) o.quaternion.fromArray(n.rotation);
    if (n.scale) o.scale.fromArray(n.scale);
    return o;
  });
  json.nodes.forEach((n, i) => (n.children || []).forEach((c) => objs[i].add(objs[c])));
  const root = new THREE.Group();
  json.scenes[json.scene ?? 0].nodes.forEach((n) => root.add(objs[n]));
  root.updateMatrixWorld(true);
  return root;
}
