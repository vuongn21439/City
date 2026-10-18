/* ===== GCITY 3D - Character v2 =====
 * Nhân vật chibi dựng hoàn toàn từ hình khối (không asset ngoài), tương thích three.js r128.
 *
 * Điểm chính:
 *  - Tỉ lệ chibi, mặt có mắt (lòng trắng + tròng + điểm sáng), lông mày, mũi, miệng cười, má hồng, tai
 *  - 8 kiểu tóc, 6 kiểu trang phục, 10 phụ kiện (kính, mũ, tai nghe, balo, nơ...)
 *  - Tay có khuỷu + bàn tay, chân có đầu gối + giày (giày đi theo chân khi bước)
 *  - Mỗi bộ phận được "bake" thành 1 mesh vertex-color => chỉ ~14 draw call / nhân vật
 *  - Viền toon (inverted hull) cho nhân vật nổi bật trên nền pastel
 *  - Animation: thở, chớp mắt, đung đưa tóc/đuôi, đi/chạy mượt, ngồi ghế đúng chiều, ngồi xếp bằng, 7 điệu nhảy
 *
 * API (giữ nguyên tên bộ phận cũ để game.js không phải đổi):
 *   GChar.DEFS                      { male:[...], female:[...] }
 *   GChar.build(gender, idx)        -> { group, parts }  (cao ~3.7 đơn vị, chưa scale)
 *   GChar.update(group, dt, time)   -> cập nhật pose (đọc group.userData: moving, walkT, face, action, actionT)
 *   GChar.preview(gender, idx,w,h)  -> dataURL ảnh 3D cho màn chọn nhân vật (null nếu không có WebGL)
 */
