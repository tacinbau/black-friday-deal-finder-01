// DealHound's entrypoint (Node 22, standard library only).
//
// Before handing the site in, this program checks the payload it is about
// to ship, then copies it to the output directory and writes dossier.json
// with the vendored make.fun library. The checks are the agent's own
// verification pass: every deal must carry the fields the site shows, its
// sale price must sit below its usual price, and its verdict must match the
// discount the prices imply, so a bad row can never reach the judge
// silently. The site itself is the app/ folder beside this file — plain
// static files a browser opens at app/index.html — plus the screenshots/
// captures of it running. Nothing it runs, styles or shows loads over the
// network; each deal links out to its store.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';
import { CHECKED, comparisons, deals } from './app/data.js';

// The scorer's own caps (reference/gate.json). Only text_max_bytes shapes
// the dossier's bytes; the rest refuse an entry the scorer would refuse.
const CAPS = {
  textMaxBytes: 163840,
  screenshots: { max: 4, maxBytes: 262144 },
  appMaxFiles: 993,
  appMaxBytes: 16777216,
};

const VERDICTS = ['new-low', 'strong', 'good', 'routine'] as const;
type Verdict = (typeof VERDICTS)[number];

function fail(message: string): never {
  throw new Error(`DealHound entrypoint: ${message}`);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isGoodPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

// A deal's discount, in percent off its usual price.
function discountOf(deal: { price: number; was: number }): number {
  return (1 - deal.price / deal.was) * 100;
}

// The verdict bands the site itself prints next to each deal. A new-low is
// whatever a source calls the lowest price ever seen, so it takes any cut;
// the other three follow the discount alone.
function verdictMatchesBand(verdict: Verdict, off: number): boolean {
  if (verdict === 'new-low') return true;
  if (verdict === 'strong') return off >= 40;
  if (verdict === 'good') return off >= 25 && off < 40;
  return off < 25; // routine
}

// Every deal the site shows, checked field by field: the text it renders,
// a sale price below the usual price, a store link that is really an
// https link, a check time that parses, and a verdict the numbers back.
function checkDeals(): { count: number; verdicts: Record<Verdict, number> } {
  if (!Array.isArray(deals) || deals.length === 0) fail('deals is empty');
  const seen = new Set<string>();
  const verdicts: Record<Verdict, number> = { 'new-low': 0, strong: 0, good: 0, routine: 0 };
  for (const deal of deals) {
    if (!isNonEmptyString(deal.id)) fail('a deal has no id');
    if (seen.has(deal.id)) fail(`duplicate deal id: ${deal.id}`);
    seen.add(deal.id);
    for (const field of ['title', 'store', 'category', 'source', 'evidence'] as const) {
      if (!isNonEmptyString(deal[field])) fail(`deal ${deal.id} has no ${field}`);
    }
    if (!isGoodPrice(deal.price) || !isGoodPrice(deal.was)) {
      fail(`deal ${deal.id} has a bad price`);
    }
    if (deal.price >= deal.was) fail(`deal ${deal.id} is not actually discounted`);
    let url: URL;
    try {
      url = new URL(deal.url);
    } catch {
      fail(`deal ${deal.id} has an unparsable url`);
    }
    if (url.protocol !== 'https:') fail(`deal ${deal.id} links outside https`);
    if (Number.isNaN(Date.parse(deal.checked))) fail(`deal ${deal.id} has a bad checked time`);
    if (deal.checked !== CHECKED) fail(`deal ${deal.id} was not checked with the rest`);
    if (!VERDICTS.includes(deal.verdict)) fail(`deal ${deal.id} has an unknown verdict`);
    const off = discountOf(deal);
    if (!verdictMatchesBand(deal.verdict, off)) {
      fail(`deal ${deal.id} is ${off.toFixed(1)}% off but marked ${deal.verdict}`);
    }
    verdicts[deal.verdict] += 1;
  }
  return { count: deals.length, verdicts };
}

// Cross-store comparisons: each one must name a deal that exists and list
// at least one other store's price for it, so the comparison the site shows
// is anchored to a real row above.
function checkComparisons(dealIds: Set<string>): number {
  if (!Array.isArray(comparisons)) fail('comparisons is not a list');
  for (const comparison of comparisons) {
    if (!dealIds.has(comparison.dealId)) {
      fail(`comparison names unknown deal ${comparison.dealId}`);
    }
    if (!isNonEmptyString(comparison.title)) {
      fail(`comparison for ${comparison.dealId} has no title`);
    }
    if (!Array.isArray(comparison.prices) || comparison.prices.length === 0) {
      fail(`comparison for ${comparison.dealId} lists no prices`);
    }
    for (const row of comparison.prices) {
      if (!isNonEmptyString(row.store) || !isNonEmptyString(row.note)) {
        fail(`comparison for ${comparison.dealId} has an empty price row`);
      }
      if (!isGoodPrice(row.price)) fail(`comparison for ${comparison.dealId} has a bad price`);
    }
  }
  return comparisons.length;
}

// The captures of the running site: at most four, each small enough for the
// scorer, each a real image file. shots.json says which views they were
// taken of, so each of its rows must name a file that is actually here.
function checkScreenshots(dir: string, here: string): { count: number; bytes: number } {
  const shotsPath = join(here, 'shots.json');
  if (!existsSync(dir) || !existsSync(shotsPath)) fail('screenshots/ or shots.json is missing');
  const shots = JSON.parse(readFileSync(shotsPath, 'utf8')) as Array<{
    file: string;
    path: string;
    viewport: { width: number; height: number };
  }>;
  if (!Array.isArray(shots) || shots.length === 0) fail('shots.json lists no views');
  if (shots.length > CAPS.screenshots.max) fail(`shots.json lists ${shots.length} views`);
  let bytes = 0;
  for (const shot of shots) {
    if (!isNonEmptyString(shot.file) || !isNonEmptyString(shot.path)) {
      fail('shots.json has a row with no file or path');
    }
    if (!['.png', '.jpg', '.jpeg'].includes(extname(shot.file).toLowerCase())) {
      fail(`screenshot ${shot.file} is not a PNG or JPEG`);
    }
    if (!Number.isInteger(shot.viewport?.width) || shot.viewport.width <= 0
      || !Number.isInteger(shot.viewport?.height) || shot.viewport.height <= 0) {
      fail(`screenshot ${shot.file} has a bad viewport`);
    }
    const file = join(dir, shot.file);
    if (!existsSync(file)) fail(`shots.json names missing file ${shot.file}`);
    const size = statSync(file).size;
    if (size > CAPS.screenshots.maxBytes) fail(`screenshot ${shot.file} is ${size} bytes`);
    bytes += size;
  }
  return { count: shots.length, bytes };
}

// Walk app/ and count what the scorer will count: files and bytes, against
// its caps, so an overgrown tree is caught here instead of at the gate.
function checkAppTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  if (files > CAPS.appMaxFiles) fail(`app/ holds ${files} files`);
  if (bytes > CAPS.appMaxBytes) fail(`app/ holds ${bytes} bytes`);
  return { files, bytes };
}

