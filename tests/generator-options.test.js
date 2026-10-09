const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Japanese punctuation opt-out reaches the generator command', () => {
  const context = {
    require: id => id === 'electron' ? {
      app: {whenReady: () => new Promise(() => {}), on() {}},
      ipcMain: {handle() {}},
    } : require(id === './update-check' ? '../src/update-check' : id),
    module: {exports: {}}, __dirname: path.join(__dirname, '../src'), process,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../src/main.js'), 'utf8') +
    '\nmodule.exports = {makeArgs};', context);
  const {makeArgs} = context.module.exports;
  const data = {template: 'stock.ffu', output: 'new.ffu', fonts: [{path: 'font.ttf', index: 0}]};
  for (const options of [{}, {normalizePunctuation: true}]) {
    assert.equal(makeArgs({...data, options}).includes('--no-normalize-punctuation'), false);
  }
  const args = makeArgs({...data, options: {normalizePunctuation: false, addVietnamese: false}});
  assert.ok(args.includes('--no-normalize-punctuation'));
  assert.ok(args.includes('--no-vn'));
});
