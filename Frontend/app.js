// Theme configuration runs after the Tailwind CDN script in <head>.
// Keep app interactions available when the optional CDN is unavailable.
if (typeof tailwind !== 'undefined') {
  tailwind.config = {
    darkMode: "class",
    theme: {
      extend: {
        "colors": {
                "inverse-on-surface": "#f0f1f3",
                "on-secondary": "#ffffff",
                "surface-container-high": "#e7e8ea",
                "on-secondary-fixed": "#091c35",
                "on-tertiary-container": "#ffdcdc",
                "background": "#f8f9fb",
                "secondary-fixed-dim": "#b7c7e8",
                "on-background": "#191c1e",
                "outline": "#6f7a71",
                "tertiary-fixed-dim": "#ffb3b6",
                "secondary-fixed": "#d6e3ff",
                "surface-variant": "#e1e2e4",
                "on-tertiary-fixed-variant": "#85202f",
                "secondary": "#4f5f7b",
                "on-primary-container": "#9ff7c2",
                "inverse-primary": "#82d8a6",
                "inverse-surface": "#2e3132",
                "surface-container-low": "#f3f4f6",
                "on-surface": "#191c1e",
                "surface-tint": "#066c43",
                "surface": "#f8f9fb",
                "on-primary": "#ffffff",
                "surface-container": "#edeef0",
                "on-tertiary-fixed": "#40000c",
                "secondary-container": "#cdddff",
                "primary-fixed": "#9ef5c0",
                "primary": "#16744a", /* Updated primary brand color */
                "tertiary-fixed": "#ffdada",
                "on-primary-fixed": "#002111",
                "on-secondary-fixed-variant": "#374763",
                "tertiary-container": "#af3f4b",
                "on-tertiary": "#ffffff",
                "outline-variant": "#bec9bf",
                "error": "#ba1a1a",
                "on-surface-variant": "#3f4942",
                "primary-fixed-dim": "#82d8a6",
                "on-secondary-container": "#51617e",
                "error-container": "#ffdad6",
                "surface-bright": "#f8f9fb",
                "on-primary-fixed-variant": "#005231",
                "surface-container-lowest": "#ffffff",
                "tertiary": "#8f2735",
                "surface-dim": "#d9dadc",
                "on-error-container": "#93000a",
                "surface-container-highest": "#e1e2e4",
                "on-error": "#ffffff",
                "primary-container": "#16744a"
        },
        "borderRadius": {
                "DEFAULT": "0.125rem",
                "lg": "0.25rem",
                "xl": "0.5rem",
                "2xl": "0.75rem",
                "3xl": "1rem",
                "full": "9999px"
        },
        "spacing": {
                "sidebar-width": "260px",
                "sm": "8px",
                "xs": "4px",
                "md": "16px",
                "unit": "4px",
                "gutter": "16px",
                "xl": "40px",
                "lg": "24px",
                "2xl": "64px"
        },
        "fontFamily": {
                "body-md": [
                        "Inter", "sans-serif"
                ],
                "formula-preview": [
                        "JetBrains Mono", "monospace"
                ],
                "display-lg": [
                        "Inter", "sans-serif"
                ],
                "label-caps": [
                        "Inter", "sans-serif"
                ],
                "formula-sm": [
                        "JetBrains Mono", "monospace"
                ],
                "headline-md": [
                        "Inter", "sans-serif"
                ]
        },
        "fontSize": {
                "body-md": [
                        "14px",
                        {
                                "lineHeight": "20px",
                                "fontWeight": "400"
                        }
                ],
                "formula-preview": [
                        "16px",
                        {
                                "lineHeight": "24px",
                                "fontWeight": "400"
                        }
                ],
                "display-lg": [
                        "30px",
                        {
                                "lineHeight": "38px",
                                "letterSpacing": "-0.02em",
                                "fontWeight": "700"
                        }
                ],
                "label-caps": [
                        "12px",
                        {
                                "lineHeight": "16px",
                                "letterSpacing": "0.05em",
                                "fontWeight": "700"
                        }
                ],
                "formula-sm": [
                        "13px",
                        {
                                "lineHeight": "18px",
                                "fontWeight": "400"
                        }
                ],
                "headline-md": [
                        "20px",
                        {
                                "lineHeight": "28px",
                                "fontWeight": "600"
                        }
                ]
        }
},
    },
  }
}

// Navigation and view animations.
const UPGRADE_SVG = '<svg width="28" height="28" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><clipPath id="sqClip"><rect x="3" y="3" width="18" height="18" rx="2"/></clipPath></defs><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><g clip-path="url(#sqClip)"><g class="sq-arrow"><path d="m8 12 4-4 4 4"/><path d="M12 8v8"/><g transform="translate(0 24)"><path d="m8 12 4-4 4 4"/><path d="M12 8v8"/></g></g></g></g></svg>';
function reconstructUpgradeIcon(){
  const host = document.getElementById('upgradeIcon');
  if(!host) return;
  host.innerHTML = '';
  requestAnimationFrame(()=>{ host.innerHTML = UPGRADE_SVG; });
}
// 页面加载时绘制一次
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('upgradeIcon').innerHTML = UPGRADE_SVG;
});
var __switching = false, __pendingView = null;
function showView(name){
  const workspaceEl = document.getElementById('workspaceView');
  const settingsEl = document.getElementById('settingsView');
  // 动画进行中:只记录最后一次目标,当前切换结束后再执行(避免元素全部消失)
  if(__switching){
    __pendingView = name;
    return;
  }
  // 已在目标页
  if((name === 'workspace' && !workspaceEl.classList.contains('hidden')) ||
     (name === 'settings' && !settingsEl.classList.contains('hidden'))){
    navState(name);
    return;
  }
  __switching = true;
  // 当前/目标
  const currentEl = name === 'workspace' ? settingsEl : workspaceEl;
  const targetEl  = name === 'workspace' ? workspaceEl : settingsEl;
  // 方向:识别页(work)离开时向上(-),设置页离开时向下(+);目标为识别页时从上方进入
  // 距离用视口高度(110vh),保证元素完全飞出画面后再离开/进入
  const outY = (currentEl === workspaceEl ? -1 : 1) * 110 + 'vh';
  const inY  = (targetEl  === workspaceEl ? -1 : 1) * 110 + 'vh';

  // 离开:设置页飞出时底部元素先走(与进入识别页时的落位顺序镜像)
  currentEl.style.setProperty('--fly-y', outY);
  currentEl.classList.add('view-fly-out');
  cascadeDelay(currentEl, currentEl === settingsEl);
  waitCascadeDone(currentEl, ()=>{
    clearCascadeDelay(currentEl);
    currentEl.classList.add('hidden');
    currentEl.classList.remove('view-fly-out');
    currentEl.style.removeProperty('--fly-y');

    // 进入:同样级联飞入
    targetEl.classList.remove('hidden');
    targetEl.style.setProperty('--fly-y', inY);
    targetEl.classList.add('view-fly-in');
    cascadeDelay(targetEl, targetEl === workspaceEl);
    waitCascadeDone(targetEl, ()=>{
      clearCascadeDelay(targetEl);
      targetEl.classList.remove('view-fly-in');
      targetEl.style.removeProperty('--fly-y');
      finishSwitch();
    });
  });

  navState(name);
}
function finishSwitch(){
  __switching = false;
  if(__pendingView){
    const n = __pendingView;
    __pendingView = null;
    showView(n);
  }
}
var __flySteps = 0;
function cascadeDelay(el, reverse){
  const base = 75;      // 首个间隔 150ms → 缩短 50%
  const decay = 0.8;    // 之后相邻间隔按 0.8 递减:75 · 60 · 48 · 38 …
  const kids = Array.from(el.children);
  if(reverse) kids.reverse(); // 倒序:最下方元素最先
  kids.forEach((k,i)=>{
    if(i === 0){ k.style.animationDelay = '0ms'; return; }
    let d = 0;
    for(let j = 0; j < i; j++) d += base * Math.pow(decay, j);
    k.style.animationDelay = d + 'ms';
  });
}
function clearCascadeDelay(el){
  Array.from(el.children).forEach(k=>{
    k.style.animationDelay = '';
    k.style.transform = 'none'; // 显式复位,避免动画残留导致微小位移
  });
}
function waitCascadeDone(el, cb){
  const kids = Array.from(el.children);
  if(kids.length === 0){ cb(); return; }
  __flySteps = kids.length;
  kids.forEach(k=>{
    k.addEventListener('animationend', ()=>{
      __flySteps--;
      if(__flySteps === 0) cb();
    }, {once:true});
  });
}
function navState(name){
  document.getElementById('navWorkspace').classList.toggle('active', name === 'workspace');
  document.getElementById('navSettings').classList.toggle('active', name === 'settings');
}
function activateModel(row){
  if (!row) return;
  document.querySelectorAll('.model-row').forEach(r=>{
    const isSel = r === row;
    r.classList.toggle('active', isSel);
    r.setAttribute('aria-checked', isSel ? 'true' : 'false');
  });
  document.getElementById('modelBadge').textContent = row.dataset.label;
}
document.addEventListener('DOMContentLoaded', ()=>{
  document.querySelectorAll('.model-row').forEach(r=>r.addEventListener('click', ()=>activateModel(r)));
  activateModel(document.querySelector('.model-row'));
});

