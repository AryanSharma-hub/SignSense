import { describe, it, expect } from 'vitest';
import { handGeometry } from '../handGeometry.js';
import { hands } from '../../../../server/src/db/seedData.js';

describe('parametric hand geometry', () => {
  const shape = (id) => hands.find((h) => h.id === id).shape;
  const reach = (pts) => Math.abs(pts[2][1] - pts[0][1]);   // how far a finger extends from its base

  it('extended fingers reach further than curled ones', () => {
    const open = handGeometry(shape('H05')), fist = handGeometry(shape('H09'));
    expect(reach(open.fingers[1])).toBeGreaterThan(reach(fist.fingers[1]) * 1.8);
  });
  it('spread fans fingers apart', () => {
    const wide = handGeometry(shape('H05')), flat = handGeometry(shape('H03'));
    const gap = (g) => g.fingers[3][2][0] - g.fingers[0][2][0];
    expect(gap(wide)).toBeGreaterThan(gap(flat));
  });
  it('produces four fingers and a thumb for every seeded handshape, with finite coordinates', () => {
    for (const h of hands) {
      const g = handGeometry(h.shape);
      expect(g.fingers).toHaveLength(4);
      expect(g.thumb).toHaveLength(3);
      expect([...g.fingers.flat(2), ...g.thumb.flat()].every(Number.isFinite)).toBe(true);
    }
  });
  it('respects the thumbs-up resting angle', () => {
    const up = handGeometry(shape('H13')).thumb, out = handGeometry({ curl: [0, 1, 1, 1, 1], spread: 0 }).thumb;
    expect(Math.abs(up[2][0] - up[0][0])).toBeLessThan(Math.abs(out[2][0] - out[0][0]));
  });
});
