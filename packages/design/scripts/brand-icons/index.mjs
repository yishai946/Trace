// Draws the TRACE mark (three soles filled with contour lines, see src/brand/geometry.ts) and writes the app icons:
//   node scripts/brand-icons/index.mjs
// PNGs are rendered by headless Chrome (or Edge); set CHROME_PATH if it is installed somewhere else.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CONTOUR_WIDTH, PEAK_RADIUS, SOLE, printContours, walk } from '../../src/brand/geometry.ts';
import { themes } from '../../src/generated/tokens.ts';

const { ink, surface, warning } = themes.night.color;
const STEPS = 3;
/** Scale of one sole, and where the trail sits, in the 512 x 512 mark. */
const SOLE_SCALE = 0.46;
const CENTER = { x: 256, y: 268 };

const root = (path) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));

/** The trail of soles. `mono` draws one colour on a transparent ground, with the contour lines cut out. */
function trail({ fill, line, peak, mono = false }) {
  return walk(STEPS)
    .map((step, i) => {
      const { contours, peak: summit } = printContours(i);
      const last = i === STEPS - 1;
      const sole = `<path d="${SOLE.forefoot}"/><path d="${SOLE.heel}"/>`;
      const lines = contours
        .map((c) => `<path d="${c.d}" stroke-width="${c.major ? CONTOUR_WIDTH.major : CONTOUR_WIDTH.minor}"/>`)
        .join('');
      const dot = `<circle cx="${summit.x}" cy="${summit.y}" r="${last ? PEAK_RADIUS.last : PEAK_RADIUS.hole}" fill="${mono ? 'black' : last ? peak : line}"/>`;
      const place = `translate(${CENTER.x + step.x * SOLE_SCALE} ${CENTER.y + step.y * SOLE_SCALE}) rotate(${step.rotate}) scale(${SOLE_SCALE})`;
      if (mono) {
        return `<mask id="m${i}" maskUnits="userSpaceOnUse" x="-120" y="-220" width="240" height="440"><g fill="white">${sole}</g><g fill="none" stroke="black" stroke-linejoin="round">${lines}</g>${dot}</mask><g transform="${place}"><rect x="-120" y="-220" width="240" height="440" fill="${fill}" mask="url(#m${i})"/></g>`;
      }
      return `<g transform="${place}"><clipPath id="c${i}">${sole}</clipPath><g fill="${fill}">${sole}</g><g clip-path="url(#c${i})" fill="none" stroke="${line}" stroke-linejoin="round">${lines}</g>${dot}</g>`;
    })
    .join('');
}

/**
 * @param {{ size: number, ground: 'none' | 'square' | 'rounded', zoom?: number, mono?: boolean }} options
 * `zoom` scales the trail around the middle, to keep it inside an adaptive icon's safe zone.
 */
function mark({ size, ground, zoom = 1, mono = false }) {
  const background =
    ground === 'none'
      ? ''
      : `<rect width="512" height="512" rx="${ground === 'rounded' ? 112 : 0}" fill="${surface}"/>`;
  const drawing = mono
    ? trail({ fill: 'white', line: 'black', peak: 'black', mono })
    : trail({ fill: ink, line: surface, peak: warning });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${background}<g transform="translate(256 256) scale(${zoom}) translate(-256 -256)">${drawing}</g></svg>`;
}

const flat = (size) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${surface}"/></svg>`;

const TARGETS = [
  { out: 'apps/field/assets/icon.png', size: 1024, svg: mark({ size: 1024, ground: 'square' }) },
  { out: 'apps/field/assets/splash-icon.png', size: 1024, svg: mark({ size: 1024, ground: 'none', zoom: 0.9 }) },
  { out: 'apps/field/assets/favicon.png', size: 48, svg: mark({ size: 48, ground: 'rounded' }) },
  {
    out: 'apps/field/assets/android-icon-foreground.png',
    size: 1024,
    svg: mark({ size: 1024, ground: 'none', zoom: 0.8 }),
  },
  { out: 'apps/field/assets/android-icon-background.png', size: 1024, svg: flat(1024) },
  {
    out: 'apps/field/assets/android-icon-monochrome.png',
    size: 1024,
    svg: mark({ size: 1024, ground: 'none', zoom: 0.8, mono: true }),
  },
  { out: 'apps/command/public/apple-touch-icon.png', size: 512, svg: mark({ size: 512, ground: 'square' }) },
];

const browser = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((path) => path && existsSync(path));
if (!browser) throw new Error('Chrome or Edge is needed to render the PNGs; set CHROME_PATH.');

/** Optional filter: `node scripts/brand-icons/index.mjs apple` renders only the matching files. */
const only = process.argv[2];
const scratch = mkdtempSync(join(tmpdir(), 'trace-icons-'));
try {
  for (const [index, { out, size, svg }] of TARGETS.entries()) {
    if (only && !out.includes(only)) continue;
    const source = join(scratch, `${out.split('/').pop()}.svg`);
    writeFileSync(source, svg);
    mkdirSync(root(out.slice(0, out.lastIndexOf('/'))), { recursive: true });
    execFileSync(browser, [
      '--headless=new',
      // A profile of its own per image, so a browser that is still running does not take the request and exit at once.
      `--user-data-dir=${join(scratch, `profile-${index}`)}`,
      '--disable-gpu',
      '--hide-scrollbars',
      '--default-background-color=00000000',
      `--window-size=${size},${size}`,
      `--screenshot=${root(out)}`,
      pathToFileURL(source).href,
    ]);
  }
  // The favicon of the web console stays vector.
  writeFileSync(root('apps/command/public/favicon.svg'), mark({ size: 64, ground: 'rounded' }));
} finally {
  // Windows can keep the browser's profile locked for a moment; the OS clears the temp folder later.
  try {
    rmSync(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
  } catch {
    // ignored
  }
}