// Recognition, custom AI settings, history and software updates.
// --- Local Tauri MVP integration -----------------------------------------
let selectedModel = localStorage.getItem('axiom.model') || 'texteller';
let currentImageDataUrl = '';
let currentLatex = '';
let toastTimer = null;
let recognitionBusy = false;
let customAiBusy = false;
let customAiLoading = true;
let customAiHasKey = false;
let customAiClearKeyPending = false;
let customAiModelNames = [];
let customAiModelMatches = [];
let customAiActiveModelIndex = -1;
let customAiEditingProfileId = null;
let customAiEditingProfileName = '';
let customAiNamingOpen = false;
let customAiRemovalOpen = false;
let customAiRemovalTarget = null;
let dropZoneResetTimer = null;
let dropZoneStateVersion = 0;
let dropZoneDragDepth = 0;
let imageInputsInitialized = false;

function isCustomAiModelId(id) {
  return id === 'custom-ai' || (typeof id === 'string' && id.startsWith('custom-ai:'));
}

function customAiProfileIdFromModel(id) {
  if (id === 'custom-ai') return 'legacy';
  return typeof id === 'string' && id.startsWith('custom-ai:') ? id.slice('custom-ai:'.length) : null;
}

function localInvoke(command, args) {
  const invoke = window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.core.invoke;
  if (typeof invoke !== 'function') {
    return Promise.reject(new Error('请通过 Tauri 应用运行此功能'));
  }
  return invoke(command, args);
}

function showToast(message, isError = false) {
  const toast = document.getElementById('appToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle('bg-error', isError);
  toast.classList.toggle('bg-[#191c1e]', !isError);
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2600);
}

function setRecognitionStatus(label, state = 'idle') {
  const status = document.getElementById('recognitionStatus');
  if (!status) return;
  const iconName = state === 'busy' ? 'hourglass_top' : state === 'error' ? 'error' : 'check_circle';
  status.innerHTML = '';
  const icon = document.createElement('span');
  icon.className = 'material-symbols-outlined text-[14px]';
  icon.textContent = iconName;
  status.append(icon, document.createTextNode(' ' + label));
  status.classList.toggle('text-error', state === 'error');
  status.classList.toggle('bg-error-container', state === 'error');
  status.classList.toggle('text-primary', state !== 'error');
  status.classList.toggle('bg-primary/10', state !== 'error');
}

function renderPreview(latex) {
  const preview = document.getElementById('latexPreview');
  if (!preview) return;
  const value = latex || '';
  if (typeof katex === 'undefined' || !value.trim()) {
    preview.textContent = value.trim() ? value : '等待识别结果';
    return;
  }
  // TexTeller 输出形如 \[ ... \]，去掉首尾包裹后交给 KaTeX 渲染
  const cleaned = value.trim().replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
  try {
    katex.render(cleaned, preview, {
      displayMode: true,
      throwOnError: false,
      output: 'html',
    });
  } catch (error) {
    preview.textContent = value;
  }
}

// TexTeller 输出形如 \[ ... \]，展示/编辑/复用时去掉首尾定界符，只保留公式本体
function cleanLatex(value) {
  return (value || '').trim().replace(/^\\\[/, '').replace(/\\\]$/, '').trim();
}

function updateLatex(value) {
  currentLatex = cleanLatex(value);
  const source = document.getElementById('latexSource');
  if (source && source.value !== currentLatex) source.value = currentLatex;
  renderPreview(currentLatex);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function imageInputLocked() {
  return recognitionBusy || customAiBusy || customAiLoading || customAiNamingOpen || customAiRemovalOpen;
}

function resetDropZoneDrag() {
  dropZoneDragDepth = 0;
  document.getElementById('dropZone')?.classList.remove('is-dragging');
}

function setDropZoneState(state, filename = '') {
  clearTimeout(dropZoneResetTimer);
  dropZoneResetTimer = null;
  const version = ++dropZoneStateVersion;
  const zone = document.getElementById('dropZone');
  if (!zone) return;
  zone.dataset.state = state;
  zone.setAttribute('aria-busy', String(state === 'busy'));
  const idle = document.getElementById('dropZoneIdle');
  const feedback = document.getElementById('dropZoneFeedback');
  if (idle) { idle.hidden = state !== 'idle'; idle.classList.toggle('hidden', state !== 'idle'); }
  if (feedback) { feedback.hidden = state === 'idle'; feedback.classList.toggle('hidden', state === 'idle'); }
  const icon = document.getElementById('dropZoneStatusIcon');
  if (icon) {
    const paths = state === 'success' ? '<path d="m7 12 3 3 7-7"/>'
      : state === 'error' ? '<path d="M12 8v5"/><path d="M12 16h.01"/>'
      : '<path d="M12 3a9 9 0 1 1-9 9"/>';
    icon.innerHTML = state === 'idle' ? '' : '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths + '</svg>';
  }
  const status = document.getElementById('dropZoneStatusText');
  if (status) status.textContent = state === 'busy' ? '正在识别公式…' : state === 'success' ? '识别完成' : state === 'error' ? '未能识别，请重试' : '';
  const name = document.getElementById('dropZoneFilename');
  if (name) name.textContent = state === 'idle' ? '' : filename;
  if (state === 'success' || state === 'error') {
    dropZoneResetTimer = setTimeout(() => {
      if (version === dropZoneStateVersion) setDropZoneState('idle');
    }, 2400);
  }
}

function updateInteractionLocks() {
  const imageLocked = imageInputLocked();
  const dropZone = document.getElementById('dropZone');
  if (dropZone) {
    dropZone.setAttribute('aria-disabled', String(imageLocked));
    dropZone.tabIndex = imageLocked ? -1 : 0;
    if (imageLocked) resetDropZoneDrag();
  }
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.disabled = imageLocked;
    fileInput.setAttribute('aria-disabled', String(imageLocked));
  }
  const source = document.getElementById('latexSource');
  if (source) source.readOnly = recognitionBusy;
  document.querySelectorAll('.model-row').forEach((row) => {
    const locked = recognitionBusy || customAiBusy || customAiLoading || customAiNamingOpen || customAiRemovalOpen;
    row.setAttribute('aria-disabled', String(locked));
    row.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
  });
  const fields = document.getElementById('customAiFields');
  if (fields) fields.disabled = customAiLoading || customAiBusy || recognitionBusy || customAiNamingOpen || customAiRemovalOpen;
  const modelToggle = document.getElementById('customAiToggleModels');
  if (modelToggle) modelToggle.disabled = customAiLoading || customAiBusy || recognitionBusy || customAiNamingOpen || customAiRemovalOpen || !customAiModelNames.length;
  if (customAiLoading || customAiBusy || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) closeCustomAiModelOptions();
  const temperature = document.getElementById('customAiTemperature');
  const usesResponses = document.getElementById('customAiApiFormat').value === 'responses';
  if (temperature) temperature.disabled = usesResponses;
  const clearKey = document.getElementById('customAiClearKey');
  if (clearKey) clearKey.disabled = !customAiHasKey && !document.getElementById('customAiKey').value;
  ['customAiProfileName', 'customAiNameConfirm', 'customAiNameCancel', 'customAiRemoveConfirm', 'customAiRemoveCancel'].forEach((id) => {
    const element = document.getElementById(id);
    if (element) element.disabled = customAiBusy;
  });
}

