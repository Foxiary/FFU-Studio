const $ = id => document.getElementById(id);
let fonts = [{path:'',index:0}];
let templateInfo = null;
let running = false;
let logText = '';
let previewRevision = 0;

function showError(message) {$('error').textContent = message;$('error').classList.remove('hidden');}
function clearError() {$('error').classList.add('hidden');$('error').textContent='';}
function log(text) {logText=text;$('log').textContent=text;$('log').scrollTop=$('log').scrollHeight;}
function runStatus(text, css) {$('log-status').textContent=text;$('log-dot').className=`dot ${css || ''}`;}
function node(tag, className, text) {const item=document.createElement(tag);if(className)item.className=className;if(text!==undefined)item.textContent=text;return item;}

function renderFonts() {
  const list=$('font-list');list.replaceChildren();
  fonts.forEach((font,index)=>{
    const row=node('div','font-row');
    const file=node('div');file.append(node('div','small-label',`SOURCE ${String(index+1).padStart(2,'0')}`));
    const pathRow=node('div','input-row');
    const input=node('input','font-path');input.type='text';input.value=font.path;input.placeholder='Choose an .otf, .ttf, or .ttc font…';input.setAttribute('aria-label',`Font ${index+1} path`);
    input.addEventListener('input',()=>{fonts[index].path=input.value;clearError();});
    const browse=node('button','browse','Browse');browse.type='button';
    browse.addEventListener('click',async()=>{try{const picked=await window.ffu.pickFile('font',input.value);if(picked){fonts[index].path=picked;input.value=picked;clearError();}}catch(error){showError(error.message);}});
    pathRow.append(input,browse);file.append(pathRow);
    const face=node('div');face.append(node('div','small-label','TTC FACE'));
    const faceInput=node('input','font-face');faceInput.type='number';faceInput.min='0';faceInput.step='1';faceInput.value=String(font.index || 0);faceInput.setAttribute('aria-label',`Font ${index+1} face index`);
    faceInput.addEventListener('input',()=>{fonts[index].index=faceInput.value;});face.append(faceInput);
    const actions=node('div','font-actions');
    const up=node('button','','↑');up.title='Move up';up.disabled=index===0;up.addEventListener('click',()=>{[fonts[index-1],fonts[index]]=[fonts[index],fonts[index-1]];renderFonts();});
    const down=node('button','','↓');down.title='Move down';down.disabled=index===fonts.length-1;down.addEventListener('click',()=>{[fonts[index+1],fonts[index]]=[fonts[index],fonts[index+1]];renderFonts();});
    const remove=node('button','','×');remove.title='Remove font';remove.disabled=fonts.length===1;remove.addEventListener('click',()=>{fonts.splice(index,1);renderFonts();});
    actions.append(up,down,remove);row.append(file,face,actions);list.append(row);
  });
}
function setMetrics(target, info) {
  const container=$(target);container.replaceChildren();
  for (const [label,value,warn] of [
    ['Glyphs',info.glyphCount,false],['Cell',`${info.cellHeight}px`,!info.headerMatches],
    ['Palettes',info.paletteCount,false],['Stroke',info.strokeCompatible?'compatible':'unavailable',false],
    ['Missing sample',info.missing.length,info.missing.length>0]
  ]) container.append(node('span',`metric ${warn?'warn':''}`,`${label}: ${value}`));
}
function showInspection(which, info) {
  const image=$(which==='template'?'template-image':'output-image');
  const empty=$(which==='template'?'template-empty':'output-empty');
  image.src=info.preview;image.classList.remove('hidden');empty.classList.add('hidden');
  setMetrics(which==='template'?'template-metrics':'output-metrics',info);
  $(which==='template'?'template-tag':'output-tag').textContent=info.missing.length ? `${info.missing.length} sample glyphs missing` : 'Preview ready';
  if(which==='template') {
    templateInfo=info;
    $('template-details').textContent=`${info.glyphCount.toLocaleString()} glyph${info.glyphCount===1?'':'s'} · ${info.cellHeight}px cell · ${info.paletteCount} palette${info.paletteCount===1?'':'s'} · ${info.strokeCompatible?'dark outline available':'no dark outline palette'}`;
    $('template-details').classList.add('ready');
    strokeHint();
  }
}
function resetPreview(which,message) {
  const image=$(which==='template'?'template-image':'output-image');
  const empty=$(which==='template'?'template-empty':'output-empty');
  image.classList.add('hidden');image.removeAttribute('src');empty.textContent=message;empty.classList.remove('hidden');
  $(which==='template'?'template-metrics':'output-metrics').replaceChildren();
  $(which==='template'?'template-tag':'output-tag').textContent=which==='template'?'No file':'Awaiting generation';
  if(which==='template') {templateInfo=null;$('template-details').textContent='Choose a template to inspect its cell and palette.';$('template-details').classList.remove('ready');}
}
async function inspect(which,revision) {
  const path=$(which==='template'?'template':'output').value.trim();
  if(!path){resetPreview(which,which==='template'?'Select an FFU to preview its glyphs.':'The generated font will appear here.');return;}
  try {
    const info=await window.ffu.inspect(path,$('sample').value);
    if(revision!==previewRevision)return;
    showInspection(which,info);
    if(which==='output')$('show-output').classList.remove('hidden');
  } catch(error) {
    if(revision!==previewRevision)return;
    resetPreview(which,error.message);
    if(which==='template')showError(`Template: ${error.message}`);
  }
}
async function refreshPreviews(includeOutput=true) {
  const revision=++previewRevision;
  await Promise.allSettled([inspect('template',revision),...(includeOutput?[inspect('output',revision)]:[])]);
}
function strokeHint() {
  const stroke=Number($('stroke').value||0);
  const hint=$('stroke-hint');
  if(stroke>0&&templateInfo&&!templateInfo.strokeCompatible) {
    hint.textContent='This template has no dark opaque palette entry. The generator will reject a nonzero stroke for it.';
    hint.classList.remove('hidden');
  } else hint.classList.add('hidden');
}
function collect() {
  const options={};
  for(const id of ['px','matchChar','pad','cell','spaceRatio','tracking','glow','markLift','stroke'])options[id]=$(id).value.trim();
  options.addVietnamese=$('addVietnamese').checked;
  options.normalizePunctuation=$('normalizePunctuation').checked;
  return {template:$('template').value.trim(),output:$('output').value.trim(),fonts:fonts.map(x=>({path:x.path.trim(),index:x.index||0})),options};
}
function setRunning(value) {
  running=value;
  $('generate').disabled=value;
  $('stop').disabled=!value;
  $('action-title').textContent=value?'Generating font…':'Ready to generate';
  $('action-hint').textContent=value?'The original ffugen.py is rendering your glyphs.':'Choose a template, at least one font, and an output file.';
}

