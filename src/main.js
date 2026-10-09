const {app, BrowserWindow, dialog, ipcMain, shell, Notification} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {spawn, spawnSync, execFile} = require('node:child_process');
const {checkForUpdate} = require('./update-check');

let window;
let currentRun = null;
let settings = {};
let lastUpdate = null;
let updateRequest = null;
const SOURCE_COMMIT = '019ccceaf78e4862519e4164e9e0d317da5d745b';

function settingsFile() { return path.join(app.getPath('userData'), 'settings.json'); }
function loadSettings() {
  try { settings = JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); }
  catch { settings = {}; }
  settings.fonts ||= [{path: '', index: 0}];
  settings.options ||= {};
}
function saveSettings() {
  fs.mkdirSync(path.dirname(settingsFile()), {recursive: true});
  fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
}
function engineFile(name) {
  const root = app.isPackaged ? path.join(process.resourcesPath, 'engine') : path.resolve(__dirname, '..', 'engine');
  return path.join(root, name);
}
function pythonFile() {
  if (process.platform === 'win32') {
    return path.join(app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..', 'vendor'),
      app.isPackaged ? 'python' : 'windows-python', 'python.exe');
  }
  return process.env.FFU_STUDIO_PYTHON || 'python3';
}
function runtimeStatus() {
  const python = pythonFile();
  const result = spawnSync(python, ['-X', 'utf8', '-c',
    'import sys; sys.path.insert(0, sys.argv[1]); import PIL, fontTools, numpy, ffu, bridge, ffugen; print(sys.version.split()[0])',
    path.dirname(engineFile('bridge.py'))],
    {encoding: 'utf8', timeout: 12000, windowsHide: true});
  return {ok: result.status === 0, version: result.status === 0 ? result.stdout.trim() : '',
    detail: result.status === 0 ? 'Bundled font engine ready' :
      (result.stderr || result.error?.message || 'Python runtime could not start').trim()};
}
function emit(name, payload) { if (window && !window.isDestroyed()) window.webContents.send(name, payload); }
function performUpdateCheck() {
  if (updateRequest) return updateRequest;
  updateRequest = checkForUpdate(app.getVersion()).then(result => {
    lastUpdate = {...result, dismissed: settings.dismissedReleaseVersion === result.latestVersion};
    if (result.status === 'available' && settings.lastNotifiedReleaseVersion !== result.latestVersion) {
      if (app.isPackaged && Notification.isSupported()) {
        try {
          const notice = new Notification({title: 'FFU Studio update available',
            body: `Version ${result.latestVersion} is ready to download.`});
          notice.on('click', () => {window?.show(); window?.focus();});
          notice.show();
          settings.lastNotifiedReleaseVersion = result.latestVersion;
          saveSettings();
        } catch { /* Keep the in-app banner available if desktop notifications fail. */ }
      }
    }
    return lastUpdate;
  }).catch(error => ({status: 'error', message: error.message})).finally(() => {updateRequest = null;});
  return updateRequest;
}
function validate(data) {
  if (!data || typeof data !== 'object') throw new Error('Missing generator settings.');
  const template = String(data.template || '').trim();
  const output = String(data.output || '').trim();
  const fonts = Array.isArray(data.fonts) ? data.fonts.filter(x => String(x.path || '').trim()) : [];
  if (!template || !fs.existsSync(template)) throw new Error('Choose an existing FFU template.');
  if (!fonts.length) throw new Error('Add at least one OTF, TTF, or TTC font.');
  for (const font of fonts) {
    if (!fs.existsSync(String(font.path))) throw new Error(`Font not found: ${font.path}`);
    if (!Number.isInteger(Number(font.index)) || Number(font.index) < 0) throw new Error('TTC face index must be a nonnegative integer.');
  }
  if (!output) throw new Error('Choose an output FFU path.');
  if (!output.toLowerCase().endsWith('.ffu')) throw new Error('Output name must end in .ffu.');
  if (path.resolve(output) === path.resolve(template)) throw new Error('Output must differ from the stock template.');
  for (const font of fonts) if (path.resolve(output) === path.resolve(font.path)) throw new Error('Output must differ from source fonts.');
  const options = data.options || {};
  for (const name of ['px','pad','cell','spaceRatio','glow','markLift','stroke','tracking']) {
    const value = String(options[name] ?? '').trim();
    if (value && !Number.isFinite(Number(value))) throw new Error(`${name} must be a number.`);
  }
  if (String(options.matchChar ?? 'A').length !== 1) throw new Error('Match character must be one character.');
  return {template: path.resolve(template), output: path.resolve(output),
    fonts: fonts.map(font => ({path: path.resolve(String(font.path).trim()), index: Number(font.index)})), options};
}
function makeArgs(data) {
  const args = ['--template', data.template, '--out', data.output];
  for (const font of data.fonts) args.push('--font', `${font.path}${Number(font.index) ? '#' + Number(font.index) : ''}`);
  const mapping = {px:'--px',matchChar:'--match-char',pad:'--pad',cell:'--cell',
    spaceRatio:'--space-ratio',glow:'--glow',markLift:'--mark-lift',stroke:'--stroke',tracking:'--tracking'};
  for (const [key, flag] of Object.entries(mapping)) {
    const value = String(data.options[key] ?? '').trim();
    if (value) args.push(flag, value);
  }
  if (data.options.addVietnamese === false) args.push('--no-vn');
  if (data.options.normalizePunctuation === false) args.push('--no-normalize-punctuation');
  return args;
}
function inspectFile(file, sample) {
  return new Promise((resolve, reject) => {
    execFile(pythonFile(), ['-X', 'utf8', engineFile('bridge.py'), file, '--text', String(sample || '').slice(0, 100)],
      {encoding: 'utf8', timeout: 20000, maxBuffer: 12 * 1024 * 1024, windowsHide: true},
      (error, stdout, stderr) => {
        if (error) return reject(new Error((stderr || error.message).trim()));
        try { resolve(JSON.parse(stdout)); }
        catch { reject(new Error(`Could not inspect FFU: ${stderr || stdout}`)); }
      });
  });
}
function createWindow() {
  window = new BrowserWindow({
    width: 1480, height: 970, minWidth: 1070, minHeight: 720,
    title: 'FFU Studio', backgroundColor: '#11191c',
    icon: path.resolve(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {preload: path.join(__dirname, 'preload.js'), contextIsolation: true,
      nodeIntegration: false, sandbox: true}
  });
  window.loadFile(path.join(__dirname, 'index.html'));
  window.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId('dev.ffustudio.desktop');
  loadSettings();
  createWindow();
  const updateTimer = setInterval(() => {
    performUpdateCheck().then(result => emit('update-status', result));
  }, 24 * 60 * 60 * 1000);
  updateTimer.unref();
  app.on('activate', () => {if (BrowserWindow.getAllWindows().length === 0) createWindow();});
});
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
app.on('before-quit', () => currentRun?.kill());