function customAiMessage(message, isError = false) {
  if (isError && message) showToast(message, true);
}

function customAiError(error) {
  let message = (error && error.message) || String(error);
  const key = document.getElementById('customAiKey').value.trim();
  if (key) message = message.split(key).join('[密钥已隐藏]');
  return message;
}

function closeCustomAiModelOptions() {
  document.getElementById('customAiModelOptions').hidden = true;
  const input = document.getElementById('customAiModel');
  input.setAttribute('aria-expanded', 'false');
  input.removeAttribute('aria-activedescendant');
  document.getElementById('customAiToggleModels').setAttribute('aria-expanded', 'false');
  customAiActiveModelIndex = -1;
}

function clearCustomAiModelOptions() {
  customAiModelNames = [];
  customAiModelMatches = [];
  closeCustomAiModelOptions();
  document.getElementById('customAiModelOptions').replaceChildren();
}

function markCustomAiConfigChanged() {
  document.getElementById('customAiBadge').textContent = '未保存';
  updateCustomAiKeyHint();
  customAiMessage('配置已修改。');
}

function selectCustomAiModel(name) {
  if (customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
  const input = document.getElementById('customAiModel');
  input.value = name;
  input.focus({ preventScroll: true });
  closeCustomAiModelOptions();
  markCustomAiConfigChanged();
}

function showCustomAiModelOptions(query = '') {
  if (customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen || !customAiModelNames.length) return;
  const input = document.getElementById('customAiModel');
  const options = document.getElementById('customAiModelOptions');
  const search = query.trim().toLowerCase();
  customAiModelMatches = customAiModelNames.filter((name) => name.toLowerCase().includes(search));
  customAiActiveModelIndex = customAiModelMatches.indexOf(input.value.trim());
  input.removeAttribute('aria-activedescendant');
  options.replaceChildren();
  customAiModelMatches.forEach((name, index) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.tabIndex = -1;
    option.id = `customAiModelOption-${index}`;
    option.setAttribute('role', 'option');
    option.setAttribute('aria-selected', String(index === customAiActiveModelIndex));
    option.textContent = name;
    option.addEventListener('mousedown', (event) => event.preventDefault());
    option.addEventListener('click', () => selectCustomAiModel(name));
    options.appendChild(option);
  });
  if (!customAiModelMatches.length) {
    const empty = document.createElement('div');
    empty.className = 'custom-ai-model-empty';
    empty.textContent = '没有匹配的模型，可继续手动填写。';
    options.appendChild(empty);
  } else if (customAiActiveModelIndex >= 0) {
    input.setAttribute('aria-activedescendant', `customAiModelOption-${customAiActiveModelIndex}`);
  }
  options.hidden = false;
  input.setAttribute('aria-expanded', 'true');
  document.getElementById('customAiToggleModels').setAttribute('aria-expanded', 'true');
}

function initCustomAiModelPicker() {
  const picker = document.getElementById('customAiModelPicker');
  const input = document.getElementById('customAiModel');
  const options = document.getElementById('customAiModelOptions');
  const toggle = document.getElementById('customAiToggleModels');
  input.addEventListener('focus', () => showCustomAiModelOptions());
  input.addEventListener('click', () => { if (options.hidden) showCustomAiModelOptions(); });
  input.addEventListener('input', () => showCustomAiModelOptions(input.value));
  input.addEventListener('keydown', (event) => {
    if (event.isComposing || customAiBusy || customAiLoading || recognitionBusy) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!customAiModelNames.length) return;
      event.preventDefault();
      if (options.hidden) showCustomAiModelOptions();
      const count = customAiModelMatches.length;
      if (!count) return;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      customAiActiveModelIndex = customAiActiveModelIndex < 0
        ? (step > 0 ? 0 : count - 1)
        : (customAiActiveModelIndex + step + count) % count;
      Array.from(options.children).forEach((option, index) => option.setAttribute('aria-selected', String(index === customAiActiveModelIndex)));
      const active = options.children[customAiActiveModelIndex];
      input.setAttribute('aria-activedescendant', active.id);
      active.scrollIntoView({ block: 'nearest' });
    } else if (event.key === 'Enter' && !options.hidden) {
      event.preventDefault();
      if (customAiActiveModelIndex >= 0) selectCustomAiModel(customAiModelMatches[customAiActiveModelIndex]);
      else closeCustomAiModelOptions();
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape' && !options.hidden) event.preventDefault();
      closeCustomAiModelOptions();
    }
  });
  toggle.addEventListener('mousedown', (event) => event.preventDefault());
  toggle.addEventListener('click', () => {
    if (customAiBusy || customAiLoading || recognitionBusy) return;
    if (!options.hidden) closeCustomAiModelOptions();
    else { input.focus({ preventScroll: true }); showCustomAiModelOptions(); }
  });
  picker.addEventListener('focusout', (event) => { if (!picker.contains(event.relatedTarget)) closeCustomAiModelOptions(); });
  document.addEventListener('pointerdown', (event) => { if (!picker.contains(event.target)) closeCustomAiModelOptions(); });
}

function updateCustomAiKeyHint() {
  const key = document.getElementById('customAiKey');
  key.placeholder = customAiHasKey && !customAiClearKeyPending ? '已保存密钥；留空保留，输入新值替换' : '服务需要鉴权时填写';
  document.getElementById('customAiKeyHint').textContent = customAiClearKeyPending
    ? '已标记清除密钥，保存后生效。'
    : customAiHasKey
      ? '此设备已保存密钥，不会回显。更换服务地址时请重新输入对应密钥。'
      : '密钥保存在此设备，不写入浏览器存储。本机免鉴权服务可留空。';
  updateInteractionLocks();
}

