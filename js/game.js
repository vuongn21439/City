/* ===== GCITY 3D - Main Game Loop ===== */
(() => {
  let player = null;        // player data (logic)
  let playerMesh = null;    // THREE.Group
  let otherMeshes = {}, npcs = [];     // id -> THREE.Group
  let input = { keys:{}, joy:{x:0,y:0}, run:false };
  let speedBoost = 0;
  let ferrisRide = -1;   // chỉ số cabin đang ngồi (-1 = không ngồi)
  let ferrisArmed = false;   // true khi đã nhả hết phím/joystick di chuyển sau lúc lên cabin (khi đó mới cho "bấm di chuyển để xuống")
  const MOVE_KEYS = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  let riding = null;   // {type:'car'|'plane', slot, v:THREE.Group, prop, wheels, seat, yaw, alt, targetAlt, remain, maxSpeed, engine, autoDescend}
  const vInput = { fwd:false, back:false, up:false, down: false };
  const SHOW_FPS = /[?&]debug=1/.test(location.search);   // bộ đếm FPS chỉ dành cho dev (thêm ?debug=1 vào URL)
  const _fseat = new THREE.Vector3(), _seatOffset = new THREE.Vector3();
  // ===== Lưu dữ liệu người chơi =====
  // localStorage là chính (đủ: tên, giới tính, nhân vật, xu, túi đồ). Cookie giữ bản rút gọn (tên/giới tính/nhân vật/xu) để dự phòng
  // khi localStorage bị chặn/xoá. Dữ liệu gắn với TÊN MIỀN: đổi domain (www ↔ không www, http ↔ https, localhost ↔ 127.0.0.1) là coi như máy mới.
  const Save = {
    key: 'gcity_save_v1', warned: false,
    parse(raw){ try{ const s = JSON.parse(raw); return (s && typeof s.name==='string' && s.name && (s.gender==='male'||s.gender==='female')) ? s : null; }catch(e){ return null; } },
    load(){
      let s = null;
      try{ s = this.parse(localStorage.getItem(this.key)); }catch(e){}
      if(!s){ try{ const m = document.cookie.match(/(?:^|; )gcity_save=([^;]*)/); if(m) s = this.parse(decodeURIComponent(m[1])); }catch(e){} }
      return s;
    },
    write(d){
      const raw = JSON.stringify(d); let ok = false;
      try{ localStorage.setItem(this.key, raw); ok = (localStorage.getItem(this.key) === raw); }catch(e){}
      try{ document.cookie = 'gcity_save=' + encodeURIComponent(JSON.stringify({ name:d.name, gender:d.gender, charIndex:d.charIndex, coins:d.coins })) + ';max-age=31536000;path=/;SameSite=Lax'; }catch(e){}
      if(!ok && !this.warned){ this.warned = true; try{ UI.toast('Không thể lưu tiến trình trên trình duyệt này. Hãy tắt chế độ ẩn danh.'); }catch(e){} }
      return ok;
    },
    clear(){ try{ localStorage.removeItem(this.key); }catch(e){} try{ document.cookie='gcity_save=;max-age=0;path=/'; }catch(e){} }
  };
  let curChar = null, entered = false;
  function saveNow(){
    if(!curChar || !player) return;
    Save.write({ v:2, t:Date.now(), name:curChar.name, gender:curChar.gender, charIndex:curChar.charIndex,
                 coins: Number.isFinite(player.coins) ? player.coins : GCITY_CONFIG.GAME.startCoins, inventory:player.inventory,
                 pending: (typeof Park!=='undefined' && Park.getPending) ? Park.getPending() : null });   // pending: ván quay số / lật hình đang dở
  }
  // Lưu theo đồng hồ thật (không phụ thuộc FPS) + lưu ngay khi ẩn tab / thoát app (trên điện thoại beforeunload hay không chạy)
  setInterval(saveNow, 2000);
  window.addEventListener('beforeunload', saveNow);
  window.addEventListener('pagehide', saveNow);
  window.addEventListener('gcity-save', saveNow);   // Park bắn sự kiện này ngay khi trừ xu / trả thưởng, không chờ vòng lưu 2s
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') saveNow(); });
  try{ if(navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}   // xin trình duyệt đừng tự dọn dữ liệu
  let currentZone = 'plaza';

  function $(id){ return document.getElementById(id); }

  // ---- Input ----
  window.addEventListener('keydown', e=>{
    const typing = e.target && e.target.tagName==='INPUT';
    if(e.code==='Escape'){             // Esc luôn hoạt động, kể cả khi đang gõ trong ô chat / link
      if(typing) e.target.blur();
      if(UI.closeConfirm() || UI.closeCharSwitch()) return;
      document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
      return;
    }
    if(typing) return; // đang gõ chat/link thì đừng điều khiển nhân vật
    if(riding && e.code==='Space') e.preventDefault();   // Space = Bay lên; không để nó bấm nhầm nút đang focus / cuộn trang
    input.keys[e.code]=true;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=true;
  });
  window.addEventListener('keyup', e=>{
    input.keys[e.code]=false;
    if(e.code==='ShiftLeft'||e.code==='ShiftRight') input.run=false;
  });
  // Mất focus (alt-tab, mở app khác, ẩn tab) thì nhả hết phím — nếu không sẽ không nhận được keyup và nhân vật chạy mãi
  function releaseKeys(){
    input.keys = {}; if(!$('btnRun').classList.contains('on')) input.run = false;
    Object.keys(vInput).forEach(k=>vInput[k]=false);   // nút HUD xe/máy bay: pointerup có thể không bao giờ tới khi tab bị ẩn
    document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('hold'));
  }
  window.addEventListener('blur', releaseKeys);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') releaseKeys(); });

  // ---- Boot ----
  const loadSteps = [[10,'Đang tải trò chơi…'],[30,'Đang chuẩn bị nhân vật…'],[55,'Đang tải thành phố…'],[75,'Sắp hoàn tất…'],[95,'Đang kết nối…'],[100,'Sẵn sàng']];
  let step=0;
  const loadTimer = setInterval(()=>{
    if(step<loadSteps.length){ UI.setLoading(loadSteps[step][0], loadSteps[step][1]); step++; }
    else { clearInterval(loadTimer); UI.hideLoading(); const sv=Save.load(); if(sv){ const n=Scene3D.CHAR_DEFS[sv.gender].length; enterGame({name:sv.name, gender:sv.gender, charIndex:Math.min(Math.max(0,sv.charIndex|0),n-1), _save:sv}); } else UI.showCharSelect(); }
  }, 400);

  async function enterGame(charData){
    if(entered) return; entered = true;   // chặn bấm đúp "Vào thành phố" → dựng 2 cảnh
    try {
    UI.hideCharSelect();
    $('loadingScreen').classList.remove('hidden');
    UI.setLoading(100, 'Đang vào thành phố…');

    // init 3D
    Scene3D.init($('threeContainer'));
    const zone = Scene3D.buildZone('plaza');
    currentZone = 'plaza';

    const spawn = zone.spawn;
    player = Player.create({ id:'me', name:charData.name, gender:charData.gender, charIndex:charData.charIndex, x:spawn.x, y:0 });
    const sv = charData._save;
    if(sv){
      player.coins = typeof sv.coins==='number' ? sv.coins : GCITY_CONFIG.GAME.startCoins;
      player.inventory = Object.assign({worm:10,shrimp:0,lure:0,fish:0,rod:1}, sv.inventory||{});
    }
    curChar = { name:charData.name, gender:charData.gender, charIndex:charData.charIndex };
    saveNow();   // lưu NGAY khi tạo nhân vật, không chờ vòng lặp
    player.zone = 'plaza';
    playerMesh = Scene3D.createCharacter(charData.gender, charData.charIndex, charData.name, true);
    playerMesh.position.set(spawn.x, 0, spawn.z);
    Scene3D.scene.add(playerMesh);

    await Net.init({ id:'me', name:charData.name, gender:charData.gender, charIndex:charData.charIndex, x:spawn.x, y:spawn.z });

    // tạo mesh cho các player khác (bao gồm bot)
    function ensureOtherMesh(p){
      if(!otherMeshes[p.id]){
        const m = Scene3D.createCharacter(p.gender||'male', p.charIndex||0, p.name, false);
        m.position.set(p.x||0, 0, p.y||0);
        Scene3D.scene.add(m);
        otherMeshes[p.id] = m;
      }
      return otherMeshes[p.id];
    }
    Net.getPlayers().forEach(ensureOtherMesh);
    // NPC đứng ở các điểm tương tác: [tên, giới tính, kiểu, x, z, hướng mặt, câu chào, hành động, zone (mặc định plaza)]
    const npcRaw = [
      ['🐎 Đua Thú','female',1,31.9,-1.5,-Math.PI/2,'Mời bạn chọn thú đua.','race'],
      ['🚗 Thuê Phương Tiện','male',2,-36.2,5.1,-Math.PI/2,'Thuê xe hoặc máy bay.','rental'],
      ['🍀 Số May Mắn','male',1,23.5,-22.5,0,'Thử vận may của bạn.','lottery'],
      ['🍕 Quán Pizza','female',4,22.5,-8,-Math.PI/2,'Chào bạn, chúc vui vẻ.'],
      ['🛒 Tạp Hóa','male',5,-20.5,-22.5,0,'Chào mừng bạn!'],
      ['🃏 Lật Hình','female',0,-9.2,0,Math.PI/2,'Lật cặp hình giống nhau.','memory'],
      ['⭐ Vòng Quay May Mắn','male',0,3,13.4,Math.atan2(-3,-13.4),'Chọn số may mắn của bạn.','lo'],
      ['📺 Màn Hình Lớn','male',3,12.5,-29.5,0,'Phát video YouTube.','tv'],
      ['🎣 Bến Câu Cá','female',3,-10.8,-8.7,0,'Mời bạn ra bến câu cá.','fish','fishing'],   // đứng sau quầy chòi câu cá
    ];
    npcs = npcRaw.map(([name,g,c,x,z,f,line,act,zone,angler])=>{
      const m = Scene3D.createCharacter(g, c, name, false);
      m.position.set(x, 0, z); m.userData.face = f;
      if(angler) m.userData.action = 'fish';     // câu sẵn ngay khi vào map
      Scene3D.scene.add(m);
      return { m, line, x, z, home:f, cd: Math.random()*6, wv:0, act, angler:!!angler, bite: 3+Math.random()*9, zone:zone||'plaza' };
    });
    Net.onPlayerJoin(p=>{ ensureOtherMesh(p); UI.renderPlayers(Net.getPlayers()); });
    Net.onPlayerLeave(id=>{ if(otherMeshes[id]){ Scene3D.scene.remove(otherMeshes[id]); delete otherMeshes[id]; } UI.renderPlayers(Net.getPlayers()); });
    Net.onChat(msg=>{
      UI.addChat(msg.name, msg.text, msg.id==='system');
      if(msg.id==='me' || msg.id===Net.myId()){
        Scene3D.setChatBubble(playerMesh, msg.text);
        clearTimeout(playerMesh._chatT);
        playerMesh._chatT = setTimeout(()=>Scene3D.setChatBubble(playerMesh, null), 5000);
      } else {
        const m = otherMeshes[msg.id];
        if(m){ Scene3D.setChatBubble(m, msg.text); clearTimeout(m._chatT); m._chatT=setTimeout(()=>Scene3D.setChatBubble(m,null),5000); }
      }
    });

    UI.initPanels({
      onChatSend: text=> Net.sendChat(text),
      onEmote: id=>{
        if(fishing) cancelFishing();
        const ud = playerMesh.userData;
        if(id==='lotus' && ud.action==='sit'){   // đang ngồi ghế: bước ra trước ghế rồi mới ngồi xuống đất, không xuyên vào ghế
          const nx = playerMesh.position.x + Math.sin(ud.face||0)*1.3, nz = playerMesh.position.z + Math.cos(ud.face||0)*1.3;
          if(!Scene3D.collides(currentZone, nx, nz)){ playerMesh.position.x = nx; playerMesh.position.z = nz; player.x = nx; player.y = nz; }
        }
        Player.doAction(player, id); ud.action = player.action; ud.actionT = 0;
        try{ Net.sendMyState({ x:player.x, y:player.y, action:player.action }); }catch(e){}
      },
      onAction: handleAction,
      getPlayer: ()=> player,
      refreshPlayers: ()=> UI.renderPlayers(Net.getPlayers()),
    });
    UI.initJoystick(j=> input.joy = j);
    if($('fishQuick')) $('fishQuick').onclick = fishQuickTap;
    function openCharSwitch(){
      if(riding){ UI.toast('Vui lòng xuống xe trước khi đổi nhân vật'); return; }
      UI.openCharSwitch(curChar, ({ name, gender:gd, charIndex:ci })=>{
        const old = playerMesh, nm = Scene3D.createCharacter(gd, ci, name, true);
        nm.position.copy(old.position); nm.userData.face = old.userData.face;
        nm.userData.action = old.userData.action; nm.userData.moving = old.userData.moving;
        Scene3D.scene.remove(old); Scene3D.scene.add(nm); playerMesh = nm;
        player.name = name; player.gender = gd; player.charIndex = ci;
        curChar = { name, gender:gd, charIndex:ci };
        $('hudName').textContent = name;
        UI.toast('Đã đổi nhân vật');
        saveNow();
      });
    }
    $('btnChar').onclick = openCharSwitch;
    $('btnRun').onclick = ()=>{ input.run = !input.run; $('btnRun').classList.toggle('on', input.run); };
    Park.init(player);
    if(sv && sv.pending) Park.settlePending(sv.pending);   // lần trước đóng tab giữa ván quay số / lật hình → trả kết quả / hoàn xu
    saveNow();
    UI.updateHUD(player);
    UI.renderPlayers(Net.getPlayers());
    UI.addChat('Hệ thống', `Chào mừng ${player.name} đến GCITY 3D. Dùng WASD hoặc joystick để di chuyển; chạm vào nhân vật (hoặc nhấn E khi ở gần) để tương tác.`, true);

    setTimeout(()=> $('loadingScreen').classList.add('hidden'), 500);
    requestAnimationFrame(loop);
    } catch(e) {
      const isWebGL = /WebGL/i.test(e.message);
      $('loadingText').style.whiteSpace='pre-wrap';
      $('loadingText').style.color = '#ff8888';
      $('loadingText').textContent = isWebGL
        ? 'Thiết bị hoặc trình duyệt của bạn chưa hỗ trợ đồ họa 3D. Vui lòng dùng Chrome, Edge hoặc Safari phiên bản mới.'
        : 'Chưa vào được thành phố. Vui lòng tải lại trang.';
      console.error(e);
    }
  }
  // Hook cho test / chỉnh map: CHỈ có khi chạy local (localhost / file://). Bản deploy không mở ra cho người chơi.
  const IS_LOCAL = ['localhost','127.0.0.1','[::1]',''].includes(location.hostname);
  if(IS_LOCAL) window.__gcity = {
    setZone(id){
      currentZone = id; walkTo = null; ferrisRide = -1;
      Scene3D.buildZone(id);
      Scene3D.scene.add(playerMesh);
      player.zone = id;
      Object.values(otherMeshes).forEach(mm=>{ Scene3D.scene.add(mm); mm.visible = (id==='plaza'); });
      npcs.forEach(n=> n.m.visible = (n.zone===id));
      const sp = Scene3D.getZone(id).spawn;
      playerMesh.position.set(sp.x, 0, sp.z);
      UI.updateHUD(player);
    },
    setNight:(v, instant)=>Scene3D.setNight(!!v, !!instant),
    move(x, z){ playerMesh.position.set(x, 0, z); },
    cam:{ dist:d=>Scene3D.setCam(d), pitch:p=>Scene3D.setCam(0, p), angle:a=>Scene3D.setCam(0, undefined, a) },
    fish: ()=>Fishing.getState(),
    player: ()=>playerMesh,
    scene: Scene3D
  };
  UI.initCharSelect(enterGame);

  // Nút ←: hỏi lại trước khi thoát (trước đây bấm nhầm là văng khỏi game)
  $('btnExit').onclick = ()=> UI.askConfirm('Bạn muốn thoát khỏi trò chơi?', 'Thoát', ()=>{
    saveNow();
    if(history.length > 1) history.back(); else UI.toast('Bạn có thể đóng tab để thoát.');
  });

  // ---- Actions (shop/fish/etc) ----
  function handleAction(type, data){
    if(type==='fishCast'){
      if(currentZone!=='fishing' || !Scene3D.atDock('fishing', playerMesh.position.x, playerMesh.position.z)){
        UI.toast('Hãy đến bến câu hoặc đứng gần mép nước để quăng cần'); return;
      }
      const st = Fishing.getState().state;
      if(st==='biting' || st==='waiting'){ Fishing.reel(player, onFishEvent); return; }
      if(st!=='idle') return;                       // đang quăng / đang nhận cá: bỏ qua
      beginFishPose();                              // quay mặt ra nước + cầm cần
      if(!Fishing.cast(player, onFishEvent)) endFishPose();   // hết mồi → bỏ tư thế
    }
    else if(type==='fishSell'){ const r=Fishing.sellAll(player); if(r.count>0) UI.toast(`Đã bán ${r.count} con cá · +${r.money} xu`); else UI.toast('Bạn chưa có cá để bán'); UI.updateHUD(player); }
    else if(type==='buyBait'){
      if(player.coins<data.price){ UI.toast(UI.NO_COIN); return; }
      player.coins-=data.price; player.inventory[data.bait]=(player.inventory[data.bait]||0)+5;
      UI.toast('Mua thành công'); UI.updateHUD(player);
    }
    else if(type==='buyLotto'){
      const num=(data||'').trim(); if(!/^\d{3}$/.test(num)){UI.toast('Vui lòng nhập đúng 3 chữ số');return;}
      if(player.coins<10){UI.toast(UI.NO_COIN);return;} player.coins-=10;
      const res=String(Math.floor(Math.random()*1000)).padStart(3,'0'); let prize=0;
      if(num===res)prize=1000; else if(num[1]===res[1]&&num[2]===res[2])prize=100; else if(num[2]===res[2])prize=20;
      if(prize){player.coins+=prize; UI.toast(`Chúc mừng! +${prize} xu · Kết quả: ${res}`);} else UI.toast(`Chưa trùng khớp · Kết quả: ${res}`);
      const lr=$('lottoResult'); if(lr)lr.textContent=`${num} · Kết quả: ${res}${prize?` · +${prize} xu`:''}`;
      UI.updateHUD(player);
    }
    else if(type==='rentSkate'){ if(player.coins<15){UI.toast(UI.NO_COIN);return;} player.coins-=15; speedBoost=Math.max(speedBoost,30); UI.toast('Đã thuê giày trượt · tăng tốc 30 giây'); UI.updateHUD(player); }
    else if(type==='rentVehicle'){
      const slot = Scene3D.getLotSlots()[data.slot];
      if(riding){ UI.toast('Bạn đang sử dụng một phương tiện'); return; }
      if(!slot || slot.taken){ UI.toast('Phương tiện này vừa được thuê'); openVehicleShop(); return; }
      const price = Vehicles.PRICE[slot.kind];
      if(player.coins<price){ UI.toast(UI.NO_COIN); return; }
      player.coins -= price; UI.updateHUD(player);
      mountVehicle(slot);
    }
    else if(type==='buyRod'){ if(player.coins<100){UI.toast(UI.NO_COIN);return;} if(player.inventory.rod>=2){UI.toast('Bạn đã có cần câu cao cấp');return;} player.coins-=100; player.inventory.rod=2; UI.toast('Đã nâng cấp cần câu'); UI.updateHUD(player); }
  }
  // ===== Tư thế câu cá của người chơi (v20): chỉ cầm cần sau khi bấm quăng; đi hoặc bấm emote là thôi câu (mồi đã quăng coi như mất) =====
  const FISH_ACTS = ['fish','cast','bite','reel'];
  let fishing = false;
  function beginFishPose(){
    const ud = playerMesh.userData;
    ud.face = Scene3D.fishDir(playerMesh.position.x, playerMesh.position.z);   // tự quay mặt ra phía nước
    ud.action = 'fish'; ud.actionT = 0; ud.moving = false;
    player.action = 'fish'; walkTo = null; fishing = true;
    try{ Net.sendMyState({ x:player.x, y:player.y, action:'fish' }); }catch(e){}
  }
  function endFishPose(){
    fishing = false;
    const ud = playerMesh.userData;
    if(FISH_ACTS.indexOf(ud.action) >= 0){ ud.action = null; player.action = null; try{ Net.sendMyState({ x:player.x, y:player.y, action:null }); }catch(e){} }
  }
  function cancelFishing(){ Fishing.reset(); resetFishBtn(); endFishPose(); }
  // Nút 🎣 nổi bên trái (chỉ hiện ở đảo câu cá): chạm để quăng; khi cá cắn (đỏ, nhấp nháy "KÉO!") chạm để kéo
  let _fq = '';
  function refreshFishQuick(){
    const b = $('fishQuick'); if(!b) return;
    const on = currentZone==='fishing' && !riding, st = Fishing.getState().state;
    const key = on + st; if(key===_fq) return; _fq = key;
    b.classList.toggle('hidden', !on);
    b.classList.toggle('bite', st==='biting'); b.classList.toggle('wait', st==='waiting' || st==='casting');
    b.innerHTML = '<span class="fq-ic">🎣</span><span class="fq-lb">' + (st==='biting' ? 'KÉO!' : (st==='waiting' || st==='casting' ? 'Chờ…' : 'Quăng')) + '</span>';
  }
  function fishQuickTap(){
    if(currentZone!=='fishing' || riding) return;
    if(Fishing.getState().state==='waiting'){ UI.toast('Hãy chờ cá cắn câu'); return; }   // kéo sớm là cá chạy mất → chặn (chỉ nút nổi; bảng ở NPC giữ logic cũ)
    handleAction('fishCast');
  }
  function onFishEvent(ev){
    if(ev.type==='casting') UI.closePanel('fishPanel');   // đóng bảng để thấy nhân vật quăng cần
    const b = $('fishCastBtn');
    if(ev.type==='error') UI.toast(ev.msg);
    else if(ev.type==='casting'){ UI.toast('Đã quăng cần. Hãy chờ cá cắn'); b.textContent='Kéo cần'; }
    else if(ev.type==='biting'){ UI.toast('Cá cắn câu! Hãy kéo cần ngay'); b.textContent='KÉO NGAY!'; b.style.background='linear-gradient(135deg,#ef4444,#dc2626)'; }
    else if(ev.type==='caught'){ UI.toast(`Câu được ${ev.fish.icon} ${ev.fish.name} · ${ev.fish.value} xu`); resetFishBtn(); }
    else if(ev.type==='escaped'||ev.type==='too_early'){ UI.toast('Cá đã thoát'); resetFishBtn(); }
    UI.updateHUD(player);
  }
  function resetFishBtn(){ const b=$('fishCastBtn'); if(b){b.textContent='Quăng cần'; b.style.background='';} }

  // E / chạm vào dòng gợi ý để tương tác (building, mini game, ghế, màn hình)
  // Game chỉ chơi qua NPC: lại gần NPC rồi chạm vào NPC (mobile) hoặc bấm E (desktop). Không có chữ gợi ý.
  const NPC_R = 5;
  const NPC_ACT = {
    race:()=>Park.openRace(), memory:()=>Park.openGame('memory'), lo:()=>Park.openGame('lo'),
    fish:()=>UI.openPanel('fishPanel'), tv:()=>UI.openPanel('tvPanel'),
    lottery:()=>UI.openShop('lottery'), rental:()=>openVehicleShop(),
  };
  const npcDist = n => Math.hypot(playerMesh.position.x - n.x, playerMesh.position.z - n.z);
  function nearestNpc(){
    let best = null, bd = NPC_R;
    npcs.forEach(n=>{ if(n.zone!==currentZone) return; const d = npcDist(n); if(n.act && d < bd){ bd = d; best = n; } });
    return best;
  }
  function npcAt(cx, cy){   // NPC (đang trong tầm) gần điểm chạm nhất; dung sai 42px cho ngón tay
    const cam = Scene3D.camera, W = window.innerWidth, H = window.innerHeight; cam.updateMatrixWorld();
    let best = null, bd = 42;
    npcs.forEach(n=>{
      if(!n.act || n.zone!==currentZone || npcDist(n) > NPC_R) return;
      const pt = y=>{ const v = new THREE.Vector3(n.x, y, n.z).project(cam); return v.z < 1 ? [(v.x+1)/2*W, (1-v.y)/2*H] : null; };
      const a = pt(0.2), b = pt(1.9); if(!a || !b) return;
      const abx = b[0]-a[0], aby = b[1]-a[1];
      const t = Math.max(0, Math.min(1, ((cx-a[0])*abx + (cy-a[1])*aby) / ((abx*abx + aby*aby) || 1)));
      const d = Math.hypot(cx - (a[0]+abx*t), cy - (a[1]+aby*t));
      if(d < bd){ bd = d; best = n; }
    });
    return best;
  }
  function interact(){
    if(!playerMesh || riding) return;   // đang lái xe/máy bay: E không được mở shop / ngồi ghế / lên đu quay
    if(ferrisRide >= 0 || Scene3D.nearFerris(playerMesh.position.x, playerMesh.position.z)){ toggleFerris(); return; }
    const npc = nearestNpc(); if(npc){ NPC_ACT[npc.act](); return; }
    const s = Scene3D.nearSpot(currentZone, playerMesh.position.x, playerMesh.position.z);
    if(!s){ const b = Scene3D.nearBench(currentZone, playerMesh.position.x, playerMesh.position.z); if(b) toggleSit(b); return; }
    if(s.kind==='building'){
      const t = s.ref.type;
      if(t==='fishshop'){ UI.togglePanel('fishPanel'); return; }
      if(t==='lottery' || t==='rental'){ UI.togglePanel('shopPanel'); UI.renderShop(t); return; }
      UI.toast('Công trình này hiện chưa mở cửa');   // rạp phim / cửa hàng chỉ để trang trí (chưa có dịch vụ)
    }
    else if(s.kind==='screen') UI.togglePanel('tvPanel');
    else if(s.kind==='vehicle') openVehicleShop();
  }
  function sitOn(b){
    const ud = playerMesh.userData;
    playerMesh.position.set(b.x, 0, b.z); ud.face = b.ry; ud.action = 'sit'; ud.actionT = 0; player.action = 'sit';
    player.x = b.x; player.y = b.z; Net.sendMyState({ x:b.x, y:b.z, action:'sit' });
  }
  // ===== CHỐNG KẸT GHẾ =====
  // Lỗi cũ: lúc ngồi, nhân vật nằm ngay TÂM hộp va chạm của ghế (|lx|<1.4, |lz|<0.74). Đứng dậy xong mỗi bước đi (~0.07 đơn vị/khung)
  // đều vẫn nằm trong hộp đó → collides() trả true cả 2 trục → không nhúc nhích được nữa.
  // Cách sửa 2 lớp: (1) đứng dậy thì bước ra phía trước ghế, chỗ trống gần nhất; (2) lưới an toàn: đang kẹt trong hộp ghế thì bỏ qua va chạm ghế để bước ra.
  function inFurniture(x, z){   // đúng khi CHỈ riêng ghế đang chặn chỗ này (tường/cây/đài phun... vẫn tính bình thường)
    return Scene3D.collides(currentZone, x, z) && !Scene3D.collides(currentZone, x, z, 0.8, true);
  }
  function leaveBenchSpot(){
    const p = playerMesh.position;
    if(!inFurniture(p.x, p.z)) return;
    const f = playerMesh.userData.face || 0;
    for(const turn of [0, Math.PI/2, -Math.PI/2, Math.PI]){        // trước ghế → hai bên → sau lưng
      for(const dist of [1.3, 1.6, 2.0]){                          // gần → xa (hai bên cần ≥1.4 mới ra khỏi hộp)
        const nx = p.x + Math.sin(f+turn)*dist, nz = p.z + Math.cos(f+turn)*dist;
        if(!Scene3D.collides(currentZone, nx, nz)){ p.x = nx; p.z = nz; player.x = nx; player.y = nz; return; }
      }
    }
    // hết chỗ trống: để lớp (2) trong vòng lặp cho nhân vật tự bước ra
  }
  function standUp(){
    const ud = playerMesh.userData;
    if(!Player.isSeated(ud.action)) return;
    ud.action = null; player.action = null;
    leaveBenchSpot();
    Net.sendMyState({ x:player.x, y:player.y, action:null });
  }
  function toggleSit(b){ if(Player.isSeated(playerMesh.userData.action)) standUp(); else sitOn(b); }

  // Chạm vào ghế: đi tới + ngồi (đứng sát thì ngồi luôn). Chạm ra chỗ khác: đứng dậy / huỷ đi. Di chuyển joystick/WASD: tự đứng dậy (xử lý trong loop).
  let walkTo = null;   // { b: ghế đích, t: thời gian đã đi, stuck: thời gian bị kẹt }
  Scene3D.setTapHandler((cx, cy)=>{
    if(!playerMesh || riding) return;
    const npc = npcAt(cx, cy); if(npc){ UI.guardTap(); NPC_ACT[npc.act](); return; }
    if(Scene3D.pickFerris(cx, cy)){ toggleFerris(); return; }     // chạm vào vòng đu quay
    const sitting = Player.isSeated(playerMesh.userData.action);
    const b = Scene3D.pickBench(cx, cy);
    if(!b){ walkTo = null; if(sitting) standUp(); return; }
    const d = Math.hypot(playerMesh.position.x - b.x, playerMesh.position.z - b.z);
    if(sitting && d < 0.3) return;                     // đang ngồi đúng ghế này rồi
    if(walkTo && walkTo.b === b) return;               // đang đi tới ghế này rồi
    if(sitting) standUp();
    if(d <= 1.8){ walkTo = null; sitOn(b); }
    else walkTo = { b, t:0, stuck:0 };
  });
  window.addEventListener('keydown', e=>{ if(e.code==='KeyE' && !e.repeat && e.target.tagName!=='INPUT') interact(); });   // !e.repeat: giữ E thì OS bắn keydown liên tục -> lên/xuống cabin liên tục

  // ===== VÒNG ĐU QUAY: chạm vào vòng (hoặc bấm E khi ở gần) để ngồi vào cabin, chạm lần nữa để xuống =====
  function toggleFerris(){
    if(ferrisRide >= 0){                                    // đang ngồi → xuống đất
      const sp = Scene3D.ferrisBoardSpot();
      ferrisRide = -1;
      playerMesh.userData.action = null; player.action = null;
      playerMesh.userData.moving = false;
      playerMesh.position.set(sp.x, 0, sp.z);
      player.x = sp.x; player.y = sp.z;
      try{ Net.sendMyState({ x:sp.x, y:sp.z, action:null }); }catch(e){}
      return;
    }
    const n = Scene3D.ferrisCabins; if(!n) return;
    // chọn cabin ở góc phía gần người chơi nhất (để lên xe không bị "bay" từ xa)
    let best = 0, bd = 1e9;
    const v = new THREE.Vector3();
    for(let i=0;i<n;i++){ const p = Scene3D.ferrisSeat(i, v); const d = p.distanceTo(playerMesh.position); if(d<bd){ bd=d; best=i; } }
    ferrisRide = best; ferrisArmed = false;
    walkTo = null;
    playerMesh.userData.action = 'ride'; playerMesh.userData.actionT = 0;
    playerMesh.userData.moving = false; player.action = 'ride';
    try{ Net.sendMyState({ x:playerMesh.position.x, y:playerMesh.position.z, action:'ride' }); }catch(e){}
  }
  // ===== Xe / máy bay thuê: chạm NPC -> chọn xe -> nhân vật ngồi lên thật (model dùng chung trong js/vehicles.js) =====
  function openVehicleShop(){
    const list = Scene3D.getLotSlots().map(v=>({ i:v.i, kind:v.kind, name:v.name, cssColor:Vehicles.css(v.color), price:Vehicles.PRICE[v.kind], taken:v.taken }));
    UI.renderVehicleShop(list); UI.openPanel('vehiclePanel');
  }
  // vị trí mông nhân vật ngồi (world) từ vị trí/hướng xe + ghế local; y trừ 0.6 vì ở tư thế ngồi hông nằm cao hơn gốc nhân vật ~0.7
  function seatWorld(r){
    const st = r.seat;
    if(r.type==='plane'){
      _seatOffset.set(st.x,st.y-0.6,st.z).applyEuler(r.v.rotation);
      return { x:r.v.position.x+_seatOffset.x, y:r.alt+_seatOffset.y, z:r.v.position.z+_seatOffset.z };
    }
    const c = Math.cos(r.yaw), sn = Math.sin(r.yaw);
    return { x: r.v.position.x + st.x*c + st.z*sn, y: r.alt + st.y - 0.6, z: r.v.position.z - st.x*sn + st.z*c };
  }
  function mountVehicle(slot){
    if(riding){ UI.toast('Bạn đang sử dụng một phương tiện'); return; }
    const v = Vehicles.build(slot.kind, slot.color), ud = v.userData;
    v.position.set(slot.x, slot.kind==='plane'?0.03:0, slot.z); v.rotation.y = slot.yaw;
    Scene3D.scene.add(v);
    Scene3D.setLotTaken(slot.i, true);                  // xe rời khỏi bãi, bong bóng đếm còn x-1
    Scene3D.setLotBadgeVisible(false);
    if(slot.kind==='plane') v.rotation.order='YXZ';
    riding = { type:slot.kind, slot:slot.i, v, prop:ud.prop||null, wheels:ud.wheels||[], seat:ud.seat, flightBoxes:ud.flightBoxes||null,
               yaw:slot.yaw, pitch:0, bank:0, alt:slot.kind==='plane'?0.03:0, targetAlt:slot.kind==='plane'?0.03:0,
               remain:Vehicles.RENT_SEC, maxSpeed:ud.maxSpeed, autoDescend:false, engine:0, speed:0, netT:0, stuckT:0, hintT:0 };
    const um = playerMesh.userData;
    um.moving = false; um.action = 'ride'; um.actionT = 0; player.action = 'ride';   // ngồi thật lên ghế (tư thế lái xe)
    walkTo = null; speedBoost = 0;
    const sp = seatWorld(riding); player.x = sp.x; player.y = sp.z;
    try{ Net.sendMyState({x:player.x, y:player.y, action:'sit'}); }catch(e){}
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    const hud = $('vehicleHud'); hud.classList.remove('hidden');
    hud.classList.toggle('car-mode', slot.kind!=='plane');
    $('rentTimer').textContent = 'Xuống xe · 5:00';
    UI.toast(slot.kind==='plane' ? 'Giữ "Bay lên" (hoặc Space) để cất cánh; thả Tiến để lơ lửng' : 'Dùng joystick hoặc nút Tiến/Lùi để lái');
  }
  function dismountVehicle(){
    if(!riding) return;
    const v = riding.v, yaw = riding.yaw, slot = riding.slot;
    Scene3D.scene.remove(v);
    Scene3D.setLotTaken(slot, false);                   // xe tự về bãi
    Scene3D.setLotBadgeVisible(true);
    const spot = freeSpotNear(v.position.x, v.position.z);   // không bao giờ đặt nhân vật vào trong nhà / ngoài bản đồ
    playerMesh.position.set(spot.x, 0, spot.z);
    playerMesh.userData.face = yaw; playerMesh.userData.moving = false;
    playerMesh.rotation.set(0,yaw,0);
    playerMesh.userData.action = null; player.action = null;
    player.x = spot.x; player.y = spot.z;
    try{ Net.sendMyState({x:player.x, y:player.y, action:null}); }catch(e){}
    riding = null;
    $('vehicleHud').classList.add('hidden');
    Object.keys(vInput).forEach(k=>vInput[k]=false);
    document.querySelectorAll('.vbtn').forEach(b=>b.classList.remove('hold'));
    UI.toast('Đã trả phương tiện');
  }
  // chỗ trống gần nhất (quét xoắn ốc). Dùng khi xuống xe để nhân vật không rơi vào trong toà nhà / ra ngoài bản đồ rồi kẹt vĩnh viễn
  function freeSpotNear(x, z, rad = 0.8){
    if(!Scene3D.collides(currentZone, x, z, rad)) return { x, z };
    for(let d = 0.6; d <= 30; d += 0.6){
      for(let k = 0; k < 16; k++){
        const a = k*Math.PI/8, nx = x + Math.sin(a)*d, nz = z + Math.cos(a)*d;
        if(!Scene3D.collides(currentZone, nx, nz, rad)) return { x:nx, z:nz };
      }
    }
    const sp = Scene3D.getZone(currentZone).spawn || { x:0, z:0 };
    return { x:sp.x, z:sp.z };
  }
  const PLANE = { GROUND:0.03, MAX_ALT:22, VS:9, REV:0.45, LIMIT:52, BANK:0.52, PITCH:0.28 };
  function updateRiding(dt){
    const r = riding; if(!r) return;
    let thr = -input.joy.y;
    if(vInput.fwd) thr += 1; if(vInput.back) thr -= 1;
    if(input.keys['KeyW']||input.keys['ArrowUp']) thr += 1;
    if(input.keys['KeyS']||input.keys['ArrowDown']) thr -= 1;
    thr = Math.max(-1, Math.min(1, thr));
    let steer = input.joy.x;
    if(input.keys['KeyA']||input.keys['ArrowLeft']) steer -= 1;
    if(input.keys['KeyD']||input.keys['ArrowRight']) steer += 1;
    steer = Math.max(-1, Math.min(1, steer));
    const isPlane = r.type==='plane';
    const upKey = vInput.up || input.keys['Space'] || input.keys['KeyR'];      // Bay lên: nút HUD hoặc Space / R (bản cũ: bàn phím không có phím nào)
    const downKey = vInput.down || input.keys['KeyF'] || input.keys['KeyC'];   // Hạ cánh: nút HUD hoặc F / C
    const roofAlt = isPlane ? Scene3D.roofLandingAltitude(currentZone,r.v.position.x,r.v.position.z,r.yaw,r.flightBoxes) : null;
    if(isPlane){
      if(r.autoDescend) r.targetAlt = roofAlt===null ? 0 : roofAlt;
      else {
        // chỉ cất cánh được khi động cơ đã nổ đủ mạnh (cánh quạt đang quay)
        if(upKey && r.engine > 0.45) r.targetAlt += PLANE.VS*dt;
        if(downKey) r.targetAlt -= PLANE.VS*dt;
      }
      r.targetAlt = Math.max(roofAlt===null?PLANE.GROUND:roofAlt, Math.min(PLANE.MAX_ALT, r.targetAlt));
      // Altitude is held when vertical input is released, including at zero
      // forward speed, so the plane can hover instead of being forced to cruise.
      const climb = Math.max(-PLANE.VS, Math.min(PLANE.VS, (r.targetAlt-r.alt)*3));
      r.alt += climb * dt;
      const pitchTarget = Math.max(-PLANE.PITCH,Math.min(PLANE.PITCH,climb/PLANE.VS*PLANE.PITCH));
      r.pitch += (pitchTarget-r.pitch)*Math.min(1,dt*4);
      if(r.alt < PLANE.GROUND+0.02 && r.targetAlt <= PLANE.GROUND+0.01) r.alt = PLANE.GROUND;
    }
    const airborne = isPlane && r.alt > 0.5;    // đã rời đất (vẫn có thể đâm vào công trình nếu bay thấp)
    if(isPlane){ const bb = $('vBack'), lb = airborne ? 'Giảm ga' : 'Lùi'; if(bb && bb.textContent !== lb) bb.textContent = lb; }   // máy bay không bay lùi được: trên không nút này là giảm ga
    // Air throttle runs down to exactly zero. Releasing "Tiến" while aloft
    // settles into a stationary hover; "Lùi" reduces speed/brakes to hover.
    const tgt = airborne ? (thr > 0 ? thr*r.maxSpeed : 0)
                         : (thr >= 0 ? thr*r.maxSpeed : thr*r.maxSpeed*(isPlane ? PLANE.REV : 1));
    r.speed += (tgt - r.speed) * (isPlane ? Math.min(1, dt*(Math.abs(tgt) > Math.abs(r.speed) ? 2.2 : 3.5)) : 1);
    if(!airborne && Math.abs(tgt) < 0.01 && Math.abs(r.speed) < 0.15) r.speed = 0;
    const speed = r.speed;
    // yaw tăng = mũi quay sang TRÁI (ngược chiều kim đồng hồ nhìn từ trên xuống). Máy bay có camera đuổi sau lưng nên
    // "phải" phải đánh mũi sang phải trên màn hình → đảo dấu cho máy bay (xe giữ nguyên như bản gốc).
    r.yaw += (isPlane ? -steer : steer) * dt * 2.4 * (0.25 + Math.min(1, Math.abs(speed)/7));
    if(isPlane){
      const bankTarget = steer*PLANE.BANK*(0.35+Math.min(1,Math.abs(speed)/7));   // phải → cánh phải chúi xuống (rotation.z dương)
      r.bank += (bankTarget-r.bank)*Math.min(1,dt*3.5);
    }
    const nx = r.v.position.x + Math.sin(r.yaw)*speed*dt;
    const nz = r.v.position.z + Math.cos(r.yaw)*speed*dt;
    let x = r.v.position.x, z = r.v.position.z;
    const planeBlocked = (px,pz)=>isPlane
      ? (!!Scene3D.aircraftCollision(currentZone,px,r.alt,pz,r.yaw,-r.pitch,r.bank,r.flightBoxes) ||
         (r.alt<0.35 && Scene3D.collides(currentZone,px,pz,1.2)))
      : Scene3D.collides(currentZone,px,pz);
    if(!planeBlocked(nx,r.v.position.z)) x = nx;
    if(!planeBlocked(x,nz)) z = nz;
    if(isPlane){
      const L=PLANE.LIMIT-2.5,d=Math.hypot(x,z);
      if(d>L){ const k=L/d; x*=k; z*=k; }
    }
    r.v.position.set(x, r.alt, z);
    if(isPlane) r.v.rotation.set(-r.pitch,r.yaw,r.bank,'YXZ');
    else r.v.rotation.y = r.yaw;
    // If a descent reaches a structure, stop at its actual top rather than
    // letting the aircraft intersect the wall/prop. Buildings remain landable.
    if(isPlane){
      const hit=Scene3D.aircraftCollision(currentZone,x,r.alt,z,r.yaw,-r.pitch,r.bank,r.flightBoxes);
      if(hit && Number.isFinite(hit.top)){
        const minAltitude=hit.top-hit.bottomOffset+0.02;
        r.alt=Math.max(r.alt,minAltitude); r.targetAlt=Math.max(r.targetAlt,minAltitude);
        r.v.position.y=r.alt;
        if(hit.kind==='building'){
          r.roofContactAlt=minAltitude; r.roofContactX=x; r.roofContactZ=z;
        }
        if(r.autoDescend){ r.autoLandAlt=minAltitude; r.autoLandX=x; r.autoLandZ=z; }
      } else {
        if(r.roofContactAlt!==undefined &&
           (Math.hypot(x-r.roofContactX,z-r.roofContactZ)>0.6 || r.alt>r.roofContactAlt+0.5)){
          delete r.roofContactAlt; delete r.roofContactX; delete r.roofContactZ;
        }
        if(r.autoLandAlt!==undefined &&
           (Math.hypot(x-r.autoLandX,z-r.autoLandZ)>0.6 || r.alt>r.autoLandAlt+0.5)){
          delete r.autoLandAlt; delete r.autoLandX; delete r.autoLandZ;
        }
      }
    }
    // cánh quạt: đứng yên khi đỗ; bấm Bay lên / chạy trên đường băng thì bắt đầu quay (tăng dần), bay thì quay hết tốc lực
    if(r.prop){
      const want = (airborne || r.targetAlt > 0.3 || upKey) ? 1 : (Math.abs(thr) > 0.05 || r.autoDescend ? 0.45 : 0);
      r.engine += (want - r.engine) * Math.min(1, dt * (want > r.engine ? 1.8 : 1.0));
      if(r.engine < 0.01) r.engine = 0;
      r.prop.rotation.z += r.engine * 60 * dt;
    }
    r.wheels.forEach(w=>{ w.rotation.x += speed*dt/0.38; });
    player.x = x; player.y = z;
    Scene3D.updateCamera(x, z, r.alt, isPlane ? r.yaw : null);
    r.netT -= dt; if(r.netT <= 0){ r.netT = 0.15; try{ Net.sendMyState({x:x, y:z, action:'sit'}); }catch(e){} }
    r.remain -= dt;
    const mm = Math.max(0, Math.floor(r.remain/60)), ss = Math.max(0, Math.floor(r.remain%60));
    const rt = $('rentTimer'); if(rt) rt.textContent = `Xuống xe · ${mm}:${String(ss).padStart(2,'0')}`;
    if(r.remain <= 0 && !r.autoDescend){
      r.autoDescend = true;
      if(!isPlane || r.alt < 0.6){ dismountVehicle(); return; }
      UI.toast('Hết thời gian thuê. Đang hạ cánh…');
    }
    if(r.autoDescend && (!isPlane || r.alt < 0.35 ||
      (r.autoLandAlt!==undefined && Math.hypot(x-r.autoLandX,z-r.autoLandZ)<0.6 && r.alt<=r.autoLandAlt+0.08) ||
      (roofAlt!==null&&r.alt<=roofAlt+0.08))){ dismountVehicle(); }
  }
  // gắn sự kiện "giữ nút" cho các nút điều khiển xe/máy bay
  (function bindVehicleBtns(){
    const bind = (id, key)=>{
      const b = document.getElementById(id); if(!b) return;
      const on = e=>{ e.preventDefault(); vInput[key]=true; b.classList.add('hold'); try{ b.setPointerCapture(e.pointerId); }catch(_){} };   // capture: trượt ngón ra ngoài nút vẫn giữ, nhả ở đâu cũng nhận pointerup
      const off = ()=>{ vInput[key]=false; b.classList.remove('hold'); };
      b.addEventListener('lostpointercapture', off);
      b.addEventListener('pointerdown', on);
      b.addEventListener('pointerup', off);
      b.addEventListener('pointercancel', off);
      b.addEventListener('pointerleave', off);
    };
    bind('vFwd','fwd'); bind('vBack','back'); bind('vUp','up'); bind('vDown','down');
    const rt = document.getElementById('rentTimer');
    if(rt) rt.addEventListener('click', ()=>{
      if(!riding) return;
      if(riding.type==='plane' && riding.alt > 0.8 && !riding.autoDescend){ riding.autoDescend = true; UI.toast('Đang hạ cánh…'); }
      else dismountVehicle();
    });
  })();

  // ---- Main loop ----
  let lastT = performance.now(), fpsN = 0, fpsT = performance.now();
  function loop(now){
    const dt = Math.min(0.05, (now-lastT)/1000); lastT = now;
    const time = now/1000;
    fpsN++; if(now-fpsT>500){ if(SHOW_FPS){ const f=$('fps'); if(f) f.textContent = Math.round(fpsN*1000/(now-fpsT)) + ' FPS'; } fpsN=0; fpsT=now; }

    if(playerMesh){
      let moving = false;
      if(riding){ updateRiding(dt); }
      else if(ferrisRide >= 0){
        // đang ngồi cabin: bấm phím di chuyển cũng để xuống luôn (đỡ phải bấm E).
        // Chỉ tính WASD/mũi tên/joystick. Bản cũ tính MỌI phím -> E (vừa bấm để lên) và Shift đang giữ làm xuống ngay khung hình sau.
        // Phải nhả hết phím di chuyển trước (ferrisArmed) để lúc lên vẫn đang giữ W/joystick thì không bị đá xuống tức thì.
        const want = input.joy.x || input.joy.y || MOVE_KEYS.some(k=>input.keys[k]);
        if(!want) ferrisArmed = true;
        else if(ferrisArmed) toggleFerris();
      }
      else {
      // movement (relative to camera)
      let mx=0, mz=0;
      if(input.keys['KeyW']||input.keys['ArrowUp']) { mx+=1; }
      if(input.keys['KeyS']||input.keys['ArrowDown']) { mx-=1; }
      if(input.keys['KeyA']||input.keys['ArrowLeft']) { mz-=1; }
      if(input.keys['KeyD']||input.keys['ArrowRight']) { mz+=1; }
      if(input.joy.x||input.joy.y){ mx += -input.joy.y; mz += input.joy.x; }

      moving = (mx!==0 || mz!==0);
      playerMesh.userData.moving = moving;
      if(moving && Player.isSeated(playerMesh.userData.action)){ playerMesh.userData.action = null; player.action = null; } // đi là tự đứng dậy
      if(moving && fishing) cancelFishing();   // đi là thôi câu (mồi đã quăng coi như mất)

      if(moving && !Player.isSeated(playerMesh.userData.action)){
        const dir = Scene3D.getMoveDir();
        const len = Math.hypot(mx,mz); mx/=len; mz/=len;
        const sp = (input.run||speedBoost>0? 7 : 4) * dt;
        const dx = (dir.fx*mx + dir.rx*mz) * sp;
        const dz = (dir.fz*mx + dir.rz*mz) * sp;
        const px = playerMesh.position.x, pz = playerMesh.position.z;
        const esc = inFurniture(px, pz);   // đang kẹt trong hộp ghế (vừa đứng dậy) → tạm bỏ qua va chạm ghế để bước ra
        if(!Scene3D.collides(currentZone, px+dx, pz, 0.8, esc)) playerMesh.position.x += dx;
        if(!Scene3D.collides(currentZone, px, pz+dz, 0.8, esc)) playerMesh.position.z += dz;
        // face direction
        const ang = Math.atan2(dx, dz);
        playerMesh.userData.face = ang;
        // sync to player data
        player.x = playerMesh.position.x; player.y = playerMesh.position.z;
        Net.sendMyState({ x:player.x, y:player.y, action:player.action });
      }

      // đang tự đi tới ghế vừa chạm (bấm joystick/WASD là huỷ)
      if(moving) walkTo = null;
      else if(walkTo){
        const ud = playerMesh.userData, b = walkTo.b, px = playerMesh.position.x, pz = playerMesh.position.z;
        const ddx = b.x - px, ddz = b.z - pz, dist = Math.hypot(ddx, ddz);
        walkTo.t += dt;
        if(dist < 0.8){ walkTo = null; sitOn(b); }
        else if(walkTo.t > 12){ walkTo = null; ud.moving = false; }
        else {
          const sp = Math.min(dist, (input.run||speedBoost>0 ? 7 : 4) * dt), sx = ddx/dist*sp, sz = ddz/dist*sp;
          let mv = false;
          if(!Scene3D.collides(currentZone, px+sx, pz, 0.8, true)){ playerMesh.position.x += sx; mv = true; }   // bỏ qua va chạm ghế: đang đi tới chỗ ngồi
          if(!Scene3D.collides(currentZone, px, pz+sz, 0.8, true)){ playerMesh.position.z += sz; mv = true; }
          ud.moving = mv; ud.face = Math.atan2(sx, sz);
          player.x = playerMesh.position.x; player.y = playerMesh.position.z;
          Net.sendMyState({ x:player.x, y:player.y, action:player.action });
          walkTo.stuck = mv ? 0 : walkTo.stuck + dt;
          if(walkTo.stuck > 0.5){ walkTo = null; ud.moving = false; UI.toast('Có vật cản. Hãy lại gần ghế hơn'); }
        }
      }
      } // end else (!riding)

      if(speedBoost>0) speedBoost-=dt;

      // action timer (auto-clear non-sit)
      if(playerMesh.userData.action && !Player.isSeated(playerMesh.userData.action) && FISH_ACTS.indexOf(playerMesh.userData.action)<0){
        const dur = playerMesh.userData.action==='jump'?0.8 : (playerMesh.userData.action==='wave'?2.5 : (playerMesh.userData.action==='cry'?3 : (playerMesh.userData.action==='holla'?2 : 4)));
        if(playerMesh.userData.actionT > dur){ playerMesh.userData.action=null; player.action=null; }
      }

      // ===== tư thế câu cá (v20): chỉ khi đã bấm quăng; theo trạng thái của Fishing: quăng · chờ · cá cắn · kéo =====
      if(fishing){
        const ud2 = playerMesh.userData;
        if(currentZone!=='fishing' || riding || ferrisRide >= 0 || Player.isSeated(ud2.action)) endFishPose();
        else {
          const fs2 = Fishing.getState().state;
          const pose = fs2==='casting' ? 'cast' : fs2==='biting' ? 'bite' : fs2==='caught' ? 'reel' : 'fish';
          if(ud2.action !== pose){ ud2.action = pose; ud2.actionT = 0; }
        }
      }
      // update animations
      Scene3D.updateCharacter(playerMesh, dt, time);
      if(ferrisRide >= 0){
        // đặt nhân vật vào cabin SAU khi update (vì GChar.update tự ghi position.y mỗi khung)
        Scene3D.ferrisSync(time);                       // đồng bộ góc quay vòng với đúng thời điểm khung hình này (cùng `time` với render) trước khi lấy vị trí ghế
        const seat = Scene3D.ferrisSeat(ferrisRide, _fseat);
        if(seat){
          playerMesh.position.copy(seat);
          playerMesh.rotation.y = Scene3D.ferrisYaw(ferrisRide);
          playerMesh.userData.face = playerMesh.rotation.y;
          playerMesh.userData.moving = false;
          if(playerMesh.userData.action !== 'ride'){ playerMesh.userData.action = 'ride'; playerMesh.userData.actionT = 0; }
          player.action = 'ride';
          player.x = playerMesh.position.x; player.y = playerMesh.position.z;
        }
      }
      if(riding){
        // đặt nhân vật ngồi vào ghế xe (override mọi thứ animation đặt lại); luôn giữ tư thế 'sit'
        const sp = seatWorld(riding);
        playerMesh.position.set(sp.x, sp.y, sp.z);
         playerMesh.rotation.order='YXZ';
         playerMesh.rotation.set(riding.type==='plane'?-riding.pitch:0,riding.yaw,riding.type==='plane'?riding.bank*0.7:0,'YXZ');
        playerMesh.userData.face = riding.yaw;
        playerMesh.userData.moving = false;
        if(playerMesh.userData.action !== 'ride'){ playerMesh.userData.action = 'ride'; playerMesh.userData.actionT = 0; }
        player.action = 'ride';
      }
      Object.values(otherMeshes).forEach(m=>{
        // bot/other movement (from net)
        const p = Net.getPlayers().find(pp=>pp.id===m.userData?._id);
        Scene3D.updateCharacter(m, dt, time);
      });

      // sync other players positions from Net (bots wander)
      Net.tick(dt);
      Net.getPlayers().forEach(p=>{
        const m = otherMeshes[p.id];
        if(m){
          m.userData._id = p.id;
          // smooth move toward p.x, p.y
          const tx = p.x||0, tz = p.y||0;
          m.position.x += (tx - m.position.x)*Math.min(1, dt*5);
          m.position.z += (tz - m.position.z)*Math.min(1, dt*5);
          const dist = Math.hypot(tx-m.position.x, tz-m.position.z);
          m.userData.moving = dist > 0.1;
          if(dist>0.05) m.userData.face = Math.atan2(tx-m.position.x, tz-m.position.z);
          m.userData.action = p.action || null;
        }
      });

      // zone portal (bỏ qua khi đang lái xe / bay)
      const portal = Scene3D.atPortal(currentZone, playerMesh.position.x, playerMesh.position.z);
      if(portal && !riding && ferrisRide < 0){
        if(fishing) cancelFishing();
        const fromZone = currentZone;
        currentZone = portal.to; walkTo = null;
        Scene3D.buildZone(currentZone);
        // re-add player + others
        Scene3D.scene.add(playerMesh);
        player.zone = currentZone;
        Object.values(otherMeshes).forEach(m=>{ Scene3D.scene.add(m); m.visible = (currentZone==='plaza'); });
        const sp = (currentZone==='plaza' && fromZone==='fishing') ? { x:0, z:32 } : Scene3D.getZone(currentZone).spawn;   // về từ đảo: đứng trước cổng tàu (không phải giữa sân)
        playerMesh.position.set(sp.x, 0, sp.z);
        player.x = sp.x; player.y = sp.z;
        UI.toast(`Đến ${Scene3D.getZone(currentZone).name}`);
        UI.updateHUD(player);
      }

      npcs.forEach(n=>{
        const m = n.m, ud = m.userData; m.visible = (n.zone===currentZone);
        const dx = playerMesh.position.x - n.x, dz = playerMesh.position.z - n.z, d = Math.hypot(dx,dz);
        const cur = ud.face||0, tgt = d<9 ? Math.atan2(dx,dz) : n.home;
        ud.face = cur + Math.atan2(Math.sin(tgt-cur), Math.cos(tgt-cur)) * Math.min(1, dt*6);
        n.cd -= dt;
        if(d<6 && n.cd<=0){
          n.cd = 25; n.wv = 2.5; ud.action = 'wave'; ud.actionT = 0;
          Scene3D.setChatBubble(m, n.line); clearTimeout(m._chatT); m._chatT = setTimeout(()=>Scene3D.setChatBubble(m,null), 5000);
        }
        if(n.wv>0){ n.wv -= dt; if(n.wv<=0) ud.action = null; }
        // ngư phủ: đứng câu liên tục, thỉnh thoảng cá giật (cắn câu) rồi đổi lại
        if(n.angler && n.wv<=0){
          ud.action = 'fish';
          n.bite -= dt;
          if(n.bite <= 0){ n.bite = 7 + Math.random()*11; ud.action = 'bite'; ud.actionT = 0;
            setTimeout(()=>{ if(ud.action==='bite') ud.action='fish'; }, 1300); }
        }
        Scene3D.updateCharacter(m, dt, time);
      });
      if(riding) { /* camera do updateRiding lo */ }
      else Scene3D.updateCamera(playerMesh.position.x, playerMesh.position.z,
             ferrisRide >= 0 ? playerMesh.position.y - 0.6 : (playerMesh.userData.gy||0));   // lên cabin thì camera bám theo độ cao
      Park.update(currentZone);
      Fishing.update(dt, player, onFishEvent);
      refreshFishQuick();
      UI.updateHUD(player);
    }

    Scene3D.render(time);
    requestAnimationFrame(loop);
  }
})();
