/* cover.js — draws the A4 cover. Layout numbers were measured from the original
   PDF (750 x 1083 reference) and scaled to a 794 x 1123 px A4 page (210 x 297 mm). */
(function () {
  const REF_W = 750, REF_H = 1083, PW = 794, PH = 1123;
  const SX = PW / REF_W, SY = PH / REF_H;

  const FONTS = {
    'Changa':                 { css: '"Changa", sans-serif' },
    'Cairo':                  { css: '"Cairo", sans-serif' },
    'Calibri':                { css: '"CarlitoLocal","Calibri","Carlito",sans-serif' },
    'Times New Roman':        { css: '"TinosLocal","Times New Roman","Tinos",serif' },
    'Arial':                  { css: '"ArimoLocal","Arial","Arimo",sans-serif' }
  };

  // x,y,w,h in reference px. size = reference px -> converted to pt below.
  // v = vertical align ('c' centre, 't' top). lh = line-height in px (reference).
  const F = (key, label, group, o) => Object.assign({ key, label, group, align: 'left', v: 'c', font: 'Cairo', size: 15, bold: false, italic: false, multiline: false }, o);
  const FIELDS = [
    F('asgNo',   'Assignment no. line', 'Top',        { x: 125, y: 76,  w: 500, h: 36, align: 'center', font: 'Changa', size: 19 }),
    F('heading', 'Heading',             'Top',        { x: 125, y: 122, w: 500, h: 36, align: 'center', font: 'Changa', size: 30 }),
    F('asgName', 'Assignment name (box)','Top',       { x: 84,  y: 196, w: 582, h: 80, align: 'center', font: 'Cairo', size: 22, bold: true }),
    F('courseNo','Course No.',          'Course',     { x: 125, y: 329, w: 500, h: 26, align: 'center', font: 'Calibri', size: 20, italic: true }),
    F('courseTitle','Course Title',     'Course',     { x: 75,  y: 351, w: 600, h: 26, align: 'center', font: 'Calibri', size: 20, italic: true }),
    F('lblDateA','Label: Date of Assignment','Dates', { x: 85,  y: 493, w: 257, h: 30, align: 'center', font: 'Changa', size: 19 }),
    F('lblDateS','Label: Date of Submission','Dates',{ x: 408, y: 493, w: 257, h: 30, align: 'center', font: 'Changa', size: 19 }),
    F('dateA',   'Date of Assignment',  'Dates',      { x: 95,  y: 530, w: 237, h: 58, align: 'center', font: 'Cairo', size: 17 }),
    F('dateS',   'Date of Submission',  'Dates',      { x: 418, y: 530, w: 237, h: 58, align: 'center', font: 'Cairo', size: 17 }),
    F('lblTo',   'Label: Submitted to', 'Teacher',    { x: 68,  y: 613, w: 290, h: 30, align: 'center', font: 'Changa', size: 19 }),
    F('tName',   'Teacher name',        'Teacher',    { x: 85,  y: 687, w: 262, h: 30, bold: true }),
    F('tDesig',  'Designation',         'Teacher',    { x: 85,  y: 729, w: 262, h: 30 }),
    F('tDeptOf', '"Department of"',     'Teacher',    { x: 85,  y: 759, w: 262, h: 30 }),
    F('tDept',   'Teacher department',  'Teacher',    { x: 85,  y: 789, w: 262, h: 80, v: 't', lh: 30, multiline: true }),
    F('lblBy',   'Label: Submitted by', 'Student',    { x: 391, y: 613, w: 290, h: 30, align: 'center', font: 'Changa', size: 19 }),
    F('lName', 'Label: Name',    'Student', { x: 408, y: 688, w: 80, h: 30 }),
    F('lId',   'Label: ID',      'Student', { x: 408, y: 718, w: 80, h: 30 }),
    F('lReg',  'Label: Reg.',    'Student', { x: 408, y: 748, w: 80, h: 30 }),
    F('lSet',  'Label: Set',     'Student', { x: 408, y: 778, w: 80, h: 30 }),
    F('lSes',  'Label: Session', 'Student', { x: 408, y: 808, w: 80, h: 30 }),
    F('sName', 'Student name',   'Student', { x: 489, y: 688, w: 185, h: 30, prefix: ': ' }),
    F('sId',   'Student ID',     'Student', { x: 489, y: 718, w: 185, h: 30, prefix: ': ', bold: true }),
    F('sReg',  'Reg. no.',       'Student', { x: 489, y: 748, w: 185, h: 30, prefix: ': ' }),
    F('sSet',  'Set',            'Student', { x: 489, y: 778, w: 185, h: 30, prefix: ': ' }),
    F('sSes',  'Session',        'Student', { x: 489, y: 808, w: 185, h: 30, prefix: ': ' }),
    F('footer','Footer (university)','Footer',        { x: 125, y: 920, w: 500, h: 64, align: 'center', v: 't', lh: 20, multiline: true })
  ];
  // convert defaults to final pt sizes / px boxes
  FIELDS.forEach(f => { f.defSizePt = Math.round(f.size * SX * 0.75 * 10) / 10; });

  const GROUPS = ['Top', 'Course', 'Dates', 'Teacher', 'Student', 'Footer'];
  const GROUP_TITLES = {
    Top: 'Assignment no. & name', Course: 'Course', Dates: 'Dates',
    Teacher: 'Submitted to (teacher)', Student: 'Submitted by (student)', Footer: 'Footer'
  };

  function defaultStyle(f) {
    return { font: f.font, size: f.defSizePt, bold: f.bold, italic: f.italic, align: f.align, fit: 'wrap' };
  }

  function box(cls, x, y, w, h, extra) {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = `left:${x * SX}px;top:${y * SY}px;width:${w * SX}px;height:${h * SY}px;` + (extra || '');
    return d;
  }

  /** Build a cover into `root`. state = { text:{key:str}, style:{key:{...}}, opacity:25 } */
  function render(root, state) {
    root.innerHTML = '';
    root.classList.add('cover');
    root.style.width = PW + 'px';
    root.style.height = PH + 'px';

    // logo (sits behind the text)
    const logo = document.createElement('img');
    logo.className = 'cover-logo';
    logo.src = 'assets/bau-logo.png';
    logo.alt = '';
    logo.style.cssText = `left:${148 * SX}px;top:${320 * SY}px;width:${452 * SX}px;opacity:${(state.opacity ?? 25) / 100}`;
    root.appendChild(logo);

    // frames
    root.appendChild(box('frame outer', 55, 60, 640, 962, `border-radius:${28 * SX}px`));
    root.appendChild(box('frame', 68, 190, 614, 92, `border-radius:${26 * SX}px`));
    root.appendChild(box('frame dashed', 85, 530, 257, 58, `border-radius:${30 * SX}px`));
    root.appendChild(box('frame dashed', 408, 530, 257, 58, `border-radius:${30 * SX}px`));
    root.appendChild(box('frame thin', 68, 656, 290, 225, `border-radius:${22 * SX}px`));
    root.appendChild(box('frame thin', 391, 656, 290, 225, `border-radius:${22 * SX}px`));

    FIELDS.forEach(f => {
      const st = Object.assign(defaultStyle(f), (state.style && state.style[f.key]) || {});
      const txt = (state.text && state.text[f.key]) || '';
      const d = box('field', f.x, f.y, f.w, f.h);
      d.dataset.key = f.key;
      d.style.justifyContent = st.align === 'center' ? 'center' : st.align === 'right' ? 'flex-end' : 'flex-start';
      d.style.alignItems = f.v === 't' ? 'flex-start' : 'center';
      const s = document.createElement('span');
      s.className = 'ft';
      s.textContent = (f.prefix || '') + txt;
      s.style.fontFamily = (FONTS[st.font] || { css: `"${st.font}", sans-serif` }).css;
      s.style.fontSize = (st.size * 96 / 72) + 'px';
      s.style.fontWeight = st.bold ? '700' : '400';
      s.style.fontStyle = st.italic ? 'italic' : 'normal';
      s.style.textAlign = st.align;
      if (f.lh) s.style.lineHeight = (f.lh * SY) + 'px';
      s.style.whiteSpace = st.fit === 'shrink' ? 'nowrap' : 'pre-wrap';
      s.style.maxWidth = '100%';
      s.style.wordBreak = 'break-word';
      s.dataset.fit = st.fit;
      d.appendChild(s);
      root.appendChild(d);
    });
    shrinkAll(root);
  }

  // shrink-to-fit for fields set to "one line, shrink"
  function shrinkAll(root) {
    root.querySelectorAll('.ft[data-fit="shrink"]').forEach(s => {
      const parent = s.parentElement;
      let size = parseFloat(s.style.fontSize);
      let guard = 60;
      while (s.scrollWidth > parent.clientWidth + 0.5 && size > 6 && guard--) {
        size -= 0.5; s.style.fontSize = size + 'px';
      }
    });
  }

  window.COVER = { FIELDS, GROUPS, GROUP_TITLES, FONTS, PW, PH, defaultStyle, render, shrinkAll };
})();
