/* app.js — 3-step wizard: Course -> Details -> Download.
   Data lives in data/<level>/ (students, teachers, courses [, assignments].csv + config.json) */
(function () {
  'use strict';
  const LEVEL = 'l3s2';                       // change this folder name for 4-1, 4-2 ...
  const BASE = 'data/' + LEVEL + '/';
  const $ = id => document.getElementById(id);
  const C = window.COVER;
  const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Lecturer'];
  const PREFIXES = ['', 'Dr.', 'Prof. Dr.', 'Prof.'];

  const D = { students: [], teachers: [], courses: [], assignments: [], config: null };
  const S = {
    student: null, course: null, teacher: null,
    text: {}, style: {}, opacity: 25, prefix: '', tDeptKey: '',
    dates: { sub: '', asg: '', fmt: 'd Mon, yy', subTouched: false, asgTouched: false }
  };

  /* ---------- small helpers ---------- */
  const store = {
    get(k) { try { return localStorage.getItem('cm_' + k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem('cm_' + k, v); } catch (e) {} }
  };
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
  const toast = m => { const t = $('toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); };
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
  const courseLabel = c => (c.type === 'Practical' ? 'P. ' : c.type === 'Theory' ? 'T. ' : '') + (c.short || c.title);

  /* ---------- wizard navigation ---------- */
  let step = 1;
  function go(n) {
    step = n;
    document.querySelectorAll('.screen').forEach(s => s.hidden = s.id !== 's' + n);
    document.querySelectorAll('#steps li').forEach(li => {
      const k = +li.dataset.s; li.classList.toggle('on', k === n); li.classList.toggle('done', k < n);
    });
    if (n === 3) { buildEditor(); drawFinal(); syncOpacityUI(); }
    window.scrollTo(0, 0);
  }

  /* ---------- STEP 1: Course ---------- */
  function initStep1() {
    const idSel = $('idSel');
    idSel.appendChild(optEl('', '— select your ID —'));
    D.students.forEach(s => idSel.appendChild(optEl(s.id)));

    // one list of courses: Practical first, then Theory
    const cs = $('courseSel');
    cs.appendChild(optEl('', '— select course —'));
    const byLabel = (a, b) => courseLabel(a).slice(3).localeCompare(courseLabel(b).slice(3));
    [['Practical', 'Practical'], ['Theory', 'Theory']].forEach(([type, title]) => {
      const list = D.courses.filter(c => c.type === type).sort(byLabel);
      if (!list.length) return;
      const g = document.createElement('optgroup'); g.label = title;
      list.forEach(c => g.appendChild(optEl(c.code, courseLabel(c))));
      cs.appendChild(g);
    });
    const others = D.courses.filter(c => c.type !== 'Practical' && c.type !== 'Theory');
    if (others.length) { const g = document.createElement('optgroup'); g.label = 'Other'; others.forEach(c => g.appendChild(optEl(c.code, courseLabel(c)))); cs.appendChild(g); }

    idSel.addEventListener('change', onId);
    cs.addEventListener('change', onCourse);
    $('teacherSel').addEventListener('change', onTeacher);
    $('go1').addEventListener('click', () => { buildDefaults(); initStep2(); go(2); });

    // restore what was used last time
    const lastId = store.get('id'); if (lastId && D.students.some(s => s.id === lastId)) { idSel.value = lastId; }
    onId();
    const lastCourse = store.get('course'); if (lastCourse && D.courses.some(c => c.code === lastCourse)) { cs.value = lastCourse; }
    onCourse();
  }
  function onId() {
    const s = D.students.find(x => x.id === $('idSel').value) || null;
    S.student = s;
    const w = $('stName'); w.hidden = !s; if (s) w.textContent = s.name;
    if (s) store.set('id', s.id);
    validate1();
  }
  function onCourse() {
    S.course = D.courses.find(c => c.code === $('courseSel').value) || null;
    if (S.course) store.set('course', S.course.code);
    fillTeachers(false);
  }
  function fillTeachers(all) {
    const ts = $('teacherSel'); ts.innerHTML = '';
    if (!S.course) { ts.appendChild(optEl('', '— choose a course first —')); S.teacher = null; showPhoto(); validate1(); return; }
    const ids = all ? D.teachers.map(t => t.tid) : (S.course.teachers || '').split(/[;|]/).map(x => x.trim()).filter(Boolean);
    const list = ids.map(teacherById).filter(Boolean);
    if (list.length !== 1) ts.appendChild(optEl('', '— select teacher —'));
    list.forEach(t => ts.appendChild(optEl(t.tid, t.short || t.name)));
    if (!all) ts.appendChild(optEl('__all', 'Someone else…'));
    if (list.length === 1) ts.value = list[0].tid;
    else {
      const remembered = store.get('teacher_' + S.course.code);
      if (remembered && list.some(t => t.tid === remembered)) ts.value = remembered;
    }
    onTeacher();
  }
  function onTeacher() {
    const v = $('teacherSel').value;
    if (v === '__all') { fillTeachers(true); return; }
    S.teacher = teacherById(v) || null;
    if (S.teacher && S.course) store.set('teacher_' + S.course.code, S.teacher.tid);
    showPhoto(); validate1();
  }
  function showPhoto() {
    const img = $('tPhoto'); img.hidden = true;
    const u = photoUrl(S.teacher);
    if (!u) return;
    img.onload = () => { img.hidden = false; };
    img.onerror = () => { img.hidden = true; };
    img.src = u;
  }
  function validate1() { $('go1').disabled = !(S.student && S.course && S.teacher); }

  function buildDefaults() {
    const s = S.student, c = S.course, t = S.teacher, cfg = D.config;
    S.prefix = '';
    S.text = {
      asgNo: 'Assignment no.', heading: 'NAME OF THE ASSIGNMENT', asgName: '',
      courseNo: 'Course No.: ' + c.code, courseTitle: 'Course Title: ' + c.title,
      lblDateA: 'Date of Assignment', lblDateS: 'Date of Submission', dateA: '', dateS: '',
      lblTo: 'Submitted to', lblBy: 'Submitted by',
      tName: t.name, tDesig: t.designation, tDeptOf: 'Department of', tDept: deptName(t.department),
      lName: 'Name', lId: 'ID', lReg: 'Reg.', lSet: 'Set', lSes: 'Session',
      sName: s.name, sId: s.id, sReg: s.reg, sSet: s.set, sSes: cfg.session,
      footer: cfg.footer
    };
    S.style = {};
    S.tDeptKey = t.department;
  }

  /* ---------- STEP 2: Details ---------- */
  function initStep2() {
    const code = S.course.code;
    const list = D.assignments.filter(a => a.code === code);
    const pick = $('asgPick');
    $('asgPickWrap').hidden = !list.length;
    pick.innerHTML = ''; pick.appendChild(optEl('', '— choose —'));
    list.forEach((a, i) => pick.appendChild(optEl(i, `${a.no ? '#' + a.no + ' — ' : ''}${a.title}`)));
    pick.onchange = () => { const a = list[+pick.value]; if (a) { $('asgNum').value = a.no || ''; $('asgNameIn').value = a.title || ''; } };

    // next number for this course = last used + 1
    const last = parseInt(store.get('asg_' + code), 10);
    $('asgNum').value = Number.isFinite(last) ? String(last + 1) : '';
    $('asgNameIn').value = '';
    if (!S.dates.sub) { S.dates.sub = todayISO(); S.dates.asg = shiftDate(S.dates.sub, -7); }
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
      S.text.asgNo = 'Assignment no.'; S.text.asgName = ''; S.text.dateA = ''; S.text.dateS = ''; S.usedNo = null;
      go(3);
    });
    $('go2').addEventListener('click', () => {
      let n = $('asgNum').value.trim();
      S.usedNo = /^\d+$/.test(n) ? parseInt(n, 10) : null;
      if (/^\d$/.test(n) && $('zeroPad').checked) n = '0' + n;
      S.text.asgNo = 'Assignment no.' + (n ? ' ' + n : '');
      S.text.asgName = $('asgNameIn').value.trim();
      S.text.dateS = fmtDate(S.dates.sub, S.dates.fmt);
      S.text.dateA = fmtDate(S.dates.asg, S.dates.fmt);
      go(3);
    });
  }

  /* ---------- STEP 3: Advanced edit ---------- */
  const customFonts = [];
  const fontOptions = () => [...Object.keys(C.FONTS), ...customFonts];
  const styleOf = f => Object.assign(C.defaultStyle(f), S.style[f.key] || {});
  function setStyle(key, patch) { S.style[key] = Object.assign(S.style[key] || {}, patch); drawFinal(); }
  function setText(key, v) { S.text[key] = v; drawFinal(); }

  function buildEditor() {
    const root = $('editor'); root.innerHTML = '';
    C.GROUPS.forEach(g => {
      const det = document.createElement('details');            // every group starts closed
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
                   <label style="grid-column:1/-1">Format<select id="e_fmt">
                     <option value="d Mon, yy">13 Nov, 26</option><option value="dd-mm-yyyy">13-11-2026</option>
                     <option value="d Month yyyy">13 November 2026</option><option value="dd/mm/yy">13/11/26</option></select></label>`;
    const dA = w.querySelector('#e_dA'), dS = w.querySelector('#e_dS'), fm = w.querySelector('#e_fmt');
    dA.value = S.dates.asg; dS.value = S.dates.sub; fm.value = S.dates.fmt;
    const apply = () => {
      S.dates.asg = dA.value; S.dates.sub = dS.value; S.dates.fmt = fm.value;
      S.text.dateA = fmtDate(dA.value, fm.value); S.text.dateS = fmtDate(dS.value, fm.value);
      syncInputs(); drawFinal();
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
                   <label>Designation<select id="e_des">${des}</select></label>
                   <label style="grid-column:1/-1">Teacher's department<select id="e_dep">${dep}</select></label>`;
    const ePre = w.querySelector('#e_pre'), eDes = w.querySelector('#e_des'), eDep = w.querySelector('#e_dep');
    ePre.value = S.prefix; eDes.value = S.text.tDesig; eDep.value = S.tDeptKey;
    ePre.onchange = () => {
      let n = S.text.tName;
      PREFIXES.filter(Boolean).sort((a, b) => b.length - a.length).forEach(p => { if (n.startsWith(p + ' ')) n = n.slice(p.length + 1); });
      S.prefix = ePre.value; S.text.tName = (S.prefix ? S.prefix + ' ' : '') + n; syncInputs(); drawFinal();
    };
    eDes.onchange = () => { S.text.tDesig = eDes.value; syncInputs(); drawFinal(); };
    eDep.onchange = () => { S.tDeptKey = eDep.value; S.text.tDept = deptName(eDep.value); syncInputs(); drawFinal(); };
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
    rs.onclick = () => { delete S.style[f.key]; buildEditorKeepOpen(); drawFinal(); };
    bar.append(fsel, size, B, I, fit, al, rs);
    row.appendChild(bar);
    return row;
  }
  function buildEditorKeepOpen() {
    const open = [...document.querySelectorAll('#editor details')].map(d => d.open);
    buildEditor(); document.querySelectorAll('#editor details').forEach((d, i) => d.open = open[i]);
  }
  function wireEditor() {
    $('resetAll').onclick = () => { S.style = {}; buildEditorKeepOpen(); drawFinal(); toast('Styles reset'); };
    $('fontFile').onchange = async e => {
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

  /* ---------- rendering ---------- */
  const currentState = () => ({ text: S.text, style: S.style, opacity: S.opacity });
  function fitFrame() { const f = $('frame3'); f.firstElementChild.style.transform = `scale(${f.clientWidth / C.PW})`; }
  function drawFinal() { C.render($('cover3'), currentState()); fitFrame(); }
  window.addEventListener('resize', () => { if (step === 3) fitFrame(); });
  if (document.fonts) {
    document.fonts.ready.then(() => { if (step === 3) drawFinal(); });
    if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { if (step === 3) drawFinal(); });
  }

  /* ---------- STEP 3: opacity + download ---------- */
  function syncOpacityUI() {
    $('opacity').value = S.opacity;
    document.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', +c.dataset.op === S.opacity));
  }
  function setOpacity(v) { S.opacity = v; syncOpacityUI(); drawFinal(); }
  function wireStep3() {
    const op = $('opacity');
    for (let v = 5; v <= 100; v += 5) op.appendChild(optEl(v, v + '%'));
    op.onchange = () => setOpacity(+op.value);
    document.querySelectorAll('.chip').forEach(c => c.onclick = () => setOpacity(+c.dataset.op));
    $('back3').onclick = () => go(2);
    $('again').onclick = e => { e.preventDefault(); location.reload(); };
    $('dl').onclick = downloadPDF;
    wireEditor();
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
      if (S.usedNo != null) store.set('asg_' + S.course.code, S.usedNo);   // next time suggest +1
      toast('Downloaded ' + name);
      $('thanks').scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {
      // fallback: the browser's own print dialog ("Save as PDF")
      toast('PDF tool could not load — choose "Save as PDF" in the print window.');
      setTimeout(printOne, 900);
    } finally { btn.disabled = false; btn.textContent = old; }
  }
  function printOne() {
    const area = $('printArea'); area.innerHTML = '';
    const pg = document.createElement('div'); pg.className = 'pg';
    const c = document.createElement('div'); pg.appendChild(c); area.appendChild(pg);
    C.render(c, currentState());
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
    initStep1(); wireStep2(); wireStep3(); go(1);
  }
  boot();
})();
