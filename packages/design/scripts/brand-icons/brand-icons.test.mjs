import assert from 'node:assert/strict';
import { test } from 'node:test';
import { printContours, walk } from '../../src/brand/geometry.ts';

test('walk alternates left and right feet, left first, and is centred on the origin', () => {
  const steps = walk(5);
  assert.deepEqual(
    steps.map((s) => s.foot),
    ['left', 'right', 'left', 'right', 'left'],
  );
  const middle = steps[2];
  assert.ok(middle);
  assert.ok(
    Math.abs(middle.x - -86.6) < 0.2 && Math.abs(middle.y - -50) < 0.2,
    'middle step sits to the left of the centre',
  );
  const centre = steps.reduce((sum, s) => ({ x: sum.x + s.x / 5, y: sum.y + s.y / 5 }), { x: 0, y: 0 });
  assert.ok(Math.abs(centre.x) < 40 && Math.abs(centre.y) < 40);
});

test('walk moves up and to the right', () => {
  const [first, ...rest] = walk(3);
  const last = rest[rest.length - 1];
  assert.ok(first && last);
  assert.ok(last.x > first.x && last.y < first.y);
});

test('printContours gives closed contour lines, every fourth one an index line', () => {
  const { contours } = printContours(0);
  assert.equal(contours.length, 13);
  assert.deepEqual(
    contours.map((c) => c.major),
    contours.map((_, i) => i % 4 === 3),
  );
  for (const c of contours) assert.ok(c.d.startsWith('M') && c.d.endsWith('Z'));
});

test('each step has its own summit and waviness', () => {
  assert.notDeepEqual(printContours(0).peak, printContours(1).peak);
  assert.notEqual(printContours(0).contours[3]?.d, printContours(1).contours[3]?.d);
});
