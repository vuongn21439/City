/* ===== GCITY UI =====
 * Quản lý tất cả panel UI, character select, loading, toast, joystick.
 */
const UI = (() => {
  let selectedGender = 'male', selectedChar = 0;
  let onEnterGame = null, onChatSend = null, onEmote = null, onAction = null;
  let toastTimer = null;
  let _guardUntil = 0;   // chặn click "lạc" vào panel ngay sau khi chạm NPC mở panel (ghost click)

  function $(id){ return document.getElementById(id); }
  // Chặn mọi click vào bất kỳ panel nào trong 500ms tới — tránh trường hợp ngón tay vừa chạm
  // vào NPC mở menu thì ngay lập tức "nhấn" luôn nút bên trong (quay số tự chạy, đua thú tự mua vé…).
  function guardTap(){ _guardUntil = Date.now() + 500; }
  document.addEventListener('click', e=>{
    if(!_guardUntil || Date.now() >= _guardUntil) return;
    if(e.target && e.target.closest && e.target.closest('.panel')){
      e.stopPropagation(); e.stopImmediatePropagation(); e.preventDefault();
    }
  }, true);

  // ---- Loading ----
  function setLoading(pct, text){
    $('loadingBar').style.width = pct + '%';
    if(text) $('loadingText').textContent = text;
  }
  function hideLoading(){ $('loadingScreen').classList.add('hidden'); }

  // ---- Character Select ----
  // Ảnh xem trước 3D (GChar.preview) - cache Image để bấm đổi thẻ không bị nháy
  const previewImgs = {};
  function drawPreview3D(ctx, gender, i){
    if(typeof GChar === 'undefined') return false;
    const key = gender + i; let im = previewImgs[key];
    if(!im){ const url = GChar.preview(gender, i, 132, 165); if(!url) return false; im = new Image(); im.src = url; previewImgs[key] = im; }
    if(im.complete) ctx.drawImage(im, 0, 0); else im.onload = ()=> ctx.drawImage(im, 0, 0);
    return true;
  }

  function renderCharGrid(){
    const grid = $('charGrid'); grid.innerHTML = '';
    const chars = (typeof Scene3D!=='undefined'? Scene3D.CHAR_DEFS : {male:[],female:[]})[selectedGender];
    chars.forEach((def, i)=>{
      const card = document.createElement('div');
      card.className = 'char-card' + (i===selectedChar?' selected':'');
      const cv = document.createElement('canvas');
      cv.width = 132; cv.height = 165;
      const ctx = cv.getContext('2d');
      if(!drawPreview3D(ctx, selectedGender, i)){
        // fallback 2D khi trình duyệt không có WebGL: đầu + thân theo màu nhân vật
        ctx.scale(2.06, 2.06);
        ctx.fillStyle='#'+def.skin.toString(16).padStart(6,'0');
        ctx.beginPath(); ctx.arc(32,26,11,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#'+def.hair.toString(16).padStart(6,'0');
        ctx.beginPath(); ctx.arc(32,22,11,Math.PI,0); ctx.fill();
        ctx.fillStyle='#'+def.shirt.toString(16).padStart(6,'0');
        ctx.fillRect(22,36,20,22);
        ctx.fillStyle='#'+def.pants.toString(16).padStart(6,'0');
        ctx.fillRect(23,58,8,18); ctx.fillRect(33,58,8,18);
      }
      card.appendChild(cv);
      const lbl = document.createElement('div');
      lbl.className='char-label';
      lbl.textContent = (selectedGender==='male'?'Nam ':'Nữ ') + (i+1);
      card.appendChild(lbl);
      card.onclick = ()=>{ selectedChar=i; renderCharGrid(); };
      grid.appendChild(card);
    });
  }
  // Chế độ ĐỔI nhân vật (đang chơi): khoá giới tính, có nút ✕ và Esc để đóng.
  // Lần chọn đầu tiên (chưa có nhân vật) thì không đóng được.
  let switching = null;   // { name, cb } khi đang đổi nhân vật
  function initCharSelect(cb){
    onEnterGame = cb;
    document.querySelectorAll('.gender-tab').forEach(tab=>{
      tab.onclick = ()=>{
        document.querySelectorAll('.gender-tab').forEach(t=>t.classList.remove('active'));
        tab.classList.add('active');
        selectedGender = tab.dataset.gender; selectedChar = 0;
        renderCharGrid();
      };
    });
    renderCharGrid();
    $('enterGameBtn').onclick = ()=>{
      const typed = $('charName').value.trim();
      if(switching){
        const { name:old, cb:done } = switching, gd = selectedGender, ci = selectedChar;
        closeCharSwitch();
        done({ name: typed || old, gender: gd, charIndex: ci });
      } else onEnterGame({ name: typed || 'Player', gender: selectedGender, charIndex: selectedChar });
    };
    $('charClose').onclick = closeCharSwitch;
  }
  function openCharSwitch(cur, done){
    switching = { name: cur.name, cb: done };
    selectedGender = cur.gender; selectedChar = cur.charIndex;
    document.querySelectorAll('.gender-tab').forEach(t=>{ t.style.display = 'none'; });
    $('charName').value = cur.name;
    $('enterGameBtn').textContent = 'Đổi nhân vật';
    $('charClose').classList.remove('hidden');
    renderCharGrid();
    $('charSelect').classList.remove('hidden');
  }
  function closeCharSwitch(){   // true nếu vừa đóng hộp đổi nhân vật
    if(!switching) return false;
    switching = null;
    $('charSelect').classList.add('hidden');
    $('charClose').classList.add('hidden');
    $('enterGameBtn').textContent = 'Vào thành phố';
    document.querySelectorAll('.gender-tab').forEach(t=>{ t.style.display = ''; });
    return true;
  }
  function showCharSelect(){ $('charSelect').classList.remove('hidden'); }
  function hideCharSelect(){ $('charSelect').classList.add('hidden'); $('gameScreen').classList.remove('hidden'); }

  // ---- Hộp xác nhận (vd: thoát game) ----
  function askConfirm(msg, okText, onOk){
    $('confirmMsg').textContent = msg;
    $('confirmYes').textContent = okText || 'Đồng ý';
    $('confirmYes').onclick = ()=>{ closeConfirm(); if(onOk) onOk(); };
    $('confirmNo').onclick = closeConfirm;
    $('confirmBox').classList.remove('hidden');
  }
  function closeConfirm(){   // true nếu vừa đóng
    const b = $('confirmBox');
    if(b.classList.contains('hidden')) return false;
    b.classList.add('hidden'); return true;
  }
  // Số xu có dấu chấm phân cách (1.234.567) — dùng chung cho HUD và Túi đồ
  const fmt = n => String(Math.floor(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  // Một câu duy nhất cho mọi lần thiếu xu
  const NO_COIN = 'Bạn không đủ xu.';

  // ---- Panels ----
  function togglePanel(id){
    const p = $(id);
    const wasHidden = p.classList.contains('hidden');
    document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));
    if(wasHidden) p.classList.remove('hidden');
  }
  function closePanel(id){ $(id).classList.add('hidden'); }
  // Mở hẳn panel (không toggle): dùng khi chạm vào NPC
  function openPanel(id){
    document.querySelectorAll('.panel').forEach(x=>x.classList.add('hidden'));
    $(id).classList.remove('hidden');
  }
  // Mở cửa hàng đúng dịch vụ (lottery | rental)
  function openShop(tab){
    openPanel('shopPanel');
    renderShop(tab);
  }

  function initPanels(callbacks){
    onChatSend = callbacks.onChatSend;
    onEmote = callbacks.onEmote;
    onAction = callbacks.onAction;

    // close buttons
    document.querySelectorAll('.panel-close').forEach(btn=>{
      btn.onclick = ()=> closePanel(btn.dataset.close);
    });
    // bottom action buttons
    $('btnEmote').onclick = ()=> togglePanel('emotePanel');
    $('btnChat').onclick = ()=> togglePanel('chatPanel');
    $('btnInventory').onclick = ()=> { togglePanel('inventoryPanel'); renderInventory(callbacks.getPlayer()); };
    $('btnPlayers').onclick = ()=> { togglePanel('playersPanel'); callbacks.refreshPlayers(); };

    // chat
    $('chatSend').onclick = sendChat;
    $('chatInput').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });

    // emote grid
    const grid = $('emoteGrid'); grid.innerHTML='';
    Player.EMOTES.forEach(e=>{
      const item = document.createElement('button');
      item.className='emote-item';
      item.innerHTML = `<span class="emote-icon">${e.icon}</span>${e.name}`;
      item.onclick = ()=>{ onEmote(e.id); closePanel('emotePanel'); };
      grid.appendChild(item);
    });

    // fishing
    $('fishCastBtn').onclick = ()=> onAction('fishCast');
    $('fishSellBtn').onclick = ()=> onAction('fishSell');
    document.querySelectorAll('.shop-item').forEach(btn=>{
      btn.onclick = ()=> onAction('buyBait', { bait: btn.dataset.bait, price: parseInt(btn.dataset.price) });
    });

  }

  function sendChat(){
    const input = $('chatInput');
    const text = input.value.trim();
    if(!text) return;
    input.value = '';
    onChatSend(text);
  }
  function addChat(name, text, isSystem){
    const hist = $('chatHistory');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    // name/text đến từ người chơi khác (Firebase) -> TUYỆT ĐỐI không đưa vào innerHTML, dùng textContent
    const who = document.createElement('span');
    who.className = 'chat-who' + (isSystem ? ' system' : '');
    who.textContent = name + ':';
    const msg = document.createElement('span');
    msg.textContent = text;
    div.append(who, msg);
    hist.appendChild(div);
    hist.scrollTop = hist.scrollHeight;
  }

  // ---- Shop content (lottery / rental): mỗi toà / NPC mở đúng dịch vụ của mình ----
  function renderShop(tab){
    const c = $('shopContent');
    if(tab==='lottery'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🍀 Số may mắn</h4>
          <p>Chọn 3 chữ số. Phần thưởng tối đa 1.000 xu. Phí tham gia: 10 xu.</p>
          <input id="lottoNum" type="text" maxlength="3" placeholder="Ví dụ: 123" style="width:100%;padding:8px;background:#1e1e30;border:1px solid #2a2a44;border-radius:6px;color:#fff;margin-bottom:8px;text-align:center;font-size:18px;letter-spacing:4px;" />
          <button class="btn-primary" id="buyLotto">Tham gia (10 xu)</button>
        </div>
        <div class="shop-service">
          <h4>📊 Kết quả gần nhất</h4>
          <p id="lottoResult">Chưa có kết quả.</p>
        </div>`;
      $('buyLotto').onclick = ()=> onAction('buyLotto', $('lottoNum').value);
    } else if(tab==='rental'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🎿 Giày trượt · tăng tốc 30 giây</h4>
          <p>Giá: 15 xu</p>
          <button class="btn-secondary" id="rentSkate">Thuê giày (15 xu)</button>
        </div>
        <div class="shop-service">
          <h4>🎣 Cần câu cao cấp</h4>
          <p>Tăng tỉ lệ câu được cá lớn. Giá: 100 xu</p>
          <button class="btn-secondary" id="buyRod">Mua cần (100 xu)</button>
        </div>`;
      $('rentSkate').onclick = ()=> onAction('rentSkate');
      $('buyRod').onclick = ()=> onAction('buyRod');
    }
  }

  // ---- Thuê xe / máy bay (NPC Tài Xế): list = [{i, kind, name, cssColor, price, taken}] ----
  function renderVehicleShop(list){
    const c = $('vehicleList');
    const sec = (kind, title) => {
      const items = list.filter(v=>v.kind===kind);
      return `<div class="veh-title">${title}</div><div class="veh-grid">` + items.map(v=>`
        <button class="veh-card${v.taken?' taken':''}" data-slot="${v.i}" ${v.taken?'disabled':''}>
          <span class="veh-pic" style="background:${v.cssColor}">${kind==='plane'?'✈️':'🚗'}</span>
          <b>${v.name}</b>
          <small>${v.taken ? 'Đã có người thuê' : v.price+' xu · 5 phút'}</small>
        </button>`).join('') + `</div>`;
    };
    c.innerHTML = sec('car','🚗 Xe mui trần') + sec('plane','✈️ Máy bay') +
      `<div class="mg-info">Chọn một phương tiện để thuê. Phương tiện sẽ tự trả về bãi khi bạn xuống.</div>`;
    c.querySelectorAll('[data-slot]').forEach(b=> b.onclick = ()=> onAction('rentVehicle', { slot:+b.dataset.slot }));
  }

  // ---- Inventory ----
  function renderInventory(p){
    const c = $('inventoryContent'); c.innerHTML='';
    const items = [
      { icon:'🪙', name:'Xu', count:fmt(p.coins) },
      { icon:'🐟', name:'Cá', count:p.inventory.fish },
      { icon:'🪱', name:'Giun', count:p.inventory.worm },
      { icon:'🦐', name:'Tép', count:p.inventory.shrimp },
      { icon:'✨', name:'Mồi giả', count:p.inventory.lure },
      { icon:'🎣', name:(p.inventory.rod>=2 ? 'Cần cao cấp' : 'Cần cơ bản'), count:1 },
    ];
    items.forEach(it=>{
      const slot = document.createElement('div');
      slot.className='inv-slot';
      slot.innerHTML = `${it.icon}<span class="inv-name">${it.name}</span><span class="inv-count">${it.count}</span>`;
      c.appendChild(slot);
    });
  }

  // ---- Players list ----
  function renderPlayers(list){
    const c = $('playersList'); c.innerHTML='';
    list.forEach(p=>{
      const row = document.createElement('div');
      row.className='player-row';
      const dot = document.createElement('span'); dot.className = 'player-dot';
      const nm = document.createElement('span'); nm.textContent = p.name;
      row.append(dot, nm);
      c.appendChild(row);
    });
    $('playerCount').textContent = list.length + 1;
  }

  // ---- HUD update ----
  function updateHUD(p){
    $('hudName').textContent = p.name;
    $('hudCoin').textContent = fmt(p.coins);
    $('hudZone').textContent = (Scene3D.getZone(p.zone)||{}).name || '';
    $('fishCount').textContent = p.inventory.fish;
    const bait = p.inventory.lure>0?`Mồi giả (${p.inventory.lure})`:(p.inventory.shrimp>0?`Tép (${p.inventory.shrimp})`:`Giun (${p.inventory.worm})`);
    $('fishBait').textContent = bait;
    $('fishRod').textContent = p.inventory.rod>=2?'Cần cao cấp':'Cần cơ bản';
  }

  // ---- Toast ----
  function toast(msg){
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=> t.classList.add('hidden'), 2500);
  }

  // ---- Joystick ----
  function initJoystick(onMove){
    const joy = $('joystick'), knob = $('joystickKnob');
    let active=false, cx=0, cy=0;
    const R = 33;
    function start(e){
      active=true;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width/2; cy = r.top + r.height/2;
    }
    function move(e){
      if(!active) return;
      const t = e.touches? e.touches[0] : e;
      let dx = t.clientX - cx, dy = t.clientY - cy;
      const d = Math.hypot(dx,dy);
      if(d>R){ dx=dx/d*R; dy=dy/d*R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove({ x: dx/R, y: dy/R });
    }
    function end(){ active=false; knob.style.transform='translate(-50%,-50%)'; onMove({x:0,y:0}); }
    joy.addEventListener('touchstart', start);
    joy.addEventListener('touchmove', e=>{ e.preventDefault(); move(e); }, {passive:false});
    joy.addEventListener('touchend', end);
    joy.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
  }

  return { setLoading, hideLoading, initCharSelect, openCharSwitch, closeCharSwitch, showCharSelect, hideCharSelect,
    askConfirm, closeConfirm, fmt, NO_COIN,
    togglePanel, closePanel, openPanel, openShop, initPanels, addChat, updateHUD, toast, initJoystick,
    renderInventory, renderPlayers, renderShop, renderVehicleShop, guardTap };
})();
