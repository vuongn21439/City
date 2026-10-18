/* ===== GCITY Park: màn hình lớn chiếu YouTube + mini game =====
 * - Video YouTube là iframe HTML, được "dán" lên màn hình 3D bằng CSS matrix3d (homography
 *   từ 4 góc màn hình đã project ra màn hình 2D) nên xoay camera video vẫn bám theo.
 * - Mini game: Lật hình (phí 5 xu), Quay số may mắn (tự chọn số xu, 10 lượt quay độc lập), Đua thú (chọn thú + tự đặt xu).
 */
const Park = (() => {
  const $ = id => document.getElementById(id);
  const FW = 960, FH = 540;
  let player = null, frame = null, videoId = null, lastZone = null;
  // Ván đang dở: nếu đóng tab giữa chừng thì lần sau vào game sẽ được trả kết quả (quay số) / hoàn xu (lật hình) — không mất xu oan.
  const BET_MAX = 10000000000;   // trần số xu cho mỗi vé đua thú / mỗi lượt quay số
  const pend = { lo:null, mem:0, race:0 };
  const save = () => window.dispatchEvent(new Event('gcity-save'));   // game.js lưu ngay, không chờ vòng lưu 2s
  function getPending(){ return (pend.lo || pend.mem || pend.race) ? { lo:pend.lo, mem:pend.mem, race:pend.race } : null; }
  function settlePending(d){
    if(!d || !player) return;
    const msg = [], lo = d.lo;
    if(lo && Array.isArray(lo.res) && lo.res.length === LO.PRIZES && lo.bet >= 1 && lo.bet <= LO.MAX && lo.pick >= 1 && lo.pick <= 99){
      const hits = lo.res.filter(v => v === lo.pick).length, win = Math.floor(lo.bet) * LO.MULT * hits;
      player.coins += win;
      msg.push(hits ? `Lượt quay trước đã hoàn tất: khớp ${hits} lượt, +${nf(win)} xu` : 'Lượt quay trước đã hoàn tất: không khớp lượt nào');
    }
    if(d.mem > 0 && d.mem <= 100){ player.coins += Math.floor(d.mem); msg.push(`Đã hoàn ${Math.floor(d.mem)} xu từ ván lật hình chưa hoàn thành`); }
    if(d.race > 0 && d.race <= BET_MAX){ player.coins += Math.floor(d.race); msg.push(`Đã hoàn ${nf(d.race)} xu từ vé đua thú chưa có kết quả`); }
    if(msg.length){ UI.updateHUD(player); UI.toast(msg.join(' · ')); }
  }

  // ---------- Trường đua thú: 7 bạn thú · chọn thú + tự đặt xu · thưởng ×6 · mở vé 30s -> đua ~10-13s (chờ cả 7 con về đích) -> kết quả 7s ----------
  const AN=['🐎 Ngựa Đỏ','🐕 Chó Xanh','🐇 Thỏ Vàng','🐢 Rùa Tím','🦊 Cáo Cam','🐖 Heo Hồng','🐸 Ếch Xanh Lá'], N=AN.length, MULT=6;
  const RC={id:206453,ph:'open',t:30,rt:0,tk:null,bet:0,pay:0,p:AN.map(()=>0),v:[],o:[],w:-1,acc:0,fin:[],vf:[]};   // t: đếm lùi pha open/end · rt: thời gian chạy · o: pha dao động ngẫu nhiên của từng thú · fin: thời điểm từng thú chạm vạch đích (null = chưa về) · vf: tốc độ lúc chạm đích · bet/pay: xu đã đặt / xu thắng của vé hiện tại
  const RUNOUT=0.8;   // giây: thú về đích vẫn chạy đà rồi giảm tốc đều tới khi đứng lại, không đứng khựng ngay trên vạch
  // trả về tiến độ của một con sau khi đã chạm đích: 1 + quãng chạy đà (giảm tốc đều từ vf về 0 trong RUNOUT giây)
  const runOut = i => { const s=Math.min(Math.max(RC.rt-RC.fin[i],0),RUNOUT); return 1 + RC.vf[i]*s*(1-s/(2*RUNOUT)); };
  const icon = i => AN[i].split(' ')[0], label = i => AN[i].slice(AN[i].indexOf(' ') + 1);
  const RP = { open:false, body:null, sel:null, bet:100, view:'' };   // trạng thái panel đua thú: thú đang chọn · số xu nhập · khoá dựng lại panel
  let raceT = 0;
  function raceStep(dt){
    // Mỗi pha dùng đồng hồ riêng. Bản cũ trừ dt ở đầu hàm rồi cộng lại trong pha run -> RC.t luôn = 0,
    // sin(RC.t*2+i*2) thành hằng số = mức cộng/trừ tốc độ cố định cho từng thú (Cáo/Chó thắng ~87%).
    // Pha dao động cũng phải ngẫu nhiên mỗi ván (RC.o): nếu giữ i*2 cố định thì tích phân sin trong ~9s vẫn lệch
    // theo từng thú (Ngựa/Rùa/Ếch ~18% > 16,7% hoà vốn của thưởng x6 -> vẫn có con +EV).
    if(RC.ph==='open'){
      RC.t -= dt;
      if(RC.t<=0){ RC.ph='run'; RC.rt=0; RC.p=AN.map(()=>0); RC.v=AN.map(()=>.085+Math.random()*.05); RC.o=AN.map(()=>Math.random()*Math.PI*2); RC.fin=AN.map(()=>null); RC.vf=AN.map(()=>0); RC.w=-1; }
    }
    else if(RC.ph==='run'){
      // Mỗi thú phải tự chạm vạch đích (p>=1). Ván chỉ kết thúc khi cả 7 con đã về đích và chạy đà xong;
      // con về nhất được xác định ngay lúc chạm vạch (nội suy thời điểm chạm trong khung hình để không hoà giả).
      const t0 = RC.rt; RC.rt += dt;
      AN.forEach((_,i)=>{
        if(RC.fin[i]===null){
          const p0=RC.p[i], sp=RC.v[i] + Math.sin(RC.rt*2+RC.o[i])*.02;
          RC.p[i] = p0 + sp*dt;
          if(RC.p[i]>=1){ RC.fin[i] = t0 + dt*(1-p0)/(RC.p[i]-p0); RC.vf[i] = sp; RC.p[i] = runOut(i); }
        } else RC.p[i] = runOut(i);
      });
      if(RC.w<0){
        const first = RC.fin.reduce((b,f,i)=> f!==null && (b<0 || f<RC.fin[b]) ? i : b, -1);
        if(first>=0){ RC.w=first;
          if(RC.tk!==null){
            pend.race = 0;   // vé đã có kết quả → không còn ván dở để hoàn xu
            if(RC.tk===RC.w){ RC.pay=Math.round(RC.bet*MULT); player.coins+=RC.pay; UI.updateHUD(player); UI.toast(`Thú bạn chọn về nhất! +${nf(RC.pay)} xu`); }
            else UI.toast('Thú bạn chọn không về nhất. Chúc bạn may mắn lần sau.');
            save();
          } }
      }
      if(RC.fin.every(f=>f!==null && RC.rt-f>=RUNOUT)){ RC.ph='end'; RC.t=7; }
    }
    else if(RC.ph==='end'){
      RC.t -= dt;
      if(RC.t<=0){ RC.ph='open'; RC.t=30; RC.id++; RC.tk=null; RC.bet=0; RC.pay=0; RC.p=AN.map(()=>0); RC.w=-1; }
    }
    RC.acc += dt;
    if(RC.acc>=.5){ RC.acc=0;
      const done = RC.ph==='run' ? RC.fin.filter(f=>f!==null).length : 0;
      const st = RC.ph==='open' ? `Mở chọn thú: ${Math.ceil(RC.t)} giây` : RC.ph==='run' ? (RC.w<0 ? 'Đang đua!' : `${AN[RC.w]} nhất · ${done}/${N} về đích`) : `Về nhất: ${AN[RC.w]}`;
      Scene3D.setRaceBoard(`Đua thú · 7 thú · nhận ×${MULT}`,'LỰA CHỌN CỦA BẠN', RC.tk===null ? 'Chưa chọn thú' : AN[RC.tk],'TRẠNG THÁI',st);
      raceTickUI(); }
    // đang chạy = chưa về đích hoặc còn chạy đà; con thắng chỉ ăn mừng sau khi đã dừng lại
    const moving = RC.ph==='run' ? RC.fin.map(f=> f===null || RC.rt-f<RUNOUT) : false;
    Scene3D.setRacers(RC.p, moving, RC.ph==='end' ? RC.w : (RC.ph==='run' && RC.w>=0 && !moving[RC.w] ? RC.w : -1));
    if(rcActive()){ if(RP.view !== raceKey()) raceRender(); else raceLive(); }
  }

  // ---------- Ô đặt xu dùng chung (đua thú + quay số) ----------
  const BET_CHIPS = [10, 100, 1000, 10000];
  const betStep = v => Math.max(1, Math.pow(10, String(Math.floor(v)).length - 2));   // bước +/−: ~10% theo cỡ số đang nhập
  const betBoxHTML = (id, val) => `<div class="bet-box"><label for="${id}">Xu đặt</label>
    <div class="bet-line"><button class="bet-step bet-ctl" type="button" data-s="-1" aria-label="Giảm">−</button><input id="${id}" class="mg-input bet-input" inputmode="numeric" autocomplete="off" value="${val}"><button class="bet-step bet-ctl" type="button" data-s="1" aria-label="Tăng">+</button></div>
    <div class="bet-chips">${BET_CHIPS.map(v => `<button class="bet-chip bet-ctl" type="button" data-v="${v}">${nf(v)}</button>`).join('')}<button class="bet-chip bet-ctl" type="button" data-v="half">½</button><button class="bet-chip bet-ctl" type="button" data-v="x2">×2</button><button class="bet-chip bet-ctl" type="button" data-v="all">Tất cả</button></div></div>`;
  function bindBet(body, input, onChange){
    const cap = () => Math.max(1, Math.min(BET_MAX, Math.floor(player.coins) || 1));
    const set = v => { input.value = Math.max(1, Math.min(Math.floor(v) || 1, cap())); onChange(+input.value); };
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, ''); onChange(parseInt(input.value, 10) || 0); });
    body.querySelectorAll('.bet-ctl').forEach(btn => btn.onclick = () => {
      const cur = parseInt(input.value, 10) || 0, d = btn.dataset;
      set(d.s ? cur + (+d.s) * betStep(cur || 1) : d.v === 'half' ? cur / 2 : d.v === 'x2' ? cur * 2 : d.v === 'all' ? player.coins : +d.v);
    });
  }

  // ---------- Panel đua thú: chọn thú → đặt xu → vé cược → theo dõi đường đua ----------
  const rcActive = () => RP.open && RP.body && RP.body.isConnected && !$('gamePanel').classList.contains('hidden');
  const rq = s => rcActive() ? RP.body.querySelector(s) : null;
  const raceKey = () => `${RC.ph}|${RC.id}|${RC.tk}|${RC.w >= 0}`;
  const laneColor = i => Animals.LANE_CSS[i];
  function ticketHTML(){
    const done = RC.w >= 0, won = done && RC.tk === RC.w;
    const stamp = !done ? '' : won ? `<span class="rc-stamp">+${nf(RC.pay)} xu</span>` : '<span class="rc-stamp">Không trúng</span>';
    return `<div class="rc-ticket${done ? (won ? ' win' : ' lose') : ''}" style="--lane:${laneColor(RC.tk)}">
      <div class="rc-tk-lane"><i>${RC.tk + 1}</i></div>
      <div class="rc-tk-main"><small>Vé của bạn</small><b>${icon(RC.tk)} ${label(RC.tk)}</b>
        <div class="rc-tk-row"><span>Đặt <b>${nf(RC.bet)}</b> xu</span><span>Trúng nhận <b>${nf(Math.round(RC.bet * MULT))}</b> xu</span></div></div>${stamp}</div>`;
  }
  const lanesHTML = () => `${RC.w >= 0 ? `<div class="rc-first">Về nhất: ${icon(RC.w)} ${label(RC.w)}</div>` : ''}<div class="rc-lanes">${AN.map((_, i) =>
    `<div class="rc-lane${RC.tk === i ? ' mine' : ''}" id="rcL${i}" style="--lane:${laneColor(i)}"><span class="rc-ln">${i + 1}</span><div class="rc-track"><i class="rc-run">${icon(i)}</i></div></div>`).join('')}</div>`;
  function raceTickUI(){
    const bal = rq('#rcBal'); if(bal) bal.textContent = nf(player.coins) + ' xu';
    const tx = rq('#rcClockTxt'), bar = rq('#rcClockBar'), clk = rq('#rcClock'); if(!tx) return;
    const open = RC.ph === 'open', run = RC.ph === 'run';
    tx.textContent = open ? `Đóng vé sau ${Math.ceil(RC.t)} giây` : run ? 'Đang đua…' : `Ván mới sau ${Math.ceil(RC.t)} giây`;
    bar.style.width = (run ? 100 : Math.max(0, Math.min(1, RC.t / (open ? 30 : 7))) * 100) + '%';
    clk.classList.toggle('run', run);
  }
  function raceLive(){   // vị trí từng thú trên đường đua mini (gọi mỗi khung hình khi panel đang mở)
    if(!rcActive() || RC.ph === 'open') return;
    for(let i = 0; i < N; i++){
      const l = rq('#rcL' + i); if(!l) return;
      l.style.setProperty('--p', Math.min(1, RC.p[i])); l.classList.toggle('win', RC.w === i);
    }
  }
  function raceRender(){
    if(!rcActive()) return;
    const b = RP.body; RP.view = raceKey();
    let html = `<div class="rc-top"><div class="rc-bal"><span>Số dư</span><b id="rcBal"></b></div><div class="rc-clock" id="rcClock"><span id="rcClockTxt"></span><i id="rcClockBar"></i></div></div>`;
    if(RC.ph === 'open' && RC.tk === null){
      RP.bet = Math.max(1, Math.min(RP.bet, Math.floor(player.coins) || 1));
      html += `<div class="rc-title">Chọn thú về nhất</div><div class="rc-grid">${AN.map((_, i) =>
        `<button class="rc-card${RP.sel === i ? ' sel' : ''}" type="button" data-a="${i}" style="--lane:${laneColor(i)}"><i class="rc-n">${i + 1}</i><span class="rc-e">${icon(i)}</span><b>${label(i)}</b></button>`).join('')
        }<div class="rc-odds"><b>×${MULT}</b><small>nếu thú bạn chọn về nhất</small></div></div>${betBoxHTML('rcBet', RP.bet)}<div class="bet-win">Trúng nhận <b id="rcWin"></b> xu</div><button class="btn-primary btn-wide" id="rcGo" type="button">Đặt cược</button>`;
    } else if(RC.tk !== null){
      html += ticketHTML() + (RC.ph === 'open' ? `<button class="rc-cancel" id="rcCancel" type="button">Huỷ vé và hoàn xu</button><div class="mg-info">Vé sẽ khoá khi cuộc đua bắt đầu.</div>` : lanesHTML());
    } else {
      html += `<div class="mg-info">${RC.ph === 'run' ? 'Cuộc đua đang diễn ra. Bạn đặt vé được ở ván sau.' : 'Ván đua đã kết thúc. Bạn đặt vé được ở ván sau.'}</div>` + lanesHTML();
    }
    b.innerHTML = html;
    raceTickUI(); raceLive();
    const inp = b.querySelector('#rcBet');
    if(inp){
      const upd = v => { RP.bet = v; const w = b.querySelector('#rcWin'); if(w) w.textContent = nf(Math.round(v * MULT)); };
      bindBet(b, inp, upd); upd(RP.bet);
      b.querySelectorAll('[data-a]').forEach(btn => btn.onclick = () => {
        RP.sel = +btn.dataset.a;
        b.querySelectorAll('.rc-card').forEach(c => c.classList.toggle('sel', +c.dataset.a === RP.sel));
      });
      b.querySelector('#rcGo').onclick = () => {
        if(RC.ph !== 'open') return raceRender();
        if(RP.sel === null){ UI.toast('Chọn một thú trước khi đặt cược'); return; }
        const bet = parseInt(inp.value, 10);
        if(!(bet >= 1)){ UI.toast('Vui lòng nhập số xu'); return; }
        if(bet > BET_MAX){ UI.toast(`Tối đa ${nf(BET_MAX)} xu`); return; }
        if(bet > player.coins){ UI.toast(UI.NO_COIN); return; }
        player.coins -= bet; RC.tk = RP.sel; RC.bet = bet; RP.bet = bet; pend.race = bet;   // đóng tab trước khi có kết quả → lần sau vào game được hoàn xu
        UI.updateHUD(player); save(); UI.toast(`Đã đặt ${nf(bet)} xu cho ${label(RC.tk)}`); raceRender();
      };
    }
    const cn = b.querySelector('#rcCancel');
    if(cn) cn.onclick = () => {
      if(RC.ph !== 'open' || RC.tk === null) return raceRender();
      player.coins += RC.bet; RC.tk = null; RC.bet = 0; pend.race = 0;
      UI.updateHUD(player); save(); UI.toast('Đã huỷ vé, hoàn xu'); raceRender();
    };
  }
  function openRace(){
    const b = showGamePanel('🐎 Đua thú');
    RP.open = true; RP.body = b; raceRender();
  }

  // ---------- YouTube ----------
  function parseYT(s){
    s = (s || '').trim();
    // ID trần 11 ký tự phải có chữ HOA / số / "_" như ID thật. Chuỗi toàn chữ thường + gạch ngang (vd "lofi-hiphop") là TỪ KHOÁ.
    if(/^[\w-]{11}$/.test(s)) return /[A-Z0-9_]/.test(s) ? s : null;
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/|live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  const PLAYING = ['ĐANG PHÁT', 'Đến gần màn hình để xem'];
  function playVideo(input, save=true){
    const id = parseYT(input);
    if(!id){ UI.toast('Liên kết YouTube không hợp lệ'); return; }
    videoId = id;
    frame.src = `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
    Scene3D.setScreenText(...PLAYING);
    if(save){ try { localStorage.setItem('gcity_yt', input); } catch(e){} }
  }

  // ---------- Tìm video YouTube bằng từ khóa (YouTube Data API v3) ----------
  // Mỗi lượt tìm tốn 100 đơn vị quota (miễn phí 10.000/ngày ~ 100 lượt) nên có cache theo từ khóa.
  const ytCache = new Map();
  let searchSeq = 0;
  const decodeHTML = s => new DOMParser().parseFromString(s || '', 'text/html').documentElement.textContent;
  function note(box, msg){
    box.innerHTML = '';
    const d = document.createElement('div'); d.className = 'tv-note'; d.textContent = msg; box.appendChild(d);
  }
  function renderResults(box, items){
    box.innerHTML = '';
    if(!items.length){ note(box, 'Không tìm thấy video phù hợp. Hãy thử từ khóa khác.'); return; }
    items.forEach(it=>{
      const b = document.createElement('button'); b.className = 'tv-item'; b.type = 'button';
      const img = document.createElement('img'); img.src = `https://i.ytimg.com/vi/${it.id}/mqdefault.jpg`; img.alt = ''; img.loading = 'lazy';
      const t = document.createElement('div');
      const h = document.createElement('b'); h.textContent = it.title;
      const c = document.createElement('small'); c.textContent = it.channel;
      t.append(h, c); b.append(img, t);
      b.onclick = ()=>{ playVideo(it.id, false); UI.toast('Đang chiếu: ' + it.title.slice(0, 40)); UI.closePanel('tvPanel'); };
      box.appendChild(b);
    });
  }
  const TV_OFF = 'Tìm kiếm hiện chưa khả dụng. Vui lòng dán liên kết video.';
  async function searchVideos(q){
    const box = $('tvResults');
    if(!YTKEYS.count()){ note(box, TV_OFF); return; }
    const ck = q.toLowerCase();
    if(ytCache.has(ck)){ renderResults(box, ytCache.get(ck)); return; }
    const my = ++searchSeq;
    note(box, 'Đang tìm…');
    try {
      const r = await ytSearch(q);
      if(my !== searchSeq) return;                 // đã có lượt tìm mới hơn
      if(r.ok){
        ytCache.set(ck, r.items);
        renderResults(box, r.items);
        return;
      }
      // Người chơi không cần biết chuyện key / quota: chi tiết kỹ thuật chỉ ghi ra console
      console.warn('[TV] tìm video thất bại:', r.reason, r.msg || '', r.reason === 'quota' ? `(reset sau ~${YTKEYS.resetInMin()} phút)` : '');
      if(r.reason === 'quota' || r.reason === 'key') note(box, TV_OFF);
      else note(box, 'Không thể tìm video lúc này. Vui lòng thử lại sau.');
    } catch(e){
      if(my === searchSeq){ console.warn('[TV]', e); note(box, 'Kết nối không ổn định. Vui lòng thử lại.'); }
    }
  }
  // Gọi YouTube Data API và XOAY VÒNG key: key nào báo hết quota thì bỏ qua, thử key kế tiếp
  async function ytSearch(q){
    const isQuota = why => /quotaExceeded|dailyLimitExceeded|rateLimitExceeded|userRateLimitExceeded/i.test(why || '');
    // Chỉ coi là "key hỏng" khi Google nói thẳng key có vấn đề. badRequest / forbidden... thường chỉ do từ khoá lạ
    // → KHÔNG được khoá key cả ngày (bản cũ: một từ khoá lạ là mất key trên trình duyệt đó).
    const isKeyBad = why => /keyInvalid|ipRefererBlocked|apiNotEnabled|accessNotConfigured/i.test(why || '');
    let keyBad = false;
    for(let hop=0; hop<YTKEYS.count()+1; hop++){
      const key = YTKEYS.pick();
      if(!key) return { ok:false, reason: keyBad ? 'key' : 'quota' };   // hết key còn sống
      const u = new URL('https://www.googleapis.com/youtube/v3/search');
      Object.entries({ part:'snippet', type:'video', maxResults:8, q, key,
        videoEmbeddable:'true', videoSyndicated:'true', safeSearch:'moderate', relevanceLanguage:'vi' })
        .forEach(([k,v]) => u.searchParams.set(k, v));
      const j = await (await fetch(u)).json();
      if(!j.error){
        return { ok:true, items:(j.items || []).filter(x => x.id && x.id.videoId)
          .map(x => ({ id:x.id.videoId, title:decodeHTML(x.snippet.title), channel:decodeHTML(x.snippet.channelTitle) })) };
      }
      const why = (j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '';
      if(isQuota(why)){ YTKEYS.kill(key, why); continue; }              // hết lượt → xoay sang key sau
      if(isKeyBad(why)){ YTKEYS.kill(key, why); keyBad = true; continue; }
      return { ok:false, reason:'err', msg:j.error.message };            // lỗi theo yêu cầu (từ khoá lạ...): không đụng tới key
    }
    return { ok:false, reason: keyBad ? 'key' : 'quota' };
  }
  // Nhập link/ID -> phát luôn; nhập chữ -> tìm kiếm
  function submitTv(){
    const v = $('tvUrl').value.trim();
    if(!v){ UI.toast('Nhập tên video hoặc dán liên kết YouTube'); return; }
    if(parseYT(v)){ $('tvResults').innerHTML = ''; playVideo(v); return; }
    try { localStorage.setItem('gcity_yt', v); } catch(e){}
    searchVideos(v);
  }
  function stopVideo(){
    videoId = null; frame.src = 'about:blank'; frame.style.visibility = 'hidden';
    Scene3D.setScreenText('GCITY TV', 'Chọn video tại quầy 📺 cạnh sân khấu');
  }

  // Ánh xạ hình chữ nhật FW×FH -> 4 điểm P (TL,TR,BR,BL) => CSS matrix3d
  function matrix3d(P){
    const src = [[0,0],[FW,0],[FW,FH],[0,FH]], A = [], B = [];
    for(let i=0;i<4;i++){
      const [x,y] = src[i], [u,v] = P[i];
      A.push([x,y,1,0,0,0,-u*x,-u*y]); B.push(u);
      A.push([0,0,0,x,y,1,-v*x,-v*y]); B.push(v);
    }
    const n = 8;
    for(let i=0;i<n;i++){
      let m = i;
      for(let r=i+1;r<n;r++) if(Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
      [A[i],A[m]] = [A[m],A[i]]; [B[i],B[m]] = [B[m],B[i]];
      for(let r=i+1;r<n;r++){
        const f = A[r][i]/A[i][i];
        for(let c=i;c<n;c++) A[r][c] -= f*A[i][c];
        B[r] -= f*B[i];
      }
    }
    const h = new Array(n);
    for(let i=n-1;i>=0;i--){
      let s = B[i];
      for(let c=i+1;c<n;c++) s -= A[i][c]*h[c];
      h[i] = s/A[i][i];
    }
    const [a,b,c,d,e,f,g,hh] = h;
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
  }

  function update(zone){
    if(!frame) return;
    const nw=performance.now(), dtR=Math.min(0.1,(nw-(raceT||nw))/1000); raceT=nw; raceStep(dtR);
    if(zone !== lastZone){
      lastZone = zone;
      if(zone === 'plaza' && videoId) Scene3D.setScreenText(...PLAYING);
    }
    const pts = (zone === 'plaza' && videoId) ? Scene3D.screenCorners2D() : null;
    const w = pts ? Math.hypot(pts[1][0]-pts[0][0], pts[1][1]-pts[0][1]) : 0;
    if(!pts || w < 80){ frame.style.visibility = 'hidden'; return; }
    frame.style.visibility = 'visible';
    frame.style.transform = matrix3d(pts);
  }

  // ---------- Mini game ----------
  const MG = {
    memory: { name:'🃏 Lật hình', fee:5, start(b, end){
      const E = ['🐶','🐱','🐸','🦊','🐼','🦁'], deck = [...E, ...E].sort(()=>Math.random()-.5);
      let open = [], moves = 0, done = 0, lock = false;
      b.innerHTML = '<div class="mg-info">Lật cặp giống nhau. Số lượt: <b id="mgMoves">0</b></div><div class="mg-grid"></div>';
      const grid = b.querySelector('.mg-grid');
      deck.forEach(e=>{
        const c = document.createElement('button'); c.className = 'mg-card'; c.textContent = '?';
        c.onclick = ()=>{
          if(lock || c.classList.contains('up')) return;
          c.classList.add('up'); c.textContent = e; open.push([c, e]);
          if(open.length < 2) return;
          moves++; b.querySelector('#mgMoves').textContent = moves;
          const [[c1,e1],[c2,e2]] = open; open = [];
          if(e1 === e2){ if(++done === 6) end(moves<=8 ? 40 : moves<=12 ? 25 : 12, `Hoàn thành sau ${moves} lượt`); }
          else { lock = true; setTimeout(()=>{ [c1,c2].forEach(x=>{ x.classList.remove('up'); x.textContent = '?'; }); lock = false; }, 700); }
        };
        grid.appendChild(c);
      });
    }},
    lo: { name:'⭐ Vòng quay may mắn', fee:0, custom:true, start(b){ loStart(b); } },
  };

  // ---------- Quay số may mắn ----------
  // Chọn số may mắn 01–99 + số xu chơi -> bấm "Quay": 10 giải quay, mỗi giải là một lần quay ĐỘC LẬP (có thể trùng số giữa các giải).
  // Mỗi giải trùng số đã chọn => thưởng x10 tiền đặt; trúng nhiều giải thì cộng dồn (2 giải = x20, 3 giải = x30, ...).
  // Hiệu ứng: cả 10 ô cùng quay, chậm dần rồi dừng lần lượt; ô trúng nảy lên + pháo xu; thắng thì nháy sáng + số dư chạy lên.
  const LO = { PRIZES:10, MULT:10, MAX:BET_MAX, pick:1, bet:10000, busy:false, res:[], shown:0, body:null, summary:'', sumCls:'' };
  const nf  = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const two = n => String(n).padStart(2, '0');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rnd99 = () => 1 + Math.floor(Math.random() * 99);
  const loQ = sel => (LO.body && LO.body.isConnected) ? LO.body.querySelector(sel) : null;   // panel đóng/mở lại giữa chừng vẫn an toàn
  function loBalance(){ const el = loQ('#loBal'); if(el) el.textContent = nf(player.coins) + ' xu'; }
  function countUp(el, a, b, ms){   // số dư chạy từ a lên b
    const t0 = performance.now();
    const f = now => { if(!el.isConnected) return; const u = Math.min(1, (now - t0) / ms); el.textContent = nf(a + (b - a) * (1 - Math.pow(1 - u, 3))) + ' xu'; if(u < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  function loLock(on){
    if(LO.body && LO.body.isConnected) LO.body.querySelectorAll('#loPick, #loBet, #loGo, .lo-ctl, .bet-ctl').forEach(el => el.disabled = on);
    const go = loQ('#loGo'); if(go) go.textContent = on ? 'Đang quay…' : 'Quay';
  }
  function burst(el, n){   // pháo xu/sao bắn ra từ một phần tử
    const host = LO.body; if(!host || !host.isConnected || !el || !el.isConnected) return;
    const x = el.offsetLeft + el.offsetWidth / 2, y = el.offsetTop + el.offsetHeight / 2;
    for(let k = 0; k < n; k++){
      const s = document.createElement('i'), a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 90;
      s.className = 'lo-spark'; s.textContent = k % 3 ? '🪙' : '⭐';
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r - 40}px;--r:${(Math.random() - .5) * 540}deg;animation-delay:${Math.floor(Math.random() * 80)}ms`;
      s.addEventListener('animationend', () => s.remove());
      host.appendChild(s);
    }
  }
  async function loRollPick(){   // nút 🎲: số trên màn hình quay chậm dần rồi dừng ở một số ngẫu nhiên
    if(LO.busy || LO.rolling) return;
    LO.rolling = true; loLock(true);
    const final = rnd99(), t0 = performance.now(), DUR = 1000;
    let next = 0;
    const inp0 = loQ('#loPick'); if(inp0) inp0.classList.add('roll');
    for(;;){
      const now = performance.now() - t0; if(now >= DUR) break;
      if(now >= next){ const e = loQ('#loPick'); if(e) e.value = two(rnd99()); next = now + 40 + Math.pow(now / DUR, 3) * 240; }
      await wait(20);
    }
    LO.pick = final; LO.rolling = false; loLock(false);
    const e = loQ('#loPick'); if(e){ e.value = two(final); e.classList.remove('roll', 'pop'); void e.offsetWidth; e.classList.add('pop'); }
  }
  function loStart(body){
    if(!LO.busy) LO.bet = Math.max(1, Math.min(LO.bet, Math.floor(player.coins) || 1));
    LO.body = body;
    body.innerHTML = `
      <div class="lo-bal"><span>Số dư</span><b id="loBal">${nf(player.coins)} xu</b></div>
      <div class="lo-lucky">
        <div class="lo-lucky-title">Số may mắn của bạn (01–99)</div>
        <div class="lo-lucky-row">
          <button class="lo-step lo-ctl" type="button" data-s="-1" aria-label="Giảm">−</button>
          <input id="loPick" class="mg-input lo-pick" inputmode="numeric" maxlength="2" autocomplete="off" value="${two(LO.pick)}">
          <button class="lo-step lo-ctl" type="button" data-s="1" aria-label="Tăng">+</button>
        </div>
        <button class="lo-dice lo-ctl" id="loDice" type="button">🎲 Chọn ngẫu nhiên</button>
      </div>
      ${betBoxHTML('loBet', LO.bet)}
      <div class="bet-win">Mỗi lượt khớp nhận <b id="loWin"></b> xu <span class="lo-x">(×${LO.MULT})</span></div>
      <button class="btn-primary btn-wide" id="loGo" type="button">Quay</button>
      <div class="lo-rule lo-sum ${LO.sumCls}" id="loSum">${LO.summary}</div>
      <div class="lo-title">${LO.PRIZES} lượt quay · mỗi lượt quay độc lập</div>
      <div class="lo-grid">${Array.from({length:LO.PRIZES}, (_, i) => `<div class="lo-box" id="loB${i}"><small>Lượt ${i+1}</small><b>··</b></div>`).join('')}</div>`;
    const pickIn = body.querySelector('#loPick'), betIn = body.querySelector('#loBet');
    pickIn.oninput = () => { pickIn.value = pickIn.value.replace(/\D/g, ''); };
    pickIn.onblur = () => { const v = parseInt(pickIn.value, 10); if(v >= 1 && v <= 99) pickIn.value = two(v); };
    body.querySelectorAll('.lo-step').forEach(btn => btn.onclick = () => {
      const cur = parseInt(pickIn.value, 10) || 1;
      pickIn.value = two(((cur - 1 + (+btn.dataset.s) + 99) % 99) + 1);
    });
    body.querySelector('#loDice').onclick = loRollPick;
    const upd = v => { const w = body.querySelector('#loWin'); if(w) w.textContent = nf(v * LO.MULT); };
    bindBet(body, betIn, upd); upd(LO.bet);
    // dựng lại các giải đã quay (nếu mở lại panel khi đang quay / sau khi quay xong)
    LO.res.slice(0, LO.shown).forEach((v, i) => {
      const el = body.querySelector('#loB' + i); el.lastChild.textContent = two(v); el.classList.toggle('hit', v === LO.pick);
    });
    if(LO.busy){ for(let i = LO.shown; i < LO.PRIZES; i++) body.querySelector('#loB' + i).classList.add('spin'); loLock(true); }
    body.querySelector('#loGo').onclick = () => {
      if(LO.busy || LO.rolling) return;
      const pick = parseInt(loQ('#loPick').value, 10), bet = parseInt(loQ('#loBet').value, 10);
      if(!(pick >= 1 && pick <= 99)){ UI.toast('Chọn số từ 01 đến 99'); return; }
      if(!(bet >= 1)){ UI.toast('Vui lòng nhập số xu'); return; }
      if(bet > LO.MAX){ UI.toast(`Tối đa ${nf(LO.MAX)} xu/lượt`); return; }
      if(bet > player.coins){ UI.toast(UI.NO_COIN); return; }
      LO.pick = pick; LO.bet = bet; loSpin();
    };
  }
  async function loSpin(){
    const pick = LO.pick, bet = LO.bet;
    LO.busy = true; LO.shown = 0; LO.summary = ''; LO.sumCls = '';
    LO.res = Array.from({length:LO.PRIZES}, rnd99);   // mỗi giải một lần random riêng
    player.coins -= bet; UI.updateHUD(player); loBalance(); loLock(true);
    pend.lo = { bet, pick, res: LO.res.slice() }; save();   // đóng tab giữa chừng → lần sau vào game vẫn được trả đúng kết quả này
    for(let i = 0; i < LO.PRIZES; i++){ const el = loQ('#loB' + i); if(el){ el.className = 'lo-box spin'; el.lastChild.textContent = '··'; el.lastChild.style.animationName = ''; } }
    const sum = (t, c) => { LO.summary = t; LO.sumCls = c || ''; const el = loQ('#loSum'); if(el){ el.textContent = t; el.className = 'lo-rule lo-sum ' + (c || ''); } };
    sum('Đang quay…');
    // cả 10 ô cùng quay; ô i dừng ở T(i) → các giải lộ ra lần lượt. Gần lúc dừng thì đổi số thưa dần (hiệu ứng chậm lại).
    const T = i => 900 + i * 330, nextAt = Array(LO.PRIZES).fill(0), t0 = performance.now();
    let done = 0, hits = 0, flip = false;
    while(done < LO.PRIZES){
      const now = performance.now() - t0;
      for(let i = done; i < LO.PRIZES; i++){
        const el = loQ('#loB' + i);
        if(now >= T(i)){
          const v = LO.res[i], hit = v === pick; if(hit) hits++;
          LO.shown = i + 1; done = i + 1;
          if(el){ el.classList.remove('spin'); el.classList.add('land'); el.classList.toggle('hit', hit); el.lastChild.style.animationName = ''; el.lastChild.textContent = two(v); if(hit) burst(el, 8); }
          if(hits) sum(`Khớp ${hits} lượt · ×${hits * LO.MULT}`, 'hit');
        } else if(el && now >= nextAt[i]){
          nextAt[i] = now + 45 + Math.max(0, 480 - (T(i) - now)) * 0.55;
          flip = !flip; el.lastChild.textContent = two(rnd99()); el.lastChild.style.animationName = flip ? 'loTickA' : 'loTickB';
        }
      }
      await wait(30);
    }
    const win = bet * LO.MULT * hits, before = player.coins;
    player.coins += win; pend.lo = null; UI.updateHUD(player); save();
    LO.busy = false; loLock(false);
    if(hits){
      const bal = loQ('#loBal'); if(bal) countUp(bal, before, player.coins, 900);
      sum(`Khớp ${hits} lượt · +${nf(win)} xu`, 'win');
      const sm = loQ('#loSum'); if(sm) burst(sm, 14 + hits * 8);
      const host = LO.body; if(host && host.isConnected){ host.classList.add('flash'); setTimeout(() => host.classList.remove('flash'), 800); }
      UI.toast(`Chúc mừng! Khớp ${hits} lượt · +${nf(win)} xu`);
    } else {
      loBalance();
      sum(`Không khớp lượt nào · −${nf(bet)} xu`, 'lose');
      UI.toast('Không khớp lượt nào. Chúc bạn may mắn lần sau.');
    }
  }

  function showGamePanel(title){
    RP.open = false;   // mở game khác thì panel đua thú thôi cập nhật
    document.querySelectorAll('.panel').forEach(p=>p.classList.add('hidden'));
    $('gamePanel').classList.remove('hidden'); $('gameTitle').textContent = title;
    return $('gameBody');
  }
  function openGame(id){
    const g = MG[id]; if(!g) return;
    if(g.custom){ g.start(showGamePanel(g.name)); return; }
    if(player.coins < g.fee){ UI.toast(UI.NO_COIN); return; }
    player.coins -= g.fee; UI.updateHUD(player);
    const body = showGamePanel(g.name);
    pend.mem = g.fee; save();                      // ván đang dở: đóng tab giữa chừng thì lần sau được hoàn xu
    g.start(body, (reward, msg)=>{
      pend.mem = 0;
      player.coins += reward; UI.updateHUD(player); save();
      body.innerHTML = `<div class="mg-result">${msg}<br>${reward ? '+' + reward + ' xu' : 'Chúc may mắn lần sau'}</div><button class="btn-primary btn-wide" id="mgAgain">Chơi lại (${g.fee} xu)</button>`;
      $('mgAgain').onclick = ()=> openGame(id);
    });
  }
  function init(p){
    player = p; frame = $('tvFrame');
    frame.style.width = FW + 'px'; frame.style.height = FH + 'px';
    try { $('tvUrl').value = localStorage.getItem('gcity_yt') || ''; } catch(e){}
    $('tvPlay').onclick = submitTv;
    $('tvUrl').addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); submitTv(); } });
    $('tvStop').onclick = stopVideo;
    // đóng panel giữa ván lật hình = bỏ ván (mất phí), không tính là ván dở để hoàn xu
    new MutationObserver(()=>{ if($('gamePanel').classList.contains('hidden') && pend.mem){ pend.mem = 0; save(); } })
      .observe($('gamePanel'), { attributes:true, attributeFilter:['class'] });
  }

  return { init, update, openRace, openGame, matrix3d, parseYT, getPending, settlePending };
})();
