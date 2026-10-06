const https = require('node:https');

const API_URL = 'https://api.github.com/repos/Foxiary/FFU-Studio/releases/latest';
const RELEASES_URL = 'https://github.com/Foxiary/FFU-Studio/releases';

function versionParts(value) {
  const match = typeof value === 'string' && value.length <= 128 &&
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(value);
  if (!match) throw new Error('Update versions must use a stable tag such as 1.1.2 or v1.1.2.');
  return {version: match.slice(1, 4).join('.'), parts: match.slice(1, 4).map(BigInt)};
}

function latestFromResponse(release, currentVersion) {
  const current = versionParts(currentVersion);
  const base = {currentVersion: current.version, checkedAt: new Date().toISOString()};
  if (release === null) {
    return {...base, status: 'current', latestVersion: null, url: RELEASES_URL};
  }
  if (!release || release.draft !== false || release.prerelease !== false || !release.published_at) {
    throw new Error('GitHub did not return a published stable release.');
  }
  const latest = versionParts(release.tag_name);
  let newer = false;
  for (let i = 0; i < 3; i++) {
    if (latest.parts[i] !== current.parts[i]) {
      newer = latest.parts[i] > current.parts[i];
      break;
    }
  }
  return {
    ...base,
    status: newer ? 'available' : 'current',
    latestVersion: latest.version,
    releaseTag: release.tag_name,
    title: String(release.name || `FFU Studio ${latest.version}`).slice(0, 160),
    url: `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}`
  };
}

function fetchLatest() {
  return new Promise((resolve, reject) => {
    const request = https.get(API_URL, {
      headers: {'Accept': 'application/vnd.github+json', 'User-Agent': 'FFU-Studio-Update-Check'}
    }, response => {
      if (response.statusCode === 404) {
        response.resume();
        resolve(null);
        return;
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`GitHub returned HTTP ${response.statusCode}.`));
        return;
      }
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
        if (body.length > 256_000) request.destroy(new Error('Update response is too large.'));
      });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('GitHub returned unreadable update data.')); }
      });
      response.on('error', reject);
    });
    request.setTimeout(10_000, () => request.destroy(new Error('Update check timed out.')));
    request.on('error', reject);
  });
}

async function checkForUpdate(currentVersion, requestLatest = fetchLatest) {
  return latestFromResponse(await requestLatest(), currentVersion);
}

module.exports = {checkForUpdate, latestFromResponse};
