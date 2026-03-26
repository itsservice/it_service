/**
 * IT Support Visual Builder — builder-core.js
 * Embed into any HTML page. Press Ctrl+Shift+B to activate.
 * Canva/Photoshop-style: every UI atom is independently draggable.
 */
(function() {
'use strict';

// ══════════════════════════════════════════════════════════════
// ATOMIC BLOCK SELECTORS — these become individual drag items
// ══════════════════════════════════════════════════════════════
const ATOM_SELECTORS = [
  // Stats
  '.stat-box', '.stat', '.es',
  // Cards
  '.jcard', '.job-card', '.ucard', '.k-card', '.crd',
  // Nav
  '.navb', '.nav-item', '.tab-btn',
  // Rows
  '.tog-row', '.log-i', '.bb', '.drow', '.br-table tr',
  // Sections
  '#gps-status-bar', '.topbar', '.tabs',
  // Accordion items
  '.acc-item',
  // Topbar buttons
  '.smb', '.tbtn',
  // Misc
  '.pill', '.rbdg', '.stat-l',
  // Any element with data-block
  '[data-block]',
];

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
const STATE = {
  active: false,
  pages: {}, // { pageName: { elements: [...], canvasW, canvasH } }
  currentPage: 'engineer',
  selectedId: null,
  isDragging: false,
  dragId: null,
  dragOx: 0, dragOy: 0,
  isResizing: false,
  resizeId: null, resizeHandle: '',
  resizeStart: null,
  scale: 1,
  offX: 0, offY: 0,
  elCounter: 1,
};

// ══════════════════════════════════════════════════════════════
// DOM PARSER — extract atomic blocks from page
// ══════════════════════════════════════════════════════════════
function parsePageAtoms(container) {
  const atoms = [];
  const seen = new Set();

  // Find all atomic elements
  ATOM_SELECTORS.forEach(sel => {
    try {
      container.querySelectorAll(sel).forEach(el => {
        if (seen.has(el)) return;
        seen.add(el);
        const rect = el.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) return;
        // Get most specific class name
        const mainClass = el.className && typeof el.className === 'string'
          ? el.className.split(' ').find(c => c.length > 2 && !['on','open','selected'].includes(c)) || 'element'
          : (el.id || 'element');
        atoms.push({
          uid: 'b' + (STATE.elCounter++),
          name: getBlockName(el),
          icon: getBlockIcon(mainClass),
          x: Math.round(rect.left - containerRect.left),
          y: Math.round(rect.top - containerRect.top),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
          html: el.outerHTML,
          originalEl: el,
          visible: true,
          locked: false,
          zIndex: parseInt(window.getComputedStyle(el).zIndex) || 1,
          opacity: 1,
          customCSS: '',
        });
      });
    } catch(e) {}
  });

  // Sort by DOM order (y position)
  atoms.sort((a, b) => a.y - b.y || a.x - b.x);
  return atoms;
}

function getBlockName(el) {
  const cls = el.className && typeof el.className === 'string' ? el.className : '';
  const id = el.id || '';
  if (cls.includes('stat-box')) return '📊 Stat Box';
  if (cls.includes('stat')) return '📊 Stat';
  if (cls.includes('jcard') || cls.includes('job-card')) return '🔧 Job Card';
  if (cls.includes('ucard')) return '👤 User Card';
  if (cls.includes('k-card')) return '🎯 Kanban Card';
  if (cls.includes('navb') || cls.includes('nav-item')) return '🔗 Nav Item';
  if (cls.includes('tab-btn')) return '📑 Tab Button';
  if (cls.includes('tog-row')) return '🔘 Toggle Row';
  if (cls.includes('log-i')) return '📋 Log Item';
  if (cls.includes('acc-item')) return '📂 Accordion';
  if (cls.includes('crd')) return '🗂 Card';
  if (id === 'gps-status-bar') return '📍 GPS Bar';
  if (cls.includes('topbar')) return '⬛ Topbar';
  if (cls.includes('tabs')) return '📑 Tabs';
  if (cls.includes('smb')) return '🔲 Button';
  if (cls.includes('bb')) return '📊 Bar Row';
  if (el.tagName === 'TR') return '📋 Table Row';
  if (el.dataset.block) return el.dataset.block;
  return el.tagName.toLowerCase() + (id ? '#'+id : '.' + (cls.split(' ')[0] || ''));
}

function getBlockIcon(cls) {
  const iconMap = {
    'stat-box':'📊','stat':'📊','jcard':'🔧','job-card':'🔧',
    'ucard':'👤','k-card':'🎯','navb':'🔗','nav-item':'🔗',
    'tab-btn':'📑','tog-row':'🔘','log-i':'📋','acc-item':'📂',
    'crd':'🗂','topbar':'⬛','tabs':'📑','smb':'🔲','bb':'📈',
    'pill':'🏷','rbdg':'🏅','es':'📊',
  };
  for (const [k,v] of Object.entries(iconMap)) {
    if (cls.includes(k)) return v;
  }
  return '🔲';
}

// ══════════════════════════════════════════════════════════════
// BUILDER UI INJECTION
// ══════════════════════════════════════════════════════════════
function injectBuilder() {
  if (document.getElementById('__builder__')) return;

  // Load JSZip for export
  if (!window.JSZip) {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(s);
  }

  const overlay = document.createElement('div');
  overlay.id = '__builder__';
  overlay.innerHTML = getBuilderHTML();
  document.body.appendChild(overlay);

  // Inject styles
  const style = document.createElement('style');
  style.id = '__builder_styles__';
  style.textContent = getBuilderCSS();
  document.head.appendChild(style);

  // Parse current page atoms
  const pageName = document.title.split('—')[0].trim() || 'Page';
  const atoms = parsePageAtoms(document.getElementById('app') || document.body);
  const area = document.getElementById('app') || document.body;
  const rect = area.getBoundingClientRect();
  STATE.pages[pageName] = {
    elements: atoms,
    canvasW: Math.round(rect.width) || 390,
    canvasH: Math.round(rect.height) || 844,
    sourceHTML: document.documentElement.outerHTML,
  };
  STATE.currentPage = pageName;

  setupBuilderEvents();
  renderBuilder();
}

// ══════════════════════════════════════════════════════════════
// BUILDER HTML TEMPLATE
// ══════════════════════════════════════════════════════════════
function getBuilderHTML() {
  return `
<div id="__bldr_shell__">
  <!-- TOPBAR -->
  <div id="__bldr_top__">
    <span class="__bl_logo__">⚡ DEV BUILDER</span>
    <div class="__bl_pages__" id="__bl_pages__"></div>
    <button class="__bl_tbtn__" onclick="__BLDR__.addPage()">+ Page</button>
    <div class="__bl_sep__"></div>
    <div class="__bl_zoom__">
      <button class="__bl_zbtn__" onclick="__BLDR__.zoom(-0.1)">−</button>
      <span id="__bl_zlbl__">100%</span>
      <button class="__bl_zbtn__" onclick="__BLDR__.zoom(+0.1)">+</button>
    </div>
    <button class="__bl_tbtn__" onclick="__BLDR__.fitCanvas()">⊡ Fit</button>
    <button class="__bl_tbtn__" onclick="__BLDR__.toggleDark()">🌙</button>
    <div class="__bl_sep__"></div>
    <button class="__bl_tbtn__ __bl_red__" onclick="__BLDR__.deleteSelected()" id="__bl_del__" style="display:none">✕</button>
    <button class="__bl_tbtn__" onclick="__BLDR__.duplicateSelected()" id="__bl_dup__" style="display:none">⎘</button>
    <button class="__bl_tbtn__" onclick="__BLDR__.bringFwd()" id="__bl_fwd__" style="display:none">↑</button>
    <button class="__bl_tbtn__" onclick="__BLDR__.sendBwd()" id="__bl_bwd__" style="display:none">↓</button>
    <button class="__bl_tbtn__" onclick="__BLDR__.reparseAtoms()">🔄 Re-parse</button>
    <div class="__bl_sep__"></div>
    <button class="__bl_tbtn__ __bl_grn__" onclick="__BLDR__.exportZip()">⬇ Export ZIP</button>
    <button class="__bl_tbtn__ __bl_close__" onclick="__BLDR__.close()">✕ Close</button>
  </div>

  <!-- MAIN -->
  <div id="__bldr_main__">
    <!-- LEFT: ATOM LIST -->
    <div id="__bldr_left__">
      <div class="__bl_phd__">🧩 Atoms (drag to canvas)</div>
      <div id="__bl_atomlist__"></div>
    </div>

    <!-- CENTER: CANVAS -->
    <div id="__bldr_canvas_area__"
      onmousedown="__BLDR__.canvasDown(event)"
      onmousemove="__BLDR__.canvasMove(event)"
      onmouseup="__BLDR__.canvasUp(event)">
      <div id="__bldr_canvas__">
        <div id="__bldr_canvas_bg__"></div>
      </div>
      <div id="__bl_selbox__"></div>
    </div>

    <!-- RIGHT: PROPS -->
    <div id="__bldr_right__">
      <div class="__bl_phd__">⚙️ Properties</div>
      <div id="__bl_props__">
        <div class="__bl_nosel__"><strong>คลิกเลือก element</strong><br>
        ลากจากรายการซ้ายลง canvas<br>หรือ Re-parse เพื่อโหลดจากหน้าปัจจุบัน<br><br>
        <span style="font-size:9px;opacity:.5">Shift+click = multi-select<br>Del = ลบ · ⌘D = copy<br>Arrow = ขยับ · Scroll = zoom</span></div>
      </div>
      <div id="__bl_layers_wrap__">
        <div class="__bl_phd__">📚 Layers</div>
        <div id="__bl_layers__"></div>
      </div>
    </div>
  </div>
</div>`;
}

// ══════════════════════════════════════════════════════════════
// CSS
// ══════════════════════════════════════════════════════════════
function getBuilderCSS() {
  return `
#__builder__{position:fixed;inset:0;z-index:999999;pointer-events:none;font-family:'Prompt','JetBrains Mono',system-ui,sans-serif;font-size:12px}
#__bldr_shell__{position:absolute;inset:0;display:grid;grid-template-rows:38px 1fr;background:#0a0a0d;color:#e8e8e8;pointer-events:all;overflow:hidden}
#__bldr_top__{display:flex;align-items:center;gap:5px;padding:0 10px;background:#070709;border-bottom:1px solid #222}
.__bl_logo__{font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;color:#4d8ef5;padding-right:8px;border-right:1px solid #222;margin-right:4px;white-space:nowrap}
.__bl_pages__{display:flex;gap:3px;flex:1;overflow-x:auto}
.__bl_page_tab__{padding:3px 10px;border-radius:4px;border:1px solid #2a2a35;background:transparent;color:#888;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s}
.__bl_page_tab__:hover{background:#1a1a1f;color:#ccc}
.__bl_page_tab__.active{background:#4d8ef5;color:#fff;border-color:#4d8ef5}
.__bl_tbtn__{height:24px;padding:0 8px;border-radius:4px;border:1px solid #2a2a35;background:transparent;color:#888;font-size:11px;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:3px;transition:all .12s}
.__bl_tbtn__:hover{background:#1a1a1f;color:#e8e8e8;border-color:#3a3a45}
.__bl_tbtn__.__bl_grn__{background:#16a34a;color:#fff;border-color:#16a34a}.__bl_tbtn__.__bl_grn__:hover{opacity:.85}
.__bl_tbtn__.__bl_red__{color:#ef4444;border-color:#ef4444}.__bl_tbtn__.__bl_red__:hover{background:rgba(239,68,68,.12)}
.__bl_tbtn__.__bl_close__{color:#888}
.__bl_sep__{width:1px;height:16px;background:#222;margin:0 2px}
.__bl_zoom__{display:flex;align-items:center;gap:2px}
.__bl_zbtn__{width:20px;height:20px;border-radius:3px;border:1px solid #2a2a35;background:transparent;color:#888;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:12px}
.__bl_zbtn__:hover{background:#1a1a1f;color:#e8e8e8}
#__bldr_main__{display:grid;grid-template-columns:200px 1fr 240px;overflow:hidden}

/* LEFT */
#__bldr_left__{background:#111115;border-right:1px solid #1e1e25;display:flex;flex-direction:column;overflow:hidden}
.__bl_phd__{padding:6px 8px;font-size:9px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:.1em;border-bottom:1px solid #1e1e25;flex-shrink:0;background:#0d0d11}
#__bl_atomlist__{padding:4px;overflow-y:auto;flex:1}
.__bl_atom__{background:#161619;border:1px solid #1e1e25;border-radius:5px;padding:6px 7px;margin-bottom:2px;cursor:grab;display:flex;align-items:center;gap:6px;transition:all .12s}
.__bl_atom__:hover{background:#1e1e25;border-color:#2e2e3a}
.__bl_atom__:active{cursor:grabbing;transform:scale(.97)}
.__bl_atom_icon__{font-size:12px;flex-shrink:0}
.__bl_atom_name__{font-size:10px;color:#bbb;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.__bl_atom_sz__{font-size:9px;color:#444;font-family:monospace;flex-shrink:0}

/* CANVAS */
#__bldr_canvas_area__{position:relative;overflow:hidden;background:repeating-linear-gradient(0deg,transparent,transparent 20px,rgba(255,255,255,.02) 20px,rgba(255,255,255,.02) 21px),repeating-linear-gradient(90deg,transparent,transparent 20px,rgba(255,255,255,.02) 20px,rgba(255,255,255,.02) 21px);background-color:#0d0d10}
#__bldr_canvas__{position:absolute;transform-origin:0 0}
#__bldr_canvas_bg__{position:absolute;pointer-events:none;z-index:0;box-shadow:0 8px 48px rgba(0,0,0,.7)}
#__bl_selbox__{position:absolute;border:1.5px dashed rgba(77,142,245,.7);background:rgba(77,142,245,.04);pointer-events:none;display:none;z-index:9997}

/* ELEMENTS ON CANVAS */
.__bl_el__{position:absolute;cursor:move;box-sizing:border-box}
.__bl_el__:hover{outline:1.5px dashed rgba(77,142,245,.5);outline-offset:1px}
.__bl_el__.sel{outline:2px solid #4d8ef5!important;outline-offset:1px}
.__bl_el_lbl__{position:absolute;top:-17px;left:0;background:#4d8ef5;color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:2px;white-space:nowrap;pointer-events:none;display:none;z-index:9999;font-family:monospace}
.__bl_el__:hover .__bl_el_lbl__,.__bl_el__.sel .__bl_el_lbl__{display:block}
.__bl_rh__{display:none;position:absolute;width:7px;height:7px;background:#4d8ef5;border:1.5px solid #fff;border-radius:2px;z-index:100}
.__bl_el__.sel .__bl_rh__{display:block}
.__bl_rh__.se{bottom:-4px;right:-4px;cursor:se-resize}
.__bl_rh__.sw{bottom:-4px;left:-4px;cursor:sw-resize}
.__bl_rh__.ne{top:-4px;right:-4px;cursor:ne-resize}
.__bl_rh__.nw{top:-4px;left:-4px;cursor:nw-resize}
.__bl_rh__.n{top:-4px;left:calc(50% - 3px);cursor:n-resize}
.__bl_rh__.s{bottom:-4px;left:calc(50% - 3px);cursor:s-resize}
.__bl_rh__.e{right:-4px;top:calc(50% - 3px);cursor:e-resize}
.__bl_rh__.w{left:-4px;top:calc(50% - 3px);cursor:w-resize}

/* RIGHT */
#__bldr_right__{background:#111115;border-left:1px solid #1e1e25;display:flex;flex-direction:column;overflow:hidden}
#__bl_props__{flex:1;overflow-y:auto;padding:6px}
.bl_psec{border-bottom:1px solid #1e1e25;margin-bottom:4px}
.bl_phd2{padding:5px 4px;font-size:9px;color:#555;cursor:pointer;display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:.08em;font-weight:700;user-select:none}
.bl_phd2:hover{color:#999}
.bl_pbody{display:none;padding-bottom:6px}
.bl_pbody.open{display:block}
.bl_prow{display:flex;align-items:center;gap:4px;margin-bottom:4px}
.bl_plbl{font-size:9px;color:#555;min-width:48px;font-family:monospace;flex-shrink:0}
.bl_pin{flex:1;background:#161619;border:1px solid #1e1e25;border-radius:3px;padding:3px 5px;color:#ccc;font-family:monospace;font-size:10px;outline:none;min-width:0}
.bl_pin:focus{border-color:#4d8ef5}
.bl_pin[type=number]{width:52px;flex:none}
.bl_pin[type=color]{height:22px;padding:1px;width:32px;flex:none;cursor:pointer}
.bl_pin[type=range]{accent-color:#4d8ef5;cursor:pointer}
.bl_textarea{width:100%;background:#0d0d10;border:1px solid #1e1e25;border-radius:3px;padding:5px;color:#ccc;font-family:monospace;font-size:9px;resize:none;outline:none;line-height:1.6}
.bl_textarea:focus{border-color:#4d8ef5}
.__bl_nosel__{padding:16px 8px;text-align:center;color:#444;font-size:10px;line-height:1.8}
.__bl_nosel__ strong{color:#666;font-size:12px;display:block;margin-bottom:6px}
#__bl_layers_wrap__{border-top:1px solid #1e1e25;flex-shrink:0}
#__bl_layers__{max-height:150px;overflow-y:auto;padding:4px}
.bl_layer{display:flex;align-items:center;gap:5px;padding:3px 6px;border-radius:4px;cursor:pointer;transition:background .1s;font-size:10px;color:#666}
.bl_layer:hover{background:#161619;color:#aaa}
.bl_layer.sel{background:rgba(77,142,245,.1);color:#ccc}
.bl_lvis{font-size:10px;width:14px;cursor:pointer;flex-shrink:0;text-align:center}
.bl_lname{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bl_llock{font-size:9px;color:#333;cursor:pointer}
.__bl_ic_code__{display:inline;background:#161619;border:1px solid #1e1e25;border-radius:2px;padding:1px 4px;font-size:9px;font-family:monospace;color:#f59e0b}
`;
}

// ══════════════════════════════════════════════════════════════
// PUBLIC API — window.__BLDR__
// ══════════════════════════════════════════════════════════════
window.__BLDR__ = {
  zoom(delta) {
    STATE.scale = Math.max(0.05, Math.min(4, STATE.scale + delta));
    applyTransform();
  },
  fitCanvas() { fitCanvas(); },
  toggleDark() {
    const bg = document.getElementById('__bldr_canvas_bg__');
    if (bg) bg.style.background = bg.style.background === 'rgb(10, 10, 10)' ? '#fff' : '#0a0a0a';
  },
  deleteSelected() { deleteSelected(); },
  duplicateSelected() { duplicateSelected(); },
  bringFwd() { modifyZ(1); },
  sendBwd() { modifyZ(-1); },
  reparseAtoms() {
    const pg = STATE.pages[STATE.currentPage];
    if (!pg) return;
    const container = document.getElementById('app') || document.body;
    const area = container.getBoundingClientRect();
    const newAtoms = parsePageAtoms(container);
    // Place them at their original positions
    newAtoms.forEach(a => {
      if (!pg.elements.find(e => e.name === a.name)) pg.elements.push(a);
    });
    renderBuilder();
    alert(`✅ Parsed ${newAtoms.length} atoms from current page`);
  },
  addPage() {
    const name = prompt('Page name:', 'New Page ' + (Object.keys(STATE.pages).length+1));
    if (!name) return;
    STATE.pages[name] = { elements:[], canvasW:390, canvasH:844, sourceHTML:'' };
    STATE.currentPage = name;
    renderBuilder();
  },
  exportZip() { exportZip(); },
  close() {
    const el = document.getElementById('__builder__');
    const st = document.getElementById('__builder_styles__');
    if (el) el.remove();
    if (st) st.remove();
    STATE.active = false;
  },
  canvasDown(e) { canvasDown(e); },
  canvasMove(e) { canvasMove(e); },
  canvasUp(e) { canvasUp(e); },
};

// ══════════════════════════════════════════════════════════════
// RENDER PIPELINE
// ══════════════════════════════════════════════════════════════
function renderBuilder() {
  renderPageTabs();
  renderAtomList();
  renderCanvas();
  renderProps();
}

function renderPageTabs() {
  const cont = document.getElementById('__bl_pages__');
  if (!cont) return;
  cont.innerHTML = Object.keys(STATE.pages).map(name =>
    `<button class="__bl_page_tab__${STATE.currentPage===name?' active':''}"
      onclick="__BLDR__._switchPage('${name}')">${name}</button>`
  ).join('');
  window.__BLDR__._switchPage = (name) => {
    STATE.currentPage = name;
    STATE.selectedId = null;
    renderBuilder();
  };
}

function renderAtomList() {
  const list = document.getElementById('__bl_atomlist__');
  if (!list) return;
  const pg = STATE.pages[STATE.currentPage];
  if (!pg || !pg.elements.length) {
    list.innerHTML = '<div style="padding:8px;font-size:10px;color:#444;text-align:center">No atoms yet.<br>Click Re-parse to scan page.</div>';
    return;
  }
  list.innerHTML = pg.elements.map(el =>
    `<div class="__bl_atom__" draggable="true"
      data-uid="${el.uid}"
      ondragstart="__BLDR__._atomDragStart(event,'${el.uid}')"
      ondragend="__BLDR__._atomDragEnd()"
      onclick="selectOnly('${el.uid}')">
      <span class="__bl_atom_icon__">${el.icon}</span>
      <span class="__bl_atom_name__">${el.name}</span>
      <span class="__bl_atom_sz__">${el.w}×${el.h}</span>
    </div>`
  ).join('');
}

function renderCanvas() {
  const cv = document.getElementById('__bldr_canvas__');
  if (!cv) return;
  cv.querySelectorAll('.__bl_el__').forEach(e => e.remove());

  const pg = STATE.pages[STATE.currentPage];
  if (!pg) return;

  // Update canvas bg size
  const bg = document.getElementById('__bldr_canvas_bg__');
  if (bg) bg.style.cssText = `position:absolute;inset:0;width:${pg.canvasW}px;height:${pg.canvasH}px;background:#fff;pointer-events:none;z-index:0`;

  const sorted = [...pg.elements].sort((a,b) => (a.zIndex||1) - (b.zIndex||1));
  sorted.forEach(el => {
    if (!el.visible) return;
    const div = document.createElement('div');
    div.className = '__bl_el__' + (STATE.selectedId===el.uid?' sel':'');
    div.id = '__dom_' + el.uid;
    div.style.cssText = `left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;z-index:${el.zIndex||1};opacity:${el.opacity||1}`;
    if (el.customCSS) div.style.cssText += ';' + el.customCSS;
    div.innerHTML = `
      <div class="__bl_el_lbl__">${el.icon} ${el.name}</div>
      ${el.html}
      ${['se','sw','ne','nw','n','s','e','w'].map(h=>`<div class="__bl_rh__ ${h}" onmousedown="event.stopPropagation();__BLDR__._rhDown(event,'${el.uid}','${h}')"></div>`).join('')}`;
    div.addEventListener('mousedown', e => elDown(e, el.uid));
    cv.appendChild(div);
  });

  renderLayers();
  updateCtrls();
}

function renderLayers() {
  const ll = document.getElementById('__bl_layers__');
  if (!ll) return;
  const pg = STATE.pages[STATE.currentPage];
  if (!pg) { ll.innerHTML=''; return; }
  const sorted = [...pg.elements].sort((a,b)=>(b.zIndex||1)-(a.zIndex||1));
  ll.innerHTML = sorted.map(el => `
    <div class="bl_layer${STATE.selectedId===el.uid?' sel':''}" onclick="selectOnly('${el.uid}')">
      <span class="bl_lvis" onclick="event.stopPropagation();toggleVis('${el.uid}')">${el.visible?'👁':'○'}</span>
      <span class="bl_lname">${el.icon} ${el.name}</span>
      <span class="bl_llock" onclick="event.stopPropagation();toggleLock('${el.uid}')">${el.locked?'🔒':'·'}</span>
    </div>`).join('') || '<div style="padding:6px;font-size:9px;color:#333;text-align:center">Empty</div>';
}

function renderProps() {
  const ps = document.getElementById('__bl_props__');
  if (!ps) return;
  const pg = STATE.pages[STATE.currentPage];
  if (!STATE.selectedId || !pg) {
    ps.innerHTML = `<div class="__bl_nosel__"><strong>คลิกเลือก element</strong><br>Re-parse เพื่อโหลด atoms จากหน้าปัจจุบัน<br><br><span style="font-size:9px;opacity:.4">Shift+click = multi<br>Del = ลบ · ⌘D = copy</span></div>`;
    return;
  }
  const el = pg.elements.find(x=>x.uid===STATE.selectedId);
  if (!el) return;

  ps.innerHTML = `
  <div class="bl_psec">
    <div class="bl_phd2" onclick="this.nextSibling.classList.toggle('open');this.querySelector('.ar').textContent=this.nextSibling.classList.contains('open')?'▾':'▸'">
      📐 Transform <span class="ar">▾</span></div>
    <div class="bl_pbody open">
      <div class="bl_prow"><span class="bl_plbl">X</span><input type="number" class="bl_pin" value="${Math.round(el.x)}" oninput="__BLDR__._sp('${el.uid}','x',+this.value)">
        <span class="bl_plbl" style="margin-left:4px">Y</span><input type="number" class="bl_pin" value="${Math.round(el.y)}" oninput="__BLDR__._sp('${el.uid}','y',+this.value)"></div>
      <div class="bl_prow"><span class="bl_plbl">W</span><input type="number" class="bl_pin" value="${Math.round(el.w)}" oninput="__BLDR__._sp('${el.uid}','w',+this.value)">
        <span class="bl_plbl" style="margin-left:4px">H</span><input type="number" class="bl_pin" value="${Math.round(el.h)}" oninput="__BLDR__._sp('${el.uid}','h',+this.value)"></div>
      <div class="bl_prow"><span class="bl_plbl">Opacity</span><input type="range" class="bl_pin" min="0" max="1" step=".05" value="${el.opacity||1}" oninput="__BLDR__._sp('${el.uid}','opacity',+this.value)">
        <span style="font-size:9px;color:#444;min-width:28px">${Math.round((el.opacity||1)*100)}%</span></div>
      <div class="bl_prow"><span class="bl_plbl">Z-Index</span><input type="number" class="bl_pin" value="${el.zIndex||1}" oninput="__BLDR__._sp('${el.uid}','zIndex',+this.value)"></div>
    </div>
  </div>
  <div class="bl_psec">
    <div class="bl_phd2" onclick="this.nextSibling.classList.toggle('open')">🎨 CSS Override <span class="ar">▸</span></div>
    <div class="bl_pbody">
      <div style="font-size:9px;color:#444;margin-bottom:4px">เพิ่ม style ตรงๆ: border-radius:8px;</div>
      <textarea class="bl_textarea" rows="3" oninput="__BLDR__._sps('${el.uid}','customCSS',this.value)" placeholder="border-radius:8px;\npadding:12px;">${escA(el.customCSS||'')}</textarea>
    </div>
  </div>
  <div class="bl_psec">
    <div class="bl_phd2" onclick="this.nextSibling.classList.toggle('open')">⚙️ HTML <span class="ar">▸</span></div>
    <div class="bl_pbody">
      <div style="font-size:9px;color:#f59e0b;margin-bottom:4px">⚠️ แก้ HTML โดยตรง</div>
      <textarea class="bl_textarea" rows="6" oninput="__BLDR__._sps('${el.uid}','html',this.value)">${escH(el.html)}</textarea>
    </div>
  </div>
  <div class="bl_psec">
    <div class="bl_phd2" onclick="this.nextSibling.classList.toggle('open')">🔍 Info <span class="ar">▸</span></div>
    <div class="bl_pbody">
      <div class="bl_prow"><span class="bl_plbl">UID</span><span class="__bl_ic_code__">${el.uid}</span></div>
      <div class="bl_prow"><span class="bl_plbl">Name</span><input type="text" class="bl_pin" value="${escA(el.name)}" oninput="__BLDR__._sps('${el.uid}','name',this.value)"></div>
    </div>
  </div>`;
}

function updateCtrls() {
  const has = !!STATE.selectedId;
  ['__bl_del__','__bl_dup__','__bl_fwd__','__bl_bwd__'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.style.display = has ? 'flex' : 'none';
  });
}