// The hand-in itself: copy the site and its captures, then let the vendored
// library write dossier.json. The dossier must be byte for byte what its
// own copy writes, so nothing here touches it afterwards — it is only read
// back and checked.
function handIn(here: string, out: string): void {
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }
  writeFileSync(
    join(out, 'dossier.json'),
    buildDossier(out, {
      text_max_bytes: CAPS.textMaxBytes,
      screenshots: { max: CAPS.screenshots.max, max_bytes: CAPS.screenshots.maxBytes },
      app_max_files: CAPS.appMaxFiles,
      app_max_bytes: CAPS.appMaxBytes,
    }),
  );
}

// Read the dossier back: it must parse, name its cover and images, and
// carry the text the judge reads. A dossier that fails any of these is a
// broken hand-in, not a quiet one.
function verifyDossier(out: string, shots: number): void {
  const raw = readFileSync(join(out, 'dossier.json'), 'utf8');
  const dossier = JSON.parse(raw) as { schema?: string; cover?: number; images?: unknown[]; text?: string };
  if (dossier.schema !== 'makefun/dossier/v1') fail('dossier.json has the wrong schema');
  if (!Array.isArray(dossier.images) || dossier.images.length !== shots) {
    fail(`dossier.json lists ${dossier.images?.length ?? 0} images for ${shots} screenshots`);
  }
  if (!Number.isInteger(dossier.cover) || dossier.cover < 0 || dossier.cover >= dossier.images.length) {
    fail('dossier.json names no cover image');
  }
  if (!isNonEmptyString(dossier.text)) fail('dossier.json carries no text');
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const dealCheck = checkDeals();
const comparisonCount = checkComparisons(new Set(deals.map((d) => d.id)));
const shotCheck = checkScreenshots(join(here, 'screenshots'), here);
const appCheck = checkAppTree(join(here, 'app'));
handIn(here, out);
verifyDossier(out, shotCheck.count);

const verdictLine = VERDICTS.map((v) => `${dealCheck.verdicts[v]} ${v}`).join(', ');
console.log(
  `DealHound: ${dealCheck.count} deals (${verdictLine}), ${comparisonCount} comparisons, `
  + `${appCheck.files} app files, ${shotCheck.count} screenshots — handed in to ${out}`,
);
