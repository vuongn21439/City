/* ===== GCITY Network Layer =====
 * Abstraction: LocalMock (offline, with bots) hoặc Firebase (real multiplayer).
 * Đổi GCITY_CONFIG.USE_FIREBASE = true để dùng Firebase.
 * Interface:
 *   net.init(player) -> promise
 *   net.onPlayerJoin(cb), net.onPlayerLeave(cb), net.onPlayerUpdate(cb)
 *   net.sendMyState(state)
 *   net.sendChat(text)
 *   net.onChat(cb)
 *   net.getPlayers() -> array
 */
const Net = (() => {
  let mode = GCITY_CONFIG.USE_FIREBASE ? 'firebase' : 'local';
  let myId = null;
  let players = {};
  let cbs = { join:[], leave:[], update:[], chat:[] };
  let fbRef = null;

  function emit(evt, data){ cbs[evt].forEach(cb=>cb(data)); }

  // ---- LOCAL MOCK (bots) ----
  const botNames = ["Bé Bo","Candy","Miu Miu","Kyo","Luna","Tidus","Yuna","Cloud","Aerith","Squall"];
  const botChars = [];
  function spawnBots(){
    for(let i=0;i<GCITY_CONFIG.GAME.botCount;i++){
      const id = 'bot_'+i;
      const gender = Math.random()<.5?'male':'female';
      players[id] = {
        id, name: botNames[i%botNames.length],
        gender, charIndex: Math.floor(Math.random()*6),
        x: -15 + Math.random()*30, y: -10 + Math.random()*24,
        dir: Math.floor(Math.random()*4), moving: false,
        action: null, actionT: 0, targetX:0, targetY:0,
        chatT: 5 + Math.random()*10
      };
      botChars.push(players[id]);
    }
  }
  function tickBots(dt){
    Object.values(players).forEach(p=>{
      if(!p.id.startsWith('bot_')) return;
      // wander
      p.chatT -= dt;
      if(p.chatT <= 0){
        p.chatT = 8 + Math.random()*15;
        const lines = ["Xin chào mọi người!","Cùng đi dạo không?","Có ai đang câu cá không?","Thành phố hôm nay đẹp quá.","Mọi người đang ở đâu vậy?","Chúc mọi người chơi vui vẻ!"];
        emit('chat', { name:p.name, text: lines[Math.floor(Math.random()*lines.length)], id:p.id });
      }
      if(!p.moving && Math.random()<0.01){
        p.targetX = -15 + Math.random()*30;
        p.targetY = -10 + Math.random()*24;
        p.moving = true;
      }
      if(p.moving){
        const dx = p.targetX - p.x, dy = p.targetY - p.y;
        const d = Math.hypot(dx,dy);
        if(d < 0.3){ p.moving = false; }
        else {
          const sp = 1.6*dt, nx = p.x + dx/d*sp, nz = p.y + dy/d*sp;
          if(typeof Scene3D!=='undefined' && Scene3D.collides('plaza', nx, nz, 1)) p.moving = false; else { p.x = nx; p.y = nz; }
          if(Math.abs(dx)>Math.abs(dy)) p.dir = dx>0?1:3; else p.dir = dy>0?0:2;
        }
      }
    });
  }

  // ---- FIREBASE ----
  // Dữ liệu từ Firebase là dữ liệu của người lạ -> luôn qua cleanPlayer/cleanChat trước khi dùng.
  const clampStr = (v, n) => String(v == null ? '' : v).slice(0, n);
  const num = v => Number.isFinite(+v) ? +v : 0;
  function cleanPlayer(d, id){
    const gender = d.gender === 'female' ? 'female' : 'male';
    const defs = (typeof Scene3D !== 'undefined' && Scene3D.CHAR_DEFS && Scene3D.CHAR_DEFS[gender]) || null;
    const maxIdx = (defs ? defs.length : 6) - 1;
    return { id, name: clampStr(d.name, 24).trim() || 'Player', gender,
      charIndex: Math.max(0, Math.min(maxIdx, d.charIndex | 0)),
      x: num(d.x), y: num(d.y), dir: d.dir | 0, action: d.action == null ? null : clampStr(d.action, 16) };
  }
  function cleanChat(d){ return { id: d.id === 'system' ? '' : clampStr(d.id, 40),   // người lạ không được giả tin 'Hệ thống'
    name: clampStr(d.name, 24).trim() || 'Player', text: clampStr(d.text, 200), ts: num(d.ts) }; }

  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = ()=> rej(new Error('Không tải được ' + src));   // offline/bị chặn -> reject để fallback local, không treo init
      document.head.appendChild(s);
    });
  }
  let chatQ = null;
  function fbDetach(){
    try { if(fbRef) fbRef.child('players').off(); if(chatQ) chatQ.off(); } catch(e){}
    fbRef = null; chatQ = null;
  }
  async function initFirebase(player){
    await loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
    await loadScript("https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js");
    firebase.initializeApp(GCITY_CONFIG.FIREBASE);
    fbRef = firebase.database().ref('gcity');

    // Đổi id 'me' -> 'p_xxx' PHẢI đổi luôn khoá trong players, nếu không bản ghi 'me' còn sót lại
    // sẽ lọt vào getPlayers() (lọc theo myId) và bạn bị nhân đôi thành một người chơi khác; sendChat cũng đọc players[myId].
    const oldId = myId;
    myId = 'p_' + Math.random().toString(36).substr(2,8);
    const self = players[oldId] || player;
    delete players[oldId]; self.id = myId; players[myId] = self;

    const meRef = fbRef.child('players/'+myId);
    meRef.set({ name:player.name, gender:player.gender, charIndex:player.charIndex, x:player.x, y:player.y, dir:0, ts:Date.now() });
    meRef.onDisconnect().remove();
    // listen
    fbRef.child('players').on('child_added', s=>{
      const d = s.val(); if(!d || s.key===myId) return;
      players[s.key] = cleanPlayer(d, s.key);
      emit('join', players[s.key]);
    });
    fbRef.child('players').on('child_removed', s=>{
      delete players[s.key]; emit('leave', s.key);
    });
    fbRef.child('players').on('child_changed', s=>{
      const d = s.val(); if(!d || s.key===myId) return;
      players[s.key] = cleanPlayer({ ...players[s.key], ...d }, s.key);
      emit('update', players[s.key]);
    });
    // limitToLast(1) phát lại tin cuối cùng đã có sẵn ngay khi gắn listener -> bỏ qua lượt đó.
    // Firebase đảm bảo mọi child_added ban đầu chạy TRƯỚC sự kiện 'value' của cùng query, nên cờ chatReady
    // bật ở once('value') chặn đúng tin cũ mà không phụ thuộc đồng hồ máy (so ts sẽ sai khi lệch giờ).
    let chatReady = false;
    chatQ = fbRef.child('chat').limitToLast(1);
    chatQ.on('child_added', s=>{
      if(!chatReady) return;
      const d = s.val(); if(d) emit('chat', cleanChat(d));
    });
    chatQ.once('value').then(()=>{ chatReady = true; });   // KHÔNG await: offline thì once('value') treo, kéo theo Net.init (và cả vào game) treo
  }

  return {
    init(player){
      myId = 'me';
      players[myId] = player;
      if(mode==='firebase'){
        return initFirebase(player).catch(e=>{ console.warn('Firebase failed, fallback to local', e); fbDetach(); mode='local'; spawnBots(); });
      } else {
        spawnBots();
        return Promise.resolve();
      }
    },
    tick(dt){ if(mode==='local') tickBots(dt); },
    sendMyState(state){
      if(mode==='firebase' && fbRef){
        fbRef.child('players/'+myId).update({...state, ts:Date.now()});
      }
    },
    sendChat(text){
      const msg = { id:myId, name: (players[myId] || {}).name || 'Player', text: clampStr(text, 200), ts:Date.now() };
      // Firebase: chỉ push. child_added sẽ bắn lại NGAY trên máy mình (SDK phát sự kiện cục bộ trước khi server xác nhận),
      // nên emit thêm ở đây sẽ làm tin hiện hai lần. Chế độ local mới cần emit trực tiếp.
      if(mode==='firebase' && fbRef) fbRef.child('chat').push(msg);
      else emit('chat', msg);
    },
    onPlayerJoin(cb){ cbs.join.push(cb); },
    onPlayerLeave(cb){ cbs.leave.push(cb); },
    onPlayerUpdate(cb){ cbs.update.push(cb); },
    onChat(cb){ cbs.chat.push(cb); },
    getPlayers(){ return Object.values(players).filter(p=>p.id!==myId); },
    myId(){ return myId; }
  };
})();