async function start() {
  const data=await window.ffu.state();
  $('source-version').textContent=data.sourceCommit.slice(0,7);
  $('about-commit').textContent=data.sourceCommit;
  $('runtime').textContent=data.runtime.ok?`Font engine ${data.runtime.version} · ready`:'Font engine unavailable';
  $('runtime').className=`status-pill ${data.runtime.ok?'good':'bad'}`;
  $('runtime').title=data.runtime.detail;
  fonts=data.settings.fonts?.length?data.settings.fonts:[{path:'',index:0}];
  $('template').value=data.settings.template||'';
  $('output').value=data.settings.output||'';
  const options=data.settings.options||{};
  for(const id of ['px','matchChar','pad','cell','spaceRatio','tracking','glow','markLift','stroke'])$(''+id).value=options[id]??(id==='matchChar'?'A':'');
  $('addVietnamese').checked=options.addVietnamese!==false;
  $('normalizePunctuation').checked=options.normalizePunctuation!==false;
  renderFonts();
  $('add-font').addEventListener('click',()=>{fonts.push({path:'',index:0});renderFonts();});
  $('pick-template').addEventListener('click',async()=>{try{const file=await window.ffu.pickFile('template',$('template').value);if(file){$('template').value=file;clearError();refreshPreviews(false);}}catch(error){showError(error.message);}});
  $('pick-output').addEventListener('click',async()=>{try{const file=await window.ffu.pickFile('output',$('output').value);if(file){$('output').value=file;clearError();}}catch(error){showError(error.message);}});
  $('template').addEventListener('change',()=>refreshPreviews(false));
  $('refresh-preview').addEventListener('click',()=>{clearError();refreshPreviews();});
  $('use-template-cell').addEventListener('click',()=>{if(templateInfo)$('cell').value=String(templateInfo.cellHeight);else showError('Choose a valid FFU template first.');});
  $('stroke').addEventListener('input',strokeHint);
  $('generate').addEventListener('click',async()=>{
    if(running)return;
    clearError();
    try {
      const result=await window.ffu.generate(collect());
      if(result?.cancelled)log('Generation cancelled before replacing the existing file.');
    } catch(error){showError(error.message);}
  });
  $('stop').addEventListener('click',async()=>{await window.ffu.cancel();});
  $('show-output').addEventListener('click',async()=>{try{await window.ffu.showOutput($('output').value.trim());}catch(error){showError(error.message);}});
  $('clear-log').addEventListener('click',()=>log(''));
  $('about-button').addEventListener('click',()=>$('about-dialog').showModal());
  $('close-about').addEventListener('click',()=>$('about-dialog').close());
  window.ffu.on('run-start',event=>{
    setRunning(true);
    log(`$ ${event.command.map(x=>/\s/.test(x)?JSON.stringify(x):x).join(' ')}\n\n`);
    runStatus('Rendering…','running');
  });
  window.ffu.on('run-output',event=>log(logText+event.text));
  window.ffu.on('run-end',async event=>{
    setRunning(false);
    const okay=event.code===0;
    log(`${logText}\n${okay?'Generated successfully':event.signal?'Stopped':`Failed with exit code ${event.code}`}\n`);
    runStatus(okay?'Complete':event.signal?'Stopped':'Failed',okay?'success':'failed');
    if(okay) { $('output').value=event.output; await refreshPreviews(); }
  });
  if($('template').value)refreshPreviews();
}
start().catch(error=>{document.body.textContent=`FFU Studio could not start: ${error.message}`;});
