/* ===== GCITY 3D - Three.js Scene =====
 * Toàn bộ 3D dựng bằng hình khối nguyên thủy (không asset ngoài).
 * API: Scene3D.init(), buildZone(), createCharacter(), updatePlayer(), camera, collision.
 */
const Scene3D = (() => {
  let scene, camera, renderer;
  let container;
  let worldGroup;      // group chứa zone hiện tại
  let characters = {}; // id -> {group, parts, action, actionT}
  // Camera third-person kiểu "Quảng trường Mini": xoay (yaw) + nghiêng (pitch) + zoom (dist) quanh nhân vật
  const CAM = { fov:55, lookY:1.5, pitch0:0.5, dist0:13, minPitch:0.1, maxPitch:1.5,
                minDist:5, maxDist:120,   // maxDist bị chặn bởi sương mù (Fog 110→260)
                rotX:0.006, rotY:0.005, follow:0.2 };
  const camClamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const setCamDist = d => { camDist = camClamp(d, CAM.minDist, CAM.maxDist); };
  let camAngle = 0, camPitch = CAM.pitch0, camDist = CAM.dist0;
  let camFollowHeading = false, camFollowOffset = 0, camDragT = 0;
  const CAM_RECENTER_DELAY = 1400, CAM_RECENTER_RATE = 2.2;   // lái máy bay: thả tay kéo camera ~1.4s thì camera tự quay về sau lưng máy bay
  const camTarget = new THREE.Vector3(), camPtr = new Map();
  let camSnap = true, camLastT = 0, camLastX = 0, camLastZ = 0;
  let curZoneId = 'plaza', tapHandler = null;   // tapHandler(clientX, clientY): gọi khi chạm/click nhanh (không kéo) lên màn hình 3D
  // Độ phân giải thích ứng: bắt đầu ở mật độ điểm ảnh gốc của máy (tối đa 3x), tự hạ khi FPS < 24. Thêm ?res=1.5 vào URL để ép cố định.
  const RES = { max:Math.min(window.devicePixelRatio||1, 3), min:1, cur:1, n:0, t:0, low:0, warm:true, fixed:false };
  const maxAniso = () => Math.min(8, renderer.capabilities.getMaxAnisotropy());   // nền gạch không bị nhoè khi nhìn xiên
  let waterMesh = null, fountainFx = null;
  let screenInfo = null, screenCanvas = null, screenTex = null, spinners = [];
  let ferris = null, racers = [], raceCanvas = null, raceTex = null;
  const FERRIS_SPEED = 0.2;                                          // rad/giây
  const FERRIS_CAB = { floor:-2.62, seat:{ x:0, y:-2.90, z:0.10 }, yaw:Math.PI };  // mặt sàn cabin + gốc chân nhân vật khi ngồi (toạ độ cục bộ so với chốt treo)
  let lotSlots = [], lotTaken = {}, lotBadge = null, lotBadgeOn = true;   // bãi thuê xe: 4 xe + 2 máy bay (lotTaken giữ trạng thái khi dựng lại zone)

  // Dữ liệu nhân vật (7 nam + 6 nữ) nằm trong js/character.js
  const CHAR_DEFS = GChar.DEFS;

  const ZONES = {
    plaza: { size:60, buildings:[
      { x:-22, z:-22, w:10, h:8, d:10, color:0x8b4513, roof:0x5a2d0c, type:'cinema', name:'Rạp chiếu phim' },
      { x:22, z:-22, w:10, h:9, d:10, color:0x4a5568, roof:0x2d3748, type:'lottery', name:'Số may mắn' },
      { x:-22, z:22, w:9, h:7, d:9, color:0x2b6cb0, roof:0x1a365d, type:'rental', name:'Thuê đồ' },
      { x:22, z:22, w:9, h:7, d:9, color:0x9f1239, roof:0x500724, type:'shop', name:'Cửa hàng' },
    ], trees:[
      {x:-12,z:-8},{x:-6,z:-16},{x:8,z:-14},{x:14,z:-6},{x:-14,z:8},{x:-8,z:14},{x:6,z:16},{x:14,z:10},{x:0,z:-18},{x:18,z:0}
    ], benches:[{x:-8,z:0},{x:8,z:0},{x:0,z:-8},{x:0,z:8}], fountain:{x:0,z:0}, lamps:[{x:-18,z:0},{x:18,z:0},{x:0,z:-18},{x:0,z:18}],
      portal:{x:0,z:29,w:6,d:3,to:'fishing',label:'🚤 Đảo câu cá'}, spawn:{x:0,z:10} },
    // Đảo câu cá (v20): hình dáng, dừa, chòi, bến chữ T, thuyền... do js/island.js dựng + tính va chạm; ở đây chỉ khai báo dữ liệu logic
    fishing: { size:60, island:true, buildings:[], trees:[], benches:[], fountain:null, lamps:[],
      portal:{x:3,z:-30.2,w:3.2,d:1.2,to:'plaza',label:'🚤 Quảng trường'}, spawn:{x:2.6,z:-5} }
  };

  ZONES.plaza.name = 'Công viên GCITY'; ZONES.fishing.name = 'Đảo câu cá';
  const H = Math.PI/2, P2 = a=>a.map(([x,z])=>({x,z}));
  const Bd = (x,z,w,d,h,ry,color,roof,type,name)=>({x,z,w,d,h,ry,color,roof,type,name});
  Object.assign(ZONES.plaza, {
    size:104, race:{x:42.4,z:0,rin:1.7,rout:8,hs:9.6,ro:8.6,lanes:7}, rentLot:{x:-42,z:3}, wheel:{x:15.5,z:42,r:3,R:7.5,h:10.2,rz:1.2,fx:4.6,fz:1.75}, spawn:{x:0,z:9}, portal:{x:0,z:37,w:6,d:3,to:'fishing',label:'🚤 Đảo câu cá'},
    buildings:[
      Bd(-22,-27,10,6,8,0,0xe8876f,0xc96a55,'shop','SUNNY MART'), Bd(22,-27,10,6,10,0,0x8b72c8,0x6a53a8,'lottery','SỐ MAY MẮN'),
      Bd(-27,-9,6,10,9,H,0x4fa3ab,0x2f7f88,'cinema','RẠP PHIM'), Bd(-27,9,6,8,6,H,0x6fb7b0,0x3f8f8c,'fishshop','ĐẢO CÂU CÁ'),
      Bd(27,-9,6,10,10,-H,0xd77aa0,0xb55a82,'shop','PIZZA HOUSE'), Bd(27,9,6,10,8,-H,0xf0a35e,0xcf8040,'rental','THUÊ ĐỒ'),
      Bd(-22,27,10,6,9,Math.PI,0x8b72c8,0x6a53a8,'shop','MOON CAFE'), Bd(22,27,10,6,8,Math.PI,0x4fa3ab,0x2f7f88,'shop','HAPPY TOYS'),
    ],
    trees:P2([[-12,-12],[12,-12],[-12,12],[12,12],[-13,-4],[13,-4],[-13,4],[13,4],[-10.5,27],[10.5,27],[-10.5,33.5],[10.5,33.5]]),
    lamps:P2([[-15.5,-9],[-15.5,9],[15.5,-9],[15.5,9],[-6,-15.5],[6,-15.5],[-6,15.5],[6,15.5],
      [-4.6,26],[4.6,26],[-36.2,-10.8],[-36.2,16.8],[26,-4.6],[26,4.6]]),
    flowers:P2([[-6.5,-12.5],[6.5,-12.5],[-6.5,12.5],[6.5,12.5],[-7.4,35],[7.4,35]]),
    benches:[], fountain:{x:0,z:0},
    screen:{x:0, z:-37.5, w:16, h:9, y:1.4}
  });
  // đèn bổ sung cho ban đêm (v20): quanh sân khấu, vỉa hè ngoài đường vòng, sân cổng tàu, vòng quay, hai bên trường đua
  // (4 đèn vỉa hè ngoài đặt ở x=±23.3 = giữa dải vỉa hè ngoài của đường vòng vuông của City-main)
  [[-12.5,-27],[12.5,-27],[-23.3,-16],[23.3,-16],[-23.3,16],[23.3,16],[-8,36],[8,36],[8,46],[23,46],[32,-12],[32,12]].forEach(([lx,lz])=>ZONES.plaza.lamps.push({x:lx,z:lz}));
  [[-7,-7],[7,-7],[-7,7],[7,7]].forEach(([bx,bz])=>ZONES.plaza.benches.push({x:bx, z:bz, ry:Math.atan2(-bx,-bz)}));
  [-9,-4.5,4.5,9].forEach(bx=>ZONES.plaza.benches.push({x:bx, z:-29, ry:Math.PI})); // ghế hàng 1 hướng về màn hình
  [-9,-4.5,4.5,9].forEach(bx=>ZONES.plaza.benches.push({x:bx, z:-26.5, ry:Math.PI})); // ghế hàng 2
  [-9,-4.5,4.5,9].forEach(bx=>ZONES.plaza.benches.push({x:bx, z:-24, ry:Math.PI}));   // ghế hàng 3
  [[-5.4,30.5,Math.PI/2],[5.4,30.5,-Math.PI/2],                                   // 2 ghế đối diện dọc lối ra cổng tàu
   [-18.8,42,Math.PI/2],[-12.2,42,-Math.PI/2],[-15.5,44.8,Math.PI],[-15.5,39.2,0]]   // 4 ghế quanh bàn khu nghỉ chân
    .forEach(([bx,bz,ry])=>ZONES.plaza.benches.push({x:bx, z:bz, ry}));

  function init(cont){
    container = cont;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfe9f4);
    scene.fog = new THREE.Fog(0xbfe9f4, 110, 260);

    camera = new THREE.PerspectiveCamera(CAM.fov, window.innerWidth/window.innerHeight, 0.1, 400);
    renderer = new THREE.WebGLRenderer({ antialias:true });
    GFX.setupRenderer(renderer);   // sRGB + tone mapping (three r186) — thêm ?legacy=1 vào URL để xem lại kiểu màu cũ
    const qRes = parseFloat(new URLSearchParams(location.search).get('res'));
    if(qRes > 0){ RES.max = camClamp(qRes, 0.5, 3); RES.fixed = true; }
    RES.cur = RES.max; renderer.setPixelRatio(RES.cur);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;   // từ r182 PCFShadowMap đã là bóng mềm (PCFSoftShadowMap bị bỏ)
    container.appendChild(renderer.domElement);

    // lights
    // Ánh sáng cân bằng: tổng ~1.0 ở mặt nằm ngang (trước đây 0.85 + 0.48 = 1.33 → gạch/nền bị cháy sáng thành trắng)
    // r155+: đèn dùng đơn vị vật lý → nhân GFX.LI (=π) để giữ đúng độ sáng như thiết kế gốc
    hemi = new THREE.HemisphereLight(0xeaf6ff, 0xcfb894, 0.30*GFX.LI); scene.add(hemi);
    ambient = new THREE.AmbientLight(0xffffff, 0.32*GFX.LI); scene.add(ambient);
    sun = new THREE.DirectionalLight(0xfff1d6, 0.52*GFX.LI);
    sun.position.set(20, 30, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048,2048);
    sun.shadow.camera.left=-60; sun.shadow.camera.right=60;
    sun.shadow.camera.top=60; sun.shadow.camera.bottom=-60; sun.shadow.camera.far=200;
    sun.shadow.normalBias = 0.03;   // chống "răng cưa bóng" (shadow acne) với bóng PCF mới
    scene.add(sun);
    buildSky();          // sao + trăng cho ban đêm
    followClock();       // trời bắt đầu đúng theo giờ thiết bị

    // camera orbit: kéo 1 ngón/chuột = xoay + nghiêng; lăn chuột / chụm 2 ngón = zoom
    const cv = renderer.domElement;
    cv.style.touchAction = 'none';   // chặn trình duyệt cuộn/zoom trang khi kéo trên canvas
    const tapInfo = new Map();   // pointerId -> {x,y,t,ok}: phân biệt "chạm" với "kéo xoay camera"
    cv.addEventListener('pointerdown', e=>{
      if(e.pointerType==='mouse'){ camPtr.clear(); tapInfo.clear(); }
      try{ cv.setPointerCapture(e.pointerId); }catch(_){}
      camPtr.set(e.pointerId, [e.clientX, e.clientY]);
      if(camPtr.size>1) tapInfo.forEach(t=>{ t.ok = false; });   // 2 ngón (zoom) thì không tính là chạm
      tapInfo.set(e.pointerId, { x:e.clientX, y:e.clientY, t:performance.now(), ok:camPtr.size===1 });
    });
    cv.addEventListener('pointermove', e=>{
      const p = camPtr.get(e.pointerId); if(!p) return;
      const ti = tapInfo.get(e.pointerId); if(ti && Math.hypot(e.clientX-ti.x, e.clientY-ti.y) > 10) ti.ok = false;
      if(camPtr.size===1){
        const dx = (e.clientX-p[0])*CAM.rotX;
        camAngle -= dx;
        if(camFollowHeading){ camFollowOffset -= dx; camDragT = performance.now(); }
        camPitch = camClamp(camPitch + (e.clientY-p[1])*CAM.rotY, CAM.minPitch, CAM.maxPitch);
      } else if(camPtr.size===2){
        const o = [...camPtr.entries()].find(q=>q[0]!==e.pointerId)[1];
        const d0 = Math.hypot(p[0]-o[0], p[1]-o[1]), d1 = Math.hypot(e.clientX-o[0], e.clientY-o[1]);
        if(d1>1) setCamDist(camDist*d0/d1);
      }
      p[0]=e.clientX; p[1]=e.clientY;
    });
    const camPtrEnd = e=>{ camPtr.delete(e.pointerId); tapInfo.delete(e.pointerId); };
    cv.addEventListener('pointerup', e=>{
      const ti = tapInfo.get(e.pointerId);
      camPtrEnd(e);
      if(ti && ti.ok && tapHandler && e.button===0 && performance.now()-ti.t < 500) tapHandler(e.clientX, e.clientY);
    });
    cv.addEventListener('pointercancel', camPtrEnd);
    cv.addEventListener('lostpointercapture', camPtrEnd);
    window.addEventListener('blur', ()=>{ camPtr.clear(); tapInfo.clear(); });   // tránh kẹt trạng thái "đang kéo" khi mất focus
    cv.addEventListener('wheel', e=>{ setCamDist(camDist*(1+(e.deltaMode===1? e.deltaY*33 : e.deltaY)*0.001)); }, {passive:true});
    window.addEventListener('resize', ()=>{
      camera.aspect = window.innerWidth/window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ===== WORLD BUILDING =====
  function makeGroundTexture(color1, color2){
    const c = document.createElement('canvas'); c.width=c.height=256;
    const g = c.getContext('2d');
    g.fillStyle='#'+color1.toString(16).padStart(6,'0'); g.fillRect(0,0,256,256);
    g.fillStyle='#'+color2.toString(16).padStart(6,'0');
    for(let i=0;i<256;i+=32){ for(let j=0;j<256;j+=32){ if((i+j)%64===0) g.fillRect(i,j,32,32); } }
    const tex = new THREE.CanvasTexture(c); tex.wrapS=tex.wrapT=THREE.RepeatWrapping; tex.repeat.set(8,8); tex.anisotropy=maxAniso();
    return tex;
  }

  function tileTex(c1,c2,rx,ry){
    const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
    g.fillStyle=c1; g.fillRect(0,0,128,128); g.fillStyle=c2; g.fillRect(0,0,64,64); g.fillRect(64,64,64,64);
    g.strokeStyle='rgba(120,70,40,.18)'; g.lineWidth=2; g.strokeRect(0,0,128,128);
    const t=new THREE.CanvasTexture(c); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(rx,ry); t.anisotropy=maxAniso(); return t;
  }
  // ===== Gộp nhiều khối thành 1 mesh (màu theo đỉnh): 1 toà nhà (hàng trăm hộp) hoặc 1 cây (~7 khối) → 1 draw call =====
  const _boxG = new THREE.BoxGeometry(1,1,1);
  const _bMat = new THREE.MeshLambertMaterial({ vertexColors:true });
  const _gMat = new THREE.MeshBasicMaterial({ vertexColors:true });   // cửa sổ/cửa hàng sáng lên ban đêm
  const tint = (hex,k)=>{ const r=Math.min(255,((hex>>16)&255)*k)|0, g=Math.min(255,((hex>>8)&255)*k)|0, b=Math.min(255,(hex&255)*k)|0; return (r<<16)|(g<<8)|b; };
  function makeBatch(mat){
    const pos=[], nor=[], col=[], idx=[]; let vc=0;
    const v=new THREE.Vector3(), n=new THREE.Vector3(), c=new THREE.Color(), nm=new THREE.Matrix3(), m4=new THREE.Matrix4();
    const api = {
      geo(g, mat, hex){
        c.setHex(hex); nm.getNormalMatrix(mat);
        const P=g.attributes.position, N=g.attributes.normal, I=g.index;
        for(let i=0;i<P.count;i++){
          v.fromBufferAttribute(P,i).applyMatrix4(mat); n.fromBufferAttribute(N,i).applyMatrix3(nm).normalize();
          pos.push(v.x,v.y,v.z); nor.push(n.x,n.y,n.z); col.push(c.r,c.g,c.b);
        }
        if(I) for(let i=0;i<I.count;i++) idx.push(I.getX(i)+vc); else for(let i=0;i<P.count;i++) idx.push(i+vc);
        vc += P.count; return api;
      },
      box(w,h,d,x,y,z,hex){ m4.makeScale(w,h,d); m4.setPosition(x,y,z); return api.geo(_boxG,m4,hex); },
      build(){
        const g=new THREE.BufferGeometry();
        g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
        g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
        g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
        g.setIndex(vc>65535 ? new THREE.Uint32BufferAttribute(idx,1) : new THREE.Uint16BufferAttribute(idx,1));
        const mesh=new THREE.Mesh(g,mat); mesh.castShadow=mesh.receiveShadow=true; return mesh;
      }
    };
    return api;
  }
  const Batch = ()=>makeBatch(_bMat);
  const GlowBatch = ()=>makeBatch(_gMat);        // batch thứ hai cho cửa sổ sáng ban đêm

  // ============================================================
  // ===== BAN ĐÊM / BAN NGÀY: đổi màu trời + ánh sáng, bật đèn đường, cửa sổ, đèn quầy, đài phun =====
  // ============================================================
  // nightReg: danh sách vật thể "phản ứng theo đêm", mỗi mục {o, mode}
  //   basic    – MeshBasic: tắt ban ngày, sáng dần lên ban đêm (giữ sắc gốc × k)
  //   emissive – Lambert có emissive: đêm tăng sáng, ngày trở về bình thường
  //   pool     – quầng sáng trên mặt đất (additive): chỉ hiện ban đêm
  //   sea/shallow/foam – mặt nước đảo đổi màu theo đêm
  let nightReg = [];
  let animFns = [];            // hàm chạy mỗi khung (sóng biển, thuyền nhấp nhô…) do zone đăng ký
  let nightDirty = false;      // true khi vừa dựng zone mới → áp lại ngày/đêm cho zone đó
  // ===== NGÀY / ĐÊM THEO GIỜ THIẾT BỊ =====
  // k: 0 = ban ngày, 1 = ban đêm. target lấy từ đồng hồ máy, đổi mượt ~1,2s nên không bị giật.
  //   06:00→07:30 bình minh (1→0) · 07:30→17:00 ban ngày · 17:00→19:00 hoàng hôn (0→1) · 19:00→06:00 ban đêm
  const DN = { k:0, target:0, manual:false, warm:0 };
  const CLOCK = (()=>{ let h = new Date().getHours() + new Date().getMinutes()/60; return {
    hour: ()=> h,
    sync(){ const d = new Date(); h = d.getHours() + d.getMinutes()/60; return h; } }; })();
  function clockNightK(t){
    if(t < 6)  return 1;                 // nửa đêm → 6h
    if(t < 7.5) return 1 - (t-6)/1.5;    // bình minh
    if(t < 17)  return 0;                // ban ngày
    if(t < 19)  return (t-17)/2;         // hoàng hôn
    return 1;                            // tối
  }
  let hemi, ambient, sun, stars, moonGlow, moonDisc, sunDir = new THREE.Vector3(20,30,10), moonDir = new THREE.Vector3(-24,26,-16);
  // Màu trộn dùng 1 biến tạm duy nhất và ghi thẳng vào đích — trước đây dùng chung _c1 cho cả
  // trời / hemi / ambient / sun nên các phép trộn sau đè lên màu trời (nền trời bị đổi nhầm).
  const _tmp = new THREE.Color();
  const mixTo = (target, hexA, hexB, t)=>{ target.setHex(hexA); _tmp.setHex(hexB); return target.lerp(_tmp, t); };
  const lerpHex = (out, dayHex, nightHex, k)=> mixTo(out, dayHex, nightHex, k);
  const SKY_DAY = 0xbfe9f4, SKY_DAY_ISLE = 0xa6dff2, SKY_NIGHT = 0x0b1635;   // trời ban ngày / ban đêm (sương mù dùng chung màu này)

  function nightTex(){          // vệt sáng tròn dưới chân đèn (gradient mềm)
    if(nightTex.t) return nightTex.t;
    const c=document.createElement('canvas'); c.width=c.height=128; const g=c.getContext('2d');
    const gr=g.createRadialGradient(64,64,2,64,64,64);
    gr.addColorStop(0,'rgba(255,238,190,.80)'); gr.addColorStop(0.30,'rgba(255,226,150,.42)');
    gr.addColorStop(0.65,'rgba(255,214,120,.14)'); gr.addColorStop(1,'rgba(255,210,110,0)');
    g.fillStyle=gr; g.fillRect(0,0,128,128);
    return (nightTex.t = new THREE.CanvasTexture(c));
  }
  let _glowTex = null;           // đĩa trắng mờ dần ra rìa (nhuộm màu bằng material.color)
  function glowTex(){
    if(_glowTex) return _glowTex;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64,64,0,64,64,64);
    gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.35,'rgba(255,255,255,0.45)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0,0,128,128); return (_glowTex = new THREE.CanvasTexture(c));
  }
  // Quầng sáng (sprite) quanh nguồn sáng + vệt sáng trên mặt đất (đĩa cộng sáng): chỉ hiện ban đêm, không dùng đèn thật → nhẹ cho điện thoại
  function addGlow(x,y,z,color,size){
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map:glowTex(), color, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    s.position.set(x,y,z); s.scale.set(size,size,1); s.visible = false; worldGroup.add(s); nightReg.push({ o:s, mode:'fade', op:0.9 }); return s;
  }
  function addPool(x,z,r,color,op,y){
    const m = new THREE.Mesh(new THREE.CircleGeometry(r,32), new THREE.MeshBasicMaterial({ map:glowTex(), color, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2 }));
    m.rotation.x = -Math.PI/2; m.position.set(x, y||0.19, z); m.visible = false; worldGroup.add(m); nightReg.push({ o:m, mode:'fade', op }); return m;
  }
  // đèn lồng đường cho đảo (s = tỉ lệ, baseY = độ cao chân đèn: 0.3 trên bến gỗ)
  function addIslandLamp(x,z,s,baseY){
    s = s || 1; baseY = baseY || 0;
    const lamp = new THREE.Group(), dk = new THREE.MeshLambertMaterial({color:0x2f4a3a});
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,3.6,6), dk); pole.position.y = 1.8; lamp.add(pole);
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.7), new THREE.MeshBasicMaterial({color:0xffe9b8})); bulb.position.y = 4.0; lamp.add(bulb);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.6,0.4,4), dk); cap.position.y = 4.6; cap.rotation.y = Math.PI/4; lamp.add(cap);
    lamp.scale.setScalar(s); lamp.position.set(x, baseY, z); worldGroup.add(lamp);
    nightReg.push({ o:bulb, mode:'lantern', day:0xe6dcc0, night:0xffe9b8 });
    addGlow(x, baseY + 4.0*s, z, 0xffd27a, 3.6*s);
    addPool(x, z, 4.8*s, 0xffe6b0, 0.5, baseY + 0.19);
  }
  // Quầng sáng dưới chân đèn (additive) + quầng sáng nhỏ quanh bóng đèn
  function addLightPool(x, z, y, r){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(r*2, r*2), new THREE.MeshBasicMaterial({ map:nightTex(), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    p.rotation.x=-Math.PI/2; p.position.set(x, 0.14, z); p.renderOrder=2; worldGroup.add(p);
    nightReg.push({ o:p, mode:'pool' });
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({ map:nightTex(), transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false }));
    halo.position.set(x, y, z); halo.scale.set(4.2,4.2,1); worldGroup.add(halo);
    nightReg.push({ o:halo, mode:'halo' });
  }
  function applyNightFountain(fx, x, z){      // đài phun sáng xanh ngọc về đêm: nước + vàng phát sáng, quầng sáng trên nền, hào quang trên đỉnh
    const [water, gold] = fx.glow;
    nightReg.push({ o:fx.group, mode:'emit', mat:water, day:0x000000, night:0x16618c });
    nightReg.push({ o:fx.group, mode:'emit', mat:gold, day:0x3d2a05, night:0x7a5710 });
    addPool(x, z, 9.5, 0x59c9ff, 0.55, 0.2); addGlow(x, 3.6, z, 0x7fd6ff, 7);
  }

  // Sao + trăng (chỉ hiện ban đêm)
  function buildSky(){
    const n=340, pos=new Float32Array(n*3);
    for(let i=0;i<n;i++){ const a=Math.random()*Math.PI*2, r=180+Math.random()*40, h=40+Math.random()*110;
      pos[i*3]=Math.cos(a)*r; pos[i*3+1]=h; pos[i*3+2]=Math.sin(a)*r; }
    const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos,3));
    stars=new THREE.Points(g, new THREE.PointsMaterial({ color:0xffffff, size:1.5, sizeAttenuation:true, transparent:true, opacity:0, depthWrite:false, fog:false }));
    stars.renderOrder=-1; scene.add(stars);
    // trăng: đĩa tròn + quầng nhỏ, đặt xa để không bị fog nuốt
    const mp = moonDir.clone().multiplyScalar(7.5);
    moonDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map:nightTex(), color:0xf6f9ff, transparent:true, opacity:0, depthWrite:false, fog:false }));
    moonDisc.scale.set(11,11,1); moonDisc.position.copy(mp); scene.add(moonDisc);
    moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({ map:nightTex(), color:0x9fb8ff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false, fog:false }));
    moonGlow.scale.set(30,30,1); moonGlow.position.copy(mp); scene.add(moonGlow);
  }
  // Đọc giờ máy → đặt hướng + màu mặt trời (đông 6h → nam 12h → tây 18h, thấp lúc bình minh/hoàng hôn)
  function syncClock(){
    if(DN.manual) return;
    const h = CLOCK.sync();
    DN.target = clockNightK(h);
    const a = (h - 6)/12 * Math.PI;                 // góc quay của mặt trời quanh bầu trời
    const el = Math.sin(a);                          // -1 (nửa đêm) → 1 (12h)
    sunDir.set(Math.cos(a)*62, Math.max(12, el*58), 16 + Math.sin(a)*8);
    DN.warm = 1 - Math.max(0, Math.min(1, el));      // 0 lúc trưa, ~1 lúc mặt trời thấp
  }
  function applyNight(k){
    if(!scene) return;
    DN.k = k;
    // trời + sương mù
    mixTo(scene.background, curZoneId==='fishing' ? SKY_DAY_ISLE : SKY_DAY, SKY_NIGHT, k);   // biển ban ngày xanh hơn quảng trường một chút
    if(scene.fog) scene.fog.color.copy(scene.background);
    // ánh sáng
    mixTo(hemi.color, 0xeaf6ff, 0x7a8fd8, k);
    mixTo(hemi.groundColor, 0xcfb894, 0x25345f, k);
    hemi.intensity = (0.30 - 0.03*k) * GFX.LI;
    mixTo(ambient.color, 0xffffff, 0x7d90d6, k);
    ambient.intensity = (0.32 - 0.11*k) * GFX.LI;
    // mặt trời: ban ngày trắng ấm → hồng cam lúc thấp (bình minh / hoàng hôn) → xanh lam khi đêm
    mixTo(sun.color, 0xfff1d6, 0xffb069, DN.warm*(1-k));
    sun.color.lerp(_tmp.setHex(0xa4b8f5), k);
    sun.intensity = (0.52 - 0.30*k) * GFX.LI;
    sun.position.copy(sunDir).lerp(moonDir, k);
    // sao + trăng
    if(stars){ stars.material.opacity = k*0.95; stars.visible = k>0.02; }
    if(moonGlow){ moonGlow.material.opacity = k*0.30; moonGlow.visible = k>0.02; }
    if(moonDisc){ moonDisc.material.opacity = k*0.95; moonDisc.visible = k>0.02; }
    // các vật thể nhạy với đêm
    nightReg.forEach(it=>{
      const o=it.o; if(!o) return;
      if(it.mode==='basic'||it.mode==='emissive'||it.mode==='pool'||it.mode==='halo') o.visible = k>0.015;
      if(it.mode==='lantern'){ o.visible = true; o.material.color.setHex(it.day).lerp(_tmp.setHex(it.night), k); }   // lồng đèn: luôn hiện (ban ngày kem nhạt, ban đêm sáng) → không hở giữa thân và nóc đèn
      else if(it.mode==='basic'){
        const c0=it.base|| (it.base=o.material.color.clone());
        o.material.color.copy(c0).multiplyScalar(it.dim===undefined?1:(it.dim + (1-it.dim)*k));
      }
      else if(it.mode==='emissive'||it.mode==='emissiveMat'){
        const m = it.mat||o.material;
        if(m && m.emissive){ if(it.base===undefined) it.base=m.emissive.clone(); m.emissive.copy(it.base).multiplyScalar(0.15 + 0.85*k); }
      }
      else if(it.mode==='pool'||it.mode==='halo'){
        o.material.opacity = (it.mode==='pool' ? 0.58 : 0.42) * k;
      }
      else if(it.mode==='fade'){ o.visible = k>0.015; o.material.opacity = it.op*k; }                       // quầng/vệt sáng cộng sáng: chỉ hiện ban đêm
      else if(it.mode==='tint'){ it.mat.color.setHex(0xffffff).lerp(_tmp.setHex(it.night), k); }              // mặt biển/vùng nước nông tối đi về đêm
      else if(it.mode==='emit'){ it.mat.emissive.setHex(it.day).lerp(_tmp.setHex(it.night), k); }             // phát sáng có màu đích (đài phun)
      else if(it.mode==='sea'){ lerpHex(o.material.color, 0x11697c, 0x07253c, k); }
      else if(it.mode==='shallow'){ lerpHex(o.material.color, 0x2a9aab, 0x0d3a52, k); }
      else if(it.mode==='foam'){ o.material.opacity = 0.55 - 0.28*k; }
    });
  }
  // Ép trời tối/sáng thủ công (dùng cho test qua window.__gcity.setNight — chỉ có khi chạy local) — bỏ thì trở lại chạy theo giờ máy
  function setNight(on, instant){
    DN.manual = true; DN.target = on ? 1 : 0;
    if(instant){ DN.k = DN.target; nightDirty = true; }
  }
  function followClock(){ DN.manual = false; syncClock(); DN.k = DN.target; nightDirty = true; }
  const isNight = ()=> DN.target > 0.5;

  // ===== CÂY low-poly: tán là các khối 20 mặt méo nhẹ + shading phẳng (mặt cắt rõ như ảnh mẫu), mỗi cây một vẻ =====
  function makeBlobGeo(seed, jit){
    const g=new THREE.IcosahedronGeometry(1,1), P=g.attributes.position;
    const hs=(x,y,z)=>{ const t=Math.sin(x*127.1+y*311.7+z*74.7+seed*19.19)*43758.5453; return t-Math.floor(t); };
    for(let i=0;i<P.count;i++){
      const x=P.getX(i), y=P.getY(i), z=P.getZ(i);
      const k=1+(hs(Math.round(x*1000),Math.round(y*1000),Math.round(z*1000))-0.5)*jit;   // làm tròn để đỉnh trùng nhau cùng méo như nhau → không nứt mặt
      P.setXYZ(i,x*k,y*k*0.93,z*k);
    }
    g.deleteAttribute('normal'); g.computeVertexNormals();   // geometry không index → pháp tuyến theo từng mặt = shading phẳng
    return g;
  }
  const _blobs=[0,1,2].map(sd=>makeBlobGeo(sd,0.26));
  const _trunkG=new THREE.CylinderGeometry(0.15,0.3,2.3,6), _brG=new THREE.CylinderGeometry(0.07,0.12,1.0,5);
  const _rimG=new THREE.CylinderGeometry(1.75,1.8,0.22,18), _soilG=new THREE.CylinderGeometry(1.5,1.55,0.26,18);
  const TREE_PAL=[[0x3a9a4a,0x4eb057,0x2d8040,0x63c068],[0x2f8a4b,0x43a25d,0x25763f,0x57b36f],[0x4b9f3c,0x61b64a,0x3a8832,0x76c85c]];
  function makeTree(x,z,s,base=true){
    const h=Math.abs(Math.sin(x*12.9898+z*78.233)*43758.5453)%1;   // số ngẫu nhiên cố định theo vị trí
    const pal=TREE_PAL[Math.floor(h*3)%3], r0=1.3*(0.92+((h*7)%1)*0.22), v0=Math.floor(h*9)%3;
    const B=Batch(), m=new THREE.Matrix4(), q=new THREE.Quaternion(), e=new THREE.Euler(), sc=new THREE.Vector3(), p=new THREE.Vector3();
    const put=(g,px,py,pz,sx,sy,sz,ry,rz,hex)=>{ e.set(0,ry,rz||0); q.setFromEuler(e); m.compose(p.set(px,py,pz),q,sc.set(sx,sy,sz)); B.geo(g,m,hex); };
    if(base){ put(_rimG,0,0.11,0,1,1,1,0,0,0xd9c8a4); put(_soilG,0,0.15,0,1,1,1,0,0,0x7b5636); }   // viền đá kem + đất nâu
    put(_trunkG,0,1.3,0,1,1,1,h*6,0,0x7a4e2d);
    put(_brG,0.26,2.15,0.04,1,1,1,0,-0.75,0x7a4e2d);
    [[0,3.45,0,1,0],[0.9,3.0,0.3,0.68,1],[-0.85,3.1,-0.4,0.66,2],[0.05,4.25,-0.15,0.6,3],[-0.1,3.0,0.95,0.55,1]].forEach(([px,py,pz,k,ci],i)=>{
      put(_blobs[(v0+i)%3],px*r0/1.3,py,pz*r0/1.3,r0*k,r0*k,r0*k,h*6+i*1.7,0,pal[ci]);
    });
    const mesh=B.build(); mesh.scale.setScalar(s); mesh.position.set(x,0,z); worldGroup.add(mesh);
  }

  // ===== TOÀ NHÀ: 1 mesh/toà. Cột góc, dải sàn, cửa sổ có nẹp + bậu + chậu hoa trên cả 4 mặt, mái hiên sọc 3 bậc, biển hiệu, mái có lan can + ống khói + máy lạnh + ăng-ten =====
  function makeBuilding(b){
    const sw=Math.abs(Math.sin(b.ry||0))>.5, lw=sw?b.d:b.w, ld=sw?b.w:b.d, H=b.h, y0=0.45;
    const B=Batch(), G=GlowBatch(), cream=0xf3e4bf, glassA=0x8fd0e0, glassB=0xa6dbe8, wallC=b.color, darkC=b.roof, trim=tint(wallC,1.14);
    // G: batch "cửa sổ sáng" — MeshBasic, ban ngày tắt, ban đêm đèn vàng ấm như ảnh mẫu
    const LIT=[0xffd98a,0xffc978,0xffe9b8,0xffd07a];
    const fl=Math.max(2,Math.round(H/3)), fh=H/fl;
    // móng + thân + cột góc + dải sàn liên tầng
    B.box(lw+0.5,y0,ld+0.5,0,y0/2,0,0xcdbb98);
    B.box(lw,H,ld,0,y0+H/2,0,wallC);
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=>B.box(0.55,H,0.55,sx*lw/2,y0+H/2,sz*ld/2,trim));
    for(let f=1;f<fl;f++) B.box(lw+0.3,0.26,ld+0.3,0,y0+f*fh,0,cream);
    // mái: tấm mái hiên ra + lan can + sàn mái + ống khói + máy lạnh + ăng-ten
    const ry0=y0+H, pw=lw+0.8, pd=ld+0.8, pt=tint(darkC,1.15);
    B.box(pw,0.32,pd,0,ry0+0.16,0,darkC);
    B.box(pw,0.42,0.2,0,ry0+0.53,pd/2-0.1,pt); B.box(pw,0.42,0.2,0,ry0+0.53,-pd/2+0.1,pt);
    B.box(0.2,0.42,pd-0.4,pw/2-0.1,ry0+0.53,0,pt); B.box(0.2,0.42,pd-0.4,-pw/2+0.1,ry0+0.53,0,pt);
    B.box(lw+0.4,0.06,ld+0.4,0,ry0+0.35,0,tint(darkC,0.8));
    B.box(0.75,1.1,0.75,lw*0.28,ry0+0.9,ld*0.2,tint(wallC,0.85)); B.box(0.95,0.14,0.95,lw*0.28,ry0+1.5,ld*0.2,darkC);
    B.box(1.3,0.65,0.95,-lw*0.26,ry0+0.7,-ld*0.18,0xd5dae0); B.box(0.6,0.06,0.6,-lw*0.26,ry0+1.05,-ld*0.18,0x6c7480);
    // cửa sổ tầng trên: face 0=+z (mặt tiền) 1=-z (sau) 2=+x 3=-x
    const win=(face,u,y,k)=>{
      const g=(k&1)?glassA:glassB, lit=LIT[k%4];
      if(face<2){ const sg=face===0?1:-1, zz=sg*ld/2;
        B.box(1.3,1.5,0.1,u,y,zz+sg*0.03,cream); B.box(1.02,1.22,0.12,u,y,zz+sg*0.06,g);
        G.box(1.02,1.22,0.12,u,y,zz+sg*0.07,lit);
        B.box(0.07,1.22,0.05,u,y,zz+sg*0.11,cream); B.box(1.02,0.07,0.05,u,y,zz+sg*0.11,cream);
        B.box(1.6,0.14,0.34,u,y-0.82,zz+sg*0.17,cream);
        if(face===0 && k%2===0 && fh>2.9){   // chậu hoa dưới cửa sổ
          B.box(1.3,0.22,0.3,u,y-0.98,zz+0.38,0x8a5a3a); B.box(1.2,0.12,0.24,u,y-0.84,zz+0.38,0x3f9a4c);
          for(let qd=-1;qd<=1;qd++) B.box(0.2,0.2,0.2,u+qd*0.38,y-0.7,zz+0.38,qd%2?0xf06a8d:0xff8fa8);
        }
      } else { const sg=face===2?1:-1, xx=sg*lw/2;
        B.box(0.1,1.5,1.3,xx+sg*0.03,y,u,cream); B.box(0.12,1.22,1.02,xx+sg*0.06,y,u,g);
        G.box(0.12,1.22,1.02,xx+sg*0.07,y,u,lit);
        B.box(0.05,1.22,0.07,xx+sg*0.11,y,u,cream); B.box(0.05,0.07,1.02,xx+sg*0.11,y,u,cream);
        B.box(0.34,0.14,1.6,xx+sg*0.17,y-0.82,u,cream);
      }
    };
    const nWin=Math.max(3,Math.floor(lw/2.4)), wsp=lw/nWin, mcol=Math.max(2,Math.floor(ld/2.6)), spz=ld/mcol;
    for(let f=1;f<fl;f++){ const wy=y0+fh*f+fh*0.5;
      for(let i=0;i<nWin;i++){ const u=-lw/2+wsp*(i+.5); win(0,u,wy,i+f); win(1,u,wy,i+f+1); }
      for(let j=0;j<mcol;j++){ const u=-ld/2+spz*(j+.5); win(2,u,wy,j+f); win(3,u,wy,j+f+1); }
    }
    // tầng trệt mặt tiền: kính lớn + cửa chính + bậc thềm + mái hiên sọc 3 bậc dốc xuống + biển hiệu
    const nG=Math.max(2,Math.floor(lw/3));
    for(let i=0;i<nG;i++){ const u=-lw/2+(i+.5)*(lw/nG); if(Math.abs(u)<1.1) continue;
      B.box(1.7,2.3,0.1,u,y0+1.2,ld/2+0.03,cream); B.box(1.4,2.0,0.12,u,y0+1.2,ld/2+0.06,glassA);
      G.box(1.4,2.0,0.12,u,y0+1.2,ld/2+0.07,LIT[(i+2)%4]);
      B.box(0.07,2.0,0.05,u,y0+1.2,ld/2+0.11,cream); B.box(1.4,0.07,0.05,u,y0+1.4,ld/2+0.11,cream); }
    B.box(1.7,2.6,0.1,0,y0+1.3,ld/2+0.03,cream); B.box(1.35,2.45,0.14,0,y0+1.25,ld/2+0.07,0x3b2a22); B.box(0.1,0.1,0.06,0.45,y0+1.2,ld/2+0.16,0xe7c35a);
    B.box(2.4,0.3,0.6,0,0.15,ld/2+0.55,0xd8c8a8);
    const ns=Math.max(4,Math.round(lw/1.1)), sw2=lw/ns;
    [[3.1,0.3],[2.92,0.62],[2.74,0.94]].forEach(([ay,az])=>{ for(let i=0;i<ns;i++) B.box(sw2,0.17,0.4,-lw/2+sw2*(i+.5),ay,ld/2+az,i%2?0xfff8ec:tint(darkC,0.82)); });
    B.box(lw*0.78,0.62,0.16,0,3.3,ld/2+0.12,darkC); B.box(lw*0.78+0.18,0.1,0.2,0,3.64,ld/2+0.12,cream); B.box(lw*0.78+0.18,0.1,0.2,0,2.96,ld/2+0.12,cream);
    // tầng trệt 2 bên + mặt sau
    [[1],[-1]].forEach(([sg])=>{ const mm=Math.max(1,Math.floor(ld/3.2)), sp=ld/mm; for(let j=0;j<mm;j++){ const zz=-ld/2+sp*(j+.5); B.box(0.1,2.0,1.4,sg*lw/2+sg*0.03,y0+1.2,zz,cream); B.box(0.12,1.7,1.12,sg*lw/2+sg*0.06,y0+1.2,zz,glassB); G.box(0.12,1.7,1.12,sg*lw/2+sg*0.07,y0+1.2,zz,LIT[j%4]); } });
    B.box(1.5,2.5,0.1,0,y0+1.25,-ld/2-0.03,cream); B.box(1.2,2.35,0.12,0,y0+1.2,-ld/2-0.06,0x4a3a30);
    const nb=Math.max(1,Math.floor(lw/4)); for(let i=0;i<nb;i++){ const u=-lw/2+(i+.5)*lw/nb; if(Math.abs(u)<1.3) continue; B.box(1.4,1.5,0.1,u,y0+1.5,-ld/2-0.03,cream); B.box(1.15,1.25,0.12,u,y0+1.5,-ld/2-0.06,glassB); G.box(1.15,1.25,0.12,u,y0+1.5,-ld/2-0.07,LIT[i%4]); }
    const g=new THREE.Group(); g.add(B.build());
    // cửa sổ sáng ban đêm (1 mesh/toà, chỉ hiện khi trời tối)
    const gm=G.build(); if(gm){ gm.castShadow=false; gm.visible=false; g.add(gm); nightReg.push({ o:gm, mode:'basic', dim:0 }); }
    const sg2=makeTextPlane(b.name,{fontsize:32,color:'#ffe08a',bg:'rgba(0,0,0,0)'});
    const sh=Math.min(0.5, lw*0.72/sg2.userData.ar); sg2.position.set(0,3.3,ld/2+0.56); sg2.scale.set(sh*sg2.userData.ar,sh,1); g.add(sg2);   // z 0.56: nằm trước mái hiên (nhô tới 0.5) nên không bị hiên che
    // Ánh sáng toà nhà ban đêm: quầng sáng ấm trước cửa + hào quang ngay cửa (như ảnh mẫu)
    const ry0b=b.ry||0;
    addLightPool(b.x + Math.sin(ry0b)*(ld/2 + 1.5), b.z + Math.cos(ry0b)*(ld/2 + 1.5), 2.2, 9.5);
    // đèn trang trí 2 bên cửa (tắt ban ngày, sáng ban đêm)
    [[-1,1],[1,1]].forEach(([sx])=>{ const lamp=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6), new THREE.MeshBasicMaterial({color:0xffe0a0}));
      lamp.position.set(sx*(lw*0.34), 2.55, ld/2 + 0.22);
      g.add(lamp); nightReg.push({ o:lamp, mode:'basic', dim:0.12 }); });
    g.position.set(b.x,0,b.z); g.rotation.y=b.ry||0; worldGroup.add(g);
  }

  function buildPlazaFloor(){
    const L=c=>new THREE.MeshLambertMaterial(typeof c==='object'?c:{color:c});
    const flat=(w,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m); o.rotation.x=-Math.PI/2; o.position.set(x,y,zz); o.receiveShadow=true; worldGroup.add(o); };
    const bx=(w,h,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,zz); o.castShadow=o.receiveShadow=true; worldGroup.add(o); };
    const isl=new THREE.Mesh(new THREE.CylinderGeometry(56,56,1,64),L(0x9fd69a)); isl.position.y=-0.5; isl.receiveShadow=true; worldGroup.add(isl);
    [[-44,-30],[47,32],[-40,34]].forEach(([x,zz])=>{ const h=new THREE.Mesh(new THREE.SphereGeometry(10,14,8),L(0xa9dca0)); h.scale.y=0.6; h.position.set(x,0,zz); worldGroup.add(h); });
    // ===== PLAZA: gạch be (theo mẫu Gaubong) =====
    flat(60,60,0,0.02,0,L({map:tileTex('#f2dcb5','#e6cfa2',24,24)}));
    // ===== ĐƯỜNG + VỈA HÈ: khung VUÔNG VỨC (4 mép bằng nhau, không khuyết góc) =====
    // 4 bề rộng: 2 cạnh ngang trải hết chiều rộng, 2 cạnh dọc chỉ chạy đoạn giữa → không chồng, không hở.
    const RW=5, RO=22, RI=RO-RW, RM=RO-RW/2, SW=2.6, SI=RI-SW/2, SO=RO+SW/2;
    const sideW=L(0xc9ccd1);
    [-RM,RM].forEach(zc=>{ flat(RO*2,SW,0,0.045,zc-SW/2,sideW); flat(RO*2,SW,0,0.045,zc+SW/2,sideW); });   // vỉa ngang (trong + ngoài)
    [-SI,SI].forEach(xc=>flat(SW,RI*2,xc,0.045,0,sideW));                                                   // vỉa dọc trong
    [-SO,SO].forEach(xc=>flat(SW,RI*2,xc,0.045,0,sideW));                                                   // vỉa dọc ngoài
    // ===== ĐƯỜNG: nhựa đen =====
    const road=L(0x262930);
    [-RM,RM].forEach(zc=>flat(RO*2,RW,0,0.06,zc,road));
    [-RM,RM].forEach(xc=>flat(RW,RI*2,xc,0.06,0,road));
    // ===== THẬP ĐÁ ĐỎ (terracotta): chữ thập + vòng tròn quanh đài phun + viền gạch =====
    const cr=()=>({map:tileTex('#d18a68','#c47d5c',8,3)});
    flat(34,6,0,0.09,0,L(cr())); flat(6,34,0,0.09,0,L(cr()));
    const cm=new THREE.Mesh(new THREE.CircleGeometry(11,48),L({map:tileTex('#c97d5c','#bd7050',10,10)})); cm.rotation.x=-Math.PI/2; cm.position.y=0.13; cm.receiveShadow=true; worldGroup.add(cm);
    const brick=L(0xa85a3c);
    for(let i=0;i<36;i++){ const a=i/36*Math.PI*2; bx(0.9,0.2,0.55, Math.cos(a)*11.7, 0.13, Math.sin(a)*11.7, brick); }
    // ===== VẠCH ĐƯỜNG THEO ẢNH MẪU (đo từ ảnh gốc) =====
    // Đường nhựa đen trơn, CHỈ có vạch trắng:
    //  • Vạch giữa đường (trắng, đứt) chạy quanh khung, TỰ DỪNG trước vạch sang đường
    //  • ĐÚNG 4 vạch sang đường, đặt ở GIỮA mỗi cạnh. Mỗi vạch gồm 9 sọc DÀI **song song chiều xe chạy**,
    //    xếp dày theo bề ngang đường và chiếm trọn bề rộng đường (không phải zebra sọc ngang)
    //  • Không có sơn ngựa ở góc, không có vạch vàng — ảnh mẫu không hề có
    const white=L(0xe9e9e3);
    const dashL=1.7, dashW=0.22, dashGap=4.0, CW=2.7;      // CW = nửa bề rộng vùng vạch sang đường
    const Y_R=0.105, Y_W=0.108;                             // 2 lớp vạch tách nhau chút để không chớp khi nhìn xiên
    for(let t=-RM+dashL+dashGap/2; t<RM; t+=dashL+dashGap){
      if(Math.abs(t)<CW) continue;                          // chừa vùng vạch sang đường
      flat(dashL,dashW, t,Y_R, RM,white); flat(dashL,dashW, t,Y_R,-RM,white);
      flat(dashW,dashL, RM,Y_R, t,white); flat(dashW,dashL,-RM,Y_R, t,white);
    }
    const cwBars=8, cwSpan=RW*0.97, cwStep=cwSpan/cwBars, cwLen=4.2, cwTh=0.26;
    for(let i=0;i<cwBars;i++){
      const off=-cwSpan/2+cwStep*(i+.5);
      flat(cwLen,cwTh, 0,Y_W, RM+off,white); flat(cwLen,cwTh, 0,Y_W,-RM-off,white);   // cạnh ngang: sọc chạy theo x
      flat(cwTh,cwLen, RM+off,Y_W, 0,white); flat(cwTh,cwLen,-RM-off,Y_W, 0,white);   // cạnh dọc: sọc chạy theo z
    }
    // ===== SÂN KHẤU trước màn hình: thân gỗ nâu sẫm + mặt sàn gỗ sáng nhô ra làm gờ + bậc thang giữa + nền gạch xung quanh =====
    // Mặt sàn vẫn cao 0.5 (khớp groundY / collides). Trước đây mặt trước tô xanh lá cùng tông cỏ và cao đúng 0.5 → trùng mặt phẳng với sàn nên chớp xanh ở mép.
    const wood=L(0xc99a6b), woodDark=L(0x5a3a26);
    bx(22.04,0.08,7.04,0,0.04,-35,L(0x3f2819));      // chân đế sẫm hơn
    bx(22,0.44,7,0,0.22,-35,woodDark);               // thân sân khấu: gỗ nâu sẫm, cao 0.44
    bx(22.3,0.06,7.3,0,0.47,-35,wood);               // mặt sàn: gỗ sáng dày 0.06 (0.44→0.5), nhô ra 0.15 mỗi phía làm gờ
    // nền gạch dưới + quanh sân khấu: nối liền nền chính ở z=-30 (hết dải cỏ phía trước), thêm 4 đơn vị mỗi bên và phía sau.
    // Mép trái x=-15 và mép nam z=-30 đều nằm đúng mốc gạch 2.5 của nền chính (x=-30+2.5k) nên ô gạch khớp liền mạch.
    flat(30,12.5,0,0.02,-36.25,L({map:tileTex('#f2dcb5','#e6cfa2',12,5)}));
    for(let s=0;s<3;s++){ bx(5,0.15*(3-s),1.0,0,0.075*(3-s),-31.0+s*1.0,wood); }
    [-10.5,10.5].forEach(sx=>bx(1.1,2.4,1,sx,1.5,-36,L(0x1b1f27)));
    [-6,6].forEach(sx=>addPool(sx,-34.2,7.5,0xffb868,0.45,0.53));   // đèn sân khấu (chỉ ban đêm)
    (ZONES.plaza.flowers||[]).forEach(f=>{ bx(3,0.5,1.2,f.x,0.3,f.z,L(0xe6d3b0));
      for(let i=-1;i<=1;i++) for(let j=0;j<2;j++){ const fl=new THREE.Mesh(new THREE.SphereGeometry(0.22,6,5),L(i%2?0xf06a8d:0xff8fa8)); fl.position.set(f.x+i*0.9,0.65,f.z+(j-0.5)*0.5); worldGroup.add(fl); } });
    for(let i=0;i<22;i++){ const a=i/22*Math.PI*2+Math.sin(i*3)*0.1, r=46+Math.sin(i*5)*4; const tx=Math.cos(a)*r, tz=Math.sin(a)*r; if((tx>33&&Math.abs(tz)<21)||(tx<-33&&tz>-15&&tz<19)||(tz>29&&tx>-27&&tx<28)||(tx<-30&&Math.abs(tz)<14)||(tx>30&&Math.abs(tz)<4)) continue; makeTree(tx, (Math.abs(tx)<17&&tz>-44.2&&tz<-29)?-44.6:tz, 1.5+Math.abs(Math.sin(i*7))*0.8, false); }   // cây vành đai lùi ra sau nền gạch sân khấu (không đứng vắt ngang mép gạch)
    buildParkLayout();
    buildExtras();
  }


  // ===== BỐ CỤC CÔNG VIÊN (v18): trục chữ thập kéo thẳng tới 4 đích — sân khấu (B) · bãi xe (T) · trường đua (Đ) · cổng tàu (N) =====
  function buildParkLayout(){
    const L=c=>new THREE.MeshLambertMaterial(typeof c==='object'?c:{color:c});
    const flat=(w,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d),m); o.rotation.x=-Math.PI/2; o.position.set(x,y,zz); o.receiveShadow=true; worldGroup.add(o); return o; };
    const bx=(w,h,d,x,y,zz,c,ry)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),L(c)); o.position.set(x,y,zz); if(ry) o.rotation.y=ry; o.castShadow=o.receiveShadow=true; worldGroup.add(o); return o; };
    const cr=(rx,ry)=>L({map:tileTex('#d18a68','#c47d5c',rx,ry)});
    const cream=0xe6d3b0, dark=0x2f4a3a, Lt=ZONES.plaza.rentLot;

    // --- Nam: quảng trường gạch nối dài (khớp ô gạch với nền cũ) + viền vỉa hè ---
    flat(45,17.5,0,0.02,38.75,L({map:tileTex('#f2dcb5','#e6cfa2',18,7)}));
    const sideW=L(0xc9ccd1);
    flat(46.6,0.8,0,0.045,47.9,sideW); [-1,1].forEach(k=>flat(0.8,18.3,k*22.9,0.045,39.15,sideW));

    // --- 4 nhánh đá đỏ nối ra khỏi vỉa hè của đường vòng ---
    flat(6,17.2,0,0.09,32.2,cr(3,8));        // Nam: tới sân cổng tàu (z 23.6 → 40.8)
    flat(6,4.9,0,0.09,-26.05,cr(3,2));       // Bắc: tới bậc thang sân khấu
    flat(13.6,6,-30.4,0.09,0,cr(6,3));       // Tây: tới bãi thuê xe
    flat(10.4,6,28.8,0.09,0,cr(5,3));        // Đông: tới trường đua

    // --- Sân tròn trước cổng tàu (lặp lại hình đài phun) ---
    const pad=new THREE.Mesh(new THREE.CircleGeometry(6.2,40),L({map:tileTex('#c97d5c','#bd7050',6,6)})); pad.rotation.x=-Math.PI/2; pad.position.set(0,0.13,38); pad.receiveShadow=true; worldGroup.add(pad);
    for(let i=0;i<26;i++){ const a=i/26*Math.PI*2, cx=Math.cos(a)*6.6, cz=38+Math.sin(a)*6.6;
      if(Math.sin(a)<-0.2 && Math.abs(cx)<3.6) continue;   // chừa lối vào phía bắc
      bx(0.9,0.2,0.55,cx,0.13,cz,0xa85a3c,-a); }
    // cổng gỗ: 2 trụ + xà vàng, biển "Đảo câu cá" treo giữa
    [-3.9,3.9].forEach(sx=>{ bx(0.42,4.5,0.42,sx,2.25,37,dark); const g=new THREE.Mesh(new THREE.SphereGeometry(0.34,10,8),L(0xd4af37)); g.position.set(sx,4.75,37); worldGroup.add(g); });
    bx(8.6,0.4,0.5,0,4.45,37,0xd4af37);

    // --- Khu nghỉ chân (thay sàn gỗ trơ): sàn ván phẳng + bàn + dù, 4 ghế ngồi được ---
    const pc=document.createElement('canvas'); pc.width=pc.height=128; const pg=pc.getContext('2d');
    pg.fillStyle='#c99a6b'; pg.fillRect(0,0,128,128); for(let k=0;k<4;k++){ pg.fillStyle=k%2?'#bd8d5f':'#d3a577'; pg.fillRect(0,k*32,128,30); }
    const pt=new THREE.CanvasTexture(pc); pt.wrapS=pt.wrapT=THREE.RepeatWrapping; pt.repeat.set(3,2); pt.anisotropy=maxAniso();
    flat(9.4,7,-15.5,0.07,42,L({map:pt}));
    const tb=new THREE.Mesh(new THREE.CylinderGeometry(0.85,0.85,0.1,16),L(0xf4f1e6)); tb.position.set(-15.5,0.78,42); tb.castShadow=true; worldGroup.add(tb);
    bx(0.14,0.75,0.14,-15.5,0.4,42,dark);
    bx(0.07,2.7,0.07,-15.5,1.5,42,0x8d8d8d);
    const um=new THREE.Mesh(new THREE.ConeGeometry(2.1,0.75,8),L(0xf0a35e)); um.position.set(-15.5,2.95,42); um.castShadow=true; worldGroup.add(um);

    // --- Vòng quay: nền đá để không đứng chơ vơ trên cỏ ---
    flat(14,6.4,15.5,0.06,42,L(cream)); flat(12.8,5.2,15.5,0.075,42,cr(5,2));

    // --- Bãi thuê xe: lề đường kem + lối đá đỏ vào bãi + cây che phía sau ---
    const cu=L(cream), cx0=Lt.x, cz0=Lt.z+0.5;
    flat(10.9,0.5,cx0,0.08,cz0-13.75,cu); flat(10.9,0.5,cx0,0.08,cz0+13.75,cu);
    flat(0.5,27,cx0-5.25,0.08,cz0,cu); flat(0.5,27,cx0+5.25,0.08,cz0,cu);
    [[-51.5,-6],[-51.5,14],[-49,-12.5]].forEach(([tx,tz])=>makeTree(tx,tz,1.5,false));
    // --- Nam: cây hậu cảnh sau cổng tàu ---
    [[-14,50.8,1.6],[-5,52.3,1.5],[5,52.3,1.7],[14,50.8,1.5]].forEach(([tx,tz,sc])=>makeTree(tx,tz,sc,false));
  }

  // ===== ĐẢO CÂU CÁ (v20): toàn bộ dựng trong js/island.js (đảo bầu dục + dừa + chòi + dù + bến chữ T + thuyền + đảo con) =====
  // env: những hàm dùng chung của three-scene.js mà island.js cần (batch gộp mesh, chữ, quầng sáng ban đêm, mặt nước, hoạt ảnh mỗi khung)
  function buildIsland(){
    const waterMats = { push: m => nightReg.push({ o:worldGroup, mode:'tint', mat:m, night:0x5a74a6 }) };   // biển + vùng nước nông tối đi về đêm
    Island.build({ group:worldGroup, Batch, GlowBatch, blobs:_blobs, aniso:maxAniso(), makeTextPlane,
      addLamp:addIslandLamp, addGlow, addPool, reg:it=>{ nightReg.push(it); return it.o; }, waterMats, anim:animFns });
  }

  // Đường đua hình sân vận động (2 đoạn thẳng + 2 nửa vòng), mọi làn chạy cùng "tiến độ" u nên luôn thẳng hàng ngang nhau
  function stadiumPt(r,u){
    const R=ZONES.plaza.race, S=R.hs, rm=(R.rin+R.rout)/2, cap=Math.PI*rm, tot=4*S+2*cap;
    let s=(((u%1)+1)%1)*tot, x,z,vx,vz,th;
    if(s<S){ x=r; z=-s; vx=0; vz=-1; }
    else if((s-=S)<cap){ th=s/cap*Math.PI; x=r*Math.cos(th); z=-S-r*Math.sin(th); vx=-Math.sin(th); vz=-Math.cos(th); }
    else if((s-=cap)<2*S){ x=-r; z=-S+s; vx=0; vz=1; }
    else if((s-=2*S)<cap){ th=Math.PI+s/cap*Math.PI; x=r*Math.cos(th); z=S-r*Math.sin(th); vx=-Math.sin(th); vz=-Math.cos(th); }
    else { s-=cap; x=r; z=S-s; vx=0; vz=-1; }
    return {x:R.x+x, z:R.z+z, vx, vz, tot};
  }
  const RACE_GATE=0.02;   // vạch xuất phát nằm sau vạch đích một đoạn ngắn
  function laneR(i){ const R=ZONES.plaza.race, lw=(R.rout-R.rin)/R.lanes; return R.rin+(i+0.5)*lw; }
  // ps: tiến độ 0..1 của từng con; run: đang đua; win: chỉ số con thắng (nhảy ăn mừng) hoặc -1
  function setRacers(ps,run,win){ const t=performance.now()/1000;
    racers.forEach((g,i)=>{ const q=stadiumPt(laneR(i), RACE_GATE+(1-RACE_GATE)*(ps[i]||0));
      g.position.set(q.x,0.15,q.z); g.rotation.y=Math.atan2(-q.vz,q.vx); if(window.Animals) Animals.animate(g,t,Array.isArray(run)?!!run[i]:!!run,win===i); }); }
  function setRaceBoard(sub,tl,tt,sl,st){
    if(!raceCanvas) return; const g=raceCanvas.getContext('2d');
    g.fillStyle='#173a36'; g.fillRect(0,0,1024,384); g.textAlign='center'; g.fillStyle='#fff'; g.font='bold 64px sans-serif'; g.fillText('TRƯỜNG ĐUA THÚ',512,80);
    g.font='34px sans-serif'; g.fillStyle='#bfe9e0'; g.fillText(sub,512,130);
    [[270,tl,tt],[760,sl,st]].forEach(([x,h,t])=>{ g.fillStyle='#0f2b28'; g.fillRect(x-230,160,460,190); g.fillStyle='#8fc9bd'; g.font='28px sans-serif'; g.fillText(h,x,200); g.fillStyle='#fff'; g.font='bold 40px sans-serif'; g.fillText(t,x,270,430); });
    raceTex.needsUpdate=true;
  }
  function buildExtras(){
    const Z=ZONES.plaza, L=c=>new THREE.MeshLambertMaterial({color:c}), R=Z.race, Lt=Z.rentLot, W=Z.wheel;
    const box=(w,h,d,x,y,zz,c,pr)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),L(c)); o.position.set(x,y,zz); o.castShadow=true; (pr||worldGroup).add(o); return o; };
    const ell=(g,c,y,sx,sz)=>{ const o=new THREE.Mesh(g,L(c)); o.rotation.x=-Math.PI/2; o.scale.set(sx,sz,1); o.position.set(R.x,y,R.z); o.receiveShadow=true; worldGroup.add(o); };
    // --- trường đua thú: sân vận động 7 làn ---
    const N=R.lanes, LW=(R.rout-R.rin)/N, LC=Animals.LANE_CSS, midX=R.x+(R.rin+R.rout)/2;
    const stadPath=(P,r)=>{ const S=R.hs; P.moveTo(r,-S); P.lineTo(r,S); P.absarc(0,S,r,0,Math.PI,false); P.lineTo(-r,-S); P.absarc(0,-S,r,Math.PI,2*Math.PI,false); };
    const band=(r0,r1,y,col)=>{ const sh=new THREE.Shape(); stadPath(sh,r1); if(r0>0){ const h=new THREE.Path(); stadPath(h,r0); sh.holes.push(h); }
      const m=new THREE.Mesh(new THREE.ShapeGeometry(sh,24),L(col)); m.rotation.x=-Math.PI/2; m.position.set(R.x,y,R.z); m.receiveShadow=true; worldGroup.add(m); return m; };
    band(R.rout,R.ro+0.6,0.10,0x78c27f);                                   // thảm cỏ viền ngoài
    for(let i=0;i<N;i++) band(R.rin+i*LW,R.rin+(i+1)*LW,0.12,i%2?0xc96f45:0xd9854f);   // 7 làn đất đỏ xen 2 tông
    for(let k=0;k<=N;k++) band(R.rin+k*LW-0.03,R.rin+k*LW+0.03,0.14,0xf4f1e6);        // vạch kẻ làn
    band(0,R.rin-0.03,0.14,0x58b58a);                                      // bãi cỏ giữa
    const tube=(r,y,rad,col)=>{ const pts=[]; for(let k=0;k<120;k++){ const q=stadiumPt(r,k/120); pts.push(new THREE.Vector3(q.x,y,q.z)); }
      const m=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts,true),240,rad,6,true),L(col)); m.castShadow=true; worldGroup.add(m); };
    const posts=(r,h,n,fin)=>{ for(let k=0;k<n;k++){ const q=stadiumPt(r,k/n); box(0.12,h,0.12,q.x,h/2,q.z,0xf4f1e6);
      if(fin){ const f=new THREE.Mesh(new THREE.SphereGeometry(0.1,8,6),L(parseInt(LC[k%N].slice(1),16))); f.position.set(q.x,h+0.08,q.z); worldGroup.add(f); } } };
    tube(R.rout+0.3,0.95,0.04,0xf4f1e6); tube(R.rout+0.3,0.58,0.04,0xf4f1e6); posts(R.rout+0.3,1.0,56,true);   // lan can ngoài 2 tầng
    tube(R.rin-0.25,0.7,0.04,0xf4f1e6); posts(R.rin-0.25,0.75,32,false);                                     // lan can trong
    for(let k=-3;k<=3;k++){ const bz=R.z+k*2.8, bs=new THREE.Mesh(new THREE.SphereGeometry(0.5,10,8),L(0x3f9248)); bs.position.set(R.x,0.45,bz); bs.scale.y=0.8; bs.castShadow=true; worldGroup.add(bs);
      [0xf06a8d,0xffd34d,0xffffff].forEach((c,j)=>{ const fl=new THREE.Mesh(new THREE.SphereGeometry(0.1,6,5),L(c)); fl.position.set(R.x+Math.cos(j*2.1+k)*0.5,0.78,bz+Math.sin(j*2.1+k)*0.5); worldGroup.add(fl); }); }
    // vạch đích caro + cổng đích
    const ck=document.createElement('canvas'); ck.width=512; ck.height=64; const cg=ck.getContext('2d');
    for(let a=0;a<16;a++) for(let b2=0;b2<2;b2++){ cg.fillStyle=(a+b2)%2?'#111':'#fff'; cg.fillRect(a*32,b2*32,32,32); }
    const fl=new THREE.Mesh(new THREE.PlaneGeometry(R.rout-R.rin,0.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(ck)})); fl.rotation.x=-Math.PI/2; fl.position.set(midX,0.16,R.z); worldGroup.add(fl);
    const xi=R.x+R.rin-0.6, xo=R.x+R.rout+0.6; [xi,xo].forEach(x=>box(0.3,3.8,0.3,x,1.9,R.z,0xf4f1e6)); box(xo-xi+0.6,0.35,0.35,(xi+xo)/2,3.7,R.z,0xe74c3c);
    { const sp=xo-xi+0.6; for(let k=0;k<14;k++) box(sp/14,0.17,0.37,xi-0.3+(k+0.5)*sp/14,3.7+(k%2?0.09:-0.09),R.z,k%2?0x111111:0xffffff); }
    const fs=makeTextSprite('🏁 VỀ ĐÍCH 🏁',{fontsize:34,color:'#fff',bg:'rgba(20,40,38,.92)'}); fs.position.set(midX,4.5,R.z); fs.scale.set(0.9*fs.userData.ar,0.9,1); worldGroup.add(fs);
    // vạch xuất phát + cổng số làn
    const g0=stadiumPt(R.rin,RACE_GATE); const sl=new THREE.Mesh(new THREE.PlaneGeometry(R.rout-R.rin,0.14),L(0xffffff)); sl.rotation.x=-Math.PI/2; sl.position.set(midX,0.16,g0.z); worldGroup.add(sl);
    for(let k=0;k<=N;k++) box(0.08,1.3,0.08,R.x+R.rin+k*LW,0.65,g0.z+1.25,0xf4f1e6);
    for(let i=0;i<N;i++){ const cx=R.x+R.rin+(i+0.5)*LW, lc=parseInt(LC[i].slice(1),16);
      box(LW-0.04,0.1,0.1,cx,1.3,g0.z+1.25,lc);
      const nc=document.createElement('canvas'); nc.width=nc.height=64; const ng=nc.getContext('2d'); ng.fillStyle=LC[i]; ng.beginPath(); ng.arc(32,32,30,0,7); ng.fill();
      ng.fillStyle='#fff'; ng.font='bold 40px sans-serif'; ng.textAlign='center'; ng.textBaseline='middle'; ng.strokeStyle='rgba(0,0,0,.5)'; ng.lineWidth=6; ng.strokeText(i+1,32,35); ng.fillText(i+1,32,35);
      const pl=new THREE.Mesh(new THREE.CircleGeometry(0.3,24),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(nc),transparent:true})); pl.rotation.x=-Math.PI/2; pl.position.set(cx,0.17,g0.z+0.62); worldGroup.add(pl); }
    for(let i=0;i<Animals.count;i++){ const an=Animals.build(i); worldGroup.add(an); racers.push(an); }   // 7 bạn thú
    const bd=new THREE.Group(); box(14.6,6,0.5,0,3.8,0,0x1d3b34,bd); [-6,6].forEach(x=>box(0.6,1,0.6,x,0.5,0,0x1d3b34,bd));
    raceCanvas=document.createElement('canvas'); raceCanvas.width=1024; raceCanvas.height=384; raceTex=new THREE.CanvasTexture(raceCanvas);
    const pn=new THREE.Mesh(new THREE.PlaneGeometry(14,5.4),new THREE.MeshBasicMaterial({map:raceTex})); pn.position.set(0,3.8,0.27); bd.add(pn);
    bd.position.set(R.x+R.ro+0.95,0,R.z); bd.rotation.y=-Math.PI/2; worldGroup.add(bd); setRaceBoard('Đua thú','LỰA CHỌN CỦA BẠN','—','TRẠNG THÁI','Đang tải…'); setRacers(Array(N).fill(0),false,-1);
    // --- bãi thuê xe + máy bay: xe thật đậu trong ô kẻ vạch, thuê qua NPC (xe được thuê rời bãi, trả về khi xuống) ---
    box(10,0.06,27,Lt.x,0.03,Lt.z+0.5,0x3a3f47);
    lotSlots = [];
    Vehicles.CARS.forEach((c,i)=> lotSlots.push({kind:'car', idx:i, name:c.name, color:c.color, x:Lt.x, z:Lt.z-10.5+i*3.6, half:1.8}));
    Vehicles.PLANES.forEach((c,i)=> lotSlots.push({kind:'plane', idx:i, name:c.name, color:c.color, x:Lt.x-0.3, z:Lt.z+4.9+i*5.6, half:2.8}));
    const lines = new Set();
    lotSlots.forEach((sl,i)=>{
      sl.i = i; sl.yaw = Math.PI/2;                        // đầu xe hướng +X (ra phía công viên)
      const m = Vehicles.build(sl.kind, sl.color); m.position.set(sl.x,0,sl.z); m.rotation.y = sl.yaw; m.visible = !lotTaken[i];
      worldGroup.add(m); sl.mesh = m;
      [sl.z-sl.half, sl.z+sl.half].forEach(zb=>{ const k=zb.toFixed(1); if(lines.has(k)) return; lines.add(k); box(4.8,0.02,0.1,Lt.x,0.07,zb,0xf2c94c); });   // vạch ô đỗ
    });
    const ls=makeTextSprite('THUÊ XE · MÁY BAY',{fontsize:30,color:'#fff',bg:'rgba(30,50,80,.9)'}); ls.position.set(Lt.x+1,3.1,Lt.z-11); ls.scale.set(0.9*ls.userData.ar,0.9,1); worldGroup.add(ls);
    { const hw=0.45*ls.scale.x; [-hw,hw].forEach(dx=> box(0.14,2.7,0.14,Lt.x+1+dx,1.35,Lt.z-11,0x2b3440)); }   // 2 cột đỡ biển
    lotBadge = null; refreshLotBadge();
    // --- vòng quay: 2 vành + trục + 2 khung chữ A + 8 cabin (ghế liền khối, lưng ghế, lan can, nóc) ---
    // Thông số lấy từ ZONES.plaza.wheel: R bán kính vành, h độ cao trục, rz nửa khoảng cách 2 vành, fx/fz chân khung chữ A
    const wg=new THREE.Group(), rot=new THREE.Group(), gond=[];
    const WR=W.R, WH=W.h, RZ=W.rz, FX=W.fx, FZ=W.fz, TEAL=0x3f8f8c, TEAL_D=0x2d6c6a, STEEL=0x9aa3ad, WHITE=0xeef3f7, CREAM=0xf7f1e4, YF=FERRIS_CAB.floor;
    const cyl=(rt,rb,len,x,y,zz,c,pr)=>{ const g=new THREE.CylinderGeometry(rt,rb,len,14); g.rotateX(Math.PI/2); const o=new THREE.Mesh(g,L(c)); o.position.set(x,y,zz); o.castShadow=true; pr.add(o); return o; };   // trụ nằm theo trục z
    rot.position.y=WH;
    [-RZ,RZ].forEach(zz=>{
      const rim=new THREE.Mesh(new THREE.TorusGeometry(WR,0.16,6,56),L(TEAL)); rim.position.z=zz; rim.castShadow=true; rot.add(rim);                 // vành ngoài
      const inn=new THREE.Mesh(new THREE.TorusGeometry(WR*0.5,0.07,6,40),L(TEAL)); inn.position.z=zz; rot.add(inn);                                    // vành trong
      for(let i=0;i<4;i++){ const sp=box(WR*2,0.09,0.09,0,0,zz,TEAL,rot); sp.rotation.z=i*Math.PI/4; }                                                  // nan hoa (trùng góc 8 cabin)
      cyl(0.75,0.75,0.3,0,0,zz,TEAL_D,rot);                                                                                                            // moay-ơ
    });
    // 8 cabin: treo bằng chốt xuyên giữa 2 vành, luôn thẳng đứng (xoay ngược chiều vành)
    [0xe85c5c,0x4aa3df,0xf2c94c,0x8fc15a,0xd77aa0,0xf0a35e,0x8b72c8,0x58b8c0].forEach((c,i)=>{
      const a=i/8*Math.PI*2, pv=new THREE.Group(); pv.position.set(Math.cos(a)*WR, Math.sin(a)*WR, 0);
      cyl(0.07,0.07,RZ*2+0.3,0,0,0,STEEL,pv);                                      // chốt treo
      [-0.55,0.55].forEach(zz=> box(0.07,0.44,0.07, 0,-0.22,zz, STEEL, pv));       // 2 thanh treo xuống nóc
      box(2.3,0.12,1.7, 0,-0.41,0, CREAM, pv);                                     // nóc
      box(1.7,0.16,1.3, 0,-0.27,0, c, pv);                                         // mái chóp
      box(2.1,0.14,1.5, 0,YF-0.07,0, c, pv);                                       // sàn (mặt sàn = YF)
      [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz])=> box(0.1,2.15,0.1, sx*0.95,YF+1.075,sz*0.7, WHITE, pv));   // 4 cột (sàn → nóc)
      [-1,1].forEach(sx=>{                                                          // hai bên: tường thấp + thanh dọc + tay vịn
        box(0.06,0.55,1.4, sx*0.95,YF+0.275,0, c, pv);
        [-0.35,0,0.35].forEach(zz=> box(0.04,0.43,0.04, sx*0.95,YF+0.765,zz, WHITE, pv));
        box(0.07,0.07,1.4, sx*0.95,YF+0.98,0, WHITE, pv);
      });
      box(1.9,0.55,0.06, 0,YF+0.275,-0.7, c, pv);                                  // phía trước (hướng về quảng trường, -z): tường thấp + tay vịn
      box(1.9,0.07,0.07, 0,YF+0.98,-0.7, WHITE, pv);
      box(1.9,1.15,0.06, 0,YF+0.575,0.7, c, pv);                                   // phía sau (+z): tường cao
      box(1.6,0.3,0.8, 0,YF+0.15,0.25, CREAM, pv);                                // ghế liền khối (mặt ghế = YF+0.3)
      box(1.6,0.62,0.1, 0,YF+0.61,0.6, CREAM, pv);                                // lưng ghế
      rot.add(pv); gond.push(pv);
    });
    wg.add(rot);
    // 2 khung chữ A ở hai bên (ngoài 2 vành): chân loe ra dưới đất, chụm lại ở ổ trục
    const legLen=Math.hypot(FX,WH), legAng=Math.atan2(FX,WH), yb=WH*0.28;
    [-FZ,FZ].forEach(zz=>{
      [-1,1].forEach(sx=>{
        const lg=box(0.34,legLen,0.34, sx*FX/2,WH/2,zz, TEAL, wg); lg.rotation.z=sx*legAng;                       // chân nghiêng vào trong (chữ A, không phải chữ V)
        box(0.8,0.14,0.8, sx*FX,0.07,zz, 0x555e66, wg);                                                            // đế chân
      });
      box(2*FX*(1-yb/WH),0.16,0.16, 0,yb,zz, TEAL_D, wg);                                                         // thanh giằng ngang
      cyl(0.62,0.62,0.5,0,WH,zz,TEAL_D,wg);                                                                        // ổ trục
    });
    [-1,1].forEach(sx=> box(0.16,0.16,2*FZ, sx*FX,0.2,0, TEAL_D, wg));                                             // giằng nối 2 khung ở chân
    cyl(0.26,0.26,2*FZ+0.9,0,WH,0,STEEL,wg);                                                                       // trục chính xuyên qua 2 ổ trục
    wg.position.set(W.x,0,W.z); worldGroup.add(wg); ferris={rot,gond,group:wg};
  }

  // ===== BÃI THUÊ XE: số xe còn / tổng (bong bóng trên bãi), xe đang được thuê thì ẩn khỏi bãi =====
  function lotText(){
    const c = k => lotSlots.filter(s=>s.kind===k), f = k => c(k).filter(s=>!lotTaken[s.i]).length;
    return `🚗 Thuê xe · ${f('car')}/${c('car').length} · ✈ ${f('plane')}/${c('plane').length}`;
  }
  function refreshLotBadge(){
    const Lt = ZONES.plaza.rentLot; if(!worldGroup || !Lt || !lotSlots.length) return;
    if(lotBadge){ worldGroup.remove(lotBadge); lotBadge.material.map.dispose(); lotBadge.material.dispose(); }
    lotBadge = makeTextSprite(lotText(), {fontsize:30, color:'#3b3b3b', bg:'rgba(255,255,255,.94)'});
    lotBadge.position.set(Lt.x+1, 5.2, Lt.z+3); lotBadge.scale.set(0.5*lotBadge.userData.ar, 0.5, 1); lotBadge.visible = lotBadgeOn; worldGroup.add(lotBadge);
  }
  function setLotBadgeVisible(v){ lotBadgeOn = !!v; if(lotBadge) lotBadge.visible = lotBadgeOn; }   // ẩn khi đang ngồi xe cho đỡ che màn hình
  function setLotTaken(i, taken){
    lotTaken[i] = !!taken;
    const sl = lotSlots[i]; if(sl && sl.mesh) sl.mesh.visible = !taken;
    refreshLotBadge();
  }
  function getLotSlots(){ return lotSlots.map(s=>({ i:s.i, kind:s.kind, name:s.name, color:s.color, x:s.x, z:s.z, yaw:s.yaw, taken:!!lotTaken[s.i] })); }

  // Giải phóng tài nguyên GPU của zone cũ (geometry/material/texture tự dựng).
  // Giữ lại các tài nguyên dùng chung (khối lệch sẵn, vân gạch, gradient quầng sáng…)
  const SHARED_GEO = new Set([_boxG, _trunkG, _brG, _rimG, _soilG].concat(_blobs));
  const SHARED_MAT = new Set([_bMat, _gMat]);
  function disposeWorld(g){
    if(!g) return;
    const geos = new Set(), mats = new Set(), texs = new Set();
    g.traverse(o=>{
      if(o.geometry && !SHARED_GEO.has(o.geometry)) geos.add(o.geometry);
      const ms = o.material ? (Array.isArray(o.material)?o.material:[o.material]) : [];
      ms.forEach(m=>{ if(m && !SHARED_MAT.has(m)){ mats.add(m); const mp=m.map; if(mp && mp!==nightTex.t) texs.add(mp); } });
    });
    geos.forEach(x=>x.dispose()); texs.forEach(x=>x.dispose()); mats.forEach(x=>x.dispose());
  }
  function buildZone(zoneId){
    if(worldGroup){ scene.remove(worldGroup); disposeWorld(worldGroup); }
    worldGroup = new THREE.Group();
    curZoneId = zoneId;
    const z = ZONES[zoneId];
    waterMesh = null; fountainFx = null; screenInfo = null; screenCanvas = null; spinners = []; ferris = null; racers = []; raceCanvas = null;
    animFns = []; nightReg = [];         // đăng ký lại toàn bộ hiệu ứng ban đêm + hoạt ảnh của zone vừa dựng
    nightDirty = true;                   // dựng xong sẽ áp lại trạng thái trời cho mọi vật thể của zone

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(z.size, z.size),
      new THREE.MeshLambertMaterial({ map: makeGroundTexture(zoneId==='fishing'?0x3a6b3a:0x4a7c4a, zoneId==='fishing'?0x356035:0x427042) })
    );
    ground.rotation.x = -Math.PI/2; ground.receiveShadow = true;
    if(zoneId==='plaza') buildPlazaFloor();
    else if(z.island) buildIsland();      // đảo câu cá (v20) dựng riêng trong js/island.js
    else worldGroup.add(ground);

    // plaza paths (cross)
    if(false){
      const pathMat = new THREE.MeshLambertMaterial({ color:0xb8a080 });
      const p1 = new THREE.Mesh(new THREE.BoxGeometry(z.size, 0.1, 4), pathMat); p1.position.y=0.05; p1.receiveShadow=true; worldGroup.add(p1);
      const p2 = new THREE.Mesh(new THREE.BoxGeometry(4, 0.1, z.size), pathMat); p2.position.y=0.05; p2.receiveShadow=true; worldGroup.add(p2);
      const ring = new THREE.Mesh(new THREE.RingGeometry(4,10,48), new THREE.MeshLambertMaterial({color:0xcbb99a, side:THREE.DoubleSide}));
      ring.rotation.x=-Math.PI/2; ring.position.y=0.11; ring.receiveShadow=true; worldGroup.add(ring); // sân lát quanh đài phun
    }

    // buildings (low-poly nhiều tầng, mặt tiền quay theo ry) — dựng trong makeBuilding()
    if(!z.island) z.buildings.forEach(makeBuilding);

    // trees (đảo câu cá đã gộp cây cọ vào js/island.js)
    if(!z.island) (z.trees||[]).forEach(t=>makeTree(t.x,t.z,1));

    // benches
    (z.benches||[]).forEach(b=>{
      const bench=new THREE.Group(), wd=new THREE.MeshLambertMaterial({color:0xb06a35}), mt=new THREE.MeshLambertMaterial({color:0x2f4a3a});
      const bx=(w,h,d,x,y,zz,m)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,zz); o.castShadow=true; bench.add(o); };
      bx(2,0.1,0.55,0,0.55,0.05,wd); bx(2,0.1,0.1,0,0.95,-0.22,wd); bx(2,0.1,0.1,0,0.75,-0.22,wd);
      [-0.9,0.9].forEach(x=>{ bx(0.1,0.55,0.55,x,0.28,0,mt); bx(0.1,0.1,0.6,x,0.8,0,mt); });
      bench.position.set(b.x,0.1,b.z); bench.rotation.y = b.ry||0; worldGroup.add(bench);
    });

    // lamps (đèn lồng) — ban đêm bật sáng: bóng đèn phát quang + quầng sáng trên mặt đất
    (z.lamps||[]).forEach(l=>{
      const lamp=new THREE.Group(), dk=new THREE.MeshLambertMaterial({color:0x2f4a3a});
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.14,3.6,6),dk); pole.position.y=1.8; lamp.add(pole);
      const bulb=new THREE.Mesh(new THREE.BoxGeometry(0.7,0.8,0.7),new THREE.MeshBasicMaterial({color:0xffe9b8})); bulb.position.y=4.0; lamp.add(bulb);
      const cap=new THREE.Mesh(new THREE.ConeGeometry(0.6,0.4,4),dk); cap.position.y=4.6; cap.rotation.y=Math.PI/4; lamp.add(cap);
      const base=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.28,0.22,8),dk); base.position.y=0.11; lamp.add(base);
      lamp.position.set(l.x,0,l.z); worldGroup.add(lamp);
      nightReg.push({ o:bulb, mode:'lantern', day:0xe6dcc0, night:0xffe9b8 });
      addLightPool(l.x, l.z, 4.0, 8.5);
    });

    // fountain: đài phun nước Hoàng Gia (js/fountain.js) — đặt trên nền đá đỏ (mặt y=0.13)
    if(z.fountain){
      fountainFx = Fountain.create();
      fountainFx.group.position.set(z.fountain.x, 0.14, z.fountain.z);
      worldGroup.add(fountainFx.group);
      applyNightFountain(fountainFx, z.fountain.x, z.fountain.z);                      // nước + hồ phát sáng xanh ban đêm
    }

    // nước (chỉ zone dùng mặt nước phẳng; đảo câu cá tự dựng trong js/island.js)
    if(z.water){
      const w = z.water;
      waterMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w.w, w.d, 20, 10),
        new THREE.MeshLambertMaterial({color:0x1a5a8a, transparent:true, opacity:0.85})
      );
      waterMesh.rotation.x = -Math.PI/2; waterMesh.position.set(w.x, 0.1, w.z);
      worldGroup.add(waterMesh);
      nightReg.push({ o:waterMesh, mode:'sea' });
    }

    // portal (glowing ring)
    if(z.portal){
      const p = z.portal;
      const ring = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.1, p.d), new THREE.MeshBasicMaterial({color:0xffd700, transparent:true, opacity:0.5}));
      ring.position.set(p.x, zoneId==='plaza'?0.2:(zoneId==='fishing'?0.34:0.1), p.z); worldGroup.add(ring);
      const sign = makeTextSprite(p.label, {fontsize:28, color:'#fff', bg:'rgba(255,180,0,.8)'});
      sign.position.set(p.x, 3, p.z); sign.scale.set(0.8*sign.userData.ar, 0.8, 1); worldGroup.add(sign);
    }

    // màn hình lớn (công viên)
    if(z.screen){
      const sc = z.screen, g = new THREE.Group(), dark = new THREE.MeshLambertMaterial({color:0x1a2538});
      const gold = new THREE.MeshLambertMaterial({color:0xd4af37});
      const cy = sc.y + sc.h/2;
      // tấm nền tối mỏng
      const backPlate = new THREE.Mesh(new THREE.BoxGeometry(sc.w, sc.h, 0.25), dark); backPlate.position.y = cy; backPlate.castShadow = true; g.add(backPlate);
      // khung viền vàng mỏng 4 cạnh (như mẫu)
      const fb=0.45;
      const fT=new THREE.Mesh(new THREE.BoxGeometry(sc.w+fb*2, fb, 0.35), gold); fT.position.set(0, sc.y+sc.h+fb/2, 0.1); g.add(fT);
      const fB=new THREE.Mesh(new THREE.BoxGeometry(sc.w+fb*2, fb, 0.35), gold); fB.position.set(0, sc.y-fb/2, 0.1); g.add(fB);
      const fL=new THREE.Mesh(new THREE.BoxGeometry(fb, sc.h+fb*2, 0.35), gold); fL.position.set(-sc.w/2-fb/2, cy, 0.1); g.add(fL);
      const fR=new THREE.Mesh(new THREE.BoxGeometry(fb, sc.h+fb*2, 0.35), gold); fR.position.set(sc.w/2+fb/2, cy, 0.1); g.add(fR);
      // 2 cột cao mảnh màu đen, vượt trên đỉnh màn hình + thanh ngang + đèn spotlight
      const poleMat = new THREE.MeshLambertMaterial({color:0x14171c});
      [-1,1].forEach(k=>{ const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 13.5, 0.22), poleMat); post.position.set(k*(sc.w/2+1.1), 6.75, 0); post.castShadow=true; g.add(post); });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sc.w+3, 0.18, 0.18), poleMat); bar.position.set(0, 12.8, 0); g.add(bar);
      for(let i=-2;i<=2;i++){ const sp=new THREE.Mesh(new THREE.ConeGeometry(0.18,0.5,8), new THREE.MeshBasicMaterial({color:0xfff2c0})); sp.position.set(i*2.2, 12.4, 0); sp.rotation.x=Math.PI; g.add(sp); }
      // loa 2 bên sân khấu
      [-1,1].forEach(k=>{ const spk=new THREE.Mesh(new THREE.BoxGeometry(1.1,1.8,0.9), poleMat); spk.position.set(k*(sc.w/2+2.2), 0.9, -1.5); spk.castShadow=true; g.add(spk); });
      screenCanvas = document.createElement('canvas'); screenCanvas.width = 1280; screenCanvas.height = 720;
      screenTex = new THREE.CanvasTexture(screenCanvas);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(sc.w, sc.h), new THREE.MeshBasicMaterial({map:screenTex}));
      panel.position.set(0, cy, 0.16); g.add(panel);
      // ===== MẶT SAU TV (thân TV) — nhìn từ đằng sau thấy nắp lưng + khe tản nhiệt, KHÔNG thấy video =====
      const backMat = new THREE.MeshLambertMaterial({color:0x11151c});
      const back = new THREE.Mesh(new THREE.BoxGeometry(sc.w+0.5, sc.h+0.5, 0.14), backMat);
      back.position.set(0, sc.y + sc.h/2, -0.25); back.castShadow = true; g.add(back);
      const ventMat = new THREE.MeshLambertMaterial({color:0x07090d});
      for(let i=0;i<7;i++){ const v = new THREE.Mesh(new THREE.BoxGeometry(sc.w*0.5, 0.14, 0.06), ventMat); v.position.set(0, sc.y + sc.h*0.30 + i*0.34, -0.32); g.add(v); }
      // bảng nhãn hiệu phía sau (vật liệu 1 mặt, quay ra sau => chỉ nhìn thấy từ đằng sau)
      const lc = document.createElement('canvas'); lc.width=512; lc.height=128; const lg=lc.getContext('2d');
      lg.fillStyle='#0a0d12'; lg.fillRect(0,0,512,128); lg.strokeStyle='#2a3444'; lg.lineWidth=6; lg.strokeRect(6,6,500,116);
      lg.fillStyle='#7d90a8'; lg.font='bold 44px sans-serif'; lg.textAlign='center'; lg.textBaseline='middle';
      lg.fillText('GCITY · LED-9000', 256, 64);
      const labelBack = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(lc)}));
      labelBack.position.set(0, sc.y + sc.h*0.16, -0.33); labelBack.rotation.y = Math.PI; g.add(labelBack);
      // ốc vít trang trí 4 góc nắp lưng
      [[-1,1],[1,1],[-1,-1],[1,-1]].forEach(([sx,sy])=>{ const s=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.12,0.06,8), ventMat); s.rotation.x=Math.PI/2; s.position.set(sx*(sc.w/2-0.8), sc.y+sc.h/2+sy*(sc.h/2-0.8), -0.32); g.add(s); });
      g.position.set(sc.x, 0, sc.z); worldGroup.add(g);
      screenInfo = sc; setScreenText('GCITY TV', 'Chọn video tại quầy 📺 cạnh sân khấu');
    }
    scene.add(worldGroup);
    return z;
  }

  // ===== TEXT (name + chat + biển) — có kiểm tra độ sâu: bị tòa nhà / cây / xe che thì chữ cũng bị che =====
  function makeTextTex(text, opts={}){
    const { fontsize=24, color='#fff', bg='rgba(0,0,0,.6)' } = opts;
    const SS = 3;   // vẽ gấp 3 lần rồi thu nhỏ → chữ nét trên màn retina và khi camera zoom gần
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = `bold ${fontsize}px sans-serif`;
    const lw = Math.ceil(g.measureText(text).width + 20), lh = fontsize + 16;
    c.width = lw*SS; c.height = lh*SS;
    const g2 = c.getContext('2d');
    g2.scale(SS, SS);
    g2.fillStyle = bg;
    roundRect2(g2, 0, 0, lw, lh, 8); g2.fill();
    g2.font = `bold ${fontsize}px sans-serif`; g2.fillStyle = color; g2.textAlign='center'; g2.textBaseline='middle';
    if(/,0\)$/.test(bg)){ g2.lineWidth=6; g2.lineJoin='round'; g2.strokeStyle='rgba(20,30,40,.7)'; g2.strokeText(text, lw/2, lh/2); }
    g2.fillText(text, lw/2, lh/2);
    return { tex:new THREE.CanvasTexture(c), ar:lw/lh };
  }
  // Sprite (luôn quay mặt về camera): tên trên đầu, bong bóng chat, biển treo giữa trời. depthTest:true để bị vật cản che; depthWrite:false để viền trong suốt không cắt chữ khác
  function makeTextSprite(text, opts={}){
    const t = makeTextTex(text, opts);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map:t.tex, transparent:true, depthTest:true, depthWrite:false }));
    spr.userData.ar = t.ar; return spr;
  }
  // Tấm phẳng gắn cố định vào tường (biển hiệu tòa nhà): không bị xoay theo camera nên không bị tường cắt mất một nửa khi nhìn xiên
  function makeTextPlane(text, opts={}){
    const t = makeTextTex(text, opts);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({ map:t.tex, transparent:true, depthWrite:false }));
    m.userData.ar = t.ar; return m;
  }
  function roundRect2(g,x,y,w,h,r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }

  // ===== CHARACTER (chi tiết dựng hình + animation: xem js/character.js) =====
  function createCharacter(gender, idx, name, isMe){
    const b = GChar.build(gender, idx);
    const g = b.group, parts = b.parts;
    const nameTag = makeTextSprite(name, { fontsize:30, color:'#ffffff', bg:'rgba(0,0,0,0)' });
    nameTag.position.y = 4.95; nameTag.scale.set(0.8*nameTag.userData.ar, 0.8, 1);
    g.add(nameTag); parts.nameTag = nameTag;
    parts.chatBubble = null;
    g.scale.setScalar(0.58);
    g.userData = { parts, gender, idx, def:b.def, action:null, actionT:0, moving:false, walkT:0, dir:0 };
    return g;
  }

  function setChatBubble(charGroup, text){
    const parts = charGroup.userData.parts;
    if(parts.chatBubble){ charGroup.remove(parts.chatBubble); parts.chatBubble = null; }
    if(!text) return;
    const bubble = makeTextSprite(text.length>24? text.slice(0,24)+'…' : text, { fontsize:22, color:'#222', bg:'#ffffff' });
    bubble.position.y = 5.75; bubble.scale.set(5, 1.2, 1); bubble.renderOrder = 2;
    charGroup.add(bubble); parts.chatBubble = bubble;
  }

  // ===== ANIMATION (đi/chạy/ngồi/vẫy/nhảy/7 điệu nhảy + thở, chớp mắt, tóc đung đưa) =====
  // Độ cao mặt đất tại (x,z): sân khấu (sàn gỗ 22×7, cao 0.5, tâm (0,-35)) + 3 bậc thang trước sân khấu (rộng 5, mỗi bậc sâu 1: 0.45 / 0.30 / 0.15)
  function groundY(zoneId, x, z){
    if(zoneId==='fishing') return Island.groundY(x, z);    // ván bến gỗ cao 0.3, cát 0.04
    if(zoneId!=='plaza') return 0;
    if(Math.abs(x)<11 && z>-38.5 && z<-31.5) return 0.5;
    if(Math.abs(x)<2.5){ if(z>=-31.5 && z<-30.5) return 0.45; if(z>=-30.5 && z<-29.5) return 0.30; if(z>=-29.5 && z<-28.5) return 0.15; }
    return 0;
  }
  // GChar.update đặt lại position.y mỗi khung (nhún bước đi/nhảy/ngồi) nên cộng độ cao nền SAU nó; làm mượt để leo bậc không bị giật
  function updateCharacter(charGroup, dt, time){
    const ud = charGroup.userData, gy = groundY(curZoneId, charGroup.position.x, charGroup.position.z);
    ud.gy = (ud.gy===undefined) ? gy : ud.gy + (gy-ud.gy)*Math.min(1, dt*14);
    GChar.update(charGroup, dt, time);
    charGroup.position.y += ud.gy;
  }

  // ===== CAMERA =====
  function wrapAngle(a){ return Math.atan2(Math.sin(a), Math.cos(a)); }
  function updateCamera(px, pz, py = 0, heading = null){
    const now = performance.now();
    const dt = Math.min(0.05, (now-camLastT)/1000); camLastT = now;
    // dịch chuyển xa (qua cổng zone, spawn lại) → đặt camera ngay, không cho "bay" xuyên map
    if(Math.hypot(px-camLastX, pz-camLastZ) > 6) camSnap = true;
    camLastX = px; camLastZ = pz;
    if(heading !== null && Number.isFinite(heading)){
      // Camera đuổi theo sau lưng máy bay: "phải" luôn là phải trên màn hình. Kéo chuột/ngón tay chỉ là liếc quanh tạm thời:
      // thả tay ~1.4s thì offset êm ái về 0 (lúc vừa lên máy bay cũng vậy: camera từ từ quay ra sau lưng thay vì giật).
      if(!camFollowHeading){ camFollowOffset = wrapAngle(camAngle - (heading + Math.PI)); camFollowHeading = true; camDragT = 0; }
      camFollowOffset = wrapAngle(camFollowOffset);
      if(camPtr.size===0 && now-camDragT > CAM_RECENTER_DELAY) camFollowOffset *= Math.exp(-dt*CAM_RECENTER_RATE);
      const desired = heading + Math.PI + camFollowOffset;
      camAngle += wrapAngle(desired-camAngle) * (1 - Math.pow(1-CAM.follow, dt*60));
    } else camFollowHeading = false;

    const cp = Math.cos(camPitch), ly = py + CAM.lookY;
    camTarget.set(px + Math.sin(camAngle)*cp*camDist,
                  ly + Math.sin(camPitch)*camDist,
                  pz + Math.cos(camAngle)*cp*camDist);
    if(camSnap){ camera.position.copy(camTarget); camSnap = false; }
    else camera.position.lerp(camTarget, 1 - Math.pow(1-CAM.follow, dt*60));   // = lerp .2 @60FPS, đồng đều ở mọi tần số quét
    camera.lookAt(px, ly, pz);
  }
  function getMoveDir(){
    // trả về hướng di chuyển tương đối camera: {x, z}
    return { fx: -Math.sin(camAngle), fz: -Math.cos(camAngle), rx: Math.cos(camAngle), rz: -Math.sin(camAngle) };
  }

  // ===== COLLISION / INTERACTION =====
  function getZone(zoneId){ return ZONES[zoneId]; }
  // Plane hitboxes are local boxes supplied by Vehicles.build(). Transform all
  // eight corners so pitch/bank affect the 3D volume, then use the projected
  // convex hull for horizontal contact tests.
  function planeParts(x,y,z,yaw,pitch,bank,boxes){
    if(!boxes || !boxes.length) return [];
    const e = new THREE.Euler(pitch||0, yaw||0, bank||0, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(e);
    const parts = [];
    for(const b of boxes){
      const center = new THREE.Vector3(b.x,b.y,b.z).applyQuaternion(q).add(new THREE.Vector3(x,y,z));
      const ax = new THREE.Vector3(1,0,0).applyQuaternion(q);
      const ay = new THREE.Vector3(0,1,0).applyQuaternion(q);
      const az = new THREE.Vector3(0,0,1).applyQuaternion(q);
      const hx=b.w/2, hy=b.h/2, hz=b.d/2, points=[];
      let minY=Infinity, maxY=-Infinity;
      for(const sx of [-1,1]) for(const sy of [-1,1]) for(const sz of [-1,1]){
        const p = new THREE.Vector3(
          center.x + ax.x*sx*hx + ay.x*sy*hy + az.x*sz*hz,
          center.y + ax.y*sx*hx + ay.y*sy*hy + az.y*sz*hz,
          center.z + ax.z*sx*hx + ay.z*sy*hy + az.z*sz*hz
        );
        points.push({x:p.x,z:p.z}); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y);
      }
      parts.push({ points:convexHull2(points), minY, maxY });
    }
    return parts;
  }
  function convexHull2(points){
    const p=points.slice().sort((a,b)=>a.x-b.x||a.z-b.z), cross=(o,a,b)=>(a.x-o.x)*(b.z-o.z)-(a.z-o.z)*(b.x-o.x);
    if(p.length<4) return p;
    const lo=[], hi=[];
    for(const v of p){ while(lo.length>1&&cross(lo[lo.length-2],lo[lo.length-1],v)<=0) lo.pop(); lo.push(v); }
    for(let i=p.length-1;i>=0;i--){ const v=p[i]; while(hi.length>1&&cross(hi[hi.length-2],hi[hi.length-1],v)<=0) hi.pop(); hi.push(v); }
    lo.pop(); hi.pop(); return lo.concat(hi);
  }
  function rectPoly(x,z,hx,hz,ry=0){
    const c=Math.cos(ry),s=Math.sin(ry);
    return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([a,b])=>({x:x+a*c+b*s,z:z-a*s+b*c}));
  }
  function polygonsOverlap(a,b){
    const separated = (poly, other)=>{
      for(let i=0;i<poly.length;i++){
        const p=poly[i], n=poly[(i+1)%poly.length], ax=-(n.z-p.z), az=n.x-p.x;
        let amin=Infinity,amax=-Infinity,bmin=Infinity,bmax=-Infinity;
        for(const v of poly){ const d=v.x*ax+v.z*az; amin=Math.min(amin,d); amax=Math.max(amax,d); }
        for(const v of other){ const d=v.x*ax+v.z*az; bmin=Math.min(bmin,d); bmax=Math.max(bmax,d); }
        if(amax < bmin-1e-5 || bmax < amin-1e-5) return true;
      }
      return false;
    };
    return !separated(a,b) && !separated(b,a);
  }
  function pointInPoly(x,z,poly){
    let inside=false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const a=poly[i],b=poly[j];
      if(((a.z>z)!==(b.z>z)) && x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x) inside=!inside;
    }
    return inside;
  }
  function polyHitsCircle(poly,x,z,r){
    if(pointInPoly(x,z,poly)) return true;
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],dx=b.x-a.x,dz=b.z-a.z;
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-(a.x+t*dx),z-(a.z+t*dz)) < r) return true;
    }
    return false;
  }
  function aircraftCollision(zoneId,x,y,zpos,yaw,pitch,bank,boxes){
    const zone=ZONES[zoneId]; if(!zone) return {kind:'boundary'};
    const parts=planeParts(x,y,zpos,yaw,pitch,bank,boxes);
    if(!parts.length) return null;
    const bottomOffset=Math.min(...parts.map(p=>p.minY))-y;
    const contact=(kind,top,object)=>({kind,top,bottomOffset,object});
    // Keep the entire wing span inside the playable area.
    if(parts.some(p=>p.points.some(v=>Math.abs(v.x)>zone.size/2||Math.abs(v.z)>zone.size/2))) return {kind:'boundary'};
    for(const b of zone.buildings||[]){
      const base=0.45, roofY=0.45+b.h+0.32, ry=b.ry||0, swap=Math.abs(Math.sin(ry))>0.5;
      const footprint=rectPoly(b.x,b.z,(swap?b.d:b.w)/2+0.4,(swap?b.w:b.d)/2+0.4,ry);
      for(const p of parts){
        if(p.maxY <= base+0.02 || p.minY >= roofY-0.02) continue;
        if(polygonsOverlap(p.points,footprint)) return contact('building',roofY,b);
      }
    }
    // Low-poly trees, lamps, and the fountain have their own vertical extent;
    // aircraft above their actual height can pass over instead of being forced
    // to climb to a global "safe" altitude.
    for(const t of zone.trees||[]){
      const radius=(t.r||1.2)+0.15, top=5.4;
      for(const p of parts) if(p.maxY>0.1&&p.minY<top&&polyHitsCircle(p.points,t.x,t.z,radius)) return contact('tree',top,t);
    }
    for(const l of zone.lamps||[]){
      for(const p of parts) if(p.maxY>0.1&&p.minY<4.5&&polyHitsCircle(p.points,l.x,l.z,0.42)) return contact('lamp',4.5,l);
    }
    if(zone.fountain){
      for(const p of parts) if(p.maxY>0.1&&p.minY<5.1&&polyHitsCircle(p.points,zone.fountain.x,zone.fountain.z,Fountain.RADIUS)) return contact('fountain',5.1,zone.fountain);
    }
    if(zone.benches){
      for(const b of zone.benches){
        const ry=b.ry||0, poly=rectPoly(b.x,b.z,1.05,0.36,ry);
        for(const p of parts) if(p.maxY>0.1&&p.minY<1.35&&polygonsOverlap(p.points,poly)) return contact('bench',1.35,b);
      }
    }
    if(zone.screen){
      const s=zone.screen, poly=rectPoly(s.x,s.z,s.w/2,0.55,0);
      for(const p of parts) if(p.maxY>s.y&&p.minY<s.y+s.h&&polygonsOverlap(p.points,poly)) return contact('screen',s.y+s.h,s);
    }
    // Vòng quay: cả khối (2 vành + cabin + chân khung chữ A) cao tới h+R — bay thấp hơn đỉnh vòng thì đâm vào vòng
    if(zone.wheel){
      const W=zone.wheel, top=W.h+W.R+0.5, poly=rectPoly(W.x,W.z,W.R+1.2,Math.max(W.fz,W.rz)+0.4,0);
      for(const p of parts) if(p.maxY>0.1&&p.minY<top&&polygonsOverlap(p.points,poly)) return contact('wheel',top,W);
    }
    // Trường đua: sân vận động (2 đoạn thẳng + 2 nửa vòng) có lan can/bụi cao ~1.2; cổng đích nhô lên ~4.7 ngay vạch đích
    if(zone.race){
      const Rc=zone.race, rect=rectPoly(Rc.x,Rc.z,Rc.ro,Rc.hs,0);
      for(const p of parts){
        if(p.maxY>0.1&&p.minY<1.3&&(polygonsOverlap(p.points,rect)||polyHitsCircle(p.points,Rc.x,Rc.z+Rc.hs,Rc.ro)||polyHitsCircle(p.points,Rc.x,Rc.z-Rc.hs,Rc.ro))) return contact('race',1.3,Rc);
      }
      const gx0=Rc.x+Rc.rin-0.9, gx1=Rc.x+Rc.rout+0.9, gate=rectPoly((gx0+gx1)/2,Rc.z,(gx1-gx0)/2,0.5,0);
      for(const p of parts) if(p.maxY>0.1&&p.minY<4.8&&polygonsOverlap(p.points,gate)) return contact('gate',4.8,Rc);
    }
    // Sân khấu công viên: sàn gỗ 22×7 cao 0.44 tâm (0,-35) + 2 loa 1.8 (cùng toạ độ với collides())
    if(zoneId==='plaza'){
      const deck=rectPoly(0,-35,11.2,3.7,0);
      for(const p of parts) if(p.maxY>0.05&&p.minY<0.5&&polygonsOverlap(p.points,deck)) return contact('stage',0.5,null);
      for(const sx of [-10.5,10.5]){ const spk=rectPoly(sx,-36,0.85,0.8,0); for(const p of parts) if(p.maxY>0.05&&p.minY<1.9&&polygonsOverlap(p.points,spk)) return contact('speaker',1.9,null); }
    }
    if(zone.island && y<5 && Island.collides(x,zpos,2)) return {kind:'island'};
    return null;
  }
  function roofLandingAltitude(zoneId,x,zpos,yaw,boxes){
    const zone=ZONES[zoneId]; if(!zone || zone.island) return null;
    const parts=planeParts(x,0,zpos,yaw,0,0,boxes); if(!parts.length) return null;
    let best=null;
    for(const b of zone.buildings||[]){
      const ry=b.ry||0, swap=Math.abs(Math.sin(ry))>0.5, c=Math.cos(ry), s=Math.sin(ry);
      const hx=(swap?b.d:b.w)/2+0.4-0.12, hz=(swap?b.w:b.d)/2+0.4-0.12;
      let fits=true, minY=Infinity;
      for(const p of parts){
        minY=Math.min(minY,p.minY);
        for(const v of p.points){
          const dx=v.x-b.x,dz=v.z-b.z, lx=dx*c-dz*s, lz=dx*s+dz*c;
          if(Math.abs(lx)>hx||Math.abs(lz)>hz){ fits=false; break; }
        }
        if(!fits) break;
      }
      if(fits){
        const top=0.45+b.h+0.32, altitude=top-minY;
        if(best===null||altitude<best) best=altitude;
      }
    }
    return best;
  }
  function collides(zoneId, x, zpos, r=0.8, skipFurn){
    const z = ZONES[zoneId];
    // Đảo câu cá (v20): ra khỏi mép cát/bến là rơi xuống nước; chòi, dừa, đèn, dù, đá, bụi là vật cản (Island.collides)
    if(z.island) return Island.collides(x, zpos, r);
    if(Math.abs(x)>z.size/2-r || Math.abs(zpos)>z.size/2-r) return true;
    for(const b of z.buildings){
      if(Math.abs(x-b.x)<b.w/2+r && Math.abs(zpos-b.z)<b.d/2+r) return true;
    }
    for(const t of (z.trees||[])){ if(Math.hypot(x-t.x, zpos-t.z)<(t.r||1.2)+r) return true; }
    // ghế: cột vật cản (nếu không phải đang đi tới để ngồi thì bỏ qua)
    if(!skipFurn && z.benches){
      for(const b of z.benches){
        const ry=b.ry||0, c=Math.cos(ry), sn=Math.sin(ry), dx=x-b.x, dz=zpos-b.z;
        const lx=dx*c-dz*sn, lz=dx*sn+dz*c;                 // tọa độ cục bộ của ghế (dài 2 theo trục x)
        if(Math.abs(lx) < 1.0 + r*0.5 && Math.abs(lz) < 0.3 + r*0.55) return true;
      }
    }
    if(z.fountain && Math.hypot(x-z.fountain.x, zpos-z.fountain.z)<Fountain.RADIUS+r) return true;
    if(z.screen && Math.abs(x-z.screen.x)<z.screen.w/2+r && Math.abs(zpos-z.screen.z)<1.2+r) return true;
    if(zoneId==='plaza' && Math.hypot(x,zpos)>53) return true;
    if(zoneId==='plaza'){   // sân khấu: chỉ lên được bằng bậc thang giữa (rộng ~5), không chui qua mép; loa 2 bên là vật cản
      const ax=Math.abs(x);
      const inOuter = ax<11.4 && zpos>-38.9 && zpos<-31.1, inInner = ax<10.6 && zpos>-38.1 && zpos<-31.9;
      if(inOuter && !inInner && !(ax<2.6 && zpos>-31.9)) return true;
      if(Math.abs(ax-10.5)<0.55+r && Math.abs(zpos+36)<0.5+r) return true;
    }
    if(z.race && Math.hypot(x-z.race.x, Math.max(Math.abs(zpos-z.race.z)-z.race.hs,0)) < z.race.ro+r) return true;
    if(z.wheel && Math.hypot(x-z.wheel.x,zpos-z.wheel.z)<z.wheel.r+r) return true;
    if(z.wheel && Math.abs(x-z.wheel.x)<z.wheel.fx+0.4+r && Math.abs(zpos-z.wheel.z)<z.wheel.fz+0.4+r) return true;   // chân 2 khung chữ A
    if(z.water){ const w=z.water; if(Math.abs(x-w.x)<w.w/2 && Math.abs(zpos-w.z)<w.d/2 && zpos>w.z-w.d/2+2) return true; }
    return false;
  }
  function atPortal(zoneId, x, z){
    const p = ZONES[zoneId].portal; if(!p) return null;
    if(Math.abs(x-p.x)<p.w/2 && Math.abs(z-p.z)<p.d/2) return p;
    return null;
  }
  function nearBuilding(zoneId, x, z){
    for(const b of ZONES[zoneId].buildings){
      if(Math.hypot(x-b.x, z-(b.z+b.d/2)) < 4) return b;
    }
    return null;
  }
  // câu cá được khi đứng trên bến gỗ hoặc sát mép nước (v20)
  function atDock(zoneId, x, z){ return zoneId==='fishing' && Island.atDock(x, z); }
  function fishDir(x, z){ return Island.fishDir(x, z); }   // góc quay mặt (rad) về phía mặt nước gần nhất, tự tránh hướng có đất / ván bến

  // ===== CÔNG VIÊN: điểm tương tác + màn hình =====
  function nearSpot(zoneId, x, z){
    const Z = ZONES[zoneId]; let best = null, bd = 1e9;
    const test = (kind, ref, px, pz, rad, label)=>{ const d = Math.hypot(x-px, z-pz); if(d<rad && d<bd){ bd=d; best={kind, ref, label}; } };
    Z.buildings.forEach(b=>{ const ry=b.ry||0, ld=Math.abs(Math.sin(ry))>.5?b.w:b.d; test('building', b, b.x+Math.sin(ry)*ld/2, b.z+Math.cos(ry)*ld/2, 4.5, b.name); });
    if(Z.rentLot) test('vehicle', Z.rentLot, Z.rentLot.x+6, Z.rentLot.z, 6, lotText());
    if(!best && Z.screen) test('screen', Z.screen, Z.screen.x, Z.screen.z+8, 9, '📺 Màn hình lớn (chọn video)');
    return best;
  }
  // Ghế: không còn hiện gợi ý [E] (che màn hình) — chạm vào ghế để ngồi.
  // pickBench: bắn tia từ điểm chạm xuống mặt phẳng ngang ngang tầm mặt ghế, ghế nào gần điểm đó (<1.7) thì trúng (dễ chạm hơn bắn thẳng vào ghế mỏng).
  const _rc = new THREE.Raycaster(), _plane = new THREE.Plane(new THREE.Vector3(0,1,0), -0.65), _hit = new THREE.Vector3();
  function pickBench(cx, cy){
    const Z = ZONES[curZoneId]; if(!Z || !(Z.benches||[]).length || !camera) return null;
    camera.updateMatrixWorld();
    _rc.setFromCamera(new THREE.Vector2(cx/window.innerWidth*2-1, -(cy/window.innerHeight)*2+1), camera);
    if(!_rc.ray.intersectPlane(_plane, _hit)) return null;
    let best = null, bd = 1.7;
    Z.benches.forEach(b=>{ const d = Math.hypot(_hit.x-b.x, _hit.z-b.z); if(d<bd){ bd=d; best=b; } });
    return best;
  }
  function nearBench(zoneId, x, z, rad=1.8){
    let best = null, bd = rad;
    ((ZONES[zoneId]||{}).benches||[]).forEach(b=>{ const d = Math.hypot(x-b.x, z-b.z); if(d<bd){ bd=d; best=b; } });
    return best;
  }
  function setTapHandler(fn){ tapHandler = fn; }

  // ===== VÒNG ĐU QUAY: lên/xuống cabin =====
  const _fv = new THREE.Vector3();
  // Vị trí ngồi trong cabin (world) — cabin i treo ở góc i/8 của vành, xoay theo vòng
  // Đặt góc vòng + cabin theo đúng thời điểm `time` (giây) rồi cập nhật ma trận cả chuỗi wheel→vành→cabin.
  // game.js gọi hàm này NGAY TRƯỚC khi đặt người vào ghế (cùng `time` với render) → ghế không bao giờ chậm 1 khung hình so với cabin.
  function ferrisSync(time){
    if(!ferris) return;
    const a = time*FERRIS_SPEED;
    ferris.rot.rotation.z = a;
    ferris.gond.forEach(g=>{ g.rotation.z = -a; });
    ferris.group.updateMatrixWorld(true);
  }
  function ferrisSeat(i, out){
    const g = ferris && ferris.gond[i]; if(!g) return null;
    g.updateWorldMatrix(true, false);                               // cập nhật cả chuỗi cha (trước đây chỉ cabin → ma trận vành bị cũ 1 khung)
    out = out || new THREE.Vector3();
    const s = FERRIS_CAB.seat;
    return out.set(s.x, s.y, s.z).applyMatrix4(g.matrixWorld);       // gốc chân nhân vật: chân đặt trên sàn, mông đúng mặt ghế
  }
  // Hướng mặt của người ngồi (bám theo cabin đang quay)
  function ferrisYaw(i){ const g = ferris && ferris.gond[i]; if(!g) return 0; return FERRIS_CAB.yaw + g.rotation.y; }   // yaw = π: ngồi quay mặt về -z, tức về phía quảng trường (vòng ở z=42, quảng trường ở z≈0)
  function nearFerris(x, z){ const W = ZONES.plaza.wheel; return !!(W && ferris && Math.hypot(x-W.x, z-W.z) < W.r + 3.5); }
  function ferrisBoardSpot(){ const W = ZONES.plaza.wheel; return { x: W.x, z: W.z + W.r + 1.6 }; }
  // Chạm vào vòng đu quay (đo theo trục đứng của nó trên màn hình)
  function pickFerris(cx, cy){
    const W = ZONES.plaza.wheel; if(!W || !ferris) return false;
    camera.updateMatrixWorld();
    const pr=(x,y,z)=>{ const v=_fv.set(x,y,z).project(camera); return v.z<1 ? [(v.x+1)/2*window.innerWidth, (1-v.y)/2*window.innerHeight] : null; };
    const a=pr(W.x, 1.5, W.z), b=pr(W.x, W.h + W.R, W.z); if(!a || !b) return false;
    const dx=b[0]-a[0], dy=b[1]-a[1];
    const t=Math.max(0, Math.min(1, ((cx-a[0])*dx + (cy-a[1])*dy) / ((dx*dx + dy*dy) || 1)));
    return Math.hypot(cx-(a[0]+dx*t), cy-(a[1]+dy*t)) < 80;
  }
  function setScreenText(a, b){
    if(!screenCanvas) return;
    const g = screenCanvas.getContext('2d'), gr = g.createLinearGradient(0,0,1280,720);
    gr.addColorStop(0,'#0f1b33'); gr.addColorStop(1,'#1c2f55'); g.fillStyle = gr; g.fillRect(0,0,1280,720);
    g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.font = 'bold 120px sans-serif'; g.fillText(a, 640, 340);
    g.fillStyle = '#fff'; g.font = '44px sans-serif'; g.fillText(b, 640, 430);
    screenTex.needsUpdate = true;
  }
  // 4 góc màn hình (TL,TR,BR,BL) theo toạ độ pixel; null nếu không có / quá nhỏ / đang nhìn từ ĐẰNG SAU TV
  function screenCorners2D(){
    if(!screenInfo) return null;
    const sc = screenInfo, zf = sc.z + 0.18, W = window.innerWidth, H = window.innerHeight;
    camera.updateMatrixWorld();
    // Màn hình hướng về +z (về phía công viên). Camera ở phía sau (z < zf) => không chiếu iframe (tránh ảnh lật ngược)
    if(camera.position.z < zf) return null;
    const vs = [[-1,1],[1,1],[1,0],[-1,0]].map(([kx,ky])=> new THREE.Vector3(sc.x + kx*sc.w/2, sc.y + ky*sc.h, zf));
    if(vs.some(v=> v.clone().applyMatrix4(camera.matrixWorldInverse).z > -0.2)) return null;
    const pts = vs.map(v=>{ const p = v.project(camera); return [(p.x+1)/2*W, (1-p.y)/2*H]; });
    // Kiểm tra chiều quay (winding): diện tích có dấu <= 0 nghĩa là nhìn từ mặt sau (homography sẽ lật ảnh) => ẩn
    let area = 0;
    for(let i=0;i<4;i++){ const x1=pts[i][0], y1=pts[i][1], x2=pts[(i+1)%4][0], y2=pts[(i+1)%4][1]; area += x1*y2 - x2*y1; }
    if(area <= 0) return null;
    return pts;
  }

  // ===== RENDER LOOP =====
  let lastFrameT = performance.now();
  const dtRender = ()=>{ const n = performance.now(); const d = (n - lastFrameT)/1000; lastFrameT = n; return Math.min(0.1, Math.max(0.001, d)); };
  function render(time){
    if(!RES.fixed){   // chỉ hạ, không tăng lại → không bị giật qua lại giữa 2 mức
      const now = performance.now();
      if(document.hidden){ RES.t = 0; RES.n = 0; }
      else if(!RES.t){ RES.t = now; RES.n = 0; }
      else if(++RES.n && now-RES.t >= 1500){
        const fps = RES.n*1000/(now-RES.t); RES.t = now; RES.n = 0;
        if(RES.warm) RES.warm = false;                      // bỏ qua cửa sổ đầu (biên dịch shader)
        else if(fps < 24 && RES.cur > RES.min){
          if(++RES.low >= 2){ RES.low = 0; RES.cur = Math.max(RES.min, RES.cur-0.5); renderer.setPixelRatio(RES.cur); renderer.setSize(window.innerWidth, window.innerHeight); }
        } else RES.low = 0;
      }
    }
    spinners.forEach(m=>{ m.rotation.y = time*1.5; });
    ferrisSync(time);
    if(fountainFx) fountainFx.update(time);
    for(let i=0;i<animFns.length;i++) animFns[i](time);      // sóng biển, thuyền nhấp nhô…
    // ===== ngày / đêm: giờ máy quyết định, đổi mượt ~1,2s (đổi tức thời thì mắt khó chịu) =====
    syncClock();
    if(nightDirty){ nightDirty = false; applyNight(DN.k); }     // zone vừa dựng cần nhận trạng thái trời hiện tại
    if(DN.k !== DN.target){
      const dt = dtRender();
      DN.k += (DN.target - DN.k) * Math.min(1, dt * 2.2);
      if(Math.abs(DN.target - DN.k) < 0.004) DN.k = DN.target;
      applyNight(DN.k);
    }
    if(waterMesh){
      const pos = waterMesh.geometry.attributes.position.array;
      for(let i=0;i<pos.length;i+=3){
        pos[i+2] = Math.sin(time*2 + pos[i]*0.3 + pos[i+1]*0.2)*0.15;
      }
      waterMesh.geometry.attributes.position.needsUpdate = true;
      waterMesh.geometry.computeVertexNormals();
    }
    renderer.render(scene, camera);
    lastFrameT = performance.now();
  }

  return { init, buildZone, createCharacter, setChatBubble, updateCharacter,
    updateCamera, getMoveDir, collides, aircraftCollision, roofLandingAltitude, atPortal, nearBuilding, atDock, render, nearSpot, pickBench, nearBench, setTapHandler, setScreenText, screenCorners2D, setRacers, setRaceBoard, getLotSlots, setLotTaken, setLotBadgeVisible, lotText,
    getZone, groundY, CHAR_DEFS,
    // ngày / đêm (tự chạy theo giờ thiết bị)
    setNight, followClock, isNight, get night(){ return DN.k; }, get nightTarget(){ return DN.target; },
    // vòng đu quay
    ferrisSync, ferrisSeat, ferrisYaw, nearFerris, pickFerris, ferrisBoardSpot, get ferrisCabins(){ return ferris ? ferris.gond.length : 0; },
    // đảo câu cá
    atFishSpot: (x,z)=> atDock('fishing', x, z),
    fishDir,
    // camera (tiện cho test / chỉnh map)
    setCam: (d, p, a)=>{ if(d) setCamDist(d); if(p!==undefined) camPitch = camClamp(p, CAM.minPitch, CAM.maxPitch); if(a!==undefined) camAngle = a; camSnap = true; },
    camState: ()=>({ dist:camDist, pitch:camPitch, angle:camAngle }),
    get scene(){return scene;}, get camera(){return camera;}, get pixelRatio(){return RES.cur;},
    stats(){ return renderer ? { calls:renderer.info.render.calls, tris:renderer.info.render.triangles, geo:renderer.info.memory.geometries, tex:renderer.info.memory.textures } : null; } };
})();