// ══════════════════════════════════════════════════════════════
// CANVAS TRANSFORM
// ══════════════════════════════════════════════════════════════
function applyTransform() {
  const cv = document.getElementById('__bldr_canvas__');
  if (cv) cv.style.transform = `translate(${STATE.offX}px,${STATE.offY}px) scale(${STATE.scale})`;
  const zlbl = document.getElementById('__bl_zlbl__');
  if (zlbl) zlbl.textContent = Math.round(STATE.scale*100)+'%';
}
function fitCanvas() {
  const area = document.getElementById('__bldr_canvas_area__');
  const pg = STATE.pages[STATE.currentPage];
  if (!area || !pg) return;
  const aW = area.clientWidth, aH = area.clientHeight;
  STATE.scale = Math.min((aW-60)/pg.canvasW, (aH-60)/pg.canvasH, 1);
  STATE.scale = Math.round(STATE.scale*10)/10;
  STATE.offX = (aW - pg.canvasW*STATE.scale)/2;
  STATE.offY = (aH - pg.canvasH*STATE.scale)/2;
  applyTransform();
}

// ══════════════════════════════════════════════════════════════
// MOUSE EVENTS
// ══════════════════════════════════════════════════════════════
let _panStart = null, _selStart = null, _resizeStart = null, _dragStart = null;

