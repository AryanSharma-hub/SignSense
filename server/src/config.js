import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(SERVER_ROOT, '..');

// The repo-root .env is shared by the server workspace and the scripts.
dotenv.config({ path: path.join(REPO_ROOT, '.env') });

const truthy = (v) => /^(1|true|yes)$/i.test(String(v ?? ''));

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL || '',
  databaseSsl: truthy(process.env.DATABASE_SSL),
  pgliteDir: process.env.PGLITE_DIR || path.join(SERVER_ROOT, 'data', 'pgdata'),
  anthropicKey: process.env.ANTHROPIC_API_KEY || '',
  llmModel: process.env.LLM_MODEL || 'claude-haiku-4-5-20251001',
  sttKey: process.env.STT_API_KEY || '',
  sttBaseUrl: (process.env.STT_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
  sttModel: process.env.STT_MODEL || 'whisper-1',
  clientDist: path.join(REPO_ROOT, 'client', 'dist'),
  /** Server-side caches (sign.mt recordings, retargeted clips). */
  dataDir: process.env.DATA_DIR || path.join(SERVER_ROOT, 'data'),
  /** The 3D signer's rig, read to retarget recorded signing onto exactly that skeleton. */
  avatarGlb: process.env.AVATAR_GLB || path.join(REPO_ROOT, 'client', 'public', 'avatar', 'signer.glb'),
  /** sign.mt text -> pose endpoint (recorded ASL); SIGNMT_URL="" turns recorded signing off. */
  signmtUrl: process.env.SIGNMT_URL ?? 'https://us-central1-sign-mt.cloudfunctions.net/spoken_text_to_signed_pose',
};

/** Feature flags advertised to the client (never the keys themselves). */
export function featureFlags() {
  return {
    ai: { sentence: !!config.anthropicKey, concepts: !!config.anthropicKey },
    stt: { server: !!config.sttKey },
    signing: { recorded: !!config.signmtUrl },
  };
}