ipcMain.handle('state', () => ({settings, runtime: runtimeStatus(), sourceCommit: SOURCE_COMMIT,
  appVersion: app.getVersion()}));
ipcMain.handle('check-update', () => performUpdateCheck());
ipcMain.handle('dismiss-update', (_event, version) => {
  if (lastUpdate?.status !== 'available' || version !== lastUpdate.latestVersion) return false;
  settings.dismissedReleaseVersion = version;
  saveSettings();
  lastUpdate.dismissed = true;
  return true;
});
ipcMain.handle('open-update', () => {
  if (lastUpdate?.status !== 'available') return false;
  return shell.openExternal(lastUpdate.url);
});
ipcMain.handle('pick-file', async (_event, kind, current) => {
  if (kind === 'output') {
    const result = await dialog.showSaveDialog(window, {defaultPath: current || 'generated.ffu',
      filters: [{name: 'FFU bitmap font', extensions: ['ffu']}]});
    return result.canceled ? null : result.filePath;
  }
  const filters = kind === 'template' ? [{name: 'FFU bitmap font', extensions: ['ffu']}] :
    [{name: 'Vector fonts', extensions: ['otf', 'ttf', 'ttc']}];
  const result = await dialog.showOpenDialog(window, {defaultPath: current || undefined,
    properties: ['openFile'], filters});
  return result.canceled ? null : result.filePaths[0];
});
ipcMain.handle('inspect', (_event, file, sample) => {
  if (!file || !fs.existsSync(file)) throw new Error('Choose an existing FFU file.');
  return inspectFile(file, sample);
});
ipcMain.handle('generate', async (_event, raw) => {
  if (currentRun) throw new Error('A font is already generating.');
  const data = validate(raw);
  if (fs.existsSync(data.output)) {
    const answer = await dialog.showMessageBox(window, {type:'warning', buttons:['Replace file','Cancel'],
      defaultId: 1, cancelId: 1, title:'Replace existing FFU?',
      message:'The output file already exists.', detail:data.output});
    if (answer.response !== 0) return {cancelled: true};
  }
  fs.mkdirSync(path.dirname(path.resolve(data.output)), {recursive: true});
  settings = {...settings, ...data};
  saveSettings();
  const args = makeArgs(data);
  const runId = `${Date.now()}`;
  const child = spawn(pythonFile(), ['-X', 'utf8', '-u', engineFile('ffugen.py'), ...args],
    {cwd: path.dirname(data.template), windowsHide: true, shell:false,
      env: {...process.env, PYTHONIOENCODING:'utf-8'}});
  currentRun = child;
  emit('run-start', {runId, command: ['ffugen.py', ...args]});
  child.stdout.on('data', chunk => emit('run-output', {runId, text:chunk.toString('utf8')}));
  child.stderr.on('data', chunk => emit('run-output', {runId, text:chunk.toString('utf8')}));
  child.on('error', error => emit('run-output', {runId, text:`${error.message}\n`}));
  child.on('close', (code, signal) => {
    currentRun = null;
    emit('run-end', {runId, code, signal, output:data.output});
  });
  return {runId};
});
ipcMain.handle('cancel', () => {if (!currentRun) return false; currentRun.kill(); return true;});
ipcMain.handle('show-output', (_event, file) => {
  if (!file || !fs.existsSync(file)) throw new Error('Output file is missing.');
  shell.showItemInFolder(file);
  return true;
});

module.exports = {validate, makeArgs};