function elDown(e, uid) {
  e.stopPropagation();
  if (e.target.classList.contains('__bl_rh__')) return;
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (!el || el.locked) return;
  selectOnly(uid);
  const pos = cvPos(e);
  _dragStart = { uid, ox: pos.x - el.x, oy: pos.y - el.y };
  STATE.isDragging = true;
  document.body.style.cursor = 'grabbing';
}

window.__BLDR__._rhDown = function(e, uid, handle) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (!el) return;
  _resizeStart = { uid, handle, sx: e.clientX, sy: e.clientY, ...el };
  STATE.isResizing = true;
  document.body.style.cursor = e.target.style.cursor;
};

function canvasDown(e) {
  const area = document.getElementById('__bldr_canvas_area__');
  if (e.target.id === '__bldr_canvas_area__' || e.target.id === '__bldr_canvas__' || e.target.id === '__bldr_canvas_bg__') {
    if (e.altKey || e.button===1) {
      _panStart = { sx: e.clientX, sy: e.clientY, ox: STATE.offX, oy: STATE.offY };
    } else {
      const rect = area.getBoundingClientRect();
      _selStart = { sx: e.clientX-rect.left, sy: e.clientY-rect.top };
      selectOnly(null);
    }
  }
}
function canvasMove(e) {
  if (_panStart) {
    STATE.offX = _panStart.ox + (e.clientX - _panStart.sx);
    STATE.offY = _panStart.oy + (e.clientY - _panStart.sy);
    applyTransform(); return;
  }
  if (_resizeStart) {
    const dx = (e.clientX - _resizeStart.sx) / STATE.scale;
    const dy = (e.clientY - _resizeStart.sy) / STATE.scale;
    const pg = STATE.pages[STATE.currentPage];
    const el = pg?.elements.find(x=>x.uid===_resizeStart.uid);
    if (!el) return;
    const h = _resizeStart.handle;
    if (h.includes('e')) el.w = Math.max(20, _resizeStart.w + dx);
    if (h.includes('s')) el.h = Math.max(8, _resizeStart.h + dy);
    if (h.includes('w')) { el.x = _resizeStart.x+dx; el.w = Math.max(20, _resizeStart.w-dx); }
    if (h.includes('n')) { el.y = _resizeStart.y+dy; el.h = Math.max(8, _resizeStart.h-dy); }
    const dom = document.getElementById('__dom_'+el.uid);
    if (dom) { dom.style.left=el.x+'px'; dom.style.top=el.y+'px'; dom.style.width=el.w+'px'; dom.style.height=el.h+'px'; }
    renderProps(); return;
  }
  if (STATE.isDragging && _dragStart) {
    const pos = cvPos(e);
    const pg = STATE.pages[STATE.currentPage];
    const el = pg?.elements.find(x=>x.uid===_dragStart.uid);
    if (!el) return;
    let nx = Math.round((pos.x - _dragStart.ox)/4)*4;
    let ny = Math.round((pos.y - _dragStart.oy)/4)*4;
    el.x = nx; el.y = ny;
    const dom = document.getElementById('__dom_'+el.uid);
    if (dom) { dom.style.left=nx+'px'; dom.style.top=ny+'px'; }
    renderProps(); return;
  }
  if (_selStart) {
    const area = document.getElementById('__bldr_canvas_area__');
    const rect = area.getBoundingClientRect();
    const cx = e.clientX-rect.left, cy = e.clientY-rect.top;
    const sb = document.getElementById('__bl_selbox__');
    if (sb) { sb.style.display='block'; sb.style.left=Math.min(_selStart.sx,cx)+'px'; sb.style.top=Math.min(_selStart.sy,cy)+'px'; sb.style.width=Math.abs(cx-_selStart.sx)+'px'; sb.style.height=Math.abs(cy-_selStart.sy)+'px'; }
  }
}
function canvasUp(e) {
  if (STATE.isDragging) renderCanvas();
  if (_resizeStart) renderCanvas();
  const sb = document.getElementById('__bl_selbox__');
  if (sb) sb.style.display='none';
  STATE.isDragging = false;
  STATE.isResizing = false;
  _dragStart = null; _panStart = null; _selStart = null; _resizeStart = null;
  document.body.style.cursor = '';
}
function cvPos(e) {
  const area = document.getElementById('__bldr_canvas_area__').getBoundingClientRect();
  return { x: (e.clientX-area.left-STATE.offX)/STATE.scale, y: (e.clientY-area.top-STATE.offY)/STATE.scale };
}

