/**
 * Update checking against GitHub Releases. Pure and dependency-injected (fetch is passed in) so it can be
 * unit-tested without a network. It only reports; it never downloads or installs anything: the user is
 * sent to the release page, which works the same for signed and unsigned builds on every OS.
 */
const { isNewer } = require('./semver.cjs');

const API_ROOT = 'https://api.github.com';
const REQUEST_TIMEOUT_MS = 10000;
const MAX_NOTES_LENGTH = 1500;

/** Accepts "https://github.com/owner/repo(.git)", "github:owner/repo" or "owner/repo". */
function parseRepo(repository) {
  const raw = typeof repository === 'string' ? repository : repository && repository.url;
  if (!raw) return null;
  const m = /(?:github\.com[/:]|^github:|^)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(String(raw).trim());
  return m ? { owner: m[1], repo: m[2] } : null;
}

/** Picks the installer that matches this machine from a release's assets. */
function pickAsset(assets, platform, arch) {
  const list = Array.isArray(assets) ? assets : [];
  const named = (re) => list.filter((a) => re.test(a.name || ''));

  if (platform === 'darwin') {
    const dmgs = named(/\.dmg$/i);
    const appleSilicon = dmgs.find((a) => /arm64/i.test(a.name));
    const intel = dmgs.find((a) => !/arm64/i.test(a.name));
    return (arch === 'arm64' ? appleSilicon || intel : intel || appleSilicon) || null;
  }
  if (platform === 'win32') {
    const exes = named(/\.exe$/i);
    return exes.find((a) => /setup/i.test(a.name)) || exes[0] || null;
  }
  return named(/\.AppImage$/i)[0] || null;
}

const isGithubUrl = (url) => typeof url === 'string' && url.startsWith('https://github.com/');

async function checkForUpdates({ currentVersion, repository, platform, arch, fetchImpl, userAgent = 'TVR-Studio' }) {
  const base = { currentVersion };
  const repo = parseRepo(repository);
  if (!repo) return { ...base, status: 'error', message: 'No GitHub repository is configured for update checks.' };

  const releasesPage = `https://github.com/${repo.owner}/${repo.repo}/releases`;

  try {
    const res = await fetchImpl(`${API_ROOT}/repos/${repo.owner}/${repo.repo}/releases/latest`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': userAgent,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (res.status === 404) return { ...base, status: 'no-releases', releaseUrl: releasesPage };
    if (res.status === 403 || res.status === 429) {
      return { ...base, status: 'error', message: 'GitHub is rate-limiting update checks. Try again in a little while.' };
    }
    if (!res.ok) return { ...base, status: 'error', message: `Update server responded with ${res.status}.` };

    const release = await res.json();
    const latestVersion = String(release.tag_name || '').replace(/^v/, '');
    if (!latestVersion) return { ...base, status: 'error', message: 'The latest release has no version tag.' };

    if (!isNewer(latestVersion, currentVersion)) return { ...base, status: 'up-to-date', latestVersion };

    const asset = pickAsset(release.assets, platform, arch);
    return {
      ...base,
      status: 'available',
      latestVersion,
      releaseUrl: isGithubUrl(release.html_url) ? release.html_url : releasesPage,
      downloadUrl: asset && isGithubUrl(asset.browser_download_url) ? asset.browser_download_url : undefined,
      notes: typeof release.body === 'string' ? release.body.trim().slice(0, MAX_NOTES_LENGTH) : undefined,
      publishedAt: release.published_at || undefined,
    };
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    return {
      ...base,
      status: 'error',
      message: timedOut ? 'The update server took too long to respond.' : 'Could not reach the update server. Check your internet connection.',
    };
  }
}

module.exports = { checkForUpdates, parseRepo, pickAsset };
