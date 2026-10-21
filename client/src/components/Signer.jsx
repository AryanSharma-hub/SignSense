import { lazy, Suspense, useState } from 'react';
import { SignerDummy, FRAMINGS } from './SignerDummy.jsx';

export { FRAMINGS, partLabel } from './SignerDummy.jsx';

// Three.js and the avatar load on demand, so the translator still opens fast.
const Signer3D = lazy(() => import('./Signer3D.jsx').then((m) => ({ default: m.Signer3D })));

let webgl2 = null;
/** True when this browser can create a WebGL2 context (checked once, without loading Three.js). */
function hasWebGL2() {
  if (webgl2 !== null) return webgl2;
  try {
    webgl2 = typeof window !== 'undefined' && typeof window.WebGL2RenderingContext !== 'undefined'
      && !!document.createElement('canvas').getContext('webgl2');
  } catch { webgl2 = false; }
  return webgl2;
}

/** Placeholder with the same footprint while the 3D signer loads. */
function Loading({ fit = 'width', framing = 'full', className = '' }) {
  const vb = FRAMINGS[framing] || FRAMINGS.full;
  return (
    <div
      className={`signer3d-loading relative grid place-items-center ${fit === 'contain' ? 'h-full w-full' : 'w-full'} ${className}`}
      style={fit === 'contain' ? undefined : { aspectRatio: `${vb.w} / ${vb.h}` }} role="status"
    >
      <span className="rounded-full bg-surface/80 px-3 py-1.5 text-[13px] font-semibold text-muted shadow-soft">Loading the signer…</span>
    </div>
  );
}

/**
 * The signer used everywhere: the realistic 3D avatar, or the 2D drawing when this browser
 * has no WebGL2 or the avatar can't be loaded. Both take exactly the same props.
 */
export function Signer(props) {
  const [mode, setMode] = useState(() => (hasWebGL2() ? '3d' : '2d'));
  if (mode === '2d') return <SignerDummy {...props} />;
  return (
    <Suspense fallback={<Loading {...props} />}>
      <Signer3D
        {...props}
        onFail={(e) => { console.warn('3D signer unavailable, using the 2D signer:', e?.message ?? e); setMode('2d'); }}
      />
    </Suspense>
  );
}
