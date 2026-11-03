/**
 * Minimal semantic-version comparison (MAJOR.MINOR.PATCH[-prerelease][+build]) for update checks.
 * A release always outranks its own prerelease (2.1.0 > 2.1.0-beta.2); unparsable input is never "newer".
 */
const PATTERN = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parse(version) {
  const m = PATTERN.exec(String(version ?? '').trim());
  if (!m) return null;
  return { nums: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.') : [] };
}

function comparePrerelease(a, b) {
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1; // no prerelease tag ranks higher
  if (!b.length) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const aNum = /^\d+$/.test(a[i]);
    const bNum = /^\d+$/.test(b[i]);
    if (aNum && bNum) {
      if (Number(a[i]) !== Number(b[i])) return Number(a[i]) > Number(b[i]) ? 1 : -1;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1; // numeric identifiers rank below alphanumeric ones
    } else if (a[i] !== b[i]) {
      return a[i] > b[i] ? 1 : -1;
    }
  }
  return 0;
}

/** Returns 1, 0 or -1, or null if either version can't be parsed. */
function compare(a, b) {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa.nums[i] !== pb.nums[i]) return pa.nums[i] > pb.nums[i] ? 1 : -1;
  }
  return comparePrerelease(pa.pre, pb.pre);
}

const isNewer = (latest, current) => compare(latest, current) === 1;

module.exports = { parse, compare, isNewer };
