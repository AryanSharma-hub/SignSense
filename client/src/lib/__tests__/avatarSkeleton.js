// The real avatar's skeleton (bones only), read from public/avatar/signer.glb, so the 3D
// rig is tested against the exact joint layout the app renders.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readGltfJson as readJson, skeletonFromGltf } from '../rig3d/gltfSkeleton.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const GLB = path.resolve(here, '../../../public/avatar/signer.glb');

export const readGltfJson = (file = GLB) => readJson(fs.readFileSync(file));
export const avatarSkeleton = (json = readGltfJson()) => skeletonFromGltf(json);
