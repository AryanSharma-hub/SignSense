import { it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { SignerDummy } from '../components/SignerDummy.jsx';
import { vocab } from '../lib/__tests__/helpers.js';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('stays on target when frame timestamps precede the loop start (no negative time steps)', async () => {
  // Real browsers can hand rAF a frame-start time earlier than performance.now() at scheduling.
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => cb(performance.now() - 500), 5));
  vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
  const { container } = render(<SignerDummy pose={{ E: 'E02', H: { right: 'HX_5' }, L: 'L04' }} vocab={vocab} />);
  await act(() => new Promise((r) => setTimeout(r, 120)));
  const mouth = [...container.querySelectorAll('path')].find((p) => p.getAttribute('fill') === 'rgb(var(--mouth))');
  const nums = mouth.getAttribute('d').match(/-?\d+(\.\d+)?/g).map(Number);
  // the mouth stays on the face (roughly x 95-145, y 85-125 in the 240x300 viewBox)
  for (const [i, n] of nums.entries()) expect(i % 2 === 0 ? n > 90 && n < 150 : n > 80 && n < 130).toBe(true);
});