// ══════════════════════════════════════════════════════════════
// SELECTION & ACTIONS
// ══════════════════════════════════════════════════════════════
window.selectOnly = function(uid) {
  STATE.selectedId = uid;
  renderCanvas(); renderProps();
};
window.toggleVis = function(uid) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (el) { el.visible=!el.visible; renderCanvas(); }
};
window.toggleLock = function(uid) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (el) el.locked=!el.locked;
};

window.__BLDR__._sp = function(uid, key, val) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (!el) return;
  el[key] = val;
  const dom = document.getElementById('__dom_'+uid);
  if (dom) { if(key==='x')dom.style.left=val+'px'; if(key==='y')dom.style.top=val+'px'; if(key==='w')dom.style.width=val+'px'; if(key==='h')dom.style.height=val+'px'; if(key==='opacity')dom.style.opacity=val; if(key==='zIndex')dom.style.zIndex=val; }
};
window.__BLDR__._sps = function(uid, key, val) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===uid);
  if (!el) return;
  el[key] = val;
  if (key==='html'||key==='customCSS') renderCanvas();
};

function deleteSelected() {
  const pg = STATE.pages[STATE.currentPage];
  if (!pg || !STATE.selectedId) return;
  pg.elements = pg.elements.filter(x=>x.uid!==STATE.selectedId);
  STATE.selectedId = null;
  renderBuilder();
}
function duplicateSelected() {
  const pg = STATE.pages[STATE.currentPage];
  if (!pg || !STATE.selectedId) return;
  const orig = pg.elements.find(x=>x.uid===STATE.selectedId);
  if (!orig) return;
  const copy = {...orig, uid:'b'+(STATE.elCounter++), x:orig.x+16, y:orig.y+16};
  pg.elements.push(copy);
  STATE.selectedId = copy.uid;
  renderBuilder();
}
function modifyZ(delta) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===STATE.selectedId);
  if (el) { el.zIndex = Math.max(1,(el.zIndex||1)+delta); renderCanvas(); }
}