function applyCustomAiConfig(config) {
  customAiEditingProfileId = config.profileId || null;
  customAiEditingProfileName = config.name || '';
  const editing = Boolean(customAiEditingProfileId);
  ['customAiUpdate', 'customAiCancelEdit', 'customAiEditingName'].forEach((id) => {
    const element = document.getElementById(id);
    element.hidden = !editing;
    element.classList.toggle('hidden', !editing);
  });
  document.getElementById('customAiEditingName').textContent = editing ? '正在编辑：' + customAiEditingProfileName : '';
  document.getElementById('customAiApiFormat').value = config.apiFormat || 'chat-completions';
  document.getElementById('customAiBaseUrl').value = config.baseUrl || '';
  document.getElementById('customAiModel').value = config.model || '';
  document.getElementById('customAiPrompt').value = config.prompt || '';
  document.getElementById('customAiTemperature').value = config.temperature ?? 0;
  document.getElementById('customAiTimeout').value = config.timeoutSeconds ?? 90;
  const key = document.getElementById('customAiKey');
  key.value = '';
  key.type = 'password';
  document.getElementById('customAiToggleKey').textContent = '显示';
  document.getElementById('customAiToggleKey').setAttribute('aria-pressed', 'false');
  customAiHasKey = Boolean(config.hasApiKey);
  customAiClearKeyPending = false;
  document.getElementById('customAiBadge').textContent = editing ? '编辑配置' : '新配置';
  updateCustomAiKeyHint();
}

function resetCustomAiForm() {
  clearCustomAiModelOptions();
  applyCustomAiConfig({ apiFormat: 'responses', baseUrl: '', model: '', prompt: '',
    temperature: 0, timeoutSeconds: 90, hasApiKey: false, profileId: null, name: '' });
}

function readCustomAiConfig(requireModel = true) {
  const apiFormat = document.getElementById('customAiApiFormat').value;
  const baseUrl = document.getElementById('customAiBaseUrl').value.trim();
  const model = document.getElementById('customAiModel').value.trim();
  const temperatureText = document.getElementById('customAiTemperature').value.trim();
  const timeoutText = document.getElementById('customAiTimeout').value.trim();
  let temperature = Number(temperatureText);
  const timeoutSeconds = Number(timeoutText);
  if (!['responses', 'chat-completions'].includes(apiFormat)) throw new Error('请选择 Responses 或 Chat Completions 接口协议。');
  if (!baseUrl) throw new Error('请填写接口地址。');
  let address;
  try { address = new URL(baseUrl); } catch (_) { throw new Error('接口地址无效，请填写包含 https:// 的完整地址。'); }
  const isLocal = ['localhost', '127.0.0.1', '[::1]', '::1'].includes(address.hostname.toLowerCase());
  if (address.protocol !== 'https:' && !(address.protocol === 'http:' && isLocal)) {
    throw new Error('远程服务请使用 HTTPS；HTTP 仅支持 localhost、127.0.0.1 或 ::1。');
  }
  if (address.username || address.password || address.search || address.hash) {
    throw new Error('接口地址不能包含用户名、密码、查询参数或片段，请将密钥填写到 API Key。');
  }
  if (requireModel && !model) throw new Error('请填写支持图片输入的模型名称。');
  if (model.length > 512) throw new Error('模型名称过长。');
  if (!temperatureText || !Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    if (apiFormat === 'chat-completions') throw new Error('温度必须为 0 到 2 之间的数值。');
    temperature = 0;
  }
  if (!timeoutText || !Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 300) {
    throw new Error('超时必须为 10 到 300 之间的整数秒。');
  }
  const apiKey = document.getElementById('customAiKey').value.trim();
  return {
    profileId: customAiEditingProfileId || undefined,
    apiFormat, baseUrl, model, temperature, timeoutSeconds,
    prompt: document.getElementById('customAiPrompt').value.trim(),
    apiKey: apiKey || undefined,
    clearApiKey: customAiClearKeyPending,
  };
}

