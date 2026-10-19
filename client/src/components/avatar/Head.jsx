import { BODY } from '../../lib/rig/skeleton.js';

const { cx, cy, rx, ry } = BODY.head;
const P = BODY.neckPivot;

/** Crown (hair) region — drawing and the head-movement hit-area share it. */
export const CROWN_PATH = 'M84 64C82 40 99 31 120 31C142 31 159 41 156 64C150 52 138 46 123 49C109 45 94 51 84 64Z';

function Brow({ inner, outer, f }) {
  const base = 63 - f.brow;
  const yi = base + f.tilt * 3, yo = base - f.tilt * 1.2;
  const mx = (inner + outer) / 2, my = Math.min(yi, yo) - 2.6;
  return <path d={`M${outer} ${yo}Q${mx} ${my} ${inner} ${yi}`} fill="none" stroke="rgb(var(--hair))" strokeWidth="2.9" strokeLinecap="round" />;
}

function Eye({ x, f, id }) {
  const open = Math.max(0.12, f.eye);
  const ryE = 3.9 * open;
  return (
    <g>
      <clipPath id={id}><ellipse cx={x} cy="77" rx="6.3" ry={ryE} /></clipPath>
      <ellipse cx={x} cy="77" rx="6.3" ry={ryE} fill="rgb(var(--sclera))" />
      <g clipPath={`url(#${id})`}>
        <circle cx={x} cy="77.3" r="3.3" fill="rgb(var(--iris))" />
        <circle cx={x} cy="77.3" r="1.5" fill="rgb(var(--eye))" />
        <circle cx={x + 1.1} cy="76" r="0.8" fill="rgb(var(--sclera))" />
      </g>
      <path d={`M${x - 6.8} 77Q${x} ${77 - ryE * 1.55} ${x + 6.8} 77`} fill="none" stroke="rgb(var(--eye))" strokeWidth="1.5" strokeLinecap="round" />
    </g>
  );
}

function Mouth({ f }) {
  const hw = 8.5 * f.width, y = 103;
  const corner = y - f.smile * 3.4;
  const up = y + f.smile * 3.6 - f.open * 2.2;
  const lo = y + f.smile * 3.6 + f.open * 11;
  return (
    <path
      d={`M${120 - hw} ${corner}Q120 ${up} ${120 + hw} ${corner}Q120 ${lo} ${120 - hw} ${corner}Z`}
      fill="rgb(var(--mouth))" stroke="rgb(var(--lip))" strokeWidth="2.1" strokeLinejoin="round"
    />
  );
}

/**
 * The head: hair, ears, face and features. Tilt rotates about the top of the neck; a
 * headshake (`turn`) and nod (`pitch`) are shown 2.5D-style by sliding the features
 * across the face, nose most, ears least — enough to read as yaw and pitch without a 3D
 * engine. Every feature is driven by the numeric face parameters in `face`.
 */
export function AvatarHead({ head, face, ids }) {
  const tx = head.turn * 6, ty = head.pitch * 5;
  return (
    <g transform={`translate(${head.dx + head.turn * 2} ${head.dy + head.pitch * 2}) rotate(${head.rot} ${P.x} ${P.y})`}>
      <ellipse cx={cx} cy={cy - 12} rx={rx + 3} ry={ry - 2} fill="rgb(var(--hair))" />
      <g transform={`translate(${head.turn * 2.5} 0)`}>
        {[cx - rx, cx + rx].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy="83" rx="5.6" ry="9.5" fill={`url(#${ids.skin})`} stroke="rgb(var(--skin-line))" strokeWidth="1.1" />
            <path d={`M${x + (x < cx ? 1.2 : -1.2)} 78q${x < cx ? -2.4 : 2.4} 5 0 10`} fill="none" stroke="rgb(var(--skin-shade))" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        ))}
      </g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={`url(#${ids.face})`} stroke="rgb(var(--skin-line))" strokeWidth="1.3" />
      <path d={CROWN_PATH} fill="rgb(var(--hair))" />
      <path d="M95 52C104 44 118 42 131 46" fill="none" stroke="rgb(var(--hair-hi))" strokeWidth="2" strokeLinecap="round" opacity="0.6" />

      <g transform={`translate(${tx} ${ty})`}>
        <Brow inner={113} outer={97} f={face} />
        <Brow inner={127} outer={143} f={face} />
        <Eye x={105} f={face} id={ids.eyeL} />
        <Eye x={135} f={face} id={ids.eyeR} />
        {face.cheek > 0.02 && (
          <>
            <ellipse cx="99" cy="93" rx="6.5" ry="3.6" fill="rgb(var(--lip) / 0.28)" opacity={face.cheek} />
            <ellipse cx="141" cy="93" rx="6.5" ry="3.6" fill="rgb(var(--lip) / 0.28)" opacity={face.cheek} />
          </>
        )}
        <g transform={`translate(${head.turn * 2} 0)`}>
          <path d="M120 81Q116.5 91 117.5 93.5Q120.5 95.5 123.5 93.5" fill="none" stroke="rgb(var(--skin-line))" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <Mouth f={face} />
      </g>
    </g>
  );
}