// ══════════════════════════════════════════════════════════════
// DRAG FROM ATOM LIST
// ══════════════════════════════════════════════════════════════
let _atomDragUid = null;
window.__BLDR__._atomDragStart = function(e, uid) { _atomDragUid = uid; e.dataTransfer.effectAllowed='copy'; };
window.__BLDR__._atomDragEnd = function() { _atomDragUid = null; };

// ══════════════════════════════════════════════════════════════
// EXPORT ZIP
// ══════════════════════════════════════════════════════════════
async function exportZip() {
  if (!window.JSZip) { alert('JSZip loading... try again in 2s'); return; }
  const zip = new JSZip();
  Object.entries(STATE.pages).forEach(([name, pg]) => {
    const safe = name.replace(/[^a-zA-Z0-9]/g,'_').toLowerCase();
    const html = generatePageHTML(name, pg);
    zip.file(safe + '.html', html);
  });
  // Add layout JSON
  const layoutJSON = JSON.stringify(
    Object.fromEntries(Object.entries(STATE.pages).map(([k,pg]) => [k, {
      canvasW: pg.canvasW, canvasH: pg.canvasH,
      elements: pg.elements.map(el => ({uid:el.uid,name:el.name,x:el.x,y:el.y,w:el.w,h:el.h,zIndex:el.zIndex,visible:el.visible,customCSS:el.customCSS}))
    }])), null, 2);
  zip.file('layout.json', layoutJSON);
  zip.file('README.txt', `IT Support Visual Builder Export\nGenerated: ${new Date().toLocaleString('th-TH')}\n\nPages: ${Object.keys(STATE.pages).join(', ')}`);
  const blob = await zip.generateAsync({type:'blob'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'it-support-layout-' + Date.now() + '.zip';
  a.click();
  URL.revokeObjectURL(a.href);
}

function generatePageHTML(name, pg) {
  const sorted = pg.elements.filter(e=>e.visible).sort((a,b)=>(a.zIndex||1)-(b.zIndex||1));
  const body = sorted.map(el => {
    const css = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.w}px;height:${el.h}px;opacity:${el.opacity||1};z-index:${el.zIndex||1}${el.customCSS?';'+el.customCSS:''}`;
    return `  <!-- ${el.name} -->\n  <div style="${css}">${el.html}</div>`;
  }).join('\n\n');
  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name} — IT Support</title>
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#fff;--bg2:#f6f6f4;--bg3:#edede9;--fg:#0a0a0a;--fg2:#3a3a38;--fg3:#7a7a75;--fg4:#a8a8a2;--border:#e0e0db;--green:#2d7a4f;--sans:'Prompt',sans-serif}
body{width:${pg.canvasW}px;min-height:${pg.canvasH}px;background:var(--bg);font-family:var(--sans);position:relative}
</style>
</head>
<body>
<!-- Builder Export: ${name} — ${new Date().toLocaleString('th-TH')} — ${sorted.length} elements -->
${body}
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
function escA(s){return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function escH(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ══════════════════════════════════════════════════════════════
// EVENTS SETUP
// ══════════════════════════════════════════════════════════════
function setupBuilderEvents() {
  // Wheel zoom
  const area = document.getElementById('__bldr_canvas_area__');
  area.addEventListener('wheel', e => {
    e.preventDefault();
    const d = e.deltaY>0 ? -0.05 : 0.05;
    const rect = area.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    const prev = STATE.scale;
    STATE.scale = Math.max(0.05, Math.min(4, STATE.scale+d));
    STATE.offX = mx - (mx-STATE.offX)*(STATE.scale/prev);
    STATE.offY = my - (my-STATE.offY)*(STATE.scale/prev);
    applyTransform();
  }, {passive:false});

  // Drop atom onto canvas
  area.addEventListener('dragover', e => { e.preventDefault(); });
  area.addEventListener('drop', e => {
    e.preventDefault();
    if (!_atomDragUid) return;
    const pg = STATE.pages[STATE.currentPage];
    if (!pg) return;
    const orig = pg.elements.find(x=>x.uid===_atomDragUid);
    if (!orig) return;
    const pos = cvPos(e);
    const copy = {...orig, uid:'b'+(STATE.elCounter++), x:Math.round(pos.x/4)*4, y:Math.round(pos.y/4)*4};
    pg.elements.push(copy);
    STATE.selectedId = copy.uid;
    renderBuilder();
    _atomDragUid = null;
  });

  // Keyboard
  document.addEventListener('keydown', e => {
    const inInput = ['INPUT','TEXTAREA'].includes(e.target.tagName);
    if (!STATE.active) return;
    if (inInput) return;
    const step = e.shiftKey ? 10 : 1;
    if (e.key==='Delete'||e.key==='Backspace') deleteSelected();
    if (e.key==='Escape') selectOnly(null);
    if (e.key==='ArrowLeft') moveEl(-step,0);
    if (e.key==='ArrowRight') moveEl(step,0);
    if (e.key==='ArrowUp') { e.preventDefault(); moveEl(0,-step); }
    if (e.key==='ArrowDown') { e.preventDefault(); moveEl(0,step); }
    if ((e.metaKey||e.ctrlKey)&&e.key==='d') { e.preventDefault(); duplicateSelected(); }
  });

  // Global mouseup
  document.addEventListener('mouseup', () => {
    if (STATE.isDragging) { STATE.isDragging=false; _dragStart=null; renderCanvas(); }
    if (STATE.isResizing) { STATE.isResizing=false; _resizeStart=null; renderCanvas(); }
    _panStart=null; _selStart=null;
    const sb = document.getElementById('__bl_selbox__');
    if (sb) sb.style.display='none';
    document.body.style.cursor='';
  });

  // Fit on load
  setTimeout(() => { fitCanvas(); STATE.active = true; }, 100);
}

function moveEl(dx, dy) {
  const pg = STATE.pages[STATE.currentPage];
  const el = pg?.elements.find(x=>x.uid===STATE.selectedId);
  if (!el) return;
  el.x+=dx; el.y+=dy;
  renderCanvas(); renderProps();
}

// ══════════════════════════════════════════════════════════════
// ACTIVATE
// ══════════════════════════════════════════════════════════════
function activate() {
  if (STATE.active) return;
  STATE.active = true;
  injectBuilder();
}

// Trigger button (hidden)
function injectTriggerButton() {
  const btn = document.createElement('button');
  btn.id = '__bldr_trigger__';
  btn.title = 'Dev Builder (Ctrl+Shift+B)';
  btn.textContent = '⚡';
  btn.style.cssText = 'position:fixed;bottom:16px;right:16px;z-index:999998;width:36px;height:36px;border-radius:50%;background:#4d8ef5;color:#fff;border:none;cursor:pointer;font-size:16px;box-shadow:0 4px 16px rgba(77,142,245,.5);transition:all .2s;opacity:.7';
  btn.onmouseenter = () => btn.style.opacity='1';
  btn.onmouseleave = () => btn.style.opacity='.7';
  btn.onclick = activate;
  document.body.appendChild(btn);
}

// Keyboard shortcut
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='B') {
    e.preventDefault();
    if (STATE.active) window.__BLDR__.close();
    else activate();
  }
});

// Auto-inject trigger button when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectTriggerButton);
} else {
  injectTriggerButton();
}

})(); // IIFE end