async function runCustomAiAction(kind) {
  if (customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
  if (!['models', 'test', 'update'].includes(kind)) return;
  if (kind === 'update' && !customAiEditingProfileId) return;
  let config;
  try { config = readCustomAiConfig(kind !== 'models'); }
  catch (error) { customAiMessage(customAiError(error), true); return; }
  let showFetchedModels = false;
  if (kind === 'models') clearCustomAiModelOptions();
  customAiBusy = true;
  document.getElementById('customAiForm').setAttribute('aria-busy', 'true');
  updateInteractionLocks();
  customAiMessage(kind === 'models' ? '正在获取模型列表…' : kind === 'test' ? '正在使用内置公式图片测试识别…' : '正在保存配置…');
  try {
    if (kind === 'models') {
      const models = await localInvoke('list_custom_ai_models', { config });
      customAiModelNames = [...new Set(Array.isArray(models) ? models.filter((name) => typeof name === 'string' && name.trim()) : [])];
      showFetchedModels = customAiModelNames.length > 0;
      customAiMessage(showFetchedModels ? `已获取 ${customAiModelNames.length} 个模型，可从下拉列表选择，也可直接手填。` : '服务未返回模型列表，可直接填写模型名称。');
    } else if (kind === 'test') {
      const result = await localInvoke('test_custom_ai_config', { config });
      const elapsed = Number.isFinite(result && result.elapsedMs) ? `（${result.elapsedMs} ms）` : '';
      showToast(((result && result.message) || '图片识别测试通过。') + elapsed);
    } else if (kind === 'update') {
      await localInvoke('update_custom_ai_profile', {
        id: customAiEditingProfileId, name: customAiEditingProfileName, config,
      });
      resetCustomAiForm();
      await renderModels();
      customAiMessage('修改已保存。');
      showToast('配置已更新');
    }
  } catch (error) {
    customAiMessage(customAiError(error), true);
  } finally {
    customAiBusy = false;
    document.getElementById('customAiForm').setAttribute('aria-busy', 'false');
    updateInteractionLocks();
    const settings = document.getElementById('settingsView');
    if (showFetchedModels && !settings.classList.contains('hidden') && !settings.classList.contains('view-fly-out')) {
      document.getElementById('customAiModel').focus({ preventScroll: true });
      showCustomAiModelOptions();
    }
  }
}

async function focusCustomAiConfig(profileId) {
  if (!profileId || customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
  showView('settings');
  customAiBusy = true;
  document.getElementById('customAiForm').setAttribute('aria-busy', 'true');
  updateInteractionLocks();
  customAiMessage('正在读取配置…');
  let loaded = false;
  try {
    const config = await localInvoke('get_custom_ai_config', { profileId });
    if (!config || config.profileId !== profileId) throw new Error('返回的配置不匹配，请重新加载。');
    clearCustomAiModelOptions();
    applyCustomAiConfig(config);
    customAiMessage('');
    loaded = true;
  } catch (error) {
    customAiMessage('读取配置失败：' + customAiError(error), true);
  } finally {
    customAiBusy = false;
    document.getElementById('customAiForm').setAttribute('aria-busy', 'false');
    updateInteractionLocks();
    if (loaded) {
      document.getElementById('customAiCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('customAiBaseUrl').focus({ preventScroll: true });
    }
  }
}

function openCustomAiNameDialog() {
  if (customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
  const dialog = document.getElementById('customAiNameDialog');
  document.getElementById('customAiProfileName').value = '';
  document.getElementById('customAiNameStatus').textContent = '';
  customAiNamingOpen = true;
  updateInteractionLocks();
  try {
    dialog.showModal();
    document.getElementById('customAiProfileName').focus();
  } catch (_) {
    customAiNamingOpen = false;
    updateInteractionLocks();
    customAiMessage('无法打开命名窗口，请重新尝试。', true);
  }
}

function closeCustomAiNameDialog() {
  if (customAiBusy) return;
  customAiNamingOpen = false;
  document.getElementById('customAiNameDialog').close();
  updateInteractionLocks();
}

async function createCustomAiProfile() {
  if (!customAiNamingOpen || customAiBusy || customAiLoading || recognitionBusy || customAiRemovalOpen) return;
  const status = document.getElementById('customAiNameStatus');
  const name = document.getElementById('customAiProfileName').value.trim();
  let config;
  try {
    if (!name) throw new Error('请填写配置名称。');
    if (name.length > 64) throw new Error('配置名称不能超过 64 个字符。');
    config = readCustomAiConfig();
  } catch (error) {
    status.textContent = customAiError(error);
    return;
  }
  customAiBusy = true;
  document.getElementById('customAiNameDialog').setAttribute('aria-busy', 'true');
  updateInteractionLocks();
  status.textContent = '正在保存…';
  try {
    await localInvoke('create_custom_ai_profile', { name, config });
    resetCustomAiForm();
    customAiNamingOpen = false;
    document.getElementById('customAiNameDialog').close();
    await renderModels();
    customAiMessage('新配置已添加。');
    showToast('新配置已添加');
  } catch (error) {
    status.textContent = customAiError(error);
  } finally {
    customAiBusy = false;
    document.getElementById('customAiNameDialog').setAttribute('aria-busy', 'false');
    updateInteractionLocks();
  }
}

function openCustomAiRemoveDialog(profileId, name) {
  if (!profileId || customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
  const dialog = document.getElementById('customAiRemoveDialog');
  customAiRemovalTarget = { id: profileId, name };
  document.getElementById('customAiRemoveName').textContent = name;
  document.getElementById('customAiRemoveStatus').textContent = '';
  customAiRemovalOpen = true;
  updateInteractionLocks();
  try {
    dialog.showModal();
    document.getElementById('customAiRemoveCancel').focus();
  } catch (_) {
    customAiRemovalOpen = false;
    customAiRemovalTarget = null;
    updateInteractionLocks();
    customAiMessage('无法打开确认窗口，请重新尝试。', true);
  }
}

function closeCustomAiRemoveDialog() {
  if (customAiBusy) return;
  customAiRemovalOpen = false;
  customAiRemovalTarget = null;
  document.getElementById('customAiRemoveDialog').close();
  updateInteractionLocks();
}

async function archiveCustomAiProfile() {
  if (!customAiRemovalOpen || !customAiRemovalTarget || customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen) return;
  const target = customAiRemovalTarget;
  const dialog = document.getElementById('customAiRemoveDialog');
  const status = document.getElementById('customAiRemoveStatus');
  customAiBusy = true;
  dialog.setAttribute('aria-busy', 'true');
  status.textContent = '正在删除…';
  updateInteractionLocks();
  try {
    await localInvoke('archive_custom_ai_profile', { id: target.id });
    if (customAiProfileIdFromModel(selectedModel) === target.id) {
      selectedModel = 'texteller';
      localStorage.setItem('axiom.model', selectedModel);
    }
    if (customAiEditingProfileId === target.id) resetCustomAiForm();
    customAiRemovalOpen = false;
    customAiRemovalTarget = null;
    dialog.close();
    await renderModels();
    customAiMessage('配置已删除。');
    showToast('配置已删除');
  } catch (error) {
    status.textContent = customAiError(error);
  } finally {
    customAiBusy = false;
    dialog.setAttribute('aria-busy', 'false');
    updateInteractionLocks();
  }
}

function initCustomAiRemovalDialog() {
  const dialog = document.getElementById('customAiRemoveDialog');
  document.getElementById('customAiRemoveForm').addEventListener('submit', (event) => {
    event.preventDefault();
    archiveCustomAiProfile();
  });
  document.getElementById('customAiRemoveCancel').addEventListener('click', closeCustomAiRemoveDialog);
  dialog.addEventListener('cancel', (event) => {
    if (customAiBusy) event.preventDefault();
  });
  dialog.addEventListener('close', () => {
    customAiRemovalOpen = false;
    customAiRemovalTarget = null;
    updateInteractionLocks();
  });
}

async function initCustomAiConfig() {
  const form = document.getElementById('customAiForm');
  initCustomAiModelPicker();
  initCustomAiRemovalDialog();
  form.addEventListener('submit', (event) => { event.preventDefault(); openCustomAiNameDialog(); });
  document.getElementById('customAiCreate').addEventListener('click', openCustomAiNameDialog);
  document.getElementById('customAiUpdate').addEventListener('click', () => runCustomAiAction('update'));
  document.getElementById('customAiCancelEdit').addEventListener('click', () => {
    if (customAiBusy || customAiLoading || recognitionBusy || customAiNamingOpen || customAiRemovalOpen) return;
    resetCustomAiForm();
    customAiMessage('');
  });
  const nameDialog = document.getElementById('customAiNameDialog');
  document.getElementById('customAiNameForm').addEventListener('submit', (event) => {
    event.preventDefault();
    createCustomAiProfile();
  });
  document.getElementById('customAiNameCancel').addEventListener('click', closeCustomAiNameDialog);
  nameDialog.addEventListener('cancel', (event) => {
    if (customAiBusy) event.preventDefault();
  });
  nameDialog.addEventListener('close', () => {
    customAiNamingOpen = false;
    updateInteractionLocks();
    document.getElementById('customAiCreate').focus({ preventScroll: true });
  });
  document.getElementById('customAiTest').addEventListener('click', () => runCustomAiAction('test'));
  document.getElementById('customAiFetchModels').addEventListener('click', () => runCustomAiAction('models'));
  document.getElementById('customAiToggleKey').addEventListener('click', () => {
    const key = document.getElementById('customAiKey');
    const visible = key.type === 'password';
    key.type = visible ? 'text' : 'password';
    document.getElementById('customAiToggleKey').textContent = visible ? '隐藏' : '显示';
    document.getElementById('customAiToggleKey').setAttribute('aria-pressed', String(visible));
  });
  document.getElementById('customAiClearKey').addEventListener('click', () => {
    document.getElementById('customAiKey').value = '';
    customAiClearKeyPending = true;
    clearCustomAiModelOptions();
    document.getElementById('customAiBadge').textContent = '未保存';
    updateCustomAiKeyHint();
    customAiMessage('密钥已标记清除，请保存配置使其生效。');
  });
  form.addEventListener('input', (event) => {
    if (event.target.id === 'customAiKey' && event.target.value.trim()) customAiClearKeyPending = false;
    if (['customAiBaseUrl', 'customAiKey'].includes(event.target.id)) clearCustomAiModelOptions();
    markCustomAiConfigChanged();
  });
  document.getElementById('customAiApiFormat').addEventListener('change', () => {
    clearCustomAiModelOptions();
    document.getElementById('customAiBadge').textContent = '未保存';
    updateInteractionLocks();
    customAiMessage('接口协议已修改，可先测试连接；保存后用于识别。');
  });
  resetCustomAiForm();
  customAiMessage('');
  customAiLoading = false;
  updateInteractionLocks();
}

async function recognizeDataUrl(dataUrl, mime) {
  const requestModel = selectedModel;
  const isCustom = isCustomAiModelId(requestModel);
  setRecognitionStatus(isCustom ? '正在调用自定义 AI 模型…' : '正在加载本地模型…', 'busy');
  try {
    const result = await localInvoke('recognize_image', {
      request: {
        image_base64: dataUrl,
        mime: mime || null,
        model: requestModel,
      },
    });
    if (!result || !result.success) {
      const message = result && result.error ? result.error.message : '模型没有返回结果';
      throw new Error(message);
    }
    updateLatex(result.latex || '');
    const elapsed = Number.isFinite(result.elapsed_ms) ? ` · ${result.elapsed_ms} ms` : '';
    setRecognitionStatus('识别完成' + elapsed, 'idle');
    showToast(isCustom ? '已使用自定义 AI 模型完成识别' : '已使用 TexTeller 本地模型完成识别');
    return true;
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    setRecognitionStatus('识别失败', 'error');
    showToast(message, true);
    return false;
  }
}

async function handleImageFile(file) {
  if (!file) return false;
  if (imageInputLocked()) {
    showToast('请等待当前任务完成后再识别图片');
    return false;
  }
  const filename = file.name || '剪贴板图片';
  resetDropZoneDrag();
  if (!file.type || !file.type.startsWith('image/')) {
    setDropZoneState('error', filename);
    showToast('请选择 PNG、JPG、WebP 或 BMP 图片', true);
    return false;
  }
  if (file.size > 12 * 1024 * 1024) {
    setDropZoneState('error', filename);
    showToast('图片不能超过 12 MB', true);
    return false;
  }
  recognitionBusy = true;
  setDropZoneState('busy', filename);
  updateInteractionLocks();
  try {
    const dataUrl = await readFileAsDataUrl(file);
    currentImageDataUrl = dataUrl;
    const image = document.getElementById('originalImage');
    const placeholder = document.getElementById('originalPlaceholder');
    const badge = document.getElementById('imageSizeBadge');
    if (image) {
      image.onload = () => {
        if (badge) badge.textContent = `${image.naturalWidth} × ${image.naturalHeight} px`;
      };
      image.src = dataUrl;
      image.classList.remove('hidden');
    }
    if (placeholder) placeholder.classList.add('hidden');
    const success = await recognizeDataUrl(dataUrl, file.type);
    setDropZoneState(success ? 'success' : 'error', filename);
    return success;
  } catch (error) {
    setRecognitionStatus('读取失败', 'error');
    setDropZoneState('error', filename);
    showToast(error.message || '读取图片失败', true);
    return false;
  } finally {
    recognitionBusy = false;
    updateInteractionLocks();
  }
}

async function copyLatex() {
  const value = (document.getElementById('latexSource') || {}).value || currentLatex;
  if (!value.trim()) {
    showToast('当前没有可复制的 LaTeX', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch (_) {
    const helper = document.createElement('textarea');
    helper.value = value;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  showToast('LaTeX 已复制到剪贴板');
}

// TeX → MathML（KaTeX mathml 输出），供 Word / MathType 等消费
function latexToMathML(value) {
  if (typeof katex === 'undefined') return '';
  try {
    const html = katex.renderToString(cleanLatex(value), {
      displayMode: true,
      throwOnError: false,
      output: 'mathml',
    });
    const match = html.match(/<math[\s\S]*?<\/math>/);
    return match ? match[0] : '';
  } catch (_) {
    return '';
  }
}

async function copyMathML() {
  const value = (document.getElementById('latexSource') || {}).value || currentLatex;
  if (!value.trim()) {
    showToast('请先识别一张公式图片', true);
    return;
  }
  const mathml = latexToMathML(value);
  if (!mathml) {
    showToast('MathML 生成失败', true);
    return;
  }
  try {
    await navigator.clipboard.writeText(mathml);
  } catch (_) {
    const helper = document.createElement('textarea');
    helper.value = mathml;
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    helper.remove();
  }
  showToast('MathML 已复制到剪贴板');
}

function saveHistory() {
  const value = (document.getElementById('latexSource') || {}).value || currentLatex;
  if (!value.trim()) {
    showToast('请先识别一张公式图片', true);
    return;
  }
  const entries = JSON.parse(localStorage.getItem('axiom.history') || '[]');
  entries.unshift({ latex: value, createdAt: new Date().toISOString() });
  localStorage.setItem('axiom.history', JSON.stringify(entries.slice(0, 20)));
  showToast('已保存到本地历史记录');
}

function createModelRemoveButton(label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'remove-weight-btn flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors shrink-0';
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
      <g class="del-lid">
        <path d="M3 6h18"/>
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      </g>
      <path class="del-box" d="M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8"/>
      <line class="del-line" x1="10" y1="11" x2="10" y2="17"/>
      <line class="del-line" x1="14" y1="11" x2="14" y2="17"/>
    </svg>`;
  return button;
}

// --- 动态模型列表：数据来自后端 list_models，未就绪的模型显示下载按钮 ----
async function renderModels() {
  const host = document.getElementById('modelList');
  const badge = document.getElementById('modelBadge');
  if (!host) return;
  host.innerHTML = '';
  let models;
  try {
    models = await localInvoke('list_models');
  } catch (error) {
    host.innerHTML = '<div class="px-5 py-6 flex items-center justify-center text-[13px] text-on-surface-variant">模型列表加载失败</div>';
    return;
  }
  if (!Array.isArray(models) || models.length === 0) {
    host.innerHTML = '<div class="px-5 py-6 flex items-center justify-center text-[13px] text-on-surface-variant">暂无可用模型</div>';
    return;
  }

  const stored = localStorage.getItem('axiom.model');
  const saved = stored === 'custom-ai' ? 'custom-ai:legacy' : stored;
  if (!saved || !models.some((m) => m.id === saved && (!isCustomAiModelId(m.id) || m.ready))) {
    selectedModel = models[0] ? models[0].id : 'texteller';
    localStorage.setItem('axiom.model', selectedModel);
  } else {
    selectedModel = saved;
    if (stored !== saved) localStorage.setItem('axiom.model', saved);
  }

  models.forEach((m) => {
    const row = document.createElement('div');
    row.className = 'model-row flex items-center justify-between gap-4 w-full px-5 py-4 text-left transition-colors hover:bg-surface-container/50';
    row.dataset.model = m.id;
    row.dataset.label = m.label;
    row.setAttribute('role', 'radio');
    row.tabIndex = m.ready ? 0 : -1;
    row.setAttribute('aria-checked', m.id === selectedModel ? 'true' : 'false');
    if (m.id === selectedModel) row.classList.add('active');

    const left = document.createElement('span');
    left.className = 'flex items-center gap-3';
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined text-[22px] ' + (m.ready ? 'text-primary/70' : 'text-on-surface-variant');
    icon.textContent = m.icon || 'smart_toy';
    const labels = document.createElement('span');
    labels.className = 'flex flex-col gap-1';
    const label = document.createElement('span');
    label.className = 'font-medium text-[14px] text-on-surface';
    label.textContent = m.label;
    const description = document.createElement('span');
    description.className = 'text-[12px] text-on-surface-variant';
    description.textContent = m.description;
    labels.append(label, description);
    left.append(icon, labels);
    row.appendChild(left);

    if (m.ready) {
      const select = () => {
        if (recognitionBusy || customAiBusy || customAiLoading || customAiNamingOpen || customAiRemovalOpen) return;
        selectedModel = m.id;
        localStorage.setItem('axiom.model', selectedModel);
        activateModel(row);
      };
      row.classList.add('cursor-pointer');
      row.addEventListener('click', select);
      row.addEventListener('keydown', (event) => {
        if (event.target !== row) return;
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(); }
      });
    }
    if (isCustomAiModelId(m.id)) {
      const right = document.createElement('span');
      right.className = 'flex items-center gap-1 ml-auto shrink-0';
      const configure = document.createElement('button');
      configure.type = 'button';
      configure.className = 'text-[12px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full shrink-0';
      configure.textContent = '配置';
      configure.addEventListener('click', (event) => {
        event.stopPropagation();
        focusCustomAiConfig(customAiProfileIdFromModel(m.id));
      });
      right.appendChild(configure);
      const remove = createModelRemoveButton('删除配置');
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        openCustomAiRemoveDialog(customAiProfileIdFromModel(m.id), m.label);
      });
      right.appendChild(remove);
      row.appendChild(right);
    } else
    if (m.ready) {
      const right = document.createElement('span');
      right.className = 'flex items-center gap-1 ml-auto shrink-0';
      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'open-folder-btn flex items-center justify-center w-8 h-8 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors shrink-0';
      openBtn.title = '打开权重文件夹';
      openBtn.setAttribute('aria-label', '打开权重文件夹');
      openBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>
          <path class="fd-minus" d="M9 13h6"/>
        </svg>`;
      openBtn.addEventListener('click', async (event) => {
        event.stopPropagation();
        try {
          const opened = await localInvoke('open_model_dir');
          showToast('已打开：' + opened, false);
        } catch (error) {
          showToast('打开失败：' + ((error && error.message) || String(error)), true);
        }
      });
      right.appendChild(openBtn);

      const remove = createModelRemoveButton('删除权重');
      remove.addEventListener('click', async (event) => {
        event.stopPropagation();
        if (!window.confirm('确定删除本地模型权重？删除后需要重新下载。')) return;
        remove.disabled = true;
        remove.textContent = '删除中…';
        try {
          await localInvoke('delete_model', { id: m.id });
          showToast('模型权重已删除', false);
        } catch (error) {
          showToast('删除失败：' + ((error && error.message) || String(error)), true);
        }
        renderModels();
      });
      right.appendChild(remove);
      row.appendChild(right);
    } else {
      const download = document.createElement('button');
      download.type = 'button';
      download.className = 'text-[12px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full shrink-0';
      download.textContent = '下载权重';
      const downloadAction = document.createElement('span');
      downloadAction.className = 'model-download-action shrink-0';
      downloadAction.appendChild(download);
      if (m.id === 'texteller') {
        const hint = document.createElement('span');
        hint.id = 'textellerWeightsHint';
        hint.className = 'model-weights-tooltip';
        hint.setAttribute('role', 'tooltip');
        hint.textContent = '未下载权重';
        download.setAttribute('aria-describedby', hint.id);
        row.setAttribute('aria-describedby', hint.id);
        downloadAction.appendChild(hint);
        row.tabIndex = 0;
        row.classList.add('cursor-pointer');
        let hintTimer = null;
        const hideWeightsHint = () => {
          clearTimeout(hintTimer);
          hintTimer = null;
          downloadAction.classList.remove('weights-hint-visible');
        };
        const showWeightsHint = () => {
          if (download.disabled || recognitionBusy || customAiBusy || customAiLoading || customAiNamingOpen || customAiRemovalOpen) return;
          clearTimeout(hintTimer);
          downloadAction.classList.add('weights-hint-visible');
          hintTimer = setTimeout(hideWeightsHint, 2000);
        };
        download.addEventListener('focus', showWeightsHint);
        download.addEventListener('blur', hideWeightsHint);
        const promptDownload = () => {
          if (download.disabled || recognitionBusy || customAiBusy || customAiLoading || customAiNamingOpen || customAiRemovalOpen) return;
          download.focus({ preventScroll: true });
          showWeightsHint();
        };
        row.addEventListener('click', promptDownload);
        row.addEventListener('keydown', (event) => {
          if (event.target !== row) return;
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            promptDownload();
          }
        });
      }
      download.addEventListener('click', async (event) => {
        event.stopPropagation();
        download.disabled = true;
        download.textContent = '下载中…';
        const core = (window.__TAURI__ && window.__TAURI__.core) || {};
        const Channel = core.Channel;
        const onEvent = typeof Channel === 'function'
          ? (() => {
              const channel = new Channel();
              channel.onmessage = (msg) => {
                if (!msg) return;
                // 环境准备阶段（安装 Python/依赖）的纯文字状态
                if (msg.stage) {
                  download.textContent = msg.stage;
                  return;
                }
                const total = msg.total || 0;
                const got = msg.downloaded || 0;
                if (total > 0) {
                  const pct = Math.min(100, Math.floor((got / total) * 100));
                  const speed = msg.speedBps > 0
                    ? (msg.speedBps / 1048576).toFixed(1) + ' MB/s'
                    : '';
                  download.textContent = speed
                    ? pct + '% · ' + speed
                    : pct + '%';
                }
              };
              return channel;
            })()
          : undefined;
        try {
          await localInvoke('download_model', { id: m.id, onEvent });
          showToast('模型权重下载完成', false);
        } catch (error) {
          showToast('下载失败：' + ((error && error.message) || String(error)), true);
        }
        renderModels();
      });
      row.appendChild(downloadAction);
    }
    host.appendChild(row);
  });

  if (badge) {
    const active = models.find((m) => m.id === selectedModel);
    badge.textContent = active ? active.label : '未选择';
  }
  updateInteractionLocks();
  return models;
}

// 侧栏 Logo：$f_x$ 数学符号（KaTeX 渲染，颜色继承父级 text-primary）
// KaTeX 不可用时降级为纯 HTML f 下标 x。
function initBrandSymbol() {
  const el = document.getElementById('brandSymbol');
  if (!el) return;
  if (typeof katex === 'function') {
    try {
      katex.render('f_x', el, { throwOnError: false, displayMode: false });
      return;
    } catch (_) { /* 渲染失败走降级 */ }
  }
  el.innerHTML = '<i>f</i><sub>x</sub>';
}

// 工作区导航图标：Lucide Animated "scan text"（React/motion 版移植为纯 Web Animations API）
// 悬停时扫描线逐条擦除再逐条绘出，形成扫描波；移出时逐条恢复。
function initScanTextIcon() {
  const button = document.getElementById('navWorkspace');
  if (!button) return;
  const svg = button.querySelector('.scan-text-icon');
  if (!svg) return;
  const lines = Array.from(svg.querySelectorAll('.scan-line'));
  if (!lines.length) return;

  lines.forEach((line) => {
    line.style.strokeDasharray = '1';
    line.style.strokeDashoffset = '0';
    line.style.opacity = '1';
  });

  let animations = [];
  let waveId = 0;
  const stopAnims = () => {
    animations.forEach((anim) => anim.cancel());
    animations = [];
  };

  // 每条扫描线：擦除（0→1 偏移）→ 停顿 → 绘出（1→0 偏移），每行依次延迟 50ms
  const runWave = async () => {
    const id = ++waveId;
    stopAnims();
    const wipes = lines.map((line, i) => line.animate(
      [
        { strokeDashoffset: '0', opacity: 1 },
        { strokeDashoffset: '1', opacity: 0 },
      ],
      { duration: 150, delay: i * 50, easing: 'ease-out', fill: 'both' }
    ));
    animations.push(...wipes);
    await Promise.all(wipes.map((anim) => anim.finished.catch(() => {})));
    if (id !== waveId) return;
    const draws = lines.map((line, i) => line.animate(
      [
        { strokeDashoffset: '1', opacity: 0 },
        { strokeDashoffset: '0', opacity: 1 },
      ],
      { duration: 150, delay: i * 50, easing: 'ease-out', fill: 'both' }
    ));
    animations.push(...draws);
    await Promise.all(draws.map((anim) => anim.finished.catch(() => {})));
  };

  const restoreLines = () => {
    waveId++;
    stopAnims();
    lines.forEach((line, i) => {
      const anim = line.animate(
        [
          { strokeDashoffset: '1', opacity: 0 },
          { strokeDashoffset: '0', opacity: 1 },
        ],
        { duration: 150, delay: i * 50, easing: 'ease-out', fill: 'both' }
      );
      animations.push(anim);
    });
  };

  button.addEventListener('mouseenter', runWave);
  button.addEventListener('mouseleave', restoreLines);
}

function dragContainsFiles(event) {
  const transfer = event.dataTransfer;
  if (!transfer) return false;
  return Array.from(transfer.types || []).includes('Files')
    || Array.from(transfer.items || []).some((item) => item.kind === 'file')
    || Boolean(transfer.files && transfer.files.length);
}

function initImageInputs() {
  if (imageInputsInitialized) return;
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  if (!dropZone || !fileInput) return;
  imageInputsInitialized = true;
  setDropZoneState('idle');
  resetDropZoneDrag();
  const openPicker = () => {
    if (imageInputLocked()) return;
    setDropZoneState('idle');
    fileInput.click();
  };
  dropZone.addEventListener('click', (event) => {
    if (event.target !== fileInput) openPicker();
  });
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!event.repeat) openPicker();
    }
  });
  dropZone.addEventListener('dragenter', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (imageInputLocked()) { resetDropZoneDrag(); return; }
    if (dropZoneDragDepth === 0) setDropZoneState('idle');
    dropZoneDragDepth += 1;
    dropZone.classList.add('is-dragging');
  });
  dropZone.addEventListener('dragleave', (event) => {
    if (!dragContainsFiles(event) && dropZoneDragDepth === 0) return;
    event.preventDefault();
    event.stopPropagation();
    dropZoneDragDepth = Math.max(0, dropZoneDragDepth - 1);
    if (dropZoneDragDepth === 0) dropZone.classList.remove('is-dragging');
  });
  dropZone.addEventListener('dragover', (event) => {
    if (!dragContainsFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    const locked = imageInputLocked();
    if (locked) resetDropZoneDrag();
    event.dataTransfer.dropEffect = locked ? 'none' : 'copy';
  });
  dropZone.addEventListener('drop', (event) => {
    const hasFiles = dragContainsFiles(event);
    resetDropZoneDrag();
    if (!hasFiles) return;
    event.preventDefault();
    event.stopPropagation();
    if (imageInputLocked()) return;
    handleImageFile(event.dataTransfer.files && event.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    handleImageFile(file);
  });
  // Files dropped outside the target must not navigate the WebView away from the app.
  document.addEventListener('dragover', (event) => {
    if (dragContainsFiles(event)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'none';
    }
  });
  document.addEventListener('drop', (event) => {
    if (dragContainsFiles(event)) event.preventDefault();
    resetDropZoneDrag();
  });
  document.addEventListener('dragend', resetDropZoneDrag);
  document.addEventListener('paste', (event) => {
    if (!document.getElementById('settingsView').classList.contains('hidden')) return;
    const items = Array.from((event.clipboardData && event.clipboardData.items) || []);
    const imageItem = items.find((item) => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItem) {
      event.preventDefault();
      if (!imageInputLocked()) handleImageFile(imageItem.getAsFile());
    }
  });
  updateInteractionLocks();
}

document.addEventListener('DOMContentLoaded', () => {
  const source = document.getElementById('latexSource');

  document.getElementById('navWorkspace')?.addEventListener('click', () => showView('workspace'));
  document.getElementById('navSettings')?.addEventListener('click', () => showView('settings'));

  renderModels();
  initCustomAiConfig();
  initBrandSymbol();
  initScanTextIcon();

  initImageInputs();

  if (source) source.addEventListener('input', () => {
    currentLatex = source.value;
    renderPreview(currentLatex);
    setRecognitionStatus('已编辑', 'idle');
  });
  document.getElementById('copyLatexButton')?.addEventListener('click', copyLatex);
  document.getElementById('copyPreviewButton')?.addEventListener('click', copyLatex);
  document.getElementById('copyMathMLButton')?.addEventListener('click', copyMathML);
  document.getElementById('saveHistoryButton')?.addEventListener('click', saveHistory);
  document.getElementById('tbMinimize')?.addEventListener('click', () => {
    const w = window.__TAURI__ && window.__TAURI__.window;
    if (w) w.getCurrentWindow().minimize();
  });
  document.getElementById('tbClose')?.addEventListener('click', () => {
    const w = window.__TAURI__ && window.__TAURI__.window;
    if (w) w.getCurrentWindow().close();
  });
});

// --- Software Update card ------------------------------------
function initUpdateCard() {
  const badge = document.getElementById('updateVersionBadge');
  const status = document.getElementById('updateStatus');
  const button = document.getElementById('updateButton');
  const navUpgrade = document.getElementById('navUpgrade');
  const core = (window.__TAURI__ && window.__TAURI__.core) || {};
  if (!badge || !status || !button || !window.__TAURI__) return;
  let updateMeta = null;

  (async () => {
    let current = '?';
    try {
      const app = window.__TAURI__.app;
      if (app && app.getVersion) current = await app.getVersion();
    } catch (_) {}
    badge.textContent = '当前版本 v' + current;
    status.textContent = '点击左侧升级按钮检查更新';
  })();

  window.checkUpdateFromNav = async function () {
    badge.textContent = '检查中…';
    status.textContent = '正在连接更新服务器…';
    button.classList.add('hidden');
    try {
      const meta = await core.invoke('plugin:updater|check');
      if (!meta || !meta.rid) {
        badge.textContent = '已是最新版本';
        status.textContent = '当前没有可用更新';
        return;
      }
      updateMeta = meta;
      badge.textContent = '发现 v' + meta.version;
      status.textContent = '发现新版本 v' + meta.version + '，点击右侧按钮下载并安装';
      button.classList.remove('hidden');
    } catch (error) {
      badge.textContent = '检查失败';
      status.textContent = '检查更新失败：' + ((error && error.message) || String(error));
    }
  };

  button.addEventListener('click', async () => {
    const Channel = core.Channel;
    if (typeof Channel !== 'function') {
      status.textContent = '当前运行环境不支持更新通道（需完整 Tauri 环境）';
      return;
    }
    const channel = new Channel();
    let contentLength = 0;
    let received = 0;
    channel.onmessage = (msg) => {
      if (!msg) return;
      if (msg.event === 'started' && msg.data) contentLength = msg.data.contentLength || 0;
      if (msg.event === 'progress' && msg.data) {
        received += msg.data.chunkLength || 0;
        if (contentLength > 0) {
          const pct = Math.min(99, Math.floor((received / contentLength) * 100));
          button.textContent = pct + '%';
          status.textContent = '正在下载更新… ' + pct + '%';
        } else {
          status.textContent = '正在下载更新…';
        }
      }
      if (msg.event === 'finished') {
        status.textContent = '下载完成，正在静默安装…';
        button.textContent = '安装中…';
      }
    };
    button.disabled = true;
    try {
      await core.invoke('plugin:updater|download_and_install', {
        rid: updateMeta.rid,
        onEvent: channel,
        restartAfterInstall: true,
      });
      status.textContent = '更新已安装，应用即将重启';
      button.textContent = '完成';
      button.disabled = false;
    } catch (error) {
      status.textContent = '下载/安装失败：' + ((error && error.message) || String(error));
      button.textContent = '重试';
      button.disabled = false;
    }
  });

  if (navUpgrade) {
    navUpgrade.addEventListener('click', () => {
      showView('settings');
      window.checkUpdateFromNav();
    });
  }
}

document.addEventListener('DOMContentLoaded', initUpdateCard);
