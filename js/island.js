/* ===== GCITY 3D - Đảo câu cá (v20) =====
 * Đảo nhỏ giữa biển như ảnh mẫu: bãi cát + thảm cỏ + đường đất hình chữ S, chòi lợp lá bán đồ câu, bến gỗ chữ T có thuyền,
 * dù sọc + ghế nằm, đèn lồng, dừa quanh bờ, đá ven biển, vài hòn đảo con ngoài xa.
 * Dựng hoàn toàn bằng khối Three.js; mọi thứ cố định gộp bằng Batch (ít draw call cho điện thoại).
 *
 * API: Island.build(env)            dựng vào env.group (env do three-scene.js đưa vào)
 *      Island.collides(x,z,r)       va chạm (ngoài đảo / chòi / dừa / đèn / dù / đá / bụi)
 *      Island.atDock(x,z)           đứng trên bến hoặc sát mép nước → được câu cá
 *      Island.fishDir(x,z)          góc quay mặt (rad, 0 = +z) về phía mặt nước gần nhất
 *      Island.groundY(x,z)          độ cao mặt đứng (cát 0.04, ván bến 0.3)
 *      Island.WATER_Y               mặt nước (để phao câu nằm đúng mặt nước)
 *
 * env (three-scene.js đưa vào): group, aniso, Batch, GlowBatch, blobs, makeTextPlane, addLamp, addGlow, addPool, reg (đăng ký hiệu ứng ban đêm), waterMats, anim
 */
