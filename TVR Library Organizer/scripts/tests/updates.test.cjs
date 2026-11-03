const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const lib = path.join(__dirname, '..', '..', 'electron', 'lib');
const { compare, isNewer } = require(path.join(lib, 'semver.cjs'));
const { checkForUpdates, parseRepo, pickAsset } = require(path.join(lib, 'updates.cjs'));

test('semver: ordering', () => {
  assert.equal(compare('2.1.0', '2.0.0'), 1);
  assert.equal(compare('2.0.0', '2.0.0'), 0);
  assert.equal(compare('1.9.9', '2.0.0'), -1);
  assert.equal(compare('v2.10.0', '2.9.0'), 1, 'numeric, not lexical');
  assert.equal(compare('2.0.1', '2.0.0'), 1);
});

test('semver: prerelease ranks below its release', () => {
  assert.equal(compare('2.1.0', '2.1.0-beta.2'), 1);
  assert.equal(compare('2.1.0-beta.2', '2.1.0-beta.10'), -1);
  assert.equal(compare('2.1.0-rc.1', '2.1.0-beta.9'), 1);
  assert.equal(compare('2.1.0-alpha', '2.1.0-alpha.1'), -1);
  assert.equal(isNewer('2.1.0-beta.1', '2.0.0'), true);
});

test('semver: garbage is never newer', () => {
  assert.equal(compare('latest', '2.0.0'), null);
  assert.equal(isNewer('', '2.0.0'), false);
  assert.equal(isNewer(undefined, '2.0.0'), false);
  assert.equal(isNewer('2.0.0', 'nonsense'), false);
});

test('parseRepo accepts the common forms', () => {
  const want = { owner: 'VR6c', repo: 'Downloader' };
  assert.deepEqual(parseRepo('https://github.com/VR6c/Downloader.git'), want);
  assert.deepEqual(parseRepo('https://github.com/VR6c/Downloader'), want);
  assert.deepEqual(parseRepo('github:VR6c/Downloader'), want);
  assert.deepEqual(parseRepo({ type: 'git', url: 'git+https://github.com/VR6c/Downloader.git' }), want);
  assert.equal(parseRepo(''), null);
  assert.equal(parseRepo(undefined), null);
});

const ASSETS = [
  { name: 'TVR.Studio-2.1.0-arm64.dmg', browser_download_url: 'https://github.com/o/r/releases/download/v2.1.0/a.dmg' },
  { name: 'TVR.Studio-2.1.0.dmg', browser_download_url: 'https://github.com/o/r/releases/download/v2.1.0/i.dmg' },
  { name: 'TVR.Studio-2.1.0-arm64.pkg' },
  { name: 'TVR.Studio.Setup.2.1.0.exe' },
  { name: 'TVR.Studio.2.1.0.exe' },
  { name: 'TVR.Studio-2.1.0.AppImage' },
];

test('pickAsset chooses the installer for this machine', () => {
  assert.match(pickAsset(ASSETS, 'darwin', 'arm64').name, /arm64\.dmg$/);
  assert.equal(pickAsset(ASSETS, 'darwin', 'x64').name, 'TVR.Studio-2.1.0.dmg');
  assert.match(pickAsset(ASSETS, 'win32', 'x64').name, /Setup/);
  assert.match(pickAsset(ASSETS, 'linux', 'x64').name, /AppImage$/);
  assert.equal(pickAsset([], 'darwin', 'arm64'), null);
  assert.equal(pickAsset(undefined, 'win32', 'x64'), null);
  // only an Intel dmg published: Apple Silicon falls back to it rather than offering nothing
  assert.equal(pickAsset([{ name: 'x.dmg' }], 'darwin', 'arm64').name, 'x.dmg');
});

const respond = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const release = (over = {}) => ({
  tag_name: 'v2.1.0',
  html_url: 'https://github.com/o/r/releases/tag/v2.1.0',
  body: '## What\'s new\n- faster downloads',
  published_at: '2026-11-10T10:00:00Z',
  assets: ASSETS,
  ...over,
});
const run = (fetchImpl, over = {}) =>
  checkForUpdates({ currentVersion: '2.0.0', repository: 'github:o/r', platform: 'darwin', arch: 'arm64', fetchImpl, ...over });

test('check: newer release is reported with the right download', async () => {
  const r = await run(respond(200, release()));
  assert.equal(r.status, 'available');
  assert.equal(r.latestVersion, '2.1.0');
  assert.equal(r.currentVersion, '2.0.0');
  assert.equal(r.downloadUrl, 'https://github.com/o/r/releases/download/v2.1.0/a.dmg');
  assert.equal(r.releaseUrl, 'https://github.com/o/r/releases/tag/v2.1.0');
  assert.match(r.notes, /faster downloads/);
});

test('check: same or older release is up to date', async () => {
  assert.equal((await run(respond(200, release({ tag_name: 'v2.0.0' })))).status, 'up-to-date');
  assert.equal((await run(respond(200, release({ tag_name: 'v1.9.0' })))).status, 'up-to-date');
});

test('check: no published release', async () => {
  const r = await run(respond(404, {}));
  assert.equal(r.status, 'no-releases');
  assert.equal(r.releaseUrl, 'https://github.com/o/r/releases');
});

test('check: rate limit, server error, network failure and timeout never throw', async () => {
  assert.match((await run(respond(403, {}))).message, /rate-limiting/);
  assert.match((await run(respond(429, {}))).message, /rate-limiting/);
  assert.match((await run(respond(500, {}))).message, /500/);
  const offline = await run(async () => { throw new TypeError('fetch failed'); });
  assert.equal(offline.status, 'error');
  assert.match(offline.message, /internet/);
  const slow = await run(async () => { const e = new Error('t'); e.name = 'TimeoutError'; throw e; });
  assert.match(slow.message, /too long/);
});

test('check: untrusted release data is sanitized', async () => {
  const r = await run(respond(200, release({
    html_url: 'javascript:alert(1)',
    assets: [{ name: 'evil-arm64.dmg', browser_download_url: 'https://evil.example/x.dmg' }],
    body: 'x'.repeat(5000),
  })));
  assert.equal(r.status, 'available');
  assert.equal(r.releaseUrl, 'https://github.com/o/r/releases', 'non-GitHub release URL replaced');
  assert.equal(r.downloadUrl, undefined, 'non-GitHub asset URL dropped');
  assert.equal(r.notes.length, 1500, 'notes capped');
});

test('check: missing tag or repository is a clean error', async () => {
  assert.equal((await run(respond(200, release({ tag_name: '' })))).status, 'error');
  assert.equal((await run(respond(200, release()), { repository: undefined })).status, 'error');
});
