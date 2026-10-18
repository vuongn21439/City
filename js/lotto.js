/* ===== GCITY · Số may mắn (chọn 3 chữ số) =====
 * Luật: phí FEE xu / lượt. Hệ thống quay ra 3 chữ số. So khớp LIÊN TIẾP từ chữ số cuối (bên phải) sang trái:
 *   khớp cả 3 → 1.000 xu · khớp 2 số cuối → 100 xu · khớp số cuối → 20 xu. Mỗi lượt chỉ nhận giải cao nhất đạt được.
 * Kết quả được tính và trả thưởng NGAY khi bấm Quay (đóng tab giữa chừng vẫn nhận đúng thưởng).
 * Phần hiệu ứng chỉ là "lộ" kết quả: 3 cuộn quay cùng lúc rồi dừng lần lượt từ phải sang trái.
 * HUD giữ số xu cũ tới khi cuộn cuối dừng để không lộ kết quả sớm (xem UI.holdCoin / UI.releaseCoin).
 */
const Lotto = (() => {
  const FEE = 10;
  const TIERS = [   // n = số chữ số khớp liên tiếp tính từ bên phải
    { n:3, prize:1000, label:'Trùng cả 3 số' },
    { n:2, prize:100,  label:'Trùng 2 số cuối' },
    { n:1, prize:20,   label:'Trùng số cuối' },
  ];
  const nf = n => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const randDigit = () => Math.floor(Math.random() * 10);
  const randDigits = () => [randDigit(), randDigit(), randDigit()];
  const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // ---------- Luật (hàm thuần, không đụng DOM) ----------
  function chainOf(pick, res){ let n = 0; for(let i = 2; i >= 0 && pick[i] === res[i]; i--) n++; return n; }
  function prizeOf(n){ const t = TIERS.find(t => t.n === n); return t ? t.prize : 0; }
  function draw(pick){
    const res = randDigits(), chain = chainOf(pick, res);
    return { pick: pick.slice(), res, chain, prize: prizeOf(chain) };
  }

  // ---------- Trạng thái (giữ khi đóng / mở lại panel) ----------
  const S = { pick: randDigits(), busy:false, rolling:false, cur:null, last:null, stale:false, stopped:[false,false,false], host:null, ctx:null };
  const q = sel => (S.host && S.host.isConnected) ? S.host.querySelector(sel) : null;
  const qa = sel => (S.host && S.host.isConnected) ? S.host.querySelectorAll(sel) : [];

  const stripHTML = () => Array.from({length:20}, (_, k) => `<span>${k % 10}</span>`).join('');
  const reelHTML = i => `<div class="lt-reel idle" id="ltR${i}"><div class="lt-strip">${stripHTML()}</div></div>`;
  const pickHTML = i => `
    <div class="lt-col">
      <button class="lt-step" type="button" data-i="${i}" data-s="1" aria-label="Tăng chữ số thứ ${i+1}">▲</button>
      <input class="lt-d" id="ltP${i}" data-i="${i}" readonly inputmode="numeric" maxlength="1" autocomplete="off" aria-label="Chữ số thứ ${i+1}" value="${S.pick[i]}">
      <button class="lt-step" type="button" data-i="${i}" data-s="-1" aria-label="Giảm chữ số thứ ${i+1}">▼</button>
    </div>`;
  const prizeHTML = t => `
    <div class="lt-prize" data-n="${t.n}">
      <span class="lt-pat" aria-hidden="true">${[0,1,2].map(i => `<i class="${i >= 3 - t.n ? 'on' : ''}"></i>`).join('')}</span>
      <span>${t.label}</span><b>${nf(t.prize)} xu</b>
    </div>`;

  function render(host, ctx){
    S.host = host; S.ctx = ctx;
    host.innerHTML = `
      <div class="lt" id="ltWrap">
        <div class="lt-flash"></div>
        <div class="lt-meta"><span>Phí mỗi lượt <b>${FEE} xu</b></span><span>Số dư <b id="ltBal">${nf(balance())} xu</b></span></div>
        <ol class="lt-steps">
          <li>Chọn 3 số</li>
          <li>Bấm Quay</li>
          <li>Khớp từ số cuối</li>
        </ol>
        <div>
          <div class="lt-sect"><span>Bảng thưởng</span><small><i class="lt-dot"></i>chữ số phải khớp</small></div>
          <div class="lt-prizes">${TIERS.map(prizeHTML).join('')}</div>
        </div>
        <div>
          <div class="lt-sect"><span>Số của bạn</span><button class="lt-dice" id="ltDice" type="button">🎲 Chọn ngẫu nhiên</button></div>
          <div class="lt-cols lt-pick">${[0,1,2].map(pickHTML).join('')}</div>
        </div>
        <div>
          <div class="lt-sect"><span>Kết quả quay</span></div>
          <div class="lt-cols lt-res">${[0,1,2].map(reelHTML).join('')}</div>
        </div>
        <div class="lt-status" id="ltStatus" role="status" aria-live="polite"></div>
        <button class="lt-go" id="ltGo" type="button">Quay số · ${FEE} xu</button>
      </div>`;
    bind();
    restore();
  }

  const balance = () => S.busy && S.cur ? S.cur.before : S.ctx.getCoins();

  // ---------- Dựng lại trạng thái hiện tại khi mở lại panel ----------
  function restore(){
    if(S.busy && S.cur){
      for(let i = 0; i < 3; i++) S.stopped[i] ? showReel(i, S.cur.res[i], S.cur.chain) : spinReel(i);
      setStatus('Đang quay số…'); lock(true); setGo('Đang quay…');
    } else if(S.last){
      const d = S.last;
      for(let i = 0; i < 3; i++) showReel(i, d.res[i], d.chain);
      if(S.stale) applyStale(); else showOutcome(d);
      setGo(`Quay lại · ${FEE} xu`);
    } else setStatus('Chọn 3 chữ số rồi bấm Quay số.');
  }

  // ---------- Điều khiển chọn số ----------
  function bind(){
    qa('.lt-step').forEach(b => b.onclick = () => {
      if(S.busy || S.rolling) return;
      const i = +b.dataset.i; setDigit(i, (S.pick[i] + (+b.dataset.s) + 10) % 10, true);
    });
    qa('.lt-d').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if(S.busy || S.rolling) return;
        const i = +inp.dataset.i;
        if(/^[0-9]$/.test(e.key)){ setDigit(i, +e.key, true); const nx = q('#ltP' + (i + 1)); if(nx) nx.focus(); else inp.blur(); e.preventDefault(); }
        else if(e.key === 'ArrowUp'){ setDigit(i, (S.pick[i] + 1) % 10, true); e.preventDefault(); }
        else if(e.key === 'ArrowDown'){ setDigit(i, (S.pick[i] + 9) % 10, true); e.preventDefault(); }
        else if(e.key === 'ArrowLeft'){ const p = q('#ltP' + (i - 1)); if(p) p.focus(); e.preventDefault(); }
        else if(e.key === 'ArrowRight'){ const n = q('#ltP' + (i + 1)); if(n) n.focus(); e.preventDefault(); }
        else if(e.key === 'Enter'){ go(); e.preventDefault(); }
      });
      inp.addEventListener('focus', () => inp.select && inp.select());
    });
    q('#ltDice').onclick = rollPick;
    q('#ltGo').onclick = go;
  }
  function setDigit(i, d, pop){
    S.pick[i] = d;
    const el = q('#ltP' + i); if(!el) return;
    el.value = d;
    if(pop){ el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); onPickChanged(); }
  }
  function onPickChanged(){ if(S.last && !S.busy && !S.stale){ S.stale = true; applyStale(); } }
  function applyStale(){   // đổi số sau khi đã có kết quả: bỏ nhấn mạnh trúng/trượt của lượt cũ
    qa('.lt-reel').forEach(r => r.classList.remove('hit', 'land')); qa('.lt-reel').forEach(r => r.classList.add('old'));
    qa('.lt-d').forEach(d => d.classList.remove('hit'));
    qa('.lt-prize').forEach(p => p.classList.remove('win', 'dim'));
    setStatus('Chọn 3 chữ số rồi bấm Quay số.');
  }
  async function rollPick(){   // 🎲 ba chữ số nhảy rồi dừng lần lượt
    if(S.busy || S.rolling) return;
    S.rolling = true; lock(true);
    const fin = randDigits(), t0 = performance.now(), end = reduced() ? [0, 0, 0] : [550, 800, 1050], done = [false, false, false];
    for(;;){
      const t = performance.now() - t0; let all = true;
      for(let i = 0; i < 3; i++){
        if(done[i]) continue;
        if(t >= end[i]){ done[i] = true; setDigit(i, fin[i], true); }
        else { all = false; const el = q('#ltP' + i); if(el) el.value = randDigit(); }
      }
      if(all) break;
      await wait(60);
    }
    S.rolling = false; lock(false);
  }
  function lock(on){ qa('.lt-step, #ltDice, #ltGo').forEach(b => b.disabled = on); }
  function setGo(t){ const b = q('#ltGo'); if(b) b.textContent = t; }
  function setStatus(t, cls){ const el = q('#ltStatus'); if(el){ el.textContent = t; el.className = 'lt-status' + (cls ? ' ' + cls : ''); } }

  // ---------- Cuộn số ----------
  function spinReel(i){
    const r = q('#ltR' + i); if(!r) return;
    r.classList.remove('idle', 'old', 'hit', 'land', 'stopped', 'settle');
    if(reduced()) return;
    const st = r.querySelector('.lt-strip');   // lệch pha + tốc độ khác nhau để 3 cuộn không hiện cùng một số
    st.style.animationDuration = (0.25 + i * 0.035) + 's'; st.style.animationDelay = (-i * 0.083) + 's';
    r.classList.add('spin');
  }
  function settleReel(i, d){
    const r = q('#ltR' + i); if(!r) return;
    const st = r.querySelector('.lt-strip');
    st.style.setProperty('--pos', 10 + d); st.style.animationDuration = st.style.animationDelay = '';
    r.classList.remove('idle', 'spin');
    if(!reduced()) r.classList.add('settle');
  }
  function showReel(i, d, chain){   // trạng thái đứng yên (không animation)
    const r = q('#ltR' + i); if(!r) return;
    r.querySelector('.lt-strip').style.setProperty('--pos', 10 + d);
    r.classList.remove('idle', 'spin', 'settle', 'old', 'hit', 'land'); r.classList.add('stopped');
    if(2 - i < chain){ r.classList.add('hit'); const p = q('#ltP' + i); if(p) p.classList.add('hit'); }
  }
  function landReel(i, draw){
    const r = q('#ltR' + i);
    S.stopped[i] = true;
    if(!r) return;
    r.classList.remove('spin', 'settle'); r.classList.add('stopped');
    const hit = 2 - i < draw.chain;
    r.classList.toggle('hit', hit); r.classList.add('land');
    const p = q('#ltP' + i); if(p) p.classList.toggle('hit', hit);
    if(hit) burst(r, 8);
  }

  // ---------- Hiệu ứng phụ ----------
  function burst(el, n){   // pháo xu / sao bắn ra từ một phần tử (dùng lại .lo-spark của Vòng quay may mắn)
    const wrap = q('#ltWrap'); if(!wrap || !el || !el.isConnected || reduced()) return;
    const w = wrap.getBoundingClientRect(), r = el.getBoundingClientRect();
    const x = r.left - w.left + r.width / 2, y = r.top - w.top + r.height / 2;
    for(let k = 0; k < n; k++){
      const s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
      s.className = 'lo-spark'; s.textContent = k % 3 ? '🪙' : '⭐';
      s.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${(Math.random() - .5) * 540}deg;animation-delay:${Math.floor(Math.random() * 80)}ms`;
      s.addEventListener('animationend', () => s.remove());
      wrap.appendChild(s);
    }
  }
  function countUp(from, to, ms){
    const el = q('#ltBal'); if(!el) return;
    if(reduced() || from === to){ el.textContent = nf(to) + ' xu'; return; }
    const t0 = performance.now();
    const f = now => { const e = q('#ltBal'); if(!e) return; const u = Math.min(1, (now - t0) / ms); e.textContent = nf(from + (to - from) * (1 - Math.pow(1 - u, 3))) + ' xu'; if(u < 1) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  }
  function outcomeText(d){
    if(d.chain === 3) return `Trúng độc đắc! +${nf(d.prize)} xu`;
    if(d.prize) return `Trúng ${nf(d.prize)} xu · ${TIERS.find(t => t.n === d.chain).label}`;
    return 'Chưa trúng · Chữ số cuối chưa khớp';
  }
  function showOutcome(d){
    qa('.lt-prize').forEach(p => { p.classList.remove('win', 'dim'); if(d.prize) p.classList.add(+p.dataset.n === d.chain ? 'win' : 'dim'); });
    setStatus(outcomeText(d), d.prize ? 'win' : 'lose');
  }

  // ---------- Quay ----------
  function go(){
    if(S.busy || S.rolling) return;
    const d = S.ctx.play(S.pick.slice());   // game.js: kiểm xu, trừ phí, quay, trả thưởng, lưu; trả null nếu không đủ xu
    if(!d) return;
    run(d);
  }
  async function run(d){
    S.busy = true; S.cur = d; S.stale = false; S.stopped = [false, false, false];
    let RM = false;
    try {
      RM = reduced();
      qa('.lt-prize').forEach(p => p.classList.remove('win', 'dim'));
      qa('.lt-d').forEach(x => x.classList.remove('hit'));
      lock(true); setGo('Đang quay…'); setStatus('Đang quay số…');
      const bal = q('#ltBal'); if(bal) bal.textContent = nf(d.before) + ' xu';
      for(let i = 0; i < 3; i++) spinReel(i);
      // Thời điểm mỗi cuộn "chạm đáy" (ms). Phải → trái; khớp liên tiếp thì chờ lâu hơn cho hồi hộp.
      const SETTLE = RM ? 0 : 680;
      const L2 = RM ? 250 : 1600, L1 = L2 + (RM ? 250 : (d.chain >= 1 ? 900 : 500)), L0 = L1 + (RM ? 250 : (d.chain >= 2 ? 1000 : 500));
      const land = { 2:L2, 1:L1, 0:L0 }, t0 = performance.now();
      for(const i of [2, 1, 0]){
        await wait(Math.max(0, t0 + land[i] - SETTLE - performance.now()));
        settleReel(i, d.res[i]);
        await wait(Math.max(0, t0 + land[i] - performance.now()));
        landReel(i, d);
      }
      await wait(RM ? 0 : 250);
      S.last = d;
      showOutcome(d); setGo(`Quay lại · ${FEE} xu`);
      countUp(d.before, d.after, 900);
      if(d.prize){
        const wrap = q('#ltWrap');
        if(wrap && !RM){ wrap.classList.remove('flash'); void wrap.offsetWidth; wrap.classList.add('flash'); }
        const rs = q('.lt-res'); if(rs) burst(rs, d.chain === 3 ? 30 : d.chain === 2 ? 16 : 8);
        if(!RM) await wait(900);   // chờ số dư chạy xong rồi mới mở khoá / cập nhật HUD
      }
    } finally {
      if(!S.last) S.last = d;
      S.busy = false; S.cur = null;
      lock(false); setGo(`Quay lại · ${FEE} xu`);
      S.ctx.release();   // HUD hiện số xu mới
      const panel = S.host && S.host.closest('.panel');
      if(panel && panel.classList.contains('hidden')) S.ctx.toast(outcomeText(d));   // đã đóng panel giữa chừng
    }
  }

  return { FEE, TIERS, chainOf, prizeOf, draw, mount: render };
})();
