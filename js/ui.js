/* ===== GCITY UI =====
 * Quản lý tất cả panel UI, character select, loading, toast, joystick.
 */
const UI = (() => {
  let selectedGender = 'male', selectedChar = 0;
  let onEnterGame = null, onChatSend = null, onEmote = null, onAction = null;
  let getPlayer = null;
  let fishPanelTab = 'fish';
  let toastTimer = null;
  let _coinHold = null;   // số xu HUD tạm giữ (Số may mắn: không lộ thưởng trước khi cuộn dừng)
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
    const key = gender + i + (GChar.hasGLB && GChar.hasGLB(gender, i) ? 'g' : 'b'); let im = previewImgs[key];
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
  function showCharSelect(){ renderCharGrid(); $('charSelect').classList.remove('hidden'); }   // vẽ lại: lúc khởi động model GLB có thể chưa tải xong
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
    getPlayer = callbacks.getPlayer;

    // close buttons
    document.querySelectorAll('.panel-close').forEach(btn=>{
      btn.onclick = ()=> closePanel(btn.dataset.close);
    });
    // bottom action buttons
    $('btnEmote').onclick = ()=>{ renderEmotes(); togglePanel('emotePanel'); };
    $('btnChat').onclick = ()=> togglePanel('chatPanel');
    $('btnInventory').onclick = ()=> { togglePanel('inventoryPanel'); renderInventory(callbacks.getPlayer()); };
    $('btnPlayers').onclick = ()=> { togglePanel('playersPanel'); callbacks.refreshPlayers(); };
    // ẩn/hiện cột nút bên phải (nhớ lựa chọn)
    (function(){
      const bar = document.querySelector('.hud-bottom'), tg = $('btnHudToggle');
      if(!bar || !tg) return;
      const KEY = 'gcity_hud_hidden';
      let hide = false; try{ hide = localStorage.getItem(KEY)==='1'; }catch(e){}
      const apply = ()=>{
        bar.classList.toggle('collapsed', hide);
        tg.textContent = hide ? '‹' : '›';
        tg.title = hide ? 'Hiện nút' : 'Ẩn nút';
        tg.setAttribute('aria-expanded', String(!hide));
      };
      tg.onclick = ()=>{ hide = !hide; apply(); try{ localStorage.setItem(KEY, hide?'1':'0'); }catch(e){} };
      apply();
    })();

    // chat
    $('chatSend').onclick = sendChat;
    $('chatInput').addEventListener('keydown', e=>{ if(e.key==='Enter') sendChat(); });

    // emote grid: icon nhảy / nhảy lên theo giới tính nhân vật hiện tại; vẽ lại mỗi lần mở bảng
    function renderEmotes(){
      const gd = (callbacks.getPlayer() || {}).gender;
      const grid = $('emoteGrid'); grid.innerHTML='';
      Player.EMOTES.forEach(e=>{
        const item = document.createElement('button');
        item.className='emote-item';
        item.innerHTML = `<span class="emote-icon">${Player.emoteIcon(e, gd)}</span>${e.name}`;
        item.onclick = ()=>{ onEmote(e.id); closePanel('emotePanel'); };
        grid.appendChild(item);
      });
    }
    renderEmotes();

    // Fishing station tabs and delegated actions (the view is re-rendered when state changes).
    $('fishTabs').addEventListener('click', e=>{
      const tab = e.target.closest('[data-fish-tab]');
      if(tab) renderFishingPanel(tab.dataset.fishTab);
    });
    $('fishView').addEventListener('click', e=>{
      const tab = e.target.closest('[data-fish-tab]');
      if(tab){ renderFishingPanel(tab.dataset.fishTab); return; }
      const button = e.target.closest('[data-fish-action]');
      if(!button || button.disabled) return;
      const action = button.dataset.fishAction;
      if(action==='buyBait') onAction('buyBait', { bait:button.dataset.bait });
      else if(action==='buyRod') onAction('buyRod');
      else onAction(action);
    });

  }

  // Cần đang cầm: 0 = chưa cầm, 1 = cần thường, 2 = cần cao cấp
  const heldRod = inv => { const t = (inv && inv.equippedRod)|0; return (t===2 && inv.rod>=2) ? 2 : (t===1 ? 1 : 0); };
  // "Giun ×4" hoặc "Chưa chọn" — mồi đang dùng (loại đã chọn trong Balo)
  const baitLabel = inv => {
    const id = inv && inv.equippedBait, b = id && Fishing.BAITS.find(x=>x.id===id);
    return (b && (inv[id]||0) > 0) ? `${b.name} ×${fmt(inv[id])}` : 'Chưa chọn';
  };
  const ROD_ICON = {
    1: '<svg class="rod-ic" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 35 L18 21.5" stroke="#8a5a32" stroke-width="4.2" stroke-linecap="round"/><path d="M17 22.5 L33 5" stroke="#c9a06a" stroke-width="2.4" stroke-linecap="round"/><circle cx="15.5" cy="29.5" r="3.6" fill="#5b6472" stroke="#d5dbe3" stroke-width="1.2"/><path d="M33 5 Q38 15 35 26" stroke="#ece8da" stroke-width="1" fill="none"/><circle cx="35" cy="28" r="2.6" fill="#e8503c"/><circle cx="35" cy="26.6" r="1.4" fill="#fdf6e8"/></svg>',
    2: '<svg class="rod-ic" viewBox="0 0 40 40" aria-hidden="true"><path d="M6 35 L18 21.5" stroke="#d9b27c" stroke-width="4.6" stroke-linecap="round"/><path d="M5 36 L7.4 33.3" stroke="#2b2b2b" stroke-width="5" stroke-linecap="round"/><path d="M17 22.5 L34 4" stroke="#1d2230" stroke-width="2.6" stroke-linecap="round"/><circle cx="21" cy="18.4" r="1.7" fill="none" stroke="#e0b84a" stroke-width="1"/><circle cx="26" cy="13" r="1.4" fill="none" stroke="#e0b84a" stroke-width="1"/><circle cx="30.4" cy="8.2" r="1.1" fill="none" stroke="#e0b84a" stroke-width="1"/><circle cx="15.5" cy="29.8" r="4.6" fill="#c9ced6" stroke="#e0b84a" stroke-width="1.6"/><circle cx="15.5" cy="29.8" r="1.6" fill="#e0b84a"/><path d="M34 4 Q39 15 36 25" stroke="#ece8da" stroke-width="1" fill="none"/><ellipse cx="36" cy="28" rx="2" ry="3.4" fill="#e8503c"/><ellipse cx="36" cy="25.6" rx="2" ry="2" fill="#ffc83d"/></svg>'
  };

  function renderFishingPanel(tab){
    if(tab) fishPanelTab = tab;
    const player = getPlayer ? getPlayer() : null;
    if(!player) return;
    const inv = player.inventory || {};
    const fishState = typeof Fishing !== 'undefined' ? Fishing.getState().state : 'idle';
    const equipped = heldRod(inv);
    const rodName = equipped ? Fishing.RODS[equipped].name : 'Chưa cầm cần';
    const baitId = Fishing.usableBait(player);
    const bait = baitId ? Fishing.BAITS.find(b=>b.id===baitId) : null;
    const fishCount = inv.fish||0;
    const view = $('fishView');
    document.querySelectorAll('.fish-tab').forEach(button=>{
      const active = button.dataset.fishTab === fishPanelTab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if(fishPanelTab==='shop'){
      const baitCards = Fishing.BAITS.map(bait=>`
        <article class="bait-card">
          <div class="bait-icon">${BaitArt.svg(bait.id,'bait-art')}</div>
          <div class="bait-details">
            <div class="bait-title"><b>${bait.name}</b><span>${fmt(inv[bait.id]||0)} trong túi</span></div>
            <small>Thu hút: ${bait.attracts}</small>
          </div>
          <button class="bait-buy" type="button" data-fish-action="buyBait" data-bait="${bait.id}">
            Mua ${bait.quantity} · ${bait.price} xu
          </button>
        </article>`).join('');
      const ownsPremium = inv.rod >= 2;
      view.innerHTML = `
        <div class="fish-shop-intro"><b>Chuẩn bị cho chuyến câu</b><span>Mỗi gói có ${Fishing.BAITS[0].quantity} mồi.</span></div>
        <div class="bait-list">${baitCards}</div>
        <article class="premium-rod-card">
          <div class="premium-rod-badge">✦</div>
          <div class="premium-rod-copy"><b>Cần câu cao cấp</b><p>${Fishing.RODS[2].durability} · quăng xa hơn và tăng cơ hội gặp cá hiếm.</p><small>Mua một lần · ${Fishing.RODS[2].price} xu</small></div>
          <button class="rod-buy" type="button" data-fish-action="buyRod" ${ownsPremium?'disabled':''}>${ownsPremium?'Đã sở hữu':'Mua cần'}</button>
        </article>
        <p class="fish-hint">Mua xong, mở Balo để cầm cần và chọn mồi.</p>`;
    } else if(fishPanelTab==='codex'){
      const dex = inv.fishDex || {};
      const TIER_CLASS = { 'Phổ biến':'common', 'Ít gặp':'uncommon', 'Hiếm':'rare', 'Sử thi':'epic', 'Huyền thoại':'legend' };
      const kinds = Fishing.FISH_TYPES.length;
      const seen = Fishing.FISH_TYPES.filter(fish=>(dex[fish.id]||0)>0).length;
      const entries = Fishing.FISH_TYPES.map(fish=>{
        const bait = Fishing.BAITS.find(item=>item.id===fish.preferredBait);
        const caught = dex[fish.id]||0;
        // Tranh minh hoạ riêng của từng loài (js/fishart.js) — cá kéo lên ở đầu dây vẽ đúng bức này
        return `<article class="codex-card rarity-${fish.id} tier-${TIER_CLASS[fish.rarity]||'common'}">
          <div class="codex-icon">${FishArt.svg(fish.id,'codex-art')}</div>
          <div class="codex-copy"><div class="codex-title"><b>${fish.name}</b><span>${fish.rarity}</span></div>
            <p>${fish.description}</p><small>Mồi hợp: ${bait ? bait.name : '—'} · Giá bán: ${fmt(fish.value)} xu</small>
          </div><div class="codex-count"><b>${fmt(caught)}</b><small>${caught===1?'lần':'lần'}</small></div>
        </article>`;
      }).join('');
      view.innerHTML = `<div class="codex-intro"><b>Sổ cá</b><span>Đã câu ${fmt(seen)}/${fmt(kinds)} loài quanh đảo.</span></div><div class="codex-list">${entries}</div>`;
    } else {
      const actionLabel = fishState==='biting' ? 'KÉO NGAY!' :
        (fishState==='waiting' || fishState==='casting' ? 'Đang chờ cá…' :
          (fishState==='caught' ? 'Đang thu cần…' : (!equipped ? 'Chưa cầm cần' : (!bait ? 'Chưa chọn mồi' : 'Quăng cần'))));
      const castDisabled = fishState==='waiting' || fishState==='casting' || fishState==='caught' || (fishState==='idle' && (!equipped || !bait));
      view.innerHTML = `
        <div class="fish-hero">
          <div class="fish-hero-water"><span class="fish-ripple ripple-one"></span><span class="fish-ripple ripple-two"></span><span class="fish-hero-float">🎣</span></div>
          <div class="fish-hero-copy"><span class="fish-eyebrow">SẴN SÀNG RA KHƠI?</span><b>Chờ phao rung rồi kéo cá lên.</b></div>
        </div>
        <div class="fish-stat-grid">
          <div class="fish-stat"><span>🎣</span><small>Cần đang cầm</small><b id="fishRodValue">${rodName}</b></div>
          <div class="fish-stat"><span>${BaitArt.svg(baitId||'worm', 'stat-bait' + (bait?'':' dim'))}</span><small>Mồi đang dùng</small><b id="fishBaitValue">${baitLabel(inv)}</b></div>
          <div class="fish-stat"><span>🐟</span><small>Cá trong túi</small><b id="fishCountValue">${fmt(fishCount)}</b></div>
        </div>
        <div class="fish-main-actions">
          <button class="fish-cast-action ${fishState==='biting'?'is-biting':''}" type="button" data-fish-action="fishCast" ${castDisabled?'disabled':''}><span>🎣</span>${actionLabel}</button>
          <button class="fish-sell-action" type="button" data-fish-action="fishSell" ${fishCount?'':'disabled'}>Bán cá đã câu</button>
        </div>
        <p class="fish-hint">${equipped ? (bait ? 'Mồi khác nhau thu hút loại cá khác nhau. Xem <button type="button" data-fish-tab="codex">Sổ cá</button> để chọn mồi hợp.' : 'Mở Balo và chọn mồi để bắt đầu câu.') : 'Mở Balo, cầm cần câu và chọn mồi rồi mới quăng cần.'}</p>`;
    }
  }
  function openFishingPanel(tab){
    if(tab) fishPanelTab = tab;
    openPanel('fishPanel');
    renderFishingPanel();
  }
  function refreshFishingPanel(){
    if(!$('fishPanel').classList.contains('hidden')) renderFishingPanel();
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
    const panel = $('shopPanel');
    panel.classList.toggle('lotto', tab==='lottery');
    $('shopTitle').textContent = tab==='lottery' ? '🍀 Số may mắn' : '🏪 Dịch vụ thành phố';
    if(tab==='lottery'){
      Lotto.mount(c, { getCoins: ()=> getPlayer().coins, play: pick => onAction('buyLotto', pick), release: releaseCoin, toast });
    } else if(tab==='rental'){
      c.innerHTML = `
        <div class="shop-service">
          <h4>🎿 Giày trượt · tăng tốc 30 giây</h4>
          <p>Giá: 15 xu</p>
          <button class="btn-secondary" id="rentSkate">Thuê giày (15 xu)</button>
        </div>`;
      $('rentSkate').onclick = ()=> onAction('rentSkate');
    }
  }

  // HUD giữ nguyên số xu cũ tới khi cuộn số dừng hẳn (kết quả đã được tính và lưu từ lúc bấm Quay)
  function holdCoin(n){ _coinHold = n; $('hudCoin').textContent = fmt(n); }
  function releaseCoin(){ _coinHold = null; if(getPlayer) updateHUD(getPlayer()); }

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
    ];
    items.forEach(it=>{
      const slot = document.createElement('div');
      slot.className='inv-slot';
      slot.innerHTML = `${it.icon}<span class="inv-name">${it.name}</span><span class="inv-count">${it.count}</span>`;
      c.appendChild(slot);
    });
    // Cần câu: chỉ trang bị được ở Đảo Câu Cá. Bấm cần chưa cầm = cầm, bấm cần đang cầm = cất.
    const equipped = heldRod(p.inventory), onIsland = p.zone==='fishing';
    const head = document.createElement('p');
    head.className = 'inv-section';
    head.textContent = 'Cần câu';
    c.appendChild(head);
    (p.inventory.rod >= 2 ? [1,2] : [1]).forEach(tier=>{
      const on = equipped===tier;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inv-slot inv-rod-slot' + (on ? ' equipped' : '') + (onIsland ? '' : ' locked');
      button.innerHTML = `${ROD_ICON[tier]}<span class="inv-name">${Fishing.RODS[tier].name}</span><span class="inv-count">${on ? 'Đang cầm' : (onIsland ? 'Trang bị' : '—')}</span>`;
      button.setAttribute('aria-label', (on ? 'Cất ' : 'Trang bị ') + Fishing.RODS[tier].name);
      button.onclick = ()=> onAction('equipRod', { tier });
      c.appendChild(button);
    });
    // Mồi: chọn loại mồi để dùng với cần đang cầm (cần nào cũng được). Chưa cầm cần thì chưa chọn được.
    const usingBait = Fishing.usableBait(p);
    const bhead = document.createElement('p');
    bhead.className = 'inv-section';
    bhead.textContent = 'Mồi câu';
    c.appendChild(bhead);
    Fishing.BAITS.forEach(b=>{
      const n = p.inventory[b.id]||0, on = usingBait===b.id;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'inv-slot inv-rod-slot inv-bait-slot' + (on ? ' equipped' : '') + ((equipped && n>0) || on ? '' : ' locked');
      button.innerHTML = `${BaitArt.svg(b.id,'bait-ic')}<span class="inv-name">${b.name}</span><span class="inv-qty">${fmt(n)}</span><span class="inv-count">${on ? 'Đang dùng' : (n<=0 ? 'Hết' : (equipped ? 'Chọn' : '—'))}</span>`;
      button.setAttribute('aria-label', (on ? 'Đang dùng ' : 'Dùng ') + b.name);
      button.onclick = ()=> onAction('equipBait', { bait:b.id });
      c.appendChild(button);
    });
    const note = document.createElement('p');
    note.className = 'inventory-note';
    note.textContent = !onIsland ? 'Chỉ cầm cần và chọn mồi tại Đảo Câu Cá.' :
      (!equipped ? 'Chọn một cần câu để cầm.' : (!usingBait ? 'Chọn loại mồi để bắt đầu câu.' : 'Đã sẵn sàng. Bấm nút 🎣 để quăng cần.'));
    c.appendChild(note);
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
    $('hudCoin').textContent = fmt(_coinHold != null ? _coinHold : p.coins);
    $('hudZone').textContent = (Scene3D.getZone(p.zone)||{}).name || '';
    const fishCount = $('fishCountValue'); if(fishCount) fishCount.textContent = fmt(p.inventory.fish||0);
    const baitCount = $('fishBaitValue');
    if(baitCount) baitCount.textContent = baitLabel(p.inventory);
    const rodValue = $('fishRodValue');
    const equipped = heldRod(p.inventory);
    if(rodValue) rodValue.textContent = equipped ? Fishing.RODS[equipped].name : 'Chưa cầm cần';
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
    let activeId=null, cx=0, cy=0;
    const R = 33;
    function start(e){
      if(activeId!==null) return;
      e.preventDefault();
      activeId=e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width/2; cy = r.top + r.height/2;
    }
    function move(e){
      if(activeId===null||e.pointerId!==activeId) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx,dy);
      if(d>R){ dx=dx/d*R; dy=dy/d*R; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      onMove({ x: dx/R, y: dy/R });
    }
    function end(e){
      if(activeId===null||e&&e.pointerId!==activeId) return;
      activeId=null; knob.style.transform='translate(-50%,-50%)'; onMove({x:0,y:0});
    }
    joy.addEventListener('pointerdown',e=>{
      start(e);
      if(activeId===e.pointerId) try{ joy.setPointerCapture(e.pointerId); }catch(_){}
    });
    joy.addEventListener('pointermove',move);
    joy.addEventListener('lostpointercapture',end);
    window.addEventListener('pointerup',end);
    window.addEventListener('pointercancel',end);
  }

  return { setLoading, hideLoading, refreshCharGrid: renderCharGrid, initCharSelect, openCharSwitch, closeCharSwitch, showCharSelect, hideCharSelect,
    askConfirm, closeConfirm, fmt, NO_COIN,
    togglePanel, closePanel, openPanel, openShop, openFishingPanel, refreshFishingPanel, initPanels, addChat, updateHUD, toast, initJoystick,
    renderFishingPanel, renderInventory, renderPlayers, renderShop, renderVehicleShop, guardTap, holdCoin, releaseCoin };
})();