const GChar = (() => {
  // ====================== DỮ LIỆU NHÂN VẬT ======================
  // outfit: tee | hoodie | jacket | dress | overalls | tank
  // sleeve: short | long | none      legs: long | shorts | skirt
  // hairStyle: short | spiky | curly | long | ponytail | twin | bun | bob
  // bangs: straight | side | none      acc: mảng phụ kiện
  const DEFS = {
    male: [
      { skin:0xf5c9a0, hair:0x6b3f2a, shirt:0xffffff, pants:0x2b2f3a, shoe:0xf4f4f4, accent:0x3b82f6, eye:0x3a2616,
        outfit:'tee', sleeve:'short', legs:'long', hairStyle:'short', bangs:'side', acc:['backpack'] },
      { skin:0xf5c9a0, hair:0x2a1a0f, shirt:0x3b82f6, pants:0x1e3a5f, shoe:0xffffff, accent:0xf59e0b, eye:0x24170c,
        outfit:'hoodie', sleeve:'long', legs:'long', hairStyle:'short', bangs:'straight', acc:['headphones'] },
      { skin:0xe8b88f, hair:0x0f0f0f, shirt:0xef4444, pants:0x2d2d2d, shoe:0x1f1f1f, accent:0xe5e7eb, eye:0x1a1a1a, under:0x1b1b1b,
        outfit:'jacket', sleeve:'long', legs:'long', hairStyle:'spiky', bangs:'none', acc:[] },
      { skin:0xf0c090, hair:0x6b4423, shirt:0x10b981, pants:0xa8946a, shoe:0x5b4636, accent:0xfef3c7, eye:0x3a2616,
        outfit:'tee', sleeve:'short', legs:'shorts', hairStyle:'curly', bangs:'none', acc:['roundglasses'] },
      { skin:0xf5d0a8, hair:0xd4a017, shirt:0x8b5cf6, pants:0x4c1d95, shoe:0xfafafa, accent:0xef4444, eye:0x2f5d8a, under:0xf3e8ff,
        outfit:'jacket', sleeve:'long', legs:'long', hairStyle:'short', bangs:'straight', acc:['cap'] },
      { skin:0xe0a878, hair:0x1a1a1a, shirt:0xf59e0b, pants:0x78350f, shoe:0xf2f2f2, accent:0xffffff, eye:0x1a1a1a,
        outfit:'tank', sleeve:'none', legs:'shorts', hairStyle:'spiky', bangs:'none', acc:['headband'] },
      { skin:0xf8d8b8, hair:0x8b4513, shirt:0xec4899, pants:0x831843, shoe:0x2a2a2a, accent:0x111827, eye:0x4a2c17,
        outfit:'tee', sleeve:'short', legs:'long', hairStyle:'curly', bangs:'none', acc:['sunglasses'] },
    ],
    female: [
      { skin:0xf8d4b0, hair:0x1a1a1a, shirt:0xec4899, pants:0xbe185d, shoe:0xffffff, accent:0xfde68a, eye:0x2a1a12,
        outfit:'dress', sleeve:'short', legs:'skirt', hairStyle:'long', bangs:'straight', acc:['bow'] },
      { skin:0xf0c090, hair:0x8b4513, shirt:0xf59e0b, pants:0xfef3c7, shoe:0xb45309, accent:0xffffff, eye:0x3a2616,
        outfit:'dress', sleeve:'none', legs:'skirt', hairStyle:'ponytail', bangs:'side', acc:[] },
      { skin:0xfce0c0, hair:0xf5d060, shirt:0x06b6d4, pants:0x155e75, shoe:0xffffff, accent:0xf472b6, eye:0x2f7fb0,
        outfit:'overalls', sleeve:'short', legs:'shorts', hairStyle:'twin', bangs:'straight', acc:[], under:0xffffff },
      { skin:0xe8b88f, hair:0x2d1b0e, shirt:0xa855f7, pants:0x312e81, shoe:0xf4f4f4, accent:0xfacc15, eye:0x24170c,
        outfit:'hoodie', sleeve:'long', legs:'long', hairStyle:'long', bangs:'side', acc:['glasses'] },
      { skin:0xf5c9a0, hair:0xc0392b, shirt:0x22c55e, pants:0x14532d, shoe:0x7c2d12, accent:0xfef08a, eye:0x2f6b3a,
        outfit:'dress', sleeve:'short', legs:'skirt', hairStyle:'bun', bangs:'straight', acc:[] },
      { skin:0xf8d8b8, hair:0x4a3728, shirt:0xf43f5e, pants:0x9f1239, shoe:0xffffff, accent:0xffffff, eye:0x3a2616,
        outfit:'jacket', sleeve:'long', legs:'skirt', hairStyle:'bob', bangs:'side', acc:['beanie'], under:0xfff1f2 },
    ],
  };

  // ====================== HELPER DỰNG HÌNH ======================
  const PI = Math.PI;
  const matCache = new Map();
  const mat = c => { let m = matCache.get(c); if(!m){ m = new THREE.MeshBasicMaterial({ color:c }); matCache.set(c, m); } return m; };
  const shade = (hex, k) => { const c = new THREE.Color(hex); c.r = Math.min(1, c.r*k); c.g = Math.min(1, c.g*k); c.b = Math.min(1, c.b*k); return c.getHex(); };   // k<1 tối, k>1 sáng (đã kẹp ≤1)
  const mix = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();

  function add(parent, geo, color, x, y, z, rx, ry, rz, sx, sy, sz){
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x||0, y||0, z||0);
    m.rotation.set(rx||0, ry||0, rz||0);
    m.scale.set(sx||1, sy||1, sz||1);
    parent.add(m); return m;
  }
  const sph = (p, r, c, x,y,z, sx,sy,sz, seg) => add(p, new THREE.SphereGeometry(r, seg||14, Math.max(8, ((seg||14)*0.7)|0)), c, x,y,z, 0,0,0, sx,sy,sz);
  const box = (p, w,h,d, c, x,y,z, rx,ry,rz) => add(p, new THREE.BoxGeometry(w,h,d), c, x,y,z, rx,ry,rz);
  const cyl = (p, rt,rb,h, c, x,y,z, rx,ry,rz, seg) => add(p, new THREE.CylinderGeometry(rt,rb,h, seg||14), c, x,y,z, rx,ry,rz);
  const cone = (p, r,h, c, x,y,z, rx,ry,rz, seg) => add(p, new THREE.ConeGeometry(r,h, seg||8), c, x,y,z, rx,ry,rz);
  const tor = (p, R,r, c, x,y,z, rx,ry,rz, arc) => add(p, new THREE.TorusGeometry(R, r, 6, 20, arc||PI*2), c, x,y,z, rx,ry,rz);

  // capsule bằng Lathe (r128 chưa có CapsuleGeometry). len = khoảng cách 2 tâm bán cầu
  function capGeo(rTop, rBot, len, seg){
    const pts = [], n = 6;
    for(let i=0;i<=n;i++){ const a = -PI/2 + i/n*PI/2; pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a)*rBot), -len/2 + Math.sin(a)*rBot)); }
    for(let i=0;i<=n;i++){ const a = i/n*PI/2;        pts.push(new THREE.Vector2(Math.max(0.0001, Math.cos(a)*rTop),  len/2 + Math.sin(a)*rTop)); }
    return new THREE.LatheGeometry(pts, seg||14);
  }
  const cap = (p, rTop,rBot,len, c, x,y,z, rx,ry,rz, sx,sy,sz) => add(p, capGeo(rTop,rBot,len), c, x,y,z, rx,ry,rz, sx,sy,sz);

  // Lathe theo profile [[r,y],...] từ dưới lên
  const lathe = (p, prof, c, x,y,z, sx,sy,sz, seg) => add(p, new THREE.LatheGeometry(prof.map(([r,y])=>new THREE.Vector2(r,y)), seg||20), c, x,y,z, 0,0,0, sx,sy,sz);

  // Gộp mọi mesh con của `root` thành 1 BufferGeometry dùng vertex color (toạ độ theo gốc của root)
  function bakeGeo(root){
    root.updateMatrixWorld(true);
    const pos = [], nor = [], col = [];
    root.traverse(o => {
      if(!o.isMesh) return;
      const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      const p = g.attributes.position, n = g.attributes.normal, c = o.material.color;
      for(let i=0;i<p.count;i++){
        pos.push(p.getX(i), p.getY(i), p.getZ(i));
        nor.push(n.getX(i), n.getY(i), n.getZ(i));
        col.push(c.r, c.g, c.b);
      }
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal',   new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color',    new THREE.Float32BufferAttribute(col, 3));
    return geo;
  }

  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors:true });
  const outlineMat = new THREE.MeshBasicMaterial({ color:0x2b2236, side:THREE.BackSide });
  outlineMat.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position) + normalize(normal) * 0.032;');
  };

  // tạo Mesh (+ viền) từ nhóm tạm
  function bakeMesh(tmp, outline){
    const geo = bakeGeo(tmp);
    const m = new THREE.Mesh(geo, bodyMat); m.castShadow = true;
    if(outline !== false){ const o = new THREE.Mesh(geo, outlineMat); m.add(o); }
    return m;
  }

  // ====================== DỰNG TỪNG BỘ PHẬN ======================
  const T = () => new THREE.Group();

  function buildHead(def, female){
    const t = T(), R = 0.62, skin = def.skin;
    const hy = 0.62;                                               // tâm đầu so với cổ
    // cổ + đầu + tai
    cyl(t, 0.17, 0.2, 0.3, shade(skin, 0.95), 0, 0.02, 0, 0,0,0, 10);
    sph(t, R, skin, 0, hy, 0, 1, 0.96, 0.94, 28);
    [-1,1].forEach(s => { sph(t, 0.11, shade(skin,0.97), s*0.61, hy-0.03, -0.02, 0.55, 1, 0.9, 10); sph(t, 0.05, shade(skin,0.85), s*0.63, hy-0.03, 0.0, 0.5, 1, 0.8, 8); });
    // mũi, miệng, má hồng
    sph(t, 0.05, shade(skin,0.93), 0, hy-0.14, 0.575, 1, 0.9, 0.9, 8);
    tor(t, 0.085, 0.015, 0x7a2f35, 0, hy-0.26, 0.53, 0.25, 0, PI, PI);       // miệng cười (cung dưới)
    const blush = mix(skin, 0xff6f91, 0.45);
    [-1,1].forEach(s => sph(t, 0.1, blush, s*0.37, hy-0.17, 0.43, 1, 0.55, 0.35, 10));
    // lông mày
    const brow = shade(def.hair, 0.9);
    [-1,1].forEach(s => box(t, 0.2, 0.035, 0.05, brow, s*0.235, hy+0.2, 0.52, 0, -s*0.38, s*-0.1));
    // tóc
    buildHair(t, def, female, hy);
    // phụ kiện đầu
    (def.acc||[]).forEach(a => headAcc(t, def, a, hy));
    return t;
  }

  function hairCap(t, c, hy, r){
    const g = new THREE.SphereGeometry(r||0.665, 28, 18, 0, PI*2, 0, PI*0.56);
    const m = add(t, g, c, 0, hy, -0.02, -0.5, 0, 0);
    return m;
  }
  function bangs(t, def, hy){
    const c = def.hair, style = def.bangs;
    if(style === 'none') return;
    const n = 6;
    for(let i=0;i<n;i++){
      const k = (i/(n-1))*2 - 1;                                    // -1..1
      const x = k*0.43, z = Math.sqrt(Math.max(0.05, 0.44 - x*x*0.9)) + 0.04;
      let ry = -k*0.7, rz = 0;
      let len = 0.17;
      if(style === 'side'){ rz = -0.45 - k*0.15; len = 0.2 + (k+1)*0.04; }
      sph(t, 0.15, i%2 ? shade(c,1.08) : c, x, hy+0.29 - Math.abs(k)*0.05, z, 1, len/0.15, 0.7, 10).rotation.set(0.25, ry, rz);
    }
  }
  function sideburns(t, c, hy){ [-1,1].forEach(s => sph(t, 0.12, c, s*0.55, hy-0.08, 0.2, 0.55, 1.25, 0.8, 8)); }
  function shine(t, c, hy){ tor(t, 0.6, 0.02, shade(c,1.4), 0, hy+0.3, -0.04, PI/2-0.45, 0, PI/2-0.6, 1.2); }

  function buildHair(t, def, female, hy){
    const c = def.hair, st = def.hairStyle;
    const hat = (def.acc||[]).some(a => a==='cap' || a==='beanie');
    hairCap(t, c, hy);
    if(!hat){ bangs(t, def, hy); shine(t, c, hy); }
    if(st === 'short'){ sideburns(t, c, hy); sph(t, 0.2, shade(c,1.05), 0.02, hy+0.6, -0.08, 1, 0.7, 1, 10); }
    else if(st === 'spiky'){
      for(let i=0;i<9;i++){
        const a = i/9*PI*2, r = 0.33, up = 0.62 + (i%2)*0.08;
        const k = cone(t, 0.15, 0.48, shade(c, i%2?1.1:1), Math.sin(a)*r, hy+up, Math.cos(a)*r*0.85 - 0.05, 0,0,0, 6);
        k.rotation.set(Math.cos(a)*0.7, 0, -Math.sin(a)*0.7);
      }
      cone(t, 0.16, 0.55, c, 0, hy+0.8, -0.02, 0,0,0, 6);
      for(let i=-1;i<=1;i++){ const k = cone(t, 0.1, 0.34, c, i*0.26, hy+0.38, 0.5, 0,0,0, 6); k.rotation.set(1.9, 0, -i*0.3); }
      sideburns(t, c, hy);
    }
    else if(st === 'curly'){
      for(let i=0;i<14;i++){
        const a = i/14*PI*2, ring = i%2;
        sph(t, 0.24 + ring*0.03, i%3===0?shade(c,1.12):c, Math.sin(a)*0.5, hy+0.3+ring*0.22, Math.cos(a)*0.5 - 0.06, 1,1,1, 10);
      }
      for(let i=0;i<5;i++){ const a = i/5*PI*2; sph(t, 0.26, c, Math.sin(a)*0.22, hy+0.66, Math.cos(a)*0.22 - 0.05, 1,1,1, 10); }
    }
    else if(st === 'long'){
      sph(t, 0.7, c, 0, hy-0.55, -0.22, 0.95, 1.35, 0.58, 18);                  // tấm tóc sau lưng
      [-1,1].forEach(s => { sph(t, 0.19, c, s*0.54, hy-0.3, 0.12, 0.7, 2.1, 0.9, 10); sph(t, 0.14, shade(c,1.12), s*0.58, hy-0.62, 0.16, 0.8, 1.2, 0.9, 10); });
    }
    else if(st === 'bob'){
      sph(t, 0.7, c, 0, hy-0.12, -0.2, 0.98, 0.82, 0.68, 18);
      [-1,1].forEach(s => { sph(t, 0.2, c, s*0.55, hy-0.16, 0.1, 0.8, 1.7, 1, 10); });
    }
    else if(st === 'bun'){
      sph(t, 0.26, c, 0, hy+0.78, -0.12, 1, 1, 1, 14);
      tor(t, 0.2, 0.05, def.accent, 0, hy+0.6, -0.12, PI/2, 0, 0);
      sideburns(t, c, hy);
    }
    else if(st === 'ponytail' || st === 'twin'){ sideburns(t, c, hy); }
  }

  function headAcc(t, def, a, hy){
    const A = def.accent;
    if(a === 'glasses' || a === 'roundglasses'){
      const fc = a === 'glasses' ? 0x222222 : 0x8a5a2b, R = a === 'glasses' ? 0.15 : 0.165;
      [-1,1].forEach(s => { tor(t, R, 0.022, fc, s*0.235, hy-0.04, 0.575, 0.0, s*0.12, 0); });
      box(t, 0.1, 0.025, 0.03, fc, 0, hy-0.02, 0.59); [-1,1].forEach(s => box(t, 0.03, 0.025, 0.36, fc, s*0.58, hy-0.02, 0.24));
    }
    else if(a === 'sunglasses'){
      [-1,1].forEach(s => sph(t, 0.17, 0x1b1b24, s*0.235, hy-0.04, 0.55, 1, 0.78, 0.3, 12));
      box(t, 0.12, 0.03, 0.03, 0x111111, 0, hy-0.01, 0.58); [-1,1].forEach(s => box(t, 0.03, 0.03, 0.36, 0x111111, s*0.59, hy-0.01, 0.24));
    }
    else if(a === 'cap'){
      const g = new THREE.SphereGeometry(0.7, 24, 14, 0, PI*2, 0, PI*0.5); add(t, g, A, 0, hy+0.04, -0.03, -0.18, 0, 0);
      sph(t, 0.45, shade(A,0.85), 0, hy+0.3, 0.55, 1, 0.12, 0.9, 14).rotation.x = 0.22;
      sph(t, 0.07, shade(A,0.8), 0, hy+0.74, -0.02, 1,1,1, 8);
    }
    else if(a === 'beanie'){
      const g = new THREE.SphereGeometry(0.72, 24, 14, 0, PI*2, 0, PI*0.52); add(t, g, A, 0, hy+0.06, -0.04, -0.3, 0, 0);
      tor(t, 0.69, 0.1, shade(A,0.9), 0, hy+0.3, 0.0, PI/2-0.3, 0, 0);
      sph(t, 0.15, shade(A,1.1), 0, hy+0.86, -0.1, 1,1,1, 10);
    }
    else if(a === 'headphones'){
      tor(t, 0.72, 0.045, 0x2a2a33, 0, hy, 0, 0,0,0, PI);
      [-1,1].forEach(s => { cyl(t, 0.2, 0.2, 0.14, A, s*0.72, hy-0.02, 0, 0,0,PI/2, 16); cyl(t, 0.14, 0.14, 0.16, 0x2a2a33, s*0.74, hy-0.02, 0, 0,0,PI/2, 14); });
    }
    else if(a === 'headband'){ tor(t, 0.64, 0.045, A, 0, hy+0.2, -0.02, PI/2-0.38, 0, 0); }
    else if(a === 'bow'){
      const bx = 0.4, by = hy+0.5, bz = 0.12;
      [-1,1].forEach(s => sph(t, 0.15, A, bx + s*0.15, by, bz, 1.1, 0.75, 0.5, 10).rotation.z = s*0.35);
      sph(t, 0.07, shade(A,0.85), bx, by, bz+0.02, 1,1,1, 8);
    }
  }

  // ---------- Thân ----------
  function buildTorso(def, female){
    const t = T(), sk = def.skin, sh = def.shirt, o = def.outfit;
    const trunk = [[0.0001,0.0],[0.44,0.0],[0.5,0.14],[0.5,0.5],[0.47,0.86],[0.38,1.06],[0.2,1.16],[0.0001,1.18]];
    const under = def.under || shade(sh, 1.25);
    if(o === 'tank'){ lathe(t, trunk, sh, 0,0,0, 1,1,0.72, 22); [-1,1].forEach(s => sph(t, 0.23, sk, s*0.4, 1.0, 0, 1,1,0.8, 10)); }
    else if(o === 'dress'){
      lathe(t, trunk.map(([r,y])=>[r*0.94,y]), sh, 0,0,0, 1,1,0.72, 22);
      // váy xoè
      lathe(t, [[0.0001,-0.58],[0.92,-0.58],[0.9,-0.52],[0.62,-0.4],[0.46,0.02],[0.0001,0.02]], def.pants, 0, 0.2, 0, 1,1,0.9, 24);
      tor(t, 0.92, 0.04, def.accent, 0, -0.35, 0, PI/2, 0, 0).scale.set(1,0.9,1);
      tor(t, 0.47, 0.035, def.accent, 0, 0.26, 0, PI/2, 0, 0).scale.set(1,0.74,1);                  // đai eo
    }
    else lathe(t, trunk, sh, 0,0,0, 1,1,0.72, 22);

    // cổ áo
    if(o === 'tee' || o === 'overalls' || o === 'dress') tor(t, 0.2, 0.05, shade(sh, 0.8), 0, 1.15, 0.03, PI/2, 0, 0).scale.set(1, 0.8, 1);
    if(o === 'hoodie'){
      sph(t, 0.46, shade(sh, 0.9), 0, 1.12, -0.2, 1, 0.62, 0.65, 16);                       // mũ hoodie sau gáy
      box(t, 0.76, 0.34, 0.12, shade(sh, 0.88), 0, 0.3, 0.37, 0.12,0,0);                        // túi trước
      [-1,1].forEach(s => cyl(t, 0.022, 0.022, 0.4, 0xf4f4f4, s*0.13, 0.82, 0.35, 0.1,0,0, 6));  // dây rút
      tor(t, 0.47, 0.05, shade(sh, 0.85), 0, 0.02, 0, PI/2, 0, 0).scale.set(1, 0.72, 1);
    }
    if(o === 'jacket'){
      box(t, 0.3, 1.0, 0.1, under, 0, 0.62, 0.33, 0.06,0,0);                               // áo trong lộ ra
      box(t, 0.035, 1.05, 0.06, shade(def.accent, 0.95), 0, 0.62, 0.38, 0.06,0,0);         // khoá kéo
      tor(t, 0.22, 0.07, shade(sh, 0.8), 0, 1.13, 0.0, PI/2, 0, 0).scale.set(1, 0.85, 1);   // cổ áo dựng
      tor(t, 0.47, 0.05, shade(sh, 0.85), 0, 0.02, 0, PI/2, 0, 0).scale.set(1, 0.72, 1);
    }
    if(o === 'overalls'){
      lathe(t, [[0.0001,0.0],[0.46,0.0],[0.5,0.14],[0.5,0.4],[0.0001,0.4]], def.pants, 0,0,0, 1,1,0.74, 22);
      box(t, 0.62, 0.55, 0.1, def.pants, 0, 0.62, 0.36);
      sph(t, 0.07, def.accent, -0.18, 0.7, 0.43, 1,1,0.5, 8); sph(t, 0.07, def.accent, 0.18, 0.7, 0.43, 1,1,0.5, 8);
      [-1,1].forEach(s => box(t, 0.1, 0.6, 0.08, def.pants, s*0.3, 0.95, 0.3, 0,0,-s*0.12));
    }
    if(o === 'tee' && def.shirt === 0xffffff){ [0.35,0.6].forEach(y => tor(t, 0.5, 0.018, 0x3b82f6, 0, y, 0, PI/2,0,0).scale.set(1,0.72,1)); }
    if(o === 'tee' && def.shirt !== 0xffffff){ sph(t, 0.1, shade(sh,1.35), 0.18, 0.78, 0.37, 1,1,0.3, 8); } // logo nhỏ
    // thắt lưng (quần dài/short)
    if(def.legs !== 'skirt' && o !== 'overalls' && o !== 'dress'){ tor(t, 0.46, 0.03, 0x2a2a2a, 0, 0.03, 0, PI/2, 0, 0).scale.set(1,0.72,1); }
    // balo
    if((def.acc||[]).includes('backpack')){
      sph(t, 0.4, def.accent, 0, 0.62, -0.42, 1, 1.15, 0.55, 14);
      sph(t, 0.22, shade(def.accent, 0.82), 0, 0.42, -0.62, 1, 0.8, 0.4, 10);
      [-1,1].forEach(s => box(t, 0.1, 0.78, 0.05, shade(def.accent, 0.7), s*0.28, 0.72, 0.28, 0.12,0,s*-0.05));
    }
    return t;
  }

  // ---------- Tay: (cánh tay trên) + (cẳng tay + bàn tay) ----------
  function buildArm(def, side){
    const sk = def.skin, sh = def.shirt, long = def.sleeve === 'long', none = def.sleeve === 'none';
    const up = T(), fo = T();
    const sleeveC = (def.outfit === 'overalls' || def.outfit === 'dress') ? sh : sh;
    if(none) cap(up, 0.13, 0.12, 0.34, sk, 0, -0.26, 0);
    else if(long) cap(up, 0.17, 0.15, 0.34, sleeveC, 0, -0.26, 0);
    else { cap(up, 0.13, 0.12, 0.34, sk, 0, -0.26, 0); cap(up, 0.2, 0.185, 0.14, sleeveC, 0, -0.14, 0); }
    sph(up, 0.17, none ? sk : sleeveC, 0, 0.0, 0, 1,1,1, 12);                                    // vai tròn
    // cẳng tay
    if(long){ cap(fo, 0.15, 0.13, 0.28, sleeveC, 0, -0.2, 0); tor(fo, 0.14, 0.04, shade(sleeveC, 0.8), 0, -0.4, 0, PI/2, 0, 0); }
    else cap(fo, 0.125, 0.115, 0.3, sk, 0, -0.2, 0);
    sph(fo, 0.155, sk, 0, -0.58, 0.02, 1, 1.05, 0.95, 12);                                      // bàn tay
    sph(fo, 0.06, shade(sk, 0.96), side*-0.1, -0.54, 0.1, 1,1,1, 8);                            // ngón cái
    return { up, fo };
  }

  // ---------- Chân: đùi + (cẳng + giày) ----------
  function buildLeg(def){
    const sk = def.skin, pc = def.pants, shoeC = def.shoe;
    const th = T(), sn = T();
    const skirt = def.legs === 'skirt', shorts = def.legs === 'shorts';
    const thighC = skirt ? sk : pc;
    cap(th, 0.2, 0.18, 0.38, thighC, 0, -0.3, 0);
    if(shorts){ cap(th, 0.23, 0.215, 0.14, pc, 0, -0.22, 0); }
    sph(th, 0.19, shorts || skirt ? thighC : pc, 0, 0, 0, 1,1,1, 12);
    // cẳng
    const shinC = (skirt || shorts) ? sk : pc;
    cap(sn, 0.18, 0.155, 0.32, shinC, 0, -0.22, 0);
    if(skirt || shorts){ cap(sn, 0.17, 0.165, 0.14, 0xffffff, 0, -0.4, 0); }                      // tất cổ cao
    sph(sn, 0.18, shinC, 0, 0, 0, 1,1,1, 12);                                                     // khớp gối
    // giày
    sph(sn, 0.2, shoeC, 0, -0.5, 0.1, 1.02, 0.7, 1.55, 14);
    sph(sn, 0.14, shade(shoeC, 1.15), 0, -0.46, 0.3, 1, 0.8, 0.8, 10);                            // mũi giày
    cyl(sn, 0.21, 0.21, 0.05, 0xe9e5dc, 0, -0.595, 0.1, 0,0,0, 14).scale.set(1.0,1,1.75);          // đế
    return { th, sn };
  }

  // ---------- Đuôi tóc (pivot riêng để đung đưa) ----------
  function buildTail(def, kind){
    const t = T(), c = def.hair;
    if(kind === 'pony'){
      cap(t, 0.16, 0.07, 0.78, c, 0, -0.46, 0);
      sph(t, 0.13, shade(c,1.1), 0, -0.1, 0, 1,1,1, 10);
      tor(t, 0.11, 0.035, def.accent, 0, -0.03, 0, PI/2, 0, 0);
    } else {
      cap(t, 0.14, 0.06, 0.55, c, 0, -0.34, 0);
      sph(t, 0.15, shade(c,1.1), 0, -0.05, 0, 1,1,1, 10);
      sph(t, 0.1, def.accent, 0, 0.04, 0, 1, 0.8, 1.3, 8);                                         // nơ buộc
    }
    return t;
  }

  // ---------- Mắt (pivot riêng để chớp) ----------
  function buildEye(def, female, side){
    const t = T();
    const big = female ? 1.1 : 1;
    sph(t, 0.12, 0xffffff, 0, 0, 0, 1*big, 1.28*big, 0.5, 14);
    sph(t, 0.092, def.eye, 0, -0.01, 0.035, 1*big, 1.3*big, 0.5, 12);
    sph(t, 0.052, 0x0b0b10, 0, -0.01, 0.062, 1*big, 1.3*big, 0.4, 10);
    sph(t, 0.032, 0xffffff, 0.035, 0.05, 0.085, 1,1,0.6, 8);
    sph(t, 0.015, 0xffffff, -0.03, -0.05, 0.08, 1,1,0.6, 6);
    if(female){ box(t, 0.19, 0.03, 0.05, 0x1b1b1b, side*0.015, 0.16*big, 0.02, 0,0, side*0.22); }  // mi
    return t;
  }

  // ====================== LẮP RÁP ======================
  const protoCache = {};
  function makeProto(gender, idx){
    const def = DEFS[gender][idx % DEFS[gender].length], female = gender === 'female';
    const root = new THREE.Group();
    const place = (obj, name, x, y, z) => { obj.name = name; obj.position.set(x, y, z); return obj; };

    // thân (pivot ở hông y=1.2)
    const body = place(new THREE.Group(), 'body', 0, 1.2, 0);
    body.add(bakeMesh(buildTorso(def, female))); root.add(body);

    // đầu (pivot ở gáy)
    const head = place(new THREE.Group(), 'head', 0, 2.38, 0);
    head.add(bakeMesh(buildHead(def, female)));
    [-1,1].forEach(s => { const e = place(buildEyeBaked(def, female, s), s<0?'eyeL':'eyeR', s*0.235, 0.58, 0.515); e.rotation.y = s*0.26; head.add(e); });
    if(def.hairStyle === 'ponytail'){ const tl = place(new THREE.Group(), 'tail', 0, 0.96, -0.6); tl.add(bakeMesh(buildTail(def, 'pony'))); tl.rotation.x = 0.55; head.add(tl); }
    if(def.hairStyle === 'twin'){
      [-1,1].forEach(s => { const tl = place(new THREE.Group(), s<0?'tailL':'tailR', s*0.54, 0.9, -0.16); tl.add(bakeMesh(buildTail(def, 'twin'))); tl.rotation.z = s*0.42; tl.userData.rz = s*0.42; head.add(tl); });
    }
    root.add(head);

    // tay
    [-1,1].forEach(s => {
      const a = buildArm(def, s);
      const arm = place(new THREE.Group(), s<0?'armL':'armR', s*0.66, 2.2, 0);
      arm.add(bakeMesh(a.up));
      const fore = place(new THREE.Group(), s<0?'foreL':'foreR', 0, -0.5, 0); fore.add(bakeMesh(a.fo)); arm.add(fore);
      arm.userData.restZ = s*0.1; arm.rotation.z = s*0.1; root.add(arm);
    });
    // chân
    [-1,1].forEach(s => {
      const l = buildLeg(def);
      const leg = place(new THREE.Group(), s<0?'legL':'legR', s*0.3, 1.2, 0);
      leg.add(bakeMesh(l.th));
      const shin = place(new THREE.Group(), s<0?'shinL':'shinR', 0, -0.62, 0); shin.add(bakeMesh(l.sn)); leg.add(shin);
      root.add(leg);
    });
    root.userData.def = def;
    return root;
  }
  // mắt: bake riêng (không viền để mắt sáng rõ)
  function buildEyeBaked(def, female, side){
    const m = bakeMesh(buildEye(def, female, side), false); m.castShadow = false; const g = new THREE.Group(); g.add(m); return g;
  }

  function build(gender, idx){
    const key = gender + ':' + (idx % DEFS[gender].length);
    if(!protoCache[key]) protoCache[key] = makeProto(gender, idx);
    const g = protoCache[key].clone(true);
    const parts = {};
    ['body','head','armL','armR','foreL','foreR','legL','legR','shinL','shinR','eyeL','eyeR','tail','tailL','tailR'].forEach(n => { const o = g.getObjectByName(n); if(o) parts[n] = o; });
    g.userData.def = protoCache[key].userData.def;
    attachGear(g, parts);
    return { group:g, parts, def:g.userData.def };
  }

  // ====================== ĐỒ CÂU (cần + dây + phao) ======================
  // Cần gắn vào cẳng tay phải (foreR) nên đi theo tay; dây câu vẽ mỗi khung từ đầu cần
  // xuống phao (điểm cố định phía trước nhân vật) — nhìn đúng như đang câu.
  const GEAR = { tipY: 0.06, tipZ: 2.92, floatX: 0.1, floatY: 0.30, floatZ: 3.4 };
  function attachGear(g, p){
    if(!p.foreR) return;
    // trục cần nằm ngang ngang tay (trục +z), chĩa ra trước
    const rod = T(); rod.name = 'rod';
    cyl(rod, 0.055, 0.085, 1.45, 0x8a5a32, 0, 0, 0.72, PI/2, 0, 0);        // cán
    cyl(rod, 0.030, 0.055, 1.00, 0xa87b4a, 0, 0.05, 2.42, PI/2, 0, 0);      // đoạn thân mảnh dần
    cyl(rod, 0.13, 0.13, 0.17, 0x4a5568, 0, -0.15, 0.22, PI/2, 0, 0);       // cuộn dây
    cyl(rod, 0.045, 0.045, 0.22, 0xd8d2c4, 0, -0.15, 0.22, 0, 0, PI/2);    // tay quay
    tor(rod, 0.07, 0.018, 0x6b7280, 0, 0.02, 1.32, PI/2, 0, 0);            // khoen dây
    tor(rod, 0.055, 0.015, 0x6b7280, 0, 0.05, 2.66, PI/2, 0, 0);
    rod.rotation.set(-0.06, 0, 0);         // hơi ngẩng
    rod.position.set(0, -0.5, 0.05);
    p.foreR.add(rod);

    const lineMat = new THREE.MeshBasicMaterial({ color:0xf2efe2, transparent:true, opacity:0.8 });
    const mk = ()=>{ const m = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 1, 4), lineMat); m.visible = false; g.add(m); return m; };
    const seg1 = mk(), seg2 = mk();

    const flt = T();
    sph(flt, 0.095, 0xe8503c, 0, 0.10, 0, 1, 1, 1, 8);
    sph(flt, 0.095, 0xfdf6e8, 0, -0.03, 0, 1, 1, 1, 8);
    cyl(flt, 0.012, 0.012, 0.34, 0x6b7280, 0, 0.26, 0, 0, 0, 0, 4);
    flt.visible = false; g.add(flt);

    p.rod = rod; p.rodSeg = [seg1, seg2]; p.rodFloat = flt;
  }
  const _tipW = new THREE.Vector3(), _tipL = new THREE.Vector3(), _fl = new THREE.Vector3(), _mid = new THREE.Vector3(),
        _dir = new THREE.Vector3(), _q = new THREE.Quaternion(), _UP = new THREE.Vector3(0,1,0);
  // Cập nhật dây + phao: đầu cần (world → local) → điểm câu trước mặt, có độ chùng khi cá đớp
  function updateGear(g, p, ud, t, sag){
    const rod = p.rod; if(!rod) return;
    const a = ud.action;
    const on = (a === 'fish' || a === 'cast' || a === 'reel' || a === 'bite');
    rod.visible = on;
    if(!on){ p.rodSeg.forEach(m=>m.visible=false); p.rodFloat.visible = false; return; }
    g.updateMatrixWorld(true);
    _tipW.set(0, GEAR.tipY, GEAR.tipZ); rod.localToWorld(_tipW); _tipL.copy(_tipW); g.worldToLocal(_tipL);
    const yaw = ud.yaw || 0, dist = a==='cast' ? 1.9 : GEAR.floatZ;
    _fl.set(GEAR.floatX, GEAR.floatY, dist).applyAxisAngle(_UP, yaw);
    _mid.copy(_fl); _mid.y -= sag * (a==='bite' ? 0.18 : 0.42);      // dây chùng
    [[_tipL, _mid], [_mid, _fl]].forEach((pair, i) => {
      const m = p.rodSeg[i];
      _dir.copy(pair[1]).sub(pair[0]);
      const len = _dir.length() || 0.001;
      m.position.copy(pair[0]).addScaledVector(_dir, 0.5);
      m.scale.set(1, len, 1);
      m.quaternion.setFromUnitVectors(_UP, _dir.normalize());
      m.visible = true;
    });
    p.rodFloat.visible = true;
    p.rodFloat.position.copy(_fl);
    p.rodFloat.position.y = GEAR.floatY + (a==='bite' ? Math.abs(Math.sin(t*9))*0.12 : Math.sin(t*1.6)*0.03);
  }

  // ====================== ANIMATION ======================
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  function update(group, dt, time){
    const ud = group.userData, p = ud.parts; if(!p) return;
    if(ud._ph === undefined){ ud._ph = Math.random()*10; ud.mv = 0; ud.yaw = ud.face || 0; ud.blinkAt = 1 + Math.random()*3; }
    const tgt = ud.moving ? 1 : 0;
    ud.mv += (tgt - ud.mv) * Math.min(1, dt*10);
    ud.walkT += dt * (ud.moving ? 9 : 0);
    const mv = ud.mv, w = ud.walkT, sw = Math.sin(w) * 0.7 * mv;
    const idle = 1 - mv;
    const ph = ud._ph, tt = time + ph;

    // quay mặt mượt
    ud.yaw += wrap((ud.face || 0) - ud.yaw) * Math.min(1, dt*14);
    group.rotation.y = ud.yaw;
    group.position.y = Math.abs(Math.cos(w)) * 0.07 * mv;

    // reset pose cơ bản
    p.legL.rotation.set(sw, 0, 0);  p.legR.rotation.set(-sw, 0, 0);
    p.shinL.rotation.set(Math.max(0, -sw)*1.1 * (mv>0.01?1:0), 0, 0); p.shinR.rotation.set(Math.max(0, sw)*1.1 * (mv>0.01?1:0), 0, 0);
    const aL = -sw*0.9 + Math.sin(tt*1.6)*0.03*idle, aR = sw*0.9 - Math.sin(tt*1.6)*0.03*idle;
    p.armL.rotation.set(aL, 0, p.armL.userData.restZ); p.armR.rotation.set(aR, 0, p.armR.userData.restZ);
    p.foreL.rotation.set(-0.15 - Math.max(0, -aL)*0.9, 0, 0); p.foreR.rotation.set(-0.15 - Math.max(0, -aR)*0.9, 0, 0);
    p.body.rotation.set(0, 0, 0); p.body.scale.set(1, 1 + Math.sin(tt*2.2)*0.012*idle, 1);
    p.head.rotation.set(Math.sin(tt*1.1)*0.03*idle + 0.04*mv, Math.sin(tt*0.6)*0.1*idle, 0);
    p.head.position.y = 2.38 + Math.sin(tt*2.2)*0.012*idle + Math.abs(Math.cos(w))*0.03*mv;

    // tóc đung đưa
    const sway = Math.sin(tt*2.0)*0.05*idle + Math.sin(w*2)*0.12*mv;
    if(p.tail){ p.tail.rotation.set(0.55 + 0.25*mv + sway, 0, Math.sin(w)*0.18*mv + Math.sin(tt*1.3)*0.04); }
    [p.tailL, p.tailR].forEach(t => { if(t) t.rotation.set(0.15 + 0.2*mv + sway, 0, t.userData.rz + Math.sin(w + (t===p.tailL?0:1.2))*0.15*mv); });

    // chớp mắt
    ud.blinkAt -= dt;
    let bl = 1;
    if(ud.blinkAt < 0){ const k = -ud.blinkAt; bl = k < 0.07 ? 1 - k/0.07*0.9 : (k < 0.14 ? 0.1 + (k-0.07)/0.07*0.9 : 1); if(k > 0.14) ud.blinkAt = 2 + Math.random()*3.5; }
    p.eyeL.scale.y = bl; p.eyeR.scale.y = bl;

    // ----- hành động -----
    if(ud.action){
      ud.actionT += dt;
      const t = ud.actionT, a = ud.action;
      if(a === 'jump'){
        const u = Math.min(1, t/0.8), h = Math.sin(u*PI) * 1.5;
        group.position.y = h;
        p.legL.rotation.x = -0.5*Math.sin(u*PI); p.legR.rotation.x = -0.5*Math.sin(u*PI);
        p.shinL.rotation.x = 0.9*Math.sin(u*PI); p.shinR.rotation.x = 0.9*Math.sin(u*PI);
        p.armL.rotation.set(-2.6*Math.sin(u*PI), 0, 0.3); p.armR.rotation.set(-2.6*Math.sin(u*PI), 0, -0.3);
      } else if(a === 'sit'){
        // ngồi ghế: hông đúng mặt ghế, đùi ngang, cẳng chân thẳng xuống, tay đặt trên đùi
        const br = Math.sin(tt*1.5)*0.012;                       // thở nhẹ khi ngồi
        group.position.y = 0.06 + br;
        p.legL.rotation.set(-1.44, 0, 0.10); p.legR.rotation.set(-1.44, 0, -0.10);
        p.shinL.rotation.set(1.34, 0, 0);      p.shinR.rotation.set(1.34, 0, 0);
        p.armL.rotation.set(-0.66, 0, 0.17);   p.armR.rotation.set(-0.66, 0, -0.17);
        p.foreL.rotation.set(-0.98, 0, 0);     p.foreR.rotation.set(-0.98, 0, 0);
        p.body.rotation.set(0.10 + br, 0, 0);
        p.head.rotation.set(-0.05, Math.sin(tt*0.7)*0.07, 0);
        if(p.tail) p.tail.rotation.set(0.35, 0, Math.sin(tt*1.2)*0.05);
      } else if(a === 'lotus'){
        // ngồi xếp bằng dưới đất: hông sát mặt đất, hai đầu gối dang ra, cẳng chân vắt chéo trước người
        // (chân phải gác lên trên/phía trước, chân trái nằm dưới), hai tay đặt lên đầu gối, lưng thẳng, thở nhẹ
        const br = Math.sin(tt*1.5)*0.010;
        group.position.y = -0.93 + br;
        p.legR.rotation.set(-1.569, 0.223, 0.379);   p.shinR.rotation.set(1.240, 0.058, -1.545);
        p.legL.rotation.set(-1.567, -0.246, -0.371); p.shinL.rotation.set(1.269, 0.684, 1.492);
        p.armR.rotation.set(0.20, 0, -0.22);         p.foreR.rotation.set(-1.28, 0, 0);
        p.armL.rotation.set(0.20, 0, 0.22);          p.foreL.rotation.set(-1.28, 0, 0);
        p.body.rotation.set(0.05 + br*2, 0, 0);
        p.head.rotation.set(-0.03, Math.sin(tt*0.7)*0.06, 0);
        if(p.tail) p.tail.rotation.set(0.35, 0, Math.sin(tt*1.2)*0.05);
      } else if(a === 'ride'){
        // ngồi xe / cabin: thân hơi cúi, đùi vuông góc, hai tay chống ra trước (vô-lăng / lan can)
        const br = Math.sin(tt*2.4)*0.008;
        group.position.y = br;
        p.legL.rotation.set(-1.52, 0, 0.13); p.legR.rotation.set(-1.52, 0, -0.13);
        p.shinL.rotation.set(1.46, 0, 0);     p.shinR.rotation.set(1.46, 0, 0);
        p.armL.rotation.set(-1.18, 0, 0.30);   p.armR.rotation.set(-1.18, 0, -0.30);
        p.foreL.rotation.set(-0.52, 0, 0);     p.foreR.rotation.set(-0.52, 0, 0);
        p.body.rotation.set(0.16 + br, 0, 0);
        p.head.rotation.set(0.04, 0, 0);
        if(p.tail) p.tail.rotation.set(0.5, 0, Math.sin(tt*2)*0.06);
      } else if(a === 'wave'){
        p.armR.rotation.set(-2.7, 0, -0.25 + Math.sin(t*9)*0.12);
        p.foreR.rotation.x = -0.3 + Math.sin(t*9)*0.4;
        p.head.rotation.z = 0.08; p.body.rotation.z = Math.sin(t*3)*0.02;
      } else if(a === 'cry'){
        p.armL.rotation.set(-2.1, 0, 0.5); p.armR.rotation.set(-2.1, 0, -0.5);
        p.foreL.rotation.x = -1.6; p.foreR.rotation.x = -1.6;
        p.head.rotation.x = 0.25; p.body.rotation.z = Math.sin(t*14)*0.03; p.eyeL.scale.y = 0.45; p.eyeR.scale.y = 0.45;
      } else if(a.startsWith('dance')){
        const n = +a.slice(5) || 1, bt = t*(4.5 + n*0.3);
        group.position.y = Math.abs(Math.sin(bt*2)) * 0.28;
        p.armL.rotation.set(-1.7 + Math.sin(bt)*0.8, 0, 0.5 + Math.sin(bt)*0.4);
        p.armR.rotation.set(-1.7 + Math.cos(bt)*0.8, 0, -0.5 - Math.cos(bt)*0.4);
        p.foreL.rotation.x = -0.6 - Math.sin(bt*2)*0.5; p.foreR.rotation.x = -0.6 + Math.sin(bt*2)*0.5;
        p.legL.rotation.x = Math.sin(bt)*0.5; p.legR.rotation.x = -Math.sin(bt)*0.5;
        p.shinL.rotation.x = Math.max(0, -Math.sin(bt))*0.9; p.shinR.rotation.x = Math.max(0, Math.sin(bt))*0.9;
        p.body.rotation.z = Math.sin(bt)*0.12; p.head.rotation.z = -Math.sin(bt)*0.12;
        p.body.scale.y = 1 + Math.sin(bt*2)*0.04;
        group.rotation.y = ud.yaw + Math.sin(bt*0.7)*0.7;
        if(p.tail) p.tail.rotation.x = 0.4 + Math.sin(bt*2)*0.25;
      } else if(a === 'holla'){
        p.armL.rotation.set(-2.8, 0, 0.2); p.armR.rotation.set(-2.8, 0, -0.2);
        p.foreL.rotation.x = -0.2; p.foreR.rotation.x = -0.2;
        group.position.y = Math.abs(Math.sin(t*8))*0.2;
      }
      // ---------- CÂU CÁ: tay phải cầm cần chĩa ra trước, tay trái đặt lên cuộn dây ----------
      else if(a === 'fish' || a === 'bite' || a === 'reel' || a === 'cast'){
        const tug = a === 'bite' ? Math.max(0, Math.sin(t*9)) : 0;
        const pull = a === 'reel' ? Math.sin(t*11) : 0;
        const cast = a === 'cast' ? Math.max(0, 1 - (t % 2)/0.8) : 0;    // vung tay quăng cần
        // chân: đứng vững hơi khoảng cách, thân hơi cúi về phía trước
        p.legL.rotation.x = -0.12 - tug*0.06; p.legR.rotation.x = 0.1;
        p.shinL.rotation.x = 0.1; p.shinR.rotation.x = 0.06;
        p.body.rotation.x = 0.16 + tug*0.05 + pull*0.03;
        p.body.rotation.y = -0.12;
        // tay phải: đưa cần lên cao, hơi chĩa sang phải; khi cá giật thì cần bật xuống
        p.armR.rotation.set(-0.48 - cast*1.45 + tug*0.30 - pull*0.18, 0, -0.40 - cast*0.45);
        p.foreR.rotation.set(-0.02 + cast*0.85 - tug*0.34 + pull*0.40, 0, 0.12);
        // tay trái: đặt lên cuộn dây, quay nhẹ khi kéo
        p.armL.rotation.set(-0.72 + tug*0.16, 0, 0.34);
        p.foreL.rotation.set(-0.62 + pull*0.5, 0, -0.42);
        p.head.rotation.x = 0.18 - tug*0.06;
        p.head.rotation.y = 0.12;
      }
    }
    // dây câu + phao (vẽ sau khi pose để đầu cần đúng chỗ)
    const sag = ud.action === 'bite' ? 1 : (ud.action === 'reel' ? 0.5 : (ud.action === 'cast' ? 0.2 : 0.8));
    updateGear(group, p, ud, time, sag);
  }

  // ====================== ẢNH XEM TRƯỚC (màn chọn nhân vật) ======================
  let pR = null, pScene = null, pCam = null;
  const pCache = {};
  function preview(gender, idx, w, h){
    w = w || 128; h = h || 160;
    const key = gender + idx + ':' + w + 'x' + h;
    if(pCache[key]) return pCache[key];
    try{
      if(!pR){
        pR = new THREE.WebGLRenderer({ antialias:true, alpha:true, preserveDrawingBuffer:true });
        GFX.setupRenderer(pR, { tone:false });
        pR.setPixelRatio(1); pR.setClearColor(0x000000, 0);
        pScene = new THREE.Scene();
        pScene.add(new THREE.AmbientLight(0xffffff, 0.95*GFX.LI));
        const d = new THREE.DirectionalLight(0xfff2dd, 0.65*GFX.LI); d.position.set(3, 6, 8); pScene.add(d);
        pCam = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
      }
      pR.setSize(w, h); pCam.aspect = w/h; pCam.updateProjectionMatrix();
      pCam.position.set(0, 2.0, 9.0); pCam.lookAt(0, 1.85, 0);
      const b = build(gender, idx); b.group.rotation.y = -0.38;
      b.group.userData.parts = b.parts; b.group.userData.walkT = 0;
      update(b.group, 0.016, 0.0); b.group.rotation.y = -0.38;
      pScene.add(b.group); pR.render(pScene, pCam);
      const url = pR.domElement.toDataURL('image/png');
      pScene.remove(b.group);
      return (pCache[key] = url);
    }catch(e){ console.warn('GChar.preview lỗi:', e); return null; }
  }

  return { DEFS, build, update, preview };
})();
