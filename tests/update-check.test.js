const assert = require('node:assert/strict');
const {test} = require('node:test');
const {EventEmitter} = require('node:events');
const https = require('node:https');
const {checkForUpdate, latestFromResponse} = require('../src/update-check');

const release = tag => ({tag_name: tag, name: `FFU Studio ${tag}`, draft: false,
  prerelease: false, published_at: '2026-10-06T00:00:00Z'});

test('only numerically newer stable releases trigger an update', () => {
  for (const [installed, published, status] of [
    ['1.1.2', '1.1.3', 'available'], ['1.9.0', '1.10.0', 'available'],
    ['1.1.2', '1.1.10', 'available'], ['1.9.9', '2.0.0', 'available'],
    ['1.1.2', '1.1.2', 'current'], ['1.1.2', '1.1.1', 'current'],
    ['2.0.0', '1.99.99', 'current'], ['1.1.2', 'v1.1.2', 'current'],
    ['1.1.2+local', 'v1.1.2+build.42', 'current'],
  ]) assert.equal(latestFromResponse(release(published), installed).status, status);
});

test('normalizes version tags and opens only this repository release URL', () => {
  const data = {...release('v1.1.3'), html_url: 'https://example.invalid'};
  const result = latestFromResponse(data, '1.1.2');
  assert.equal(result.latestVersion, '1.1.3');
  assert.equal(result.currentVersion, '1.1.2');
  assert.equal(result.url, 'https://github.com/Foxiary/FFU-Studio/releases/tag/v1.1.3');
});

test('drafts, prereleases, unpublished data and invalid tags cannot notify', () => {
  for (const data of [
    {...release('1.1.3'), draft: true}, {...release('1.1.3'), prerelease: true},
    {...release('1.1.3'), published_at: null}, release('1.1.3-beta.1'),
    release('01.1.3'), release('not-a-version'), release('1.1.3/../../elsewhere'),
  ]) assert.throws(() => latestFromResponse(data, '1.1.2'));
});

function mockResponse(t, statusCode, body) {
  let calledUrl;
  t.mock.method(https, 'get', (url, options, callback) => {
    calledUrl = url;
    assert.equal(options.headers['User-Agent'], 'FFU-Studio-Update-Check');
    const request = new EventEmitter();
    request.setTimeout = () => request;
    process.nextTick(() => {
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.resume = () => {};
      response.setEncoding = () => {};
      callback(response);
      if (statusCode === 200) {
        response.emit('data', JSON.stringify(body));
        response.emit('end');
      }
    });
    return request;
  });
  return () => calledUrl;
}

test('queries the FFU Studio releases endpoint', async t => {
  const requestedUrl = mockResponse(t, 200, release('1.1.3'));
  assert.equal((await checkForUpdate('1.1.2')).status, 'available');
  assert.equal(requestedUrl(), 'https://api.github.com/repos/Foxiary/FFU-Studio/releases/latest');
});

test('no published release is a normal no-update result', async t => {
  mockResponse(t, 404);
  const result = await checkForUpdate('1.1.2');
  assert.equal(result.status, 'current');
  assert.equal(result.latestVersion, null);
});

test('rate-limited and offline checks report errors instead of fake updates', async t => {
  mockResponse(t, 403);
  await assert.rejects(checkForUpdate('1.1.2'), /HTTP 403/);
  await assert.rejects(checkForUpdate('1.1.2', async () => {throw new Error('Offline');}), /Offline/);
});
