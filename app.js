/* app.js — wizard logic. Data lives in data/<level>/ (students, teachers, courses [, assignments].csv + config.json) */
(function () {
  'use strict';
  const LEVEL = 'l3s2';                       // change this folder name for 4-1, 4-2 …
  const BASE = 'data/' + LEVEL + '/';
  const $ = id => document.getElementById(id);
  const C = window.COVER;
  const SET_TO_DEPT = { A: 'CSM', B: 'FPM', C: 'FSEE', D: 'IWM' };
  const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];
  const PREFIXES = ['', 'Dr.', 'Prof. Dr.', 'Prof.'];

  const D = { students: [], teachers: [], courses: [], assignments: [], config: null };
  const S = {                                   // app state
    student: null, course: null, teacher: null,
    text: {}, style: {}, opacity: 25,
    dates: { sub: '', asg: '', fmt: 'd Mon, yy', subTouched: false, asgTouched: false },
    prefix: ''
  };

  /* ---------- helpers ---------- */
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift().map(h => h.trim().toLowerCase());
    return rows.filter(r => r.some(v => v.trim())).map(r => {
      const o = {};
      head.forEach((h, i) => { if (h) o[h] = (r[i] || '').trim(); });
      return o;
    });
  }
  async function load(name, optional) {
    try {
      const r = await fetch(BASE + name, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      return await r.text();
    } catch (e) { if (optional) return null; throw e; }
  }
  const toast = (m) => { const t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2400); };
  const optEl = (v, label) => { const o = document.createElement('option'); o.value = v; o.textContent = label ?? v; return o; };
  const teacherById = id => D.teachers.find(t => t.tid === id);
  const deptName = k => (D.config.departments[k] || {}).name || k;
  const photoUrl = t => t && t.photo ? 'photos/' + t.photo.replace(/\.[^.]+$/, '') + '.webp' : '';
  const pad2 = n => String(n).padStart(2, '0');
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTH = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  function fmtDate(iso, fmt) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    switch (fmt) {
      case 'dd-mm-yyyy': return `${pad2(d)}-${pad2(m)}-${y}`;
      case 'd Month yyyy': return `${d} ${MONTH[m - 1]} ${y}`;
      case 'dd/mm/yy': return `${pad2(d)}/${pad2(m)}/${String(y).slice(2)}`;
      default: return `${d} ${MON[m - 1]}, ${String(y).slice(2)}`;
    }
  }
  function shiftDate(iso, days) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + days));
    return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
  }
  const todayISO = () => { const n = new Date(); return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`; };

  /* ---------- wizard nav ---------- */
  let step = 1;
  function go(n) {
    step = n;
    document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== 's' + n);
    document.querySelectorAll('#steps li').forEach(li => {
      const k = +li.dataset.s; li.classList.toggle('on', k === n); li.classList.toggle('done', k < n);
    });
    if (n === 3) { buildEditor(); drawLive(); }
    if (n === 4) drawFinal();
    window.scrollTo(0, 0);
  }

  /* ---------- STEP 1 ---------- */
  function initStep1() {
    const dl = $('idList');
    D.students.forEach(s => { const o = document.createElement('option'); o.value = s.id; o.label = s.name; o.textContent = s.name; dl.appendChild(o); });

    const deptKeys = Object.keys(D.config.departments).filter(k => D.courses.some(c => c.department === k));
    const dsel = $('deptSel');
    dsel.appendChild(optEl('', '— select department —'));
    deptKeys.forEach(k => dsel.appendChild(optEl(k, `${k} — ${deptName(k)}`)));

    $('idInput').addEventListener('input', onId);
    dsel.addEventListener('change', onDept);
    $('courseSel').addEventListener('change', onCourse);
    $('typeSel').addEventListener('change', onType);
    $('teacherSel').addEventListener('change', onTeacher);
    $('go1').addEventListener('click', () => { buildDefaultsFromStep1(); initStep2(); go(2); });
    try { const last = localStorage.getItem('cm_last_id'); if (last) { $('idInput').value = last; onId(); } } catch (e) {}
  }
  function onId() {
    const v = $('idInput').value.trim();
    const s = D.students.find(x => x.id === v);
    S.student = s || null;
    $('studentCard').hidden = !s;
    const msg = $('idMsg');
    if (s) {
      $('stName').textContent = s.name; $('stReg').textContent = s.reg; $('stSet').textContent = s.set;
      msg.hidden = true;
      try { localStorage.setItem('cm_last_id', s.id); } catch (e) {}
      const dsel = $('deptSel');
      if (!dsel.value && SET_TO_DEPT[s.set]) { dsel.value = SET_TO_DEPT[s.set]; if (dsel.value) onDept(); }
    } else if (v.length >= 7) { msg.textContent = 'ID not found in the list.'; msg.hidden = false; }
    else msg.hidden = true;
    validate1();
  }
  function onDept() {
    const k = $('deptSel').value;
    const cs = $('courseSel'); cs.innerHTML = '';
    cs.appendChild(optEl('', k ? '— select course —' : '— pick a department first —'));
    [...new Set(D.courses.filter(c => c.department === k).map(c => c.title))].forEach(t => cs.appendChild(optEl(t)));
    onCourse();
  }
  function onCourse() {
    const k = $('deptSel').value, t = $('courseSel').value;
    const ts = $('typeSel'); ts.innerHTML = '';
    const rows = D.courses.filter(c => c.department === k && c.title === t);
    if (!rows.length) ts.appendChild(optEl('', '—'));
    else {
      if (rows.length > 1) ts.appendChild(optEl('', '— select —'));
      rows.forEach(r => ts.appendChild(optEl(r.type)));
    }
    onType();
  }
  function onType() {
    const k = $('deptSel').value, t = $('courseSel').value, ty = $('typeSel').value;
    S.course = D.courses.find(c => c.department === k && c.title === t && c.type === ty) || null;
    $('codeOut').value = S.course ? S.course.code : '';
    fillTeachers(false);
  }
  function fillTeachers(all) {
    const ts = $('teacherSel'); ts.innerHTML = '';
    if (!S.course) { ts.appendChild(optEl('', '— choose a course first —')); S.teacher = null; showPhoto(); validate1(); $('teacherHint').textContent = ''; return; }
    const ids = all ? D.teachers.map(t => t.tid) : (S.course.teachers || '').split(/[;|]/).map(x => x.trim()).filter(Boolean);
    const list = ids.map(teacherById).filter(Boolean);
    if (!all && list.length !== 1) ts.appendChild(optEl('', '— select teacher —'));
    list.forEach(t => ts.appendChild(optEl(t.tid, `${t.name} (${t.designation})`)));
    if (!all) ts.appendChild(optEl('__all', 'Someone else… (show all teachers)'));
    $('teacherHint').textContent = all ? 'Showing every teacher.' : '';
    onTeacher();
  }
  function onTeacher() {
    const v = $('teacherSel').value;
    if (v === '__all') { fillTeachers(true); return; }
    S.teacher = teacherById(v) || null;
    showPhoto(); validate1();
  }
  function showPhoto() {
    const img = $('tPhoto'), ini = $('tInitial'), t = S.teacher;
    img.hidden = true; ini.hidden = !t;
    if (!t) return;
    ini.textContent = t.name.replace(/^(Dr\.|Md\.|Mst\.)\s*/i, '').trim().charAt(0).toUpperCase();
    const u = photoUrl(t);
    if (u) { img.onload = () => { img.hidden = false; ini.hidden = true; }; img.onerror = () => { img.hidden = true; ini.hidden = false; }; img.src = u; }
  }
  function validate1() { $('go1').disabled = !(S.student && S.course && S.teacher); }

  function buildDefaultsFromStep1() {
    const s = S.student, c = S.course, t = S.teacher, cfg = D.config;
    S.prefix = (t.designation && t.designation !== 'Lecturer') ? 'Dr.' : '';
    S.text = {
      asgNo: 'Assignment no.', heading: 'NAME OF THE ASSIGNMENT', asgName: '',
      courseNo: 'Course No.: ' + c.code, courseTitle: 'Course Title: ' + c.title,
      lblDateA: 'Date of Assignment', lblDateS: 'Date of Submission', dateA: '', dateS: '',
      lblTo: 'Submitted to', lblBy: 'Submitted by',
      tName: (S.prefix ? S.prefix + ' ' : '') + t.name, tDesig: t.designation,
      tDeptOf: 'Department of', tDept: deptName(t.department),
      lName: 'Name', lId: 'ID', lReg: 'Reg.', lSet: 'Set', lSes: 'Session',
      sName: s.name, sId: s.id, sReg: s.reg, sSet: s.set, sSes: cfg.session,
      footer: cfg.footer
    };
    S.style = {};
    S.tDeptKey = t.department;
  }

  /* ---------- STEP 2 ---------- */
  function initStep2() {
    const pickWrap = $('asgPickWrap'), pick = $('asgPick');
    const list = D.assignments.filter(a => a.code === S.course.code);
    pickWrap.hidden = !list.length;
    pick.innerHTML = ''; pick.appendChild(optEl('', '— choose —'));
    list.forEach((a, i) => pick.appendChild(optEl(i, `${a.no ? '#' + a.no + ' — ' : ''}${a.title}`)));
    pick.onchange = () => {
      const a = list[+pick.value]; if (!a) return;
      $('asgNum').value = a.no || ''; $('asgNameIn').value = a.title || '';
    };
    if (!S.dates.sub) {
      S.dates.sub = todayISO(); S.dates.asg = shiftDate(S.dates.sub, -7);
    }
    $('dateSub').value = S.dates.sub; $('dateAsg').value = S.dates.asg; $('dateFmt').value = S.dates.fmt;
  }
  function wireStep2() {
    $('dateSub').addEventListener('change', () => {
      S.dates.sub = $('dateSub').value; S.dates.subTouched = true;
      if (!S.dates.asgTouched && S.dates.sub) { S.dates.asg = shiftDate(S.dates.sub, -7); $('dateAsg').value = S.dates.asg; }
    });
    $('dateAsg').addEventListener('change', () => {
      S.dates.asg = $('dateAsg').value; S.dates.asgTouched = true;
      if (!S.dates.subTouched && S.dates.asg) { S.dates.sub = shiftDate(S.dates.asg, 7); $('dateSub').value = S.dates.sub; }
    });
    $('dateFmt').addEventListener('change', () => { S.dates.fmt = $('dateFmt').value; });
    $('back2').addEventListener('click', () => go(1));
    $('skip2').addEventListener('click', () => {
      S.text.asgNo = 'Assignment no.'; S.text.asgName = ''; S.text.dateA = ''; S.text.dateS = '';
      go(3);
    });
    $('go2').addEventListener('click', () => {
      let n = $('asgNum').value.trim();
      if (/^\d$/.test(n) && $('zeroPad').checked) n = '0' + n;
      S.text.asgNo = 'Assignment no.' + (n ? ' ' + n : '');
      S.text.asgName = $('asgNameIn').value.trim();
      S.text.dateS = fmtDate(S.dates.sub, S.dates.fmt);
      S.text.dateA = fmtDate(S.dates.asg, S.dates.fmt);
      go(3);
    });
  }

  /* ---------- STEP 3: editor ---------- */
  const customFonts = [];
  function fontOptions() { return [...Object.keys(C.FONTS), ...customFonts]; }
  function styleOf(f) { return Object.assign(C.defaultStyle(f), S.style[f.key] || {}); }
  function setStyle(key, patch) { S.style[key] = Object.assign(S.style[key] || {}, patch); drawLive(); }
  function setText(key, v) { S.text[key] = v; drawLive(); }

  function buildEditor() {
    const root = $('editor'); root.innerHTML = '';
    // special teacher controls
    C.GROUPS.forEach((g, gi) => {
      const det = document.createElement('details'); det.open = gi < 2 || g === 'Teacher';
      det.innerHTML = `<summary>${C.GROUP_TITLES[g]}</summary>`;
      const body = document.createElement('div'); body.className = 'group-body';
      if (g === 'Dates') body.appendChild(dateTools());
      if (g === 'Teacher') body.appendChild(teacherTools());
      C.FIELDS.filter(f => f.group === g).forEach(f => body.appendChild(fieldRow(f)));
      det.appendChild(body); root.appendChild(det);
    });
  }
  function dateTools() {
    const w = document.createElement('div'); w.className = 'special';
    w.innerHTML = `<label>Assignment date<input type="date" id="e_dA"></label>
                   <label>Submission date<input type="date" id="e_dS"></label>
                   <label>Format<select id="e_fmt">
                     <option value="d Mon, yy">13 Nov, 26</option><option value="dd-mm-yyyy">13-11-2026</option>
                     <option value="d Month yyyy">13 November 2026</option><option value="dd/mm/yy">13/11/26</option></select></label>`;
    const dA = w.querySelector('#e_dA'), dS = w.querySelector('#e_dS'), fm = w.querySelector('#e_fmt');
    dA.value = S.dates.asg; dS.value = S.dates.sub; fm.value = S.dates.fmt;
    const apply = () => {
      S.dates.asg = dA.value; S.dates.sub = dS.value; S.dates.fmt = fm.value;
      S.text.dateA = fmtDate(dA.value, fm.value); S.text.dateS = fmtDate(dS.value, fm.value);
      syncInputs(); drawLive();
    };
    dA.onchange = () => { S.dates.asgTouched = true; apply(); };
    dS.onchange = () => { S.dates.subTouched = true; apply(); };
    fm.onchange = apply;
    return w;
  }
  function teacherTools() {
    const w = document.createElement('div'); w.className = 'special';
    const pre = PREFIXES.map(p => `<option value="${p}">${p || '(none)'}</option>`).join('');
    const des = [...new Set([...DESIGNATIONS, S.text.tDesig])].map(d => `<option>${d}</option>`).join('');
    const dep = Object.keys(D.config.departments).map(k => `<option value="${k}">${k} — ${deptName(k)}</option>`).join('');
    w.innerHTML = `<label>Title before name<select id="e_pre">${pre}</select></label>
                   <label>Designation (e.g. promoted)<select id="e_des">${des}</select></label>
                   <label style="grid-column:1/-1">Teacher's department<select id="e_dep">${dep}</select></label>`;
    const ePre = w.querySelector('#e_pre'), eDes = w.querySelector('#e_des'), eDep = w.querySelector('#e_dep');
    ePre.value = S.prefix; eDes.value = S.text.tDesig; eDep.value = S.tDeptKey;
    ePre.onchange = () => {
      let n = S.text.tName; PREFIXES.filter(Boolean).sort((a, b) => b.length - a.length).forEach(p => { if (n.startsWith(p + ' ')) n = n.slice(p.length + 1); });
      S.prefix = ePre.value; S.text.tName = (S.prefix ? S.prefix + ' ' : '') + n; syncInputs(); drawLive();
    };
    eDes.onchange = () => { S.text.tDesig = eDes.value; syncInputs(); drawLive(); };
    eDep.onchange = () => { S.tDeptKey = eDep.value; S.text.tDept = deptName(eDep.value); syncInputs(); drawLive(); };
    return w;
  }
  function syncInputs() {
    document.querySelectorAll('[data-fk]').forEach(el => { if (document.activeElement !== el) el.value = S.text[el.dataset.fk] || ''; });
  }
  function fieldRow(f) {
    const st = styleOf(f);
    const row = document.createElement('div'); row.className = 'field-row';
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = f.label; row.appendChild(lbl);
    const inp = document.createElement(f.multiline || f.key === 'asgName' ? 'textarea' : 'input');
    if (inp.tagName === 'INPUT') inp.type = 'text';
    if (inp.tagName === 'TEXTAREA') inp.rows = f.key === 'footer' ? 3 : 2;
    inp.dataset.fk = f.key; inp.value = S.text[f.key] || '';
    inp.addEventListener('input', () => setText(f.key, inp.value));
    row.appendChild(inp);

    const bar = document.createElement('div'); bar.className = 'style-bar';
    const fsel = document.createElement('select');
    fontOptions().forEach(n => fsel.appendChild(optEl(n))); fsel.value = st.font;
    fsel.onchange = () => setStyle(f.key, { font: fsel.value });
    const size = document.createElement('input'); size.type = 'number'; size.min = 6; size.max = 60; size.step = 0.5; size.value = st.size; size.title = 'Font size (pt)';
    size.oninput = () => { const v = parseFloat(size.value); if (v > 0) setStyle(f.key, { size: v }); };
    const tg = (txt, key, title) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'tg' + (st[key] ? ' on' : ''); b.textContent = txt; b.title = title;
      b.onclick = () => { const on = !(styleOf(f)[key]); setStyle(f.key, { [key]: on }); b.classList.toggle('on', on); };
      return b;
    };
    const B = tg('B', 'bold', 'Bold'); B.style.fontWeight = '800';
    const I = tg('I', 'italic', 'Italic'); I.style.fontStyle = 'italic';
    const fit = document.createElement('select');
    fit.appendChild(optEl('wrap', 'Wrap')); fit.appendChild(optEl('shrink', 'One line, shrink')); fit.value = st.fit;
    fit.title = 'If the text is too long'; fit.onchange = () => setStyle(f.key, { fit: fit.value });
    const al = document.createElement('select');
    [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(([v, l]) => al.appendChild(optEl(v, l))); al.value = st.align;
    al.onchange = () => setStyle(f.key, { align: al.value });
    const rs = document.createElement('button'); rs.type = 'button'; rs.className = 'mini'; rs.textContent = 'Reset style';
    rs.onclick = () => { delete S.style[f.key]; buildEditorKeepOpen(); drawLive(); };
    bar.append(fsel, size, B, I, fit, al, rs);
    row.appendChild(bar);
    return row;
  }
  function buildEditorKeepOpen() {
    const open = [...document.querySelectorAll('#editor details')].map(d => d.open);
    buildEditor(); document.querySelectorAll('#editor details').forEach((d, i) => d.open = open[i]);
  }
  function wireStep3() {
    $('back3').onclick = () => go(2);
    $('go3').onclick = () => go(4);
    $('resetAll').onclick = () => { S.style = {}; buildEditorKeepOpen(); drawLive(); toast('Styles reset'); };
    $('fontFile').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const name = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]/g, '').trim() || 'Custom';
        const face = new FontFace(name, await file.arrayBuffer());
        await face.load(); document.fonts.add(face); customFonts.push(name);
        buildEditorKeepOpen(); toast('Font added: ' + name + ' — pick it in any font list');
      } catch (err) { toast('Could not read that font file'); }
      e.target.value = '';
    };
  }

  /* ---------- rendering / scaling ---------- */
  function currentState() { return { text: S.text, style: S.style, opacity: S.opacity }; }
  function fitFrame(frame) {
    const inner = frame.firstElementChild;
    const k = frame.clientWidth / C.PW;
    inner.style.transform = `scale(${k})`;
  }
  function drawInto(rootId, frameId) {
    const root = $(rootId); C.render(root, currentState());
    fitFrame($(frameId));
  }
  function drawLive() { if (step === 3) drawInto('cover3', 'frame3'); }
  function drawFinal() { drawInto('cover4', 'frame4'); }
  window.addEventListener('resize', () => { if (step === 3) fitFrame($('frame3')); if (step === 4) fitFrame($('frame4')); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (step >= 3) (step === 3 ? drawLive : drawFinal)(); });
  if (document.fonts) document.fonts.addEventListener && document.fonts.addEventListener('loadingdone', () => { if (step === 3) drawLive(); if (step === 4) drawFinal(); });

  /* ---------- STEP 4 ---------- */
  function wireStep4() {
    const op = $('opacity');
    for (let v = 5; v <= 100; v += 5) op.appendChild(optEl(v, v + '%' + (v === 25 ? ' (B/W print, recommended)' : v === 100 ? ' (colour print)' : '')));
    op.value = 25;
    op.onchange = () => { S.opacity = +op.value; drawFinal(); };
    $('back4').onclick = () => go(3);
    $('again').onclick = (e) => { e.preventDefault(); location.reload(); };
    $('dl').onclick = downloadPDF;
    $('printN').onclick = printCopies;
  }
  async function downloadPDF() {
    const btn = $('dl'); btn.disabled = true; const old = btn.textContent; btn.textContent = 'Making PDF…';
    try {
      if (!window.html2canvas || !window.jspdf) throw new Error('lib');
      if (document.fonts) await document.fonts.ready;
      const stage = document.createElement('div');
      stage.style.cssText = 'position:fixed;left:-10000px;top:0;';
      const node = document.createElement('div'); stage.appendChild(node); document.body.appendChild(stage);
      C.render(node, currentState());
      await new Promise(r => setTimeout(r, 150));
      const canvas = await html2canvas(node, { scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false });
      document.body.removeChild(stage);
      const pdf = new jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297, undefined, 'FAST');
      const name = `Assignment_${(S.course.code || 'cover').replace(/\s+/g, '')}_${S.student.id}.pdf`;
      pdf.save(name);
      toast('Downloaded ' + name);
      $('thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      toast('PDF tool could not load — opening print dialog instead (choose "Save as PDF").');
      setTimeout(() => printCopies(), 900);
    } finally { btn.disabled = false; btn.textContent = old; }
  }
  function printCopies() {
    const n = Math.max(1, Math.min(50, parseInt($('copies').value, 10) || 1));
    const area = $('printArea'); area.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const pg = document.createElement('div'); pg.className = 'pg';
      const c = document.createElement('div'); pg.appendChild(c); area.appendChild(pg);
      C.render(c, currentState());
    }
    setTimeout(() => window.print(), 100);
  }

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const [st, te, co, as, cf] = await Promise.all([
        load('students.csv'), load('teachers.csv'), load('courses.csv'), load('assignments.csv', true), load('config.json')
      ]);
      D.students = parseCSV(st); D.teachers = parseCSV(te); D.courses = parseCSV(co);
      D.assignments = as ? parseCSV(as) : []; D.config = JSON.parse(cf);
    } catch (e) {
      document.querySelector('main').innerHTML = '<div class="card narrow"><h2>Could not load the data files</h2><p>If you opened this page straight from a folder (file://), please open it from the GitHub Pages link or run a small local server — browsers block loading CSV files from file://.</p></div>';
      return;
    }
    $('levelLabel').textContent = 'Dhrubok 59 · ' + D.config.label;
    initStep1(); wireStep2(); wireStep3(); wireStep4(); go(1);
  }
  boot();
})();
