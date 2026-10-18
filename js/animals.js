/* ===== GCITY Animals: 7 bạn thú đua, dựng hoàn toàn bằng khối Three.js =====
 * Quy ước: mũi hướng +X, đầu hướng +Y, bề ngang theo Z, chân chạm y=0.
 * Mỗi con có: thân/đầu/tai/mắt/đuôi chi tiết, chân là khớp (pivot) để chạy,
 * yếm số làn màu riêng + thẻ số bay trên đầu để dễ nhận ra khi đua.
 */
const Animals = (() => {
  const T = THREE, mats = {};
  const LANE_COLORS = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0xff8c1a, 0xf06292, 0x2ecc71];
  const LANE_CSS = LANE_COLORS.map(c => '#' + c.toString(16).padStart(6, '0'));
  const M = c => mats[c] || (mats[c] = new T.MeshLambertMaterial({ color: c }));

  // ---------- helper dựng hình ----------
  function mesh(par, geo, c, p, s, r){
    const o = new T.Mesh(geo, M(c));
    if(p) o.position.set(p[0], p[1], p[2]);
    if(s) o.scale.set(s[0], s[1], s[2]);
    if(r) o.rotation.set(r[0], r[1], r[2]);
    o.castShadow = true; par.add(o); return o;
  }
  const ell  = (par, r, c, p, s, rot) => mesh(par, new T.SphereGeometry(r, 16, 12), c, p, s, rot);
  const cone = (par, r, h, c, p, rot) => mesh(par, new T.ConeGeometry(r, h, 10), c, p, null, rot);
  const cyl  = (par, rt, rb, h, c, p, rot) => mesh(par, new T.CylinderGeometry(rt, rb, h, 10), c, p, null, rot);
  const box  = (par, w, h, d, c, p, rot) => mesh(par, new T.BoxGeometry(w, h, d), c, p, null, rot);
  function grp(par, p, r){ const g = new T.Group(); if(p) g.position.set(p[0], p[1], p[2]); if(r) g.rotation.set(r[0], r[1], r[2]); par.add(g); return g; }

  // chân có khớp hông: đùi + cẳng (màu khác) + bàn chân
  function leg(rig, p, len, r, c, c2, ph, k){
    const g = grp(rig, p);
    cyl(g, r, r*0.8, len*0.58, c, [0, -len*0.29, 0]);
    cyl(g, r*0.8, r*0.7, len*0.44, c2, [0, -len*0.78, 0]);
    ell(g, r*1.05, c2, [r*0.55, -len + r*0.55, 0], [1.6, 0.55, 1.1]);
    rig.userData.legs.push({ p: g, ph, k: k || 1 });
    return g;
  }
  // 4 chân chạy kiểu nước kiệu (chéo nhau)
  function quad(rig, xf, xb, zz, len, r, c, c2){
    leg(rig, [xf, len,  zz], len, r, c, c2, 0);
    leg(rig, [xf, len, -zz], len, r, c, c2, Math.PI);
    leg(rig, [xb, len,  zz], len, r, c, c2, Math.PI);
    leg(rig, [xb, len, -zz], len, r, c, c2, 0);
  }
  function eyes(par, x, y, z, r, pupil){
    [1, -1].forEach(s => {
      ell(par, r, 0xffffff, [x, y, s*z]);
      ell(par, r*0.64, pupil || 0x151515, [x + r*0.42, y, s*(z + r*0.1)]);
      ell(par, r*0.2, 0xffffff, [x + r*0.82, y + r*0.3, s*(z + r*0.1)]);
    });
  }
  // yếm số làn (màu làn) phủ lưng
  function blanket(rig, x, yTop, yMid, w, d, c){
    box(rig, w, 0.05, d, c, [x, yTop, 0]);
    [1, -1].forEach(s => box(rig, w*0.85, yTop - yMid + 0.05, 0.03, c, [x, (yTop + yMid)/2, s*(d/2 + 0.01)]));
    box(rig, 0.05, 0.012, d + 0.03, 0xffffff, [x - w*0.28, yTop + 0.03, 0]);   // sọc trắng viền yếm
  }

  function base(idx, scale){
    const g = new T.Group(), rig = grp(g);
    rig.scale.setScalar(scale);
    rig.userData.legs = [];
    g.userData = { rig, legs: rig.userData.legs, ears: [], tail: null, off: idx * 1.7 };
    return { g, rig };
  }
  function tag(i, y){
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 61, 0, 7); x.fill();
    x.fillStyle = LANE_CSS[i]; x.beginPath(); x.arc(64, 64, 51, 0, 7); x.fill();
    x.font = 'bold 74px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 9; x.strokeStyle = 'rgba(0,0,0,.5)'; x.strokeText(i + 1, 64, 70);
    x.fillStyle = '#fff'; x.fillText(i + 1, 64, 70);
    const s = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false }));
    s.scale.set(0.5, 0.5, 1); s.position.y = y; s.renderOrder = 5; return s;
  }

  // ---------- 1. NGỰA ĐỎ ----------
  function horse(i){
    const { g, rig } = base(i, 1), c = 0xb5412a, c2 = 0xc9553a, dk = 0x3a2014, mane = 0x2b160d, lc = LANE_COLORS[i];
    ell(rig, 0.5, c, [0, 1.18, 0], [1.55, 0.82, 0.6]);                 // thân
    ell(rig, 0.33, c2, [0.5, 1.22, 0], [1, 1.05, 0.95]);               // ngực nở
    ell(rig, 0.34, c, [-0.55, 1.24, 0], [1, 1.05, 0.95]);              // mông
    ell(rig, 0.3, 0xd9774f, [0.05, 0.95, 0], [1.6, 0.4, 0.9]);         // bụng sáng màu
    quad(rig, 0.5, -0.52, 0.19, 0.82, 0.085, c, dk);
    cyl(rig, 0.16, 0.27, 0.8, c, [0.9, 1.68, 0], [0, 0, -0.78]);       // cổ
    ell(rig, 0.2, c, [1.34, 1.95, 0], [1.65, 0.8, 0.72], [0, 0, -0.5]); // đầu
    ell(rig, 0.14, 0xd8a070, [1.62, 1.82, 0], [1.2, 0.85, 0.85], [0, 0, -0.5]); // mõm
    ell(rig, 0.06, 0xffffff, [1.4, 2.06, 0], [2.4, 0.3, 0.5], [0, 0, -0.5]);    // sọc trắng giữa mặt
    [1, -1].forEach(s => {
      ell(rig, 0.028, 0x2a1a12, [1.75, 1.8, s*0.05]);                   // lỗ mũi
      cone(rig, 0.055, 0.2, c, [1.2, 2.2, s*0.085], [0, 0, -0.15]);     // tai
      cone(rig, 0.03, 0.12, 0xe0a090, [1.22, 2.19, s*0.085], [0, 0, -0.15]);
    });
    eyes(rig, 1.43, 2.0, 0.145, 0.045);
    for(let k = 0; k < 7; k++){ const t = k/6;                          // bờm
      box(rig, 0.13, 0.24, 0.07, mane, [0.5 + 0.5*t, 1.6 + 0.55*t, 0], [0, 0, -0.45]); }
    box(rig, 0.1, 0.2, 0.06, mane, [1.3, 2.2, 0], [0, 0, -0.4]);       // mái
    blanket(rig, 0.02, 1.58, 1.4, 0.5, 0.5, lc);
    const tp = grp(rig, [-0.82, 1.4, 0], [0, 0, -0.5]);                 // đuôi
    cone(tp, 0.1, 0.8, mane, [0, -0.4, 0], [0, 0, Math.PI]);
    ell(tp, 0.1, mane, [0, -0.78, 0], [0.8, 1.3, 0.8]);
    g.userData.tail = { p: tp, base: -0.5, amp: 0.22, axis: 'z' };
    g.userData.gait = { freq: 15, amp: 0.8, bob: 0.07, pitch: 0.05 };
    g.add(tag(i, 2.7)); return g;
  }

  // ---------- 2. CHÓ XANH ----------
  function dog(i){
    const { g, rig } = base(i, 1.05), c = 0x4a8fe0, lt = 0xcfe5ff, dk = 0x2f66b3, lc = LANE_COLORS[i];
    ell(rig, 0.4, c, [0, 0.8, 0], [1.5, 0.8, 0.68]);
    ell(rig, 0.3, lt, [0.05, 0.62, 0], [1.4, 0.55, 0.95]);             // bụng trắng
    ell(rig, 0.22, lt, [0.5, 0.8, 0], [0.8, 1.05, 0.9]);               // ngực trắng
    ell(rig, 0.16, dk, [-0.2, 1.05, 0.12], [1.5, 0.45, 1]);            // mảng lông lưng
    quad(rig, 0.4, -0.42, 0.17, 0.56, 0.07, c, lt);
    ell(rig, 0.27, c, [0.74, 1.13, 0]);                                 // đầu
    ell(rig, 0.15, lt, [1.0, 1.04, 0], [1.4, 0.8, 0.9]);               // mõm
    ell(rig, 0.055, 0x111111, [1.15, 1.08, 0], [1, 0.8, 1.2]);         // mũi đen
    ell(rig, 0.06, 0xff7b95, [1.04, 0.93, 0], [1.6, 0.35, 0.9]);       // lưỡi thè
    box(rig, 0.005, 0.03, 0.2, 0x222222, [1.05, 0.99, 0]);
    [1, -1].forEach(s => {
      const ear = grp(rig, [0.66, 1.3, s*0.2], [s*0.5, 0, s*0.08]);       // tai cụp
      ell(ear, 0.13, dk, [0, -0.1, 0], [0.55, 1.4, 0.45]);
      g.userData.ears.push({ p: ear, base: s*0.5, axis: 'x' });
      ell(rig, 0.07, 0x7ab3ee, [0.93, 1.27, s*0.1], [1, 0.7, 0.6]);        // chân mày
    });
    eyes(rig, 0.95, 1.2, 0.115, 0.052);
    // vòng cổ màu làn + thẻ tên
    mesh(rig, new T.TorusGeometry(0.2, 0.04, 8, 18), lc, [0.55, 0.98, 0], null, [0, Math.PI/2, 0]);
    ell(rig, 0.045, 0xffd34d, [0.6, 0.78, 0]);
    const tp = grp(rig, [-0.58, 0.98, 0]), t2 = grp(tp, null, [0, 0, 0.95]);   // đuôi cong
    cyl(t2, 0.03, 0.055, 0.5, c, [0, 0.24, 0]);
    ell(t2, 0.05, lt, [0, 0.5, 0], [1, 1.4, 1]);
    g.userData.tail = { p: tp, base: 0, amp: 0.6, axis: 'y' };
    g.userData.gait = { freq: 18, amp: 0.85, bob: 0.06, pitch: 0.06 };
    g.add(tag(i, 1.95)); return g;
  }

  // ---------- 3. THỎ VÀNG ----------
  function rabbit(i){
    const { g, rig } = base(i, 1.2), c = 0xf5d442, dk = 0xe0b92a, lc = LANE_COLORS[i];
    ell(rig, 0.34, c, [0, 0.48, 0], [1.3, 0.95, 0.85]);
    ell(rig, 0.24, 0xfff3b0, [0.12, 0.38, 0], [1.2, 0.8, 0.9]);        // bụng kem
    ell(rig, 0.26, dk, [-0.25, 0.42, 0.19], [1.2, 1.1, 0.6]);          // đùi sau
    ell(rig, 0.26, dk, [-0.25, 0.42, -0.19], [1.2, 1.1, 0.6]);
    // chân sau (nhảy) + chân trước
    [1, -1].forEach(s => {
      const h = leg(rig, [-0.2, 0.26, s*0.2], 0.26, 0.07, dk, dk, 0, 1);
      ell(h, 0.09, 0xfff3b0, [0.12, -0.23, 0], [2.4, 0.4, 0.9]);
      const f = leg(rig, [0.3, 0.3, s*0.13], 0.3, 0.05, c, 0xfff3b0, 0, -0.8);
    });
    ell(rig, 0.25, c, [0.5, 0.8, 0], [1.05, 1, 0.95]);                 // đầu
    [1, -1].forEach(s => {
      ell(rig, 0.13, 0xfff8cc, [0.64, 0.72, s*0.11], [1, 0.9, 0.9]);   // má
      ell(rig, 0.06, 0xff9bb0, [0.6, 0.68, s*0.2], [0.5, 0.5, 0.2]);   // má hồng
      for(let k = 0; k < 2; k++) cyl(rig, 0.004, 0.004, 0.3, 0xffffff, [0.7, 0.74 - k*0.04, s*0.24], [Math.PI/2, 0, (k - 0.5)*s*0.3 ]); // ria
      const e = grp(rig, [0.4, 1.0, s*0.09], [s*0.12, 0, 0.22]);          // tai dài
      ell(e, 0.095, c, [0, 0.24, 0], [0.55, 2.7, 0.35]);
      ell(e, 0.06, 0xffa6b8, [0.02, 0.23, s*0.02], [0.4, 2.3, 0.2]);
      g.userData.ears.push({ p: e, base: 0.22, axis: 'z' });
    });
    ell(rig, 0.045, 0xff7d9b, [0.74, 0.8, 0], [1, 0.8, 1.2]);          // mũi hồng
    ell(rig, 0.035, 0x111111, [0.745, 0.7, 0], [0.5, 1, 0.3]);
    eyes(rig, 0.64, 0.9, 0.13, 0.055);
    ell(rig, 0.12, 0xffffff, [-0.5, 0.5, 0]);                          // đuôi bông
    ell(rig, 0.09, 0xffffff, [-0.56, 0.54, 0.05]);
    blanket(rig, 0.05, 0.78, 0.62, 0.34, 0.36, lc);
    g.userData.gait = { freq: 11, amp: 0.9, bob: 0.3, pitch: 0.22 };
    g.add(tag(i, 2.05)); return g;
  }

  // ---------- 4. RÙA TÍM ----------
  function turtle(i){
    const { g, rig } = base(i, 1.35), sh = 0x8a56d6, pl = 0xb48af0, gr = 0x8bc86b, gd = 0x6fae52, lc = LANE_COLORS[i];
    mesh(rig, new T.SphereGeometry(0.5, 26, 14, 0, Math.PI*2, 0, Math.PI/2), sh, [0, 0.27, 0], [1.2, 0.8, 0.95]); // mai
    mesh(rig, new T.CylinderGeometry(0.5, 0.5, 0.07, 26), 0xe9d9a2, [0, 0.27, 0], [1.22, 1, 0.97]);               // yếm bụng
    mesh(rig, new T.TorusGeometry(0.5, 0.03, 6, 26), 0xe9d9a2, [0, 0.29, 0], [1.2, 0.95, 1], [Math.PI/2, 0, 0]);   // viền mai
    mesh(rig, new T.CylinderGeometry(0.15, 0.17, 0.05, 6), pl, [0, 0.67, 0]);   // mảnh mai giữa
    for(let k = 0; k < 6; k++){                                                  // 6 mảnh lục giác quanh
      const a = k*Math.PI/3, al = 0.64;
      mesh(rig, new T.CylinderGeometry(0.12, 0.14, 0.05, 6), k%2 ? pl : 0xa070e6,
        [0.3*Math.cos(a)*1.2, 0.27 + 0.8*0.4, 0.3*Math.sin(a)*0.95], null, [al*Math.sin(a), 0, -al*Math.cos(a)]);
    }
    for(let k = 0; k < 6; k++){ const a = k*Math.PI/3 + Math.PI/6;               // hàng mảnh sát viền
      mesh(rig, new T.CylinderGeometry(0.08, 0.1, 0.04, 6), 0x7a47c0,
        [0.43*Math.cos(a)*1.2, 0.27 + 0.8*0.2, 0.43*Math.sin(a)*0.95], null, [1.0*Math.sin(a), 0, -1.0*Math.cos(a)]); }
    quad(rig, 0.36, -0.36, 0.3, 0.26, 0.09, gr, gd);
    cyl(rig, 0.07, 0.09, 0.3, gr, [0.6, 0.34, 0], [0, 0, -1.2]);                  // cổ
    ell(rig, 0.17, gr, [0.8, 0.4, 0], [1.3, 1, 1]);                              // đầu
    ell(rig, 0.1, 0xb5e08e, [0.92, 0.35, 0], [1.2, 0.7, 1]);
    ell(rig, 0.025, 0x2a4a22, [1.0, 0.4, 0.04]); ell(rig, 0.025, 0x2a4a22, [1.0, 0.4, -0.04]);
    box(rig, 0.005, 0.02, 0.12, 0x2a4a22, [0.99, 0.33, 0]);
    eyes(rig, 0.88, 0.47, 0.1, 0.045);
    ell(rig, 0.06, lc, [0.72, 0.5, 0.12], [1, 0.4, 0.8]);                         // nơ/đốm màu làn trên đầu
    ell(rig, 0.06, lc, [0.72, 0.5, -0.12], [1, 0.4, 0.8]);
    const tp = grp(rig, [-0.62, 0.22, 0], [0, 0, 0.25]);
    cone(tp, 0.07, 0.22, gr, [-0.1, 0, 0], [0, 0, Math.PI/2]);
    g.userData.tail = { p: tp, base: 0.25, amp: 0.3, axis: 'y' };
    g.userData.gait = { freq: 8, amp: 0.55, bob: 0.015, pitch: 0.03 };
    g.add(tag(i, 1.5)); return g;
  }

  // ---------- 5. CÁO CAM ----------
  function fox(i){
    const { g, rig } = base(i, 1.1), c = 0xe8741a, wh = 0xfff4e6, bk = 0x2a1a14, lc = LANE_COLORS[i];
    ell(rig, 0.36, c, [0, 0.78, 0], [1.6, 0.75, 0.6]);
    ell(rig, 0.24, wh, [0.08, 0.62, 0], [1.5, 0.5, 0.85]);             // bụng trắng
    ell(rig, 0.22, wh, [0.5, 0.78, 0], [0.7, 1, 0.8]);                 // ngực trắng
    quad(rig, 0.42, -0.4, 0.14, 0.62, 0.055, c, bk);                    // tất đen
    ell(rig, 0.22, c, [0.62, 1.02, 0]);                                 // đầu
    cone(rig, 0.14, 0.42, c, [0.9, 0.97, 0], [0, 0, -Math.PI/2 - 0.12]); // mõm nhọn
    cone(rig, 0.12, 0.3, wh, [0.86, 0.93, 0], [0, 0, -Math.PI/2 - 0.12]);
    ell(rig, 0.05, 0x111111, [1.1, 0.94, 0]);                           // mũi
    [1, -1].forEach(s => {
      ell(rig, 0.12, wh, [0.7, 0.93, s*0.14], [1.2, 0.8, 0.9]);        // má trắng
      cone(rig, 0.1, 0.3, c, [0.5, 1.28, s*0.13], [s*0.12, 0, 0.1]);   // tai
      cone(rig, 0.06, 0.14, bk, [0.49, 1.42, s*0.13], [s*0.12, 0, 0.1]);
      cone(rig, 0.055, 0.2, 0xffd9b8, [0.51, 1.25, s*0.115], [s*0.12, 0, 0.1]);
    });
    eyes(rig, 0.78, 1.07, 0.12, 0.048, 0x221100);
    mesh(rig, new T.TorusGeometry(0.19, 0.03, 8, 18), lc, [0.5, 0.9, 0], null, [0, Math.PI/2, 0]); // khăn màu làn
    const tp = grp(rig, [-0.55, 0.86, 0], [0, 0, -0.18]);               // đuôi xù
    ell(tp, 0.2, c, [-0.4, 0, 0], [2.3, 0.75, 0.75]);
    ell(tp, 0.14, wh, [-0.86, 0, 0], [1.2, 0.95, 0.95]);
    g.userData.tail = { p: tp, base: 0, amp: 0.4, axis: 'y' };
    g.userData.gait = { freq: 19, amp: 0.85, bob: 0.06, pitch: 0.06 };
    g.add(tag(i, 1.85)); return g;
  }

  // ---------- 6. HEO HỒNG ----------
  function pig(i){
    const { g, rig } = base(i, 1.1), c = 0xf6a6b8, dp = 0xe888a0, lp = 0xffc2d0, lc = LANE_COLORS[i];
    ell(rig, 0.45, c, [0, 0.78, 0], [1.35, 0.95, 0.72]);
    ell(rig, 0.3, lp, [0.05, 0.6, 0], [1.4, 0.5, 0.95]);               // bụng
    ell(rig, 0.17, dp, [-0.22, 1.13, 0.15], [1.4, 0.45, 1]);           // mảng đốm
    quad(rig, 0.4, -0.4, 0.2, 0.42, 0.075, c, 0x7a4a4a);                // móng guốc
    ell(rig, 0.3, c, [0.68, 0.9, 0], [1, 0.95, 0.95]);                  // đầu tròn
    cyl(rig, 0.15, 0.16, 0.16, lp, [0.95, 0.84, 0], [0, 0, Math.PI/2]); // mõm
    ell(rig, 0.155, lp, [1.03, 0.84, 0], [0.35, 1, 1]);
    [1, -1].forEach(s => {
      ell(rig, 0.028, 0x8a4a5a, [1.07, 0.84, s*0.055], [0.5, 1.5, 1]); // lỗ mũi
      const ear = grp(rig, [0.62, 1.18, s*0.17], [s*0.4, 0, -0.35]);     // tai gập
      cone(ear, 0.12, 0.22, dp, [0, 0.1, 0]);
      ell(rig, 0.07, 0xff8aa5, [0.84, 0.82, s*0.22], [0.6, 0.8, 0.4]);  // má hồng
    });
    eyes(rig, 0.9, 1.0, 0.145, 0.042);
    mesh(rig, new T.TorusGeometry(0.28, 0.035, 8, 18), lc, [0.5, 0.92, 0], null, [0, Math.PI/2, 0]); // vòng cổ màu làn
    const tp = grp(rig, [-0.62, 0.98, 0]);                              // đuôi xoắn
    mesh(tp, new T.TorusGeometry(0.07, 0.02, 8, 16, Math.PI*1.7), dp, [-0.04, 0, 0], null, [0, 0, 0.6]);
    g.userData.tail = { p: tp, base: 0, amp: 0.4, axis: 'z' };
    g.userData.gait = { freq: 15, amp: 0.7, bob: 0.05, pitch: 0.05 };
    g.add(tag(i, 1.75)); return g;
  }

  // ---------- 7. ẾCH XANH LÁ ----------
  function frog(i){
    const { g, rig } = base(i, 1.35), c = 0x45b52e, dk = 0x2f8a20, lt = 0xd6f08a, lc = LANE_COLORS[i];
    ell(rig, 0.36, c, [0, 0.42, 0], [1.2, 0.75, 0.9]);
    ell(rig, 0.28, lt, [0.05, 0.3, 0], [1.2, 0.5, 0.95]);              // bụng vàng nhạt
    ell(rig, 0.3, c, [0.36, 0.5, 0], [1, 0.75, 1.05]);                 // đầu rộng
    [[-0.1, 0.72, 0.15], [0.05, 0.7, -0.17], [-0.28, 0.62, -0.12], [-0.25, 0.64, 0.2]].forEach(p =>
      ell(rig, 0.07, dk, p, [1.2, 0.3, 1]));                            // đốm lưng
    box(rig, 0.04, 0.025, 0.46, 0x7a2a2a, [0.655, 0.44, 0]);           // miệng rộng
    [1, -1].forEach(s => {
      ell(rig, 0.12, c, [0.4, 0.74, s*0.17]);                           // mắt lồi
      ell(rig, 0.09, 0xffffff, [0.46, 0.8, s*0.18]);
      ell(rig, 0.055, 0x111111, [0.52, 0.81, s*0.19]);
      ell(rig, 0.02, 0xffffff, [0.55, 0.84, s*0.19]);
      ell(rig, 0.02, 0x1d5a14, [0.65, 0.5, s*0.06]);                    // lỗ mũi
      ell(rig, 0.065, 0xff9aa0, [0.55, 0.4, s*0.22], [0.5, 0.7, 0.3]);  // má hồng
      // chân sau: đùi + cẳng gập + bàn chân dẹt
      const h = grp(rig, [-0.28, 0.45, s*0.3]);
      ell(h, 0.2, c, [-0.12, 0, 0], [1.5, 0.8, 0.55]);
      cyl(h, 0.06, 0.08, 0.55, c, [-0.135, -0.18, 0], [0, 0, -2.4]);
      ell(h, 0.1, lt, [0.14, -0.4, 0], [2.3, 0.35, 1.3]);
      rig.userData.legs.push({ p: h, ph: 0, k: 1 });
      const f = leg(rig, [0.28, 0.3, s*0.24], 0.3, 0.05, c, lt, 0, -0.8);
    });
    ell(rig, 0.07, lc, [0.1, 0.78, 0], [1.5, 0.3, 1.4]);               // đốm màu làn trên lưng
    g.userData.gait = { freq: 9, amp: 0.9, bob: 0.42, pitch: 0.25 };
    g.add(tag(i, 1.7)); return g;
  }

  const BUILD = [horse, dog, rabbit, turtle, fox, pig, frog];

  // ---------- hoạt ảnh ----------
  function animate(g, t, run, win){
    const d = g.userData, G = d.gait, rig = d.rig, w = t*G.freq + d.off, a = run ? 1 : 0.04;
    d.legs.forEach(l => { l.p.rotation.z = Math.sin(w + l.ph)*G.amp*l.k*a; });
    rig.position.y = Math.abs(Math.sin(w*0.5))*G.bob*a;
    rig.rotation.z = Math.sin(w)*G.pitch*a;
    rig.rotation.y = 0;
    if(d.tail){ const T2 = d.tail; T2.p.rotation[T2.axis] = T2.base + Math.sin(w*1.3 + 1)*T2.amp*(0.3 + 0.7*a); }
    d.ears.forEach(e => { e.p.rotation[e.axis] = e.base + Math.sin(w*0.9 + 2)*0.18*a; });
    if(win){ rig.position.y += Math.abs(Math.sin(t*7 + d.off))*0.6; rig.rotation.y = Math.sin(t*6)*0.35; }
  }

  return { count: BUILD.length, build: i => BUILD[i](i), animate, LANE_COLORS, LANE_CSS };
})();