const Island = (() => {
  const RX = 22, RZ = 14.5, WATER_Y = -0.35, TOP = 0.02;
  const PI = Math.PI, deg = a => a*PI/180;
  const PIER = { cx:3, hw:1.4, trunk:{ z0:-28, z1:-12 }, head:{ hw:5, z0:-31, z1:-26 }, y:0.3 };
  const HUT = { x:-10.8, z:-8.4, w:6.2, d:4.2 };
  const UMB = [ { x:-5.6, z:-11.4, c:0 }, { x:-2.7, z:-11.0, c:0 }, { x:12.4, z:-9.3, c:1 } ];
  const LANT = [ [-4.3,0.2], [6.6,-2.3], [-2.6,6.2] ];
  const BUSH = [ { x:-10, z:3.6, r:2.9 }, { x:11.4, z:3.5, r:2.9 } ];
  const ROCKS = [ [-20.2,1.6,0.9], [-19.6,3.4,0.6], [18.4,5.6,0.8], [-9.5,12.2,0.7], [9.5,11.6,0.6] ];
  const BOAT = { x:7.3, z:-20.6, ry:0.12 };
  const ISLETS = [ [-14,-37,3.4], [-33,-22,4.4], [33,-31,3.8], [-37,19,3.2], [39,17,4.2], [9,41,3.4], [-20,38,2.6] ];
  const hs = (a,b) => { const t = Math.sin(a*127.1 + b*311.7)*43758.5453; return t - Math.floor(t); };

  // bán kính mép cát theo hướng th (x = cos, z = sin): elip méo nhẹ → hình đảo tự nhiên; dùng chung cho mặt dựng và va chạm
  function R(th){
    const e = RX*RZ/Math.hypot(RZ*Math.cos(th), RX*Math.sin(th));
    return e*(1 + 0.055*Math.sin(3*th + 0.9) + 0.035*Math.sin(5*th + 2.1) + 0.02*Math.sin(8*th));
  }
  const Rg = th => R(th)*0.74*(1 + 0.05*Math.sin(4*th + 1));     // mép thảm cỏ (nằm trong mép cát)

  // ---------- dừa + đá: vị trí cố định ----------
  const PALMS = [];
  [-172,-160,-146,-130,-114,-62,-46,-30,-14,3,16,30,44,58,72,86,100,114,128,142,156,170].forEach((a,i)=>{
    const th = deg(a + (hs(i,1)-0.5)*5), r = R(th)*(0.87 + (hs(i,2)-0.5)*0.07);
    const x = Math.cos(th)*r, z = Math.sin(th)*r;
    if(Math.abs(x-HUT.x) < HUT.w/2+2.2 && Math.abs(z-HUT.z) < HUT.d/2+2.2) return;                 // đè chòi
    if(Math.abs(x-PIER.cx) < 3.6 && z < -9) return;                                                // chắn lối lên bến
    if(UMB.some(u=>Math.hypot(x-u.x, z-u.z) < 2.6)) return;
    PALMS.push({ x, z, h:4.3 + hs(i,3)*1.4, lean:0.7 + hs(i,4)*1.3, phi:th + (hs(i,5)-0.5)*1.4, seed:i });
  });
  const OBST = [];       // vòng tròn chắn đường
  PALMS.forEach(p => OBST.push({ x:p.x, z:p.z, r:0.55 }));
  UMB.forEach(u => OBST.push({ x:u.x, z:u.z, r:0.4 }));
  LANT.forEach(l => OBST.push({ x:l[0], z:l[1], r:0.4 }));
  BUSH.forEach(b => OBST.push({ x:b.x, z:b.z, r:b.r*0.85 }));
  ROCKS.forEach(r => OBST.push({ x:r[0], z:r[1], r:r[2]+0.2 }));

  // ---------- hình học dùng chung ----------
  const inIsland = (x,z,m) => Math.hypot(x,z) < R(Math.atan2(z,x)) - m;
  const inRect = (x,z,x0,x1,z0,z1,m) => x > x0+m && x < x1-m && z > z0+m && z < z1-m;
  function onPier(x,z,m){
    const t = PIER.trunk, h = PIER.head;
    return inRect(x,z, PIER.cx-PIER.hw, PIER.cx+PIER.hw, t.z0, t.z1, m) || inRect(x,z, PIER.cx-h.hw, PIER.cx+h.hw, h.z0, h.z1, m);
  }
  function collides(x, z, r){
    r = r || 0.8;
    if(!(inIsland(x,z,r*0.8+0.2) || onPier(x,z,r*0.6))) return true;
    if(Math.abs(x-HUT.x) < HUT.w/2 + r*0.6 && Math.abs(z-HUT.z) < HUT.d/2 + r*0.6) return true;
    for(let i=0;i<OBST.length;i++){ const o = OBST[i]; if(Math.hypot(x-o.x, z-o.z) < o.r + r*0.6) return true; }
    return false;
  }
  function atDock(x,z){
    if(onPier(x,z,-0.3)) return true;
    const th = Math.atan2(z,x); return Math.hypot(x,z) > R(th) - 3.4;
  }
  function fishDir(x,z){
    const t = PIER.trunk, h = PIER.head; let base;
    if(inRect(x,z, PIER.cx-h.hw-0.3, PIER.cx+h.hw+0.3, h.z0-0.3, h.z1, 0)) base = PI;                         // đầu chữ T: nhìn ra biển phía bắc
    else if(inRect(x,z, PIER.cx-PIER.hw-0.3, PIER.cx+PIER.hw+0.3, t.z0, t.z1, 0)) base = x < PIER.cx ? -PI/2 : PI/2;   // thân bến: nhìn sang bên gần hơn
    else base = Math.atan2(x/(RX*RX), z/(RZ*RZ));                                                              // bờ đảo: nhìn theo pháp tuyến elip
    // phao rơi cách 5.2 đơn vị phía trước: nếu rơi trúng đất / ván bến thì xoay dần sang hướng khác cho tới khi rơi xuống nước
    const ok = a => { const tx = x + Math.sin(a)*5.2, tz = z + Math.cos(a)*5.2; return !inIsland(tx,tz,-0.4) && !onPier(tx,tz,-0.5); };
    if(ok(base)) return base;
    for(let k=1;k<=8;k++) for(const sg of [1,-1]){ const a = base + sg*k*0.4; if(ok(a)) return a; }
    return base;
  }
  const groundY = (x,z) => onPier(x,z,-0.2) ? PIER.y : 0.04;

  // ---------- canvas texture ----------
  const cvs = (w,h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const hex = n => '#' + n.toString(16).padStart(6,'0');
  function speckle(base, dots, n, size, alpha){
    const c = cvs(128,128), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0,0,128,128);
    for(let i=0;i<n;i++){ g.fillStyle = dots[i%dots.length]; g.globalAlpha = alpha*(0.5+hs(i,7)*0.5); const s = size*(0.5+hs(i,8));
      g.beginPath(); g.ellipse(hs(i,9)*128, hs(i,10)*128, s, s*0.7, hs(i,11)*3, 0, 7); g.fill(); }
    return c;
  }
  const mkTex = (c, rx, ry, aniso, wrap) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy = aniso; return t; };

  // ---------- hình khối phụ ----------
  function blobShape(fn, cx, cz, k){            // Shape (x, -z) theo bán kính fn(th); extrude/rotate xem shapeMesh
    const s = new THREE.Shape(), N = 120;
    for(let i=0;i<=N;i++){ const th = i/N*PI*2, r = fn(th)*(k||1), x = cx + Math.cos(th)*r, z = cz + Math.sin(th)*r; if(i) s.lineTo(x,-z); else s.moveTo(x,-z); }
    return s;
  }
  function ribbon(curve, w0, y, mat, grp, n){      // dải đường đất phẳng bám theo đường cong
    const pts = curve.getPoints(n || 90), pos = [], idx = [];
    pts.forEach((p,i)=>{
      const a = pts[Math.max(0,i-1)], b = pts[Math.min(pts.length-1,i+1)];
      let tx = b.x-a.x, tz = b.z-a.z; const l = Math.hypot(tx,tz) || 1; tx/=l; tz/=l;
      const w = w0*(0.9 + 0.12*Math.sin(i*0.37)) / 2;
      pos.push(p.x - tz*w, y, p.z + tx*w,  p.x + tz*w, y, p.z - tx*w);
      if(i){ const k = i*2; idx.push(k-2, k, k-1,  k-1, k, k+1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; grp.add(m); return m;
  }

  // ---------- dừa: thân cong (đốt nhỏ dần) + 9 tàu lá cong rủ + dừa ----------
  const _up = new THREE.Vector3(0,1,0), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1,1,1), _e = new THREE.Euler();
  function frondGeo(L, W, droop){
    const rows = 7, pos = [];
    const pt = (s, side) => { const w = W*Math.sin(PI*Math.pow(s,0.72)), x = L*s, y = L*(0.55*s - droop*s*s) + (side===0 ? 0.07*w : -0.05*w); return [x, y, side*w/2]; };
    for(let i=0;i<rows-1;i++){
      const s0 = i/(rows-1), s1 = (i+1)/(rows-1), A = pt(s0,-1), B = pt(s0,0), C = pt(s0,1), D = pt(s1,-1), E = pt(s1,0), F = pt(s1,1);
      [[A,B,D],[B,E,D],[B,C,E],[C,F,E]].forEach(t=>{ t.forEach(v=>pos.push(...v)); t.slice().reverse().forEach(v=>pos.push(...v)); });   // 2 mặt: lá nhìn từ dưới lên vẫn thấy
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals(); return g;
  }
  const FRONDS = [0,1,2].map(k => frondGeo(2.7 + k*0.25, 0.62, 0.95 + k*0.08));
  const _nutG = new THREE.IcosahedronGeometry(0.2, 0);
  function palm(B, p){
    const dx = Math.cos(p.phi), dz = Math.sin(p.phi), N = 6, pts = [];
    for(let i=0;i<=N;i++){ const t = i/N; pts.push(new THREE.Vector3(p.x + dx*p.lean*t*t, p.h*t, p.z + dz*p.lean*t*t)); }
    for(let i=0;i<N;i++){
      const a = pts[i], b = pts[i+1], d = b.clone().sub(a), len = d.length(), rb = 0.3 - 0.14*i/N, rt = 0.3 - 0.14*(i+1)/N;
      const g = new THREE.CylinderGeometry(rt, rb, len, 6); _q.setFromUnitVectors(_up, d.normalize()); _m.compose(_p.copy(a).add(b).multiplyScalar(0.5), _q, _s);
      B.geo(g, _m, i%2 ? 0x8b6a45 : 0x7a5a38); g.dispose();
    }
    const c = pts[N];
    for(let k=0;k<9;k++){
      const ang = p.phi + k/9*PI*2 + (hs(p.seed,k)-0.5)*0.5, g = FRONDS[(k+p.seed)%3], tilt = (hs(p.seed,k+20)-0.5)*0.5;
      _e.set(0, -ang, tilt, 'YZX'); _q.setFromEuler(_e); _m.compose(_p.copy(c), _q, _s);
      B.geo(g, _m, [0x2d8a3e,0x37a04a,0x2a7d38][k%3]);
    }
    for(let k=0;k<3;k++){ _m.makeTranslation(c.x + Math.cos(k*2.1)*0.22, c.y - 0.2, c.z + Math.sin(k*2.1)*0.22); B.geo(_nutG, _m, 0x6b4423); }
  }

  // ---------- chòi câu cá (lá lợp + quầy xanh ngọc + phao cứu sinh + cá trên mái) ----------
  function hut(env, grp){
    const B = env.Batch(), G = env.GlowBatch(), wood = 0x8d5b33, woodD = 0x6b4423, teal = 0x2f7f86, cream = 0xf3e4bf;
    const box = (...a) => B.box(...a);
    box(HUT.w+0.5, 0.2, HUT.d+0.5, 0, 0.1, 0, 0x9a6b3f);                                              // sàn
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz]) => box(0.3, 2.6, 0.3, sx*HUT.w/2, 1.5, sz*HUT.d/2, woodD));   // 4 cột
    box(HUT.w-0.3, 2.4, 0.2, 0, 1.4, -HUT.d/2+0.1, wood);                                             // tường sau
    box(0.2, 2.4, HUT.d-0.3, -HUT.w/2+0.1, 1.4, 0, wood);                                             // tường trái
    box(0.2, 1.1, HUT.d-0.3, HUT.w/2-0.1, 0.75, 0, wood); box(0.2, 0.6, HUT.d-0.3, HUT.w/2-0.1, 2.3, 0, wood);   // tường phải có ô cửa sổ
    box(0.1, 0.7, 1.6, HUT.w/2-0.1, 1.65, -0.2, 0xa6dbe8); G.box(0.12, 0.7, 1.6, HUT.w/2-0.08, 1.65, -0.2, 0xffd98a); box(0.14, 0.1, 1.9, HUT.w/2-0.1, 1.28, -0.2, cream);   // kính ban ngày + lớp đèn vàng chỉ hiện ban đêm
    box(HUT.w-0.3, 1.0, 0.45, 0, 0.7, HUT.d/2-0.15, teal);                                             // quầy trước (xanh ngọc)
    box(HUT.w-0.1, 0.12, 0.6, 0, 1.24, HUT.d/2-0.15, cream);                                           // mặt quầy
    box(HUT.w-0.1, 0.35, 0.3, 0, 2.5, HUT.d/2-0.05, woodD);                                            // xà trước
    box(HUT.w-0.5, 0.1, 0.5, 0, 1.75, -HUT.d/2+0.4, woodD);                                            // kệ
    [0xe8876f,0x4fa3ab,0xf0a35e,0x8b72c8,0x6fb7b0].forEach((c,i)=> B.geo(new THREE.CylinderGeometry(0.2,0.2,0.4,8), new THREE.Matrix4().makeTranslation(-2.2+i*1.05, 2.0, -HUT.d/2+0.4), c));   // lọ trên kệ
    box(0.95, 0.5, 0.7, 1.7, 1.55, HUT.d/2-0.3, 0xe3f3ef); box(0.97, 0.12, 0.72, 1.7, 1.83, HUT.d/2-0.3, teal);   // thùng đá trên quầy
    box(0.9,0.9,0.9, HUT.w/2+1.0, 0.45, 0.4, 0x9a6b3f); box(0.7,0.7,0.7, HUT.w/2+1.0, 1.25, 0.4, 0xb07a45);     // thùng gỗ bên hông
    B.geo(new THREE.CylinderGeometry(0.42,0.42,0.9,10), new THREE.Matrix4().makeTranslation(HUT.w/2+1.1,0.45,-1.0), 0x4a6a8a);                                  // thùng phuy
    for(let k=0;k<2;k++){ const g = new THREE.CylinderGeometry(0.03,0.05,3.4,5), m = new THREE.Matrix4().compose(new THREE.Vector3(HUT.w/2+0.1+k*0.25,1.7,1.4), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-0.12-k*0.06)), _s); B.geo(g, m, 0x7a4e2d); }   // 2 cần câu dựa tường
    // phao cứu sinh đỏ-trắng trên thành quầy
    const lb = (arc, rot, r, c) => B.geo(new THREE.TorusGeometry(0.34, r, 8, 20, arc), new THREE.Matrix4().compose(new THREE.Vector3(-2.0, 0.8, HUT.d/2+0.12), new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,rot)), _s), c);
    lb(PI*2, 0, 0.1, 0xd64545); [0,1,2,3].forEach(k => lb(PI/5, k*PI/2 + 0.2, 0.104, 0xffffff));
    // đầu hồi (tam giác) 2 bên mái
    const tri = x => { const g = new THREE.BufferGeometry(), s = x > 0 ? 1 : -1, y0 = 2.7, y1 = 4.15, h = HUT.d/2 + 0.5;
      const v = s > 0 ? [x,y0,-h, x,y0,h, x,y1,0] : [x,y0,h, x,y0,-h, x,y1,0];
      g.setAttribute('position', new THREE.Float32BufferAttribute(v,3)); g.computeVertexNormals(); B.geo(g, new THREE.Matrix4(), woodD); };
    tri(HUT.w/2+0.1); tri(-HUT.w/2-0.1);
    const g = new THREE.Group(); g.add(B.build());
    const gm = G.build(); gm.castShadow = false; gm.visible = false; g.add(gm); env.reg({ o:gm, mode:'basic', dim:0 });   // cửa sổ chòi sáng đèn vàng về đêm
    // mái lá: 2 mái dốc, texture lá đan chéo
    const tc = cvs(128,128), tg = tc.getContext('2d'); tg.fillStyle = '#c9a15a'; tg.fillRect(0,0,128,128);
    for(let i=-4;i<12;i++){ tg.strokeStyle = i%2 ? '#a9803f' : '#dbb872'; tg.lineWidth = 5; tg.beginPath(); tg.moveTo(i*16,0); tg.lineTo(i*16+128,128); tg.stroke(); tg.beginPath(); tg.moveTo(i*16+128,0); tg.lineTo(i*16,128); tg.stroke(); }
    const rm = new THREE.MeshLambertMaterial({ map: mkTex(tc, 4, 1.6, env.aniso), color:0xffffff });
    [1,-1].forEach(sd => { const sl = new THREE.Group(); sl.position.set(0, 3.45, sd*1.2); sl.rotation.x = sd*0.55;
      const m = new THREE.Mesh(new THREE.BoxGeometry(HUT.w+1.1, 0.22, 2.95), rm); m.castShadow = true; m.receiveShadow = true; sl.add(m);
      if(sd > 0){   // cá gỗ trên mái trước
        const fs = new THREE.Shape(); fs.moveTo(-0.7,0); fs.quadraticCurveTo(-0.1,0.5,0.55,0); fs.lineTo(0.95,0.32); fs.lineTo(0.95,-0.32); fs.lineTo(0.55,0); fs.quadraticCurveTo(-0.1,-0.5,-0.7,0);
        const fm = new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth:0.1, bevelEnabled:false }), new THREE.MeshLambertMaterial({ color:0xd2b27a }));
        fm.rotation.x = -PI/2; fm.position.set(0, 0.2, 0.15); fm.scale.setScalar(1.1); sl.add(fm); }
      g.add(sl); });
    g.position.set(HUT.x, 0.02, HUT.z); grp.add(g);
    // biển tên trên xà trước (tấm phẳng gắn vào xà)
    const sg = env.makeTextPlane('CÂU CÁ', { fontsize:32, color:'#fff4cf', bg:'#2f7f86' });
    const sh = 0.5; sg.scale.set(sh*sg.userData.ar, sh, 1); sg.position.set(HUT.x, 2.52, HUT.z + HUT.d/2 + 0.14); grp.add(sg);
    // đèn treo ở cột trước-phải + ánh sáng ban đêm trong chòi
    env.addGlow(HUT.x + HUT.w/2 - 0.1, 2.35, HUT.z + HUT.d/2 + 0.1, 0xffc766, 2.6);
    env.addPool(HUT.x, HUT.z + 1.2, 4.6, 0xffc070, 0.5);
  }

  // ---------- dù sọc + ghế nằm ----------
  function umbrellas(env, grp){
    const mk = c => { const cv = cvs(256,16), g = cv.getContext('2d'); const cols = c ? ['#3f7fc4','#f4f1e6'] : ['#d2523f','#f4ecd8'];
      for(let i=0;i<8;i++){ g.fillStyle = cols[i%2]; g.fillRect(i*32,0,32,16); } const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; return new THREE.MeshLambertMaterial({ map:t }); };
    const mats = [mk(0), mk(1)], pole = new THREE.MeshLambertMaterial({ color:0xb8b8b8 }), B = env.Batch();
    UMB.forEach(u => {
      const um = new THREE.Mesh(new THREE.ConeGeometry(2.0, 0.7, 8, 1, true), mats[u.c]); um.material.side = THREE.DoubleSide; um.position.set(u.x, 2.65, u.z); um.rotation.y = 0.3; um.castShadow = true; grp.add(um);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6), pole); cap.position.set(u.x, 3.02, u.z); grp.add(cap);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.05,2.7,6), pole); pl.position.set(u.x, 1.37, u.z); pl.castShadow = true; grp.add(pl);
      B.geo(new THREE.CylinderGeometry(0.34,0.38,0.12,10), new THREE.Matrix4().makeTranslation(u.x, 0.08, u.z), 0xb9b2a0);          // đế dù
      // ghế nằm (nghiêng 1 đầu) quay về phía biển, đặt phía trước-dưới dù
      const cx = u.x + 0.9, cz = u.z + 1.5, mt = new THREE.Matrix4(), q = new THREE.Quaternion();
      q.setFromEuler(new THREE.Euler(0,0.15,0)); mt.compose(new THREE.Vector3(cx,0.38,cz), q, new THREE.Vector3(1,1,1));
      const seat = new THREE.BoxGeometry(0.9,0.1,1.45); B.geo(seat, mt, u.c ? 0x4a86c8 : 0xe6e0d0);
      q.setFromEuler(new THREE.Euler(-0.9,0.15,0)); mt.compose(new THREE.Vector3(cx+0.08,0.75,cz+0.88), q, new THREE.Vector3(1,1,1)); B.geo(new THREE.BoxGeometry(0.9,0.1,0.85), mt, u.c ? 0x4a86c8 : 0xe6e0d0);
      [[-0.4,-0.6],[0.4,-0.6],[-0.4,0.6],[0.4,0.6]].forEach(([lx,lz]) => B.geo(new THREE.BoxGeometry(0.07,0.34,0.07), new THREE.Matrix4().makeTranslation(cx+lx, 0.2, cz+lz), 0x6b4423));
    });
    grp.add(B.build());
  }

  // ---------- bến gỗ chữ T + thuyền ----------
  function pier(env, grp){
    const pc = cvs(256,256), g = pc.getContext('2d'); g.fillStyle = '#6b4a2b'; g.fillRect(0,0,256,256);
    for(let i=0;i<4;i++){ g.fillStyle = ['#b58450','#a87848','#bf8f58','#9f7042'][i]; g.fillRect(0,i*64+3,256,58);
      g.fillStyle = 'rgba(60,35,18,.55)'; for(let k=0;k<2;k++) g.fillRect(hs(i,k+30)*236+8, i*64+3, 3, 58); }
    const T = (rx,ry) => mkTex(pc, rx, ry, env.aniso);
    const L = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color:c }, extra||{}));
    const t = PIER.trunk, h = PIER.head, y = PIER.y, tl = t.z1 - t.z0, hl = h.z1 - h.z0;
    const deck = (w, d, x, zc, rx, ry) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.2, d), L(0xffffff, { map:T(rx,ry) })); m.position.set(x, y-0.1, zc); m.castShadow = m.receiveShadow = true; grp.add(m); };
    deck(PIER.hw*2, tl, PIER.cx, (t.z0+t.z1)/2, 1, tl/2);
    deck(h.hw*2, hl, PIER.cx, (h.z0+h.z1)/2, 5, hl/2);
    const B = env.Batch(), wd = 0x5b3d22;
    // dầm dưới + cọc ở 2 mép thân và quanh đầu chữ T
    B.box(0.22, 0.2, tl, PIER.cx-PIER.hw+0.2, y-0.3, (t.z0+t.z1)/2, wd); B.box(0.22, 0.2, tl, PIER.cx+PIER.hw-0.2, y-0.3, (t.z0+t.z1)/2, wd);
    B.box(h.hw*2, 0.2, 0.22, PIER.cx, y-0.3, h.z0+0.3, wd); B.box(h.hw*2, 0.2, 0.22, PIER.cx, y-0.3, h.z1-0.3, wd);
    const post = (px, pz, top) => B.geo(new THREE.CylinderGeometry(0.15,0.17,top-(WATER_Y-0.7),7), new THREE.Matrix4().makeTranslation(px, (top+WATER_Y-0.7)/2, pz), 0x6b4a2b);
    for(let z = t.z1-1; z > t.z0; z -= 3.2){ post(PIER.cx-PIER.hw, z, y+0.55); post(PIER.cx+PIER.hw, z, y+0.55); }
    [[-1,-1],[1,-1],[-1,1],[1,1],[0,-1]].forEach(([sx,sz]) => post(PIER.cx + sx*h.hw, sz<0 ? h.z0 : h.z1, y+0.7));
    for(let x = -h.hw+2.5; x < h.hw-1; x += 2.5) post(PIER.cx + x, h.z0, y+0.55);
    // dây thừng giữa các cọc cạnh đầu chữ T (thanh mảnh)
    B.box(h.hw*2, 0.05, 0.05, PIER.cx, y+0.45, h.z0, 0xd8c8a0);
    grp.add(B.build());
    // đèn ở 2 góc đầu chữ T
    [-1,1].forEach(sx => env.addLamp(PIER.cx + sx*(h.hw-0.35), h.z1 - 0.35, 0.5, y));
    // thuyền chèo gần thân bến, buộc dây
    const bt = new THREE.Group(), pts = [[0,-1.9],[0.55,-1.0],[0.78,0.2],[0.7,1.3],[0.45,1.8],[-0.45,1.8],[-0.7,1.3],[-0.78,0.2],[-0.55,-1.0]];
    const bs = new THREE.Shape(); pts.forEach(([x,z],i) => i ? bs.lineTo(x,-z) : bs.moveTo(x,-z));
    const bg = new THREE.ExtrudeGeometry(bs, { depth:0.55, bevelEnabled:false }); bg.rotateX(-PI/2);
    const hull = new THREE.Mesh(bg, [L(0x7a4a24), L(0x9b6a3a)]); hull.castShadow = true; bt.add(hull);
    const is = new THREE.Shape(); pts.forEach(([x,z],i) => i ? is.lineTo(x*0.8,-z*0.86) : is.moveTo(x*0.8,-z*0.86));
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(is), L(0x4a2f17)); inner.rotation.x = -PI/2; inner.position.y = 0.5; bt.add(inner);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3,0.08,0.34), L(0xb98652)); seat.position.set(0,0.55,0.4); bt.add(seat);
    const oar = new THREE.Mesh(new THREE.CylinderGeometry(0.03,0.03,2.4,5), L(0xc99a6b)); oar.rotation.z = PI/2; oar.rotation.y = 0.3; oar.position.set(0,0.62,-0.4); bt.add(oar);
    bt.position.set(BOAT.x, WATER_Y-0.3, BOAT.z); bt.rotation.y = BOAT.ry; grp.add(bt);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018,0.018,1.9,4), L(0xd8c8a0)); rope.rotation.z = PI/2 - 0.1; rope.position.set(PIER.cx+PIER.hw+1.15, 0.25, BOAT.z-0.8); rope.rotation.y = 0.2; grp.add(rope);
    env.anim.push(time => { bt.position.y = WATER_Y - 0.3 + Math.sin(time*1.4)*0.04; bt.rotation.z = Math.sin(time*1.1)*0.025; bt.rotation.x = Math.sin(time*0.9+1)*0.02; });
  }

  // ---------- đảo con ngoài xa ----------
  function islets(env, grp, palmB){
    const sandM = new THREE.MeshLambertMaterial({ map:mkTex(speckle('#dcc28c',['#caa86d','#e9d4a2'],60,3,0.5),1/6,1/6,env.aniso) });
    const grassM = new THREE.MeshLambertMaterial({ map:mkTex(speckle('#6ea245',['#5d9238','#80b552'],50,6,0.5),1/6,1/6,env.aniso) });
    const sideM = new THREE.MeshLambertMaterial({ color:0xb99e68 });
    ISLETS.forEach(([x,z,r],i) => {
      const fn = th => r*(1 + 0.12*Math.sin(3*th + i) + 0.07*Math.sin(5*th + 2*i));
      const sg = new THREE.ExtrudeGeometry(blobShape(fn, x, z), { depth:0.6, bevelEnabled:false }); sg.translate(0,0,-0.58); sg.rotateX(-PI/2);
      const sm = new THREE.Mesh(sg, [sandM, sideM]); sm.receiveShadow = true; grp.add(sm);
      const gm = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(fn, x, z, 0.68)), grassM); gm.rotation.x = -PI/2; gm.position.y = 0.04; gm.receiveShadow = true; grp.add(gm);
      palm(palmB, { x:x + r*0.15, z:z - r*0.1, h:3.6 + hs(i,1)*1.2, lean:0.5 + hs(i,2), phi:hs(i,3)*6, seed:40+i });
      if(r > 3.6) palm(palmB, { x:x - r*0.3, z:z + r*0.25, h:3.2 + hs(i,4), lean:0.6, phi:hs(i,5)*6, seed:60+i });
    });
  }

  // ---------- vòng nông xanh ngọc quanh đảo (vẽ bằng canvas, trong suốt, bám theo hình đảo) ----------
  function shallows(env, grp){
    const S = 110, PX = 1024, k = PX/S, cv = cvs(PX,PX), g = cv.getContext('2d');
    const path = (fn, cx, cz, kk) => { g.beginPath(); for(let i=0;i<=120;i++){ const th = i/120*PI*2, r = fn(th)*(kk||1), x = (cx + Math.cos(th)*r + S/2)*k, y = (cz + Math.sin(th)*r + S/2)*k; i ? g.lineTo(x,y) : g.moveTo(x,y); } g.closePath(); };
    g.lineJoin = 'round';
    const ring = (fn, cx, cz, w) => { for(let j=0;j<12;j++){ g.lineWidth = (w - j*w/13)*k; g.strokeStyle = `rgba(104,222,208,${0.075 + j*0.006})`; path(fn,cx,cz); g.stroke(); } g.fillStyle = 'rgba(104,222,208,0.35)'; path(fn,cx,cz); g.fill();
      g.lineWidth = 0.35*k; g.strokeStyle = 'rgba(255,255,255,0.40)'; path(fn,cx,cz,1.14); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.16)'; path(fn,cx,cz,1.3); g.stroke(); };
    ring(R, 0, 0, 11);
    ISLETS.forEach(([x,z,r],i) => ring(th => r*(1 + 0.12*Math.sin(3*th + i) + 0.07*Math.sin(5*th + 2*i)), x, z, 7));
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = env.aniso;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(S,S), new THREE.MeshBasicMaterial({ map:tex, transparent:true, depthWrite:false }));
    m.rotation.x = -PI/2; m.position.y = WATER_Y + 0.02; grp.add(m); env.waterMats.push(m.material);
  }

  // ---------- biển: nền xanh sâu có chấm sáng + vằn sóng, cuộn nhẹ ----------
  function ocean(env, grp){
    const c = cvs(512,512), g = c.getContext('2d'); g.fillStyle = '#1b6e9a'; g.fillRect(0,0,512,512);
    for(let i=0;i<26;i++){ const x = hs(i,40)*512, y = hs(i,41)*512, r = 50 + hs(i,42)*90, gr = g.createRadialGradient(x,y,0,x,y,r);
      gr.addColorStop(0, i%2 ? 'rgba(80,170,215,.20)' : 'rgba(10,60,100,.22)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x-r,y-r,2*r,2*r); }
    g.fillStyle = 'rgba(190,235,250,.22)'; for(let y=16;y<512;y+=32) for(let x=(y/32%2)*16+8;x<512;x+=32) g.fillRect(x,y,2.5,2.5);
    g.strokeStyle = 'rgba(200,240,255,.16)'; g.lineWidth = 2; for(let i=0;i<34;i++){ const x = hs(i,50)*512, y = hs(i,51)*512; g.beginPath(); g.moveTo(x,y); g.quadraticCurveTo(x+14,y-5,x+30,y); g.stroke(); }
    const tex = mkTex(c, 36, 36, env.aniso), m = new THREE.Mesh(new THREE.PlaneGeometry(520,520), new THREE.MeshBasicMaterial({ map:tex }));
    m.rotation.x = -PI/2; m.position.y = WATER_Y; grp.add(m); env.waterMats.push(m.material);
    env.anim.push(time => { tex.offset.set(time*0.006, time*0.004); });
  }

  // ===== DỰNG =====
  function build(env){
    const grp = env.group, aniso = env.aniso;
    ocean(env, grp); shallows(env, grp);
    // cát (khối đùn có thành, mặt trên y=0.02) → cỏ → đường đất
    const sandM = new THREE.MeshLambertMaterial({ map:mkTex(speckle('#dcc28c',['#caa86d','#e9d4a2','#bd9a5c'],90,3,0.55),1/6,1/6,aniso) });
    const sideM = new THREE.MeshLambertMaterial({ color:0xb99e68 });
    const sg = new THREE.ExtrudeGeometry(blobShape(R,0,0), { depth:0.6, bevelEnabled:false }); sg.translate(0,0,-0.58); sg.rotateX(-PI/2);
    const sand = new THREE.Mesh(sg, [sandM, sideM]); sand.receiveShadow = true; grp.add(sand);
    const grassM = new THREE.MeshLambertMaterial({ map:mkTex(speckle('#6ea245',['#5d9238','#80b552','#74a83f'],70,7,0.5),1/7,1/7,aniso) });
    const gm = new THREE.Mesh(new THREE.ShapeGeometry(blobShape(Rg,0,0)), grassM); gm.rotation.x = -PI/2; gm.position.y = 0.04; gm.receiveShadow = true; grp.add(gm);
    const pm = (c, off) => new THREE.MeshLambertMaterial({ color:c, polygonOffset:true, polygonOffsetFactor:-off, polygonOffsetUnits:-off });
    const C3 = a => new THREE.CatmullRomCurve3(a.map(([x,z]) => new THREE.Vector3(x,0,z)), false, 'centripetal');
    const main = C3([[PIER.cx,-13.6],[PIER.cx+0.4,-10],[1.4,-6.2],[-0.4,-2.8],[0.8,0.8],[2.8,4.4],[1.8,8.6],[0.4,11.4]]);
    const hutBr = C3([[0.1,-4.4],[-3.6,-5.2],[-7.4,-6.0],[-10.2,-5.5]]);
    [main, hutBr].forEach(c => ribbon(c, 2.5, 0.05, pm(0x9aa650,1), grp));
    [main, hutBr].forEach(c => ribbon(c, 1.8, 0.06, pm(0xc9a76d,2), grp));

    // cây dừa gom 1 mesh; bụi cỏ tròn + đá gom 1 mesh
    const palmB = env.Batch(); PALMS.forEach(p => palm(palmB, p)); islets(env, grp, palmB);
    const pmesh = palmB.build(); grp.add(pmesh);
    const B = env.Batch(), _m2 = new THREE.Matrix4(), q = new THREE.Quaternion();
    BUSH.forEach((b,i) => { q.setFromEuler(new THREE.Euler(0,i*1.7,0)); _m2.compose(new THREE.Vector3(b.x,0.1,b.z), q, new THREE.Vector3(b.r,b.r*0.55,b.r)); B.geo(env.blobs[i%3], _m2, 0x7ab85a); });
    ROCKS.forEach((r,i) => { q.setFromEuler(new THREE.Euler(0.1,i*2.3,0.1)); _m2.compose(new THREE.Vector3(r[0],0.05,r[1]), q, new THREE.Vector3(r[2],r[2]*0.6,r[2]*0.8)); B.geo(env.blobs[(i+1)%3], _m2, i%2 ? 0x7f8ea0 : 0x8f98a2); });
    grp.add(B.build());

    hut(env, grp); umbrellas(env, grp); pier(env, grp);
    LANT.forEach(l => env.addLamp(l[0], l[1], 0.5, TOP));
  }

  return { build, collides, atDock, fishDir, groundY, R, WATER_Y, PIER, HUT, spawn:{ x:2.6, z:-5 } };
})();
