/**
 * Site-wide settings an administrator can change from the dashboard. Each has a type and
 * a default; unknown keys and wrongly typed values are rejected, so a bad request can
 * never store something the client cannot render.
 */
export const SETTINGS = {
  siteTitle:        { type: 'string', max: 40, default: 'SignSense', label: 'Site name' },
  tagline:          { type: 'string', max: 120, default: 'Sign in one direction, speech in the other.', label: 'Tagline' },
  announcement:     { type: 'string', max: 400, default: '', label: 'Announcement banner (empty = hidden)' },
  registrationOpen: { type: 'boolean', default: true, label: 'Anyone can create a learner account' },
  learningEnabled:  { type: 'boolean', default: true, label: 'Learning module available' },
  feedbackEnabled:  { type: 'boolean', default: true, label: 'Learners can send feedback' },
  passMark:         { type: 'number', min: 0.5, max: 1, default: 0.8, label: 'Score needed to complete a lesson (0.5–1)' },
  testLength:       { type: 'number', min: 4, max: 30, integer: true, default: 10, label: 'Questions per test' },
};

export async function getSettings(db) {
  const { rows } = await db.query('select key, value from site_settings');
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(Object.entries(SETTINGS).map(([k, def]) => [k, k in stored ? stored[k] : def.default]));
}

/** Validate a partial update; returns {values} or {error}. */
export function validateSettings(patch) {
  const values = {};
  for (const [k, v] of Object.entries(patch || {})) {
    const def = SETTINGS[k];
    if (!def) return { error: `Unknown setting "${k}".` };
    if (def.type === 'string') {
      if (typeof v !== 'string') return { error: `${def.label} must be text.` };
      const t = v.trim();
      if (t.length > def.max) return { error: `${def.label} is limited to ${def.max} characters.` };
      if (k === 'siteTitle' && !t) return { error: 'The site name cannot be empty.' };
      values[k] = t;
    } else if (def.type === 'boolean') {
      if (typeof v !== 'boolean') return { error: `${def.label} must be on or off.` };
      values[k] = v;
    } else if (def.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < def.min || n > def.max || (def.integer && !Number.isInteger(n))) {
        return { error: `${def.label} must be ${def.integer ? 'a whole number ' : ''}between ${def.min} and ${def.max}.` };
      }
      values[k] = n;
    }
  }
  return { values };
}

export async function saveSettings(db, values) {
  for (const [k, v] of Object.entries(values)) {
    await db.query('insert into site_settings (key, value) values ($1,$2) on conflict (key) do update set value=$2', [k, JSON.stringify(v)]);
  }
}
