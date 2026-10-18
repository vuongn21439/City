/* ===== GCITY - Đài phun nước Hoàng Gia (3 tầng, chạm khắc, thiên cầu vàng) =====
 * Dựng bằng khối nguyên thủy Three.js, không asset ngoài.
 * API:  const fx = Fountain.create();      // { group, update(time) }
 *       fx.group.position.set(x, y, z);  scene.add(fx.group);
 *       mỗi frame: fx.update(time_giây);
 *       Fountain.RADIUS = bán kính va chạm (mép bậc ngoài).
 * Kích thước gốc (bản mẫu) bán kính 8.5 → thu bằng SCALE cho vừa quảng trường.
 */
const Fountain = (() => {
  const SCALE = 0.55;
  const RADIUS = 8.5 * SCALE;          // mép bậc đá ngoài cùng

  // Toạ độ bên dưới là hệ "gốc" (chưa nhân SCALE)
  const POOL_Y = 1.75;                 // mặt nước hồ chính
  const MID_Y  = 4.77;                 // mặt nước bồn giữa
  const TOP_Y  = 6.53;                 // mặt nước bồn đỉnh
  const SPH_Y  = 7.2;                  // tâm thiên cầu
  const JET_Y0 = 7.9;                  // điểm bắn tia chính (đỉnh thiên cầu)
  const RING_Y0 = 4.85;                // điểm bắn tia vòng (mép bồn giữa)
  const G_MAIN = 23, G_RING = 20;      // trọng lực (đơn vị/giây²)
  const TAU = Math.PI * 2;

  const rnd = Math.random;
  const mkTex = (c, rx, ry) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; if(rx) t.repeat.set(rx, ry); return t; };
  const cv = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  // mặt nước: vân sáng/tối lượn sóng, lặp liền mạch (vẽ bù ±256 để không lộ đường nối) → trôi chậm theo thời gian
  function makeWaterTex(){
    const c = cv(256, 256, g => {
      g.fillStyle = '#d4e8f5'; g.fillRect(0, 0, 256, 256);
      for(let k=0;k<90;k++){
        const x = rnd()*256, y = rnd()*256, rx = 6+rnd()*18, ry = 3+rnd()*8, rot = rnd()*3.14;
        g.lineWidth = 1.5+rnd()*2; g.strokeStyle = k%3 ? 'rgba(255,255,255,.7)' : 'rgba(110,165,205,.45)';
        for(const dx of [-256,0,256]) for(const dy of [-256,0,256]){ g.beginPath(); g.ellipse(x+dx, y+dy, rx, ry, rot, 0, TAU*0.7); g.stroke(); }
      }
    });
    return mkTex(c, 3, 3);
  }
  // màn nước chảy: các vệt dọc dài ngắn khác nhau, trong suốt giữa các vệt
  function makeCurtainTex(rx){
    const c = cv(128, 256, g => {
      for(let k=0;k<34;k++){
        const x = rnd()*128, w = 2+rnd()*5, y = rnd()*256, len = 70+rnd()*150;
        for(const dy of [-256,0]){ const gr = g.createLinearGradient(0, y+dy, 0, y+dy+len);
          gr.addColorStop(0,'rgba(235,248,255,0)'); gr.addColorStop(.25,'rgba(235,248,255,.85)'); gr.addColorStop(.8,'rgba(215,240,255,.7)'); gr.addColorStop(1,'rgba(215,240,255,0)');
          g.fillStyle = gr; g.fillRect(x, y+dy, w, len); }
      }
    });
    return mkTex(c, rx, 1);
  }
  const rippleTexture = () => mkTex(cv(128, 128, g => {
    const gr = g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,255,255,0)'); gr.addColorStop(.62,'rgba(255,255,255,0)'); gr.addColorStop(.8,'rgba(255,255,255,1)'); gr.addColorStop(.9,'rgba(255,255,255,.35)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }));
  const landY = rt => rt < 1.1 ? TOP_Y : rt < 2.9 ? MID_Y : POOL_Y;
  // quỹ đạo giải tích: bắn từ (cos a·j, y0, sin a·j) lên cao H rồi rơi đúng vào bán kính rt ở độ cao yl
  function ballistic(P, a, rt, H, g, y0, yl, j){
    const v = Math.sqrt(2*g*H), T = v/g + Math.sqrt(2*(y0 + H - yl)/g);
    P.x = Math.cos(a)*j; P.z = Math.sin(a)*j; P.y = y0; P.vx = Math.cos(a)*rt/T; P.vz = Math.sin(a)*rt/T; P.vy = v; P.g = g; P.T = T;
  }
  // 1 lớp hạt: N hạt, mỗi hạt có quỹ đạo riêng do spawn(i, P) điền vào; hết đời thì nối tiếp quỹ đạo mới, không giật
  function layer(N, size, spawn){
    const pos = new Float32Array(N*3), S = new Float32Array(N*8), born = new Float32Array(N), P = {};   // S: x0 y0 z0 vx vy vz g T
    const sp = i => { spawn(i, P); S.set([P.x,P.y,P.z,P.vx,P.vy,P.vz,P.g,P.T], i*8); };
    for(let i=0;i<N;i++){ sp(i); pos[i*3+1] = -50; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size, map:dotTexture(), transparent:true, opacity:1, depthWrite:false }));
    pts.frustumCulled = false;
    let ready = false;
    function update(time){
      if(!ready){ for(let i=0;i<N;i++) born[i] = time - rnd()*S[i*8+7]; ready = true; }
      for(let i=0;i<N;i++){
        const o = i*8; let t = time - born[i], T = S[o+7];
        if(t >= T){
          const stale = t - T > 0.25;
          if(!stale) born[i] += T;
          sp(i); T = S[o+7];
          if(stale) born[i] = time - rnd()*T;
          t = Math.max(0, time - born[i]);
        }
        pos[i*3] = S[o] + S[o+3]*t; pos[i*3+1] = S[o+1] + S[o+4]*t - 0.5*S[o+6]*t*t; pos[i*3+2] = S[o+2] + S[o+5]*t;
      }
      geo.attributes.position.needsUpdate = true;
    }
    return { pts, update };
  }

  let dotTex = null;
  function dotTexture(){               // chấm tròn mềm cho hạt nước (thay cho ô vuông mặc định của Points)
    if(dotTex) return dotTex;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), grad = g.createRadialGradient(32,32,0,32,32,32);
    // lõi trắng xanh + viền xanh ngọc đậm hơn → nổi rõ trên nền gạch kem sáng của quảng trường (màu thuần trắng bị chìm)
    grad.addColorStop(0,'rgba(240,252,255,1)'); grad.addColorStop(0.4,'rgba(125,218,248,0.95)'); grad.addColorStop(0.8,'rgba(60,170,230,0.55)'); grad.addColorStop(1,'rgba(60,170,230,0)');
    g.fillStyle = grad; g.fillRect(0,0,64,64);
    dotTex = new THREE.CanvasTexture(c);
    return dotTex;
  }

  // InstancedMesh: gộp nhiều chi tiết lặp lại (họa tiết, rãnh cột, con sơn) vào 1 draw call
  function instanced(geo, mat, items, shadow){
    const m = new THREE.InstancedMesh(geo, mat, items.length);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1,1,1), p = new THREE.Vector3(), e = new THREE.Euler();
    items.forEach((it, i) => {
      e.set(it.rx||0, it.ry||0, it.rz||0, 'YXZ');            // Ry·Rx·Rz: xoay quanh trục đứng sau khi nghiêng theo trục tiếp tuyến
      q.setFromEuler(e); p.set(it.x, it.y, it.z);
      m.setMatrixAt(i, mx.compose(p, q, sc));
    });
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;                                   // bounding sphere của InstancedMesh (r128) không tính các instance
    m.castShadow = !!shadow; m.receiveShadow = true;
    return m;
  }

  function create(){
    const root = new THREE.Group();
    const body = new THREE.Group(); body.scale.setScalar(SCALE); root.add(body);

    // ---- vật liệu (Lambert cho nhẹ trên điện thoại, màu khớp tông pastel của công viên) ----
    const L = (c, extra) => new THREE.MeshLambertMaterial(Object.assign({ color:c }, extra||{}));
    const marble = L(0xece8dc), carved = L(0xd6d0c0), dark = L(0xa8a396), stone1 = L(0xd9d3c4), stone2 = L(0xe6e0d2), stoneRim = L(0xb3ac9c);
    const gold = L(0xd9a93a, { emissive:0x3d2a05 });
    const water = L(0x3aa6da, { transparent:true, opacity:0.93, map:makeWaterTex() });   // xanh sâu hơn: ánh sáng game (ambient .85 + sun .6) làm màu sáng bị cháy thành cyan phẳng

    const add = (geo, mat, x, y, z, o) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
      o = o || {};
      if(o.rx) m.rotation.x = o.rx;
      m.castShadow = !!o.cast; m.receiveShadow = o.recv !== false;
      body.add(m); return m;
    };
    const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg || 40);
    const tor = (R, r, ts) => new THREE.TorusGeometry(R, r, 10, ts || 48);

    // ---- bậc thềm đá ----
    add(cyl(8.2, 8.5, 0.3, 48), stone1, 0, 0.15, 0, { cast:true });
    add(tor(8.35, 0.08), stoneRim, 0, 0.3, 0, { rx:Math.PI/2 });
    add(cyl(7.3, 7.6, 0.3, 48), stone2, 0, 0.45, 0, { cast:true });

    // ---- hồ chính ----
    add(cyl(6.2, 6.4, 1.2, 48), marble, 0, 1.05, 0, { cast:true });
    const reliefs = [];                                        // họa tiết chạm nổi quanh thân hồ (32 tấm)
    for(let i=0;i<32;i++){ const a = i/32*TAU; reliefs.push({ x:Math.cos(a)*6.33, y:1.05, z:Math.sin(a)*6.33, ry:-a }); }
    body.add(instanced(new THREE.BoxGeometry(0.16, 0.6, 0.5), carved, reliefs, false));
    add(tor(6.3, 0.22), gold, 0, 1.68, 0, { rx:Math.PI/2 });
    add(tor(6.45, 0.15), marble, 0, 0.55, 0, { rx:Math.PI/2 });
    add(cyl(6.02, 6.02, 0.1, 48), water, 0, 1.7, 0, { cast:false });   // nước cao hơn nắp hồ 0.05 → không bị z-fighting

    // ---- cột trung tâm + rãnh dọc thân (nghiêng theo độ thon của cột) ----
    add(cyl(0.65, 0.85, 3.5, 28), marble, 0, 2.9, 0, { cast:true });
    const taper = Math.atan(0.2/3.5), flutes = [];
    for(let i=0;i<12;i++){ const a = i/12*TAU; flutes.push({ x:Math.cos(a)*0.75, y:2.9, z:Math.sin(a)*0.75, ry:-a, rz:taper }); }
    body.add(instanced(new THREE.BoxGeometry(0.1, 3.3, 0.1), carved, flutes, false));
    add(tor(0.83, 0.07, 32), gold, 0, 2.9, 0, { rx:Math.PI/2 });

    // ---- 4 cột phụ + đầu cột vàng (chạm tới đáy bồn giữa) ----
    for(let i=0;i<4;i++){ const a = i/4*TAU, x = Math.cos(a)*1.3, z = Math.sin(a)*1.3;
      add(cyl(0.22, 0.28, 2.9, 18), dark, x, 2.6, z, { cast:true });
      add(cyl(0.32, 0.22, 0.2, 18), gold, x, 4.15, z);
    }

    // ---- bồn giữa + 8 con sơn đỡ (nghiêng đúng theo trục tiếp tuyến, lệch 22.5° so với cột phụ) ----
    add(cyl(3.3, 1.1, 0.55, 44), marble, 0, 4.4, 0, { cast:true });
    const brackets = [];
    for(let i=0;i<8;i++){ const a = (i+0.5)/8*TAU; brackets.push({ x:Math.cos(a)*1.0, y:3.95, z:Math.sin(a)*1.0, ry:-a, rz:-0.6 }); }
    body.add(instanced(new THREE.BoxGeometry(0.22, 0.9, 0.5), carved, brackets, true));
    add(tor(3.35, 0.18), gold, 0, 4.7, 0, { rx:Math.PI/2 });
    add(cyl(3.12, 3.12, 0.1, 44), water, 0, 4.72, 0, { cast:false });

    // ---- tầng đỉnh (có nước, bản mẫu để trống) ----
    add(cyl(0.35, 0.45, 1.5, 22), marble, 0, 5.45, 0, { cast:true });
    add(cyl(1.3, 0.45, 0.45, 30), marble, 0, 6.25, 0, { cast:true });
    add(tor(1.32, 0.1, 32), gold, 0, 6.5, 0, { rx:Math.PI/2 });
    add(cyl(1.18, 1.18, 0.06, 30), water, 0, 6.5, 0, { cast:false });

    // ---- thiên cầu vàng (có cuống nối xuống bồn đỉnh) ----
    add(cyl(0.08, 0.12, 0.7, 12), gold, 0, 6.85, 0, { cast:true });
    const sphere = new THREE.Group(); sphere.position.y = SPH_Y; body.add(sphere);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.25, 18, 14), gold); core.castShadow = true; sphere.add(core);
    for(let i=0;i<3;i++){
      const ring = new THREE.Mesh(tor(0.45 + i*0.08, 0.03, 32), gold);
      ring.rotation.x = i*Math.PI/3; ring.rotation.y = i*Math.PI/4; sphere.add(ring);
    }

    // ---- mặt nước dùng chung 1 texture: co UV theo bán kính để mật độ vân bằng nhau ở hồ, bồn giữa, bồn đỉnh ----
    body.children.forEach(m => { if(m.material === water){
      const k = m.geometry.parameters.radiusTop/6.02, uv = m.geometry.attributes.uv;
      for(let i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*k, uv.getY(i)*k);
    } });

    // ---- thác nước tràn từ bồn giữa xuống hồ, và từ bồn đỉnh xuống bồn giữa ----
    const curtainMat = (tex) => new THREE.MeshBasicMaterial({ map:tex, color:0xa5dcf5, transparent:true, opacity:0.9, side:THREE.DoubleSide, depthWrite:false });
    const tex1 = makeCurtainTex(14), tex2 = makeCurtainTex(7);
    const c1 = new THREE.Mesh(new THREE.CylinderGeometry(3.38, 3.62, MID_Y-0.07-POOL_Y, 64, 1, true), curtainMat(tex1)); c1.position.y = (MID_Y-0.07+POOL_Y)/2;
    const c2 = new THREE.Mesh(new THREE.CylinderGeometry(1.34, 1.5, TOP_Y-0.03-MID_Y, 40, 1, true), curtainMat(tex2)); c2.position.y = (TOP_Y-0.03+MID_Y)/2;
    body.add(c1, c2);

    // ---- tia nước có hình: cột giữa cao + vương miện 12 tia (xen kẽ xa/gần) + 24 tia vòng xoắn nhẹ + lớp giọt phun ngẫu nhiên ----
    const layers = [
      layer(900, 0.13, (i, P) => {
        if(i%4 === 0) return ballistic(P, rnd()*TAU, 0.3*rnd(), 3.8 + rnd()*0.9, G_MAIN, JET_Y0, TOP_Y, rnd()*0.05);
        const n = (rnd()*12)|0, a = n/12*TAU + (rnd()-0.5)*0.03, far = n%2 === 0;
        ballistic(P, a, far ? 4.3 + rnd()*0.9 : 2.0 + rnd()*0.7, (far ? 2.4 : 1.6) + rnd()*0.25, G_MAIN, JET_Y0, far ? POOL_Y : MID_Y, rnd()*0.04);
      }),
      layer(220, 0.22, (i, P) => { const rt = 5.3*Math.pow(rnd(), 1.6); ballistic(P, rnd()*TAU, rt, 3.0 + rnd()*1.7, G_MAIN, JET_Y0, landY(rt), rnd()*0.06); }),
      layer(480, 0.14, (i, P) => {
        const n = (rnd()*24)|0, a = n/24*TAU, r0 = 2.9, rt = 4.6 + (n%2)*0.9 + (rnd()-0.5)*0.15, T = 1.0 + (n%2)*0.1 + rnd()*0.04, tw = a + 0.12;
        P.x = Math.cos(a)*r0; P.z = Math.sin(a)*r0; P.y = RING_Y0;
        P.vx = (Math.cos(tw)*rt - P.x)/T; P.vz = (Math.sin(tw)*rt - P.z)/T; P.vy = (POOL_Y - RING_Y0 + 0.5*G_RING*T*T)/T; P.g = G_RING; P.T = T;
      })
    ];
    layers.forEach(l => body.add(l.pts));

    // ---- gợn sóng lan toả + giọt bắn tại chỗ nước rơi (36 điểm, 1 draw call + 1 lớp hạt) ----
    const R = 36, SPL = 5, LP = { x:0, y:0, z:0, m:0 };
    const rs = { x:new Float32Array(R), y:new Float32Array(R), z:new Float32Array(R), b:new Float32Array(R), l:new Float32Array(R), m:new Float32Array(R) };
    const sv = new Float32Array(R*SPL*3), spPos = new Float32Array(R*SPL*3);
    const ripGeo = new THREE.PlaneGeometry(1, 1); ripGeo.rotateX(-Math.PI/2);
    const ripples = new THREE.InstancedMesh(ripGeo, new THREE.MeshBasicMaterial({ map:rippleTexture(), transparent:true, blending:THREE.AdditiveBlending, depthWrite:false }), R);
    ripples.frustumCulled = false; body.add(ripples);
    const mx = new THREE.Matrix4(), cc = new THREE.Color();
    for(let i=0;i<R;i++) ripples.setColorAt(i, cc.setRGB(0,0,0));
    const splGeo = new THREE.BufferGeometry(); splGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    const splash = new THREE.Points(splGeo, new THREE.PointsMaterial({ color:0xffffff, size:0.11, map:dotTexture(), transparent:true, depthWrite:false }));
    splash.frustumCulled = false; body.add(splash);
    function landing(){
      const u = rnd(), a = rnd()*TAU; let r, y, m;
      if(u < 0.18){ r = 1.0*Math.sqrt(rnd()); y = TOP_Y; m = 0.9; } else if(u < 0.45){ r = 1.3 + 1.5*rnd(); y = MID_Y; m = 1.5; } else { r = 3.4 + 2.3*rnd(); y = POOL_Y; m = 2.4; }
      LP.x = Math.cos(a)*r; LP.z = Math.sin(a)*r; LP.y = y + 0.04; LP.m = m;
    }
    function ripple(i, time){
      landing(); rs.x[i] = LP.x; rs.y[i] = LP.y; rs.z[i] = LP.z; rs.m[i] = LP.m; rs.b[i] = time; rs.l[i] = 0.8 + rnd()*0.6;
      for(let j=0;j<SPL;j++){ const q = (i*SPL + j)*3; sv[q] = (rnd()-0.5)*1.6; sv[q+1] = 1.6 + rnd()*1.2; sv[q+2] = (rnd()-0.5)*1.6; }
    }

    let ready = false;
    function update(time){
      if(!ready){ for(let i=0;i<R;i++){ ripple(i, time); rs.b[i] = time - rnd()*rs.l[i]; } ready = true; }
      sphere.rotation.y = time*0.3;
      layers.forEach(l => l.update(time));
      for(let i=0;i<R;i++){
        let age = time - rs.b[i];
        if(age >= rs.l[i] || age < 0){ ripple(i, time); age = 0; }
        const k = age/rs.l[i], s = 0.25 + k*rs.m[i], f = (1-k)*(1-k)*0.85;
        mx.makeScale(s, 1, s).setPosition(rs.x[i], rs.y[i], rs.z[i]);
        ripples.setMatrixAt(i, mx); ripples.setColorAt(i, cc.setRGB(f, f, f));
        for(let j=0;j<SPL;j++){ const q = (i*SPL + j)*3;
          if(age < 0.5){ spPos[q] = rs.x[i] + sv[q]*age; spPos[q+1] = rs.y[i] + sv[q+1]*age - 6*age*age; spPos[q+2] = rs.z[i] + sv[q+2]*age; }
          else spPos[q+1] = -50; }
      }
      ripples.instanceMatrix.needsUpdate = true; ripples.instanceColor.needsUpdate = true; splGeo.attributes.position.needsUpdate = true;
      tex1.offset.y = (time*0.9) % 1; tex2.offset.y = (time*0.7 + 0.3) % 1;       // thác chảy xuống
      water.map.offset.set((time*0.012) % 1, (time*0.008) % 1);                     // mặt nước trôi
    }

    // glow: các vật liệu sẽ sáng lên ban đêm (nước + vàng ánh sáng)
    return { group: root, update, glow: [water, gold] };
  }

  return { create, RADIUS, SCALE, POOL_Y, MID_Y, TOP_Y };
})();
