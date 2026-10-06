const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const {latestFromResponse} = require('../src/update-check');

function startApp(folder) {
  const handlers = new Map();
  const notices = [];
  const links = [];
  const versions = [];
  let tag = '1.1.3';
  let failNotice = false;
  let offline = false;
  class Window {
    webContents = {send() {}, setWindowOpenHandler() {}};
    loadFile() {}
    isDestroyed() {return false;}
  }
  class Notice {
    static isSupported() {return true;}
    constructor(options) {this.options = options;}
    on() {}
    show() {if (failNotice) throw new Error('Notifications unavailable'); notices.push(this.options);}
  }
  const electron = {
    app: {isPackaged: true, whenReady: () => ({then: fn => fn()}), on() {},
      getPath: () => folder, getVersion: () => '1.1.2', setAppUserModelId() {}},
    BrowserWindow: Window, Notification: Notice,
    ipcMain: {handle: (name, fn) => handlers.set(name, fn)},
    shell: {openExternal: url => links.push(url)},
  };
  const updates = {checkForUpdate: async version => {
    versions.push(version);
    if (offline) throw new Error('Offline');
    return latestFromResponse({tag_name: tag, draft: false, prerelease: false,
      published_at: '2026-10-06T00:00:00Z'}, version);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8'), {
    require: id => id === 'electron' ? electron : id === './update-check' ? updates : require(id),
    module: {exports: {}}, __dirname: path.join(__dirname, '../src'),
    process: {platform: 'win32', resourcesPath: folder, env: {}},
    setInterval: (_fn, delay) => {assert.equal(delay, 24 * 60 * 60 * 1000); return {unref() {}};},
  });
  return {handlers, notices, links, versions, setTag: value => {tag = value;},
    failNotice: () => {failNotice = true;}, goOffline: () => {offline = true;}};
}

test('release notices, dismissal, restart and newer versions work through IPC', async t => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'ffu-release-test-'));
  t.after(() => fs.rmSync(folder, {recursive: true, force: true}));
  fs.writeFileSync(path.join(folder, 'settings.json'), JSON.stringify({
    dismissedUpdateCommit: 'old-source-commit', lastNotifiedUpdateCommit: 'old-source-commit',
  }));
  const app = startApp(folder);
  const check = app.handlers.get('check-update');
  const first = check();
  assert.equal(check(), first, 'Concurrent checks share the same request');
  assert.equal((await first).latestVersion, '1.1.3');
  await check();
  assert.equal(app.versions[0], '1.1.2', 'Uses the installed app version');
  assert.equal(app.notices.length, 1, 'One desktop notice for repeated checks');
  assert.match(app.notices[0].body, /1\.1\.3/);
  app.handlers.get('open-update')();
  assert.equal(app.links[0], 'https://github.com/Foxiary/FFU-Studio/releases/tag/1.1.3');
  assert.equal(app.handlers.get('dismiss-update')(null, '1.1.2'), false);
  assert.equal(app.handlers.get('dismiss-update')(null, '1.1.3'), true);
  assert.equal((await check()).dismissed, true);

  const restarted = startApp(folder);
  assert.equal((await restarted.handlers.get('check-update')()).dismissed, true);
  assert.equal(restarted.notices.length, 0, 'Dismissal and notification history survive restart');
  restarted.setTag('v1.1.4');
  const newer = await restarted.handlers.get('check-update')();
  assert.equal(newer.dismissed, false, 'A newer release is not hidden by old dismissal');
  assert.equal(restarted.notices.length, 1);
  restarted.setTag('1.1.1');
  assert.equal((await restarted.handlers.get('check-update')()).status, 'current');
  assert.equal(restarted.notices.length, 1, 'Older releases do not notify');
  restarted.setTag('1.1.5');
  restarted.failNotice();
  assert.equal((await restarted.handlers.get('check-update')()).status, 'available',
    'A desktop notification failure must not suppress the in-app banner');
  restarted.goOffline();
  assert.equal((await restarted.handlers.get('check-update')()).status, 'error');
});
