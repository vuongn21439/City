/* ===== GCITY — Khoá YouTube & xoay vòng quota =====
 * Key KHÔNG nằm trong source này. File js/keys.js (do GitHub Actions sinh lúc deploy từ
 * Secret `YT_KEYS`, mỗi dòng 1 key) gán vào window.GCITY_KEYS = [ ... ].
 * Nếu bản đang mở không có key nào, game vẫn chạy — chỉ mất chức năng GÕ TỪ KHOÁ (dán link vẫn được).
 *
 * Vì key miễn phí chỉ ~100 lượt tìm/ngày ( tính theo giờ Pacific của Google ), nên:
 *   • Xoay vòng qua các key, bắt đầu từ 1 key ngẫu nhiên để người chơi không dồn vào key đầu
 *   • Key báo quotaExceeded/dailyLimitExceeded sẽ bị đánh dấu "chết" tới 0h00 ngày mai giờ Pacific
 *   • Danh sách key chết lưu localStorage nên đóng tab mở lại vẫn nhớ, không đốt oan key
 *
 * API:  YTKEYS.list()            -> [key...] (đã lọc, bỏ trùng)
 *       YTKEYS.count()            -> số key đang dùng
 *       YTKEYS.pick()             -> key kế tiếp còn "sống" (null nếu hết quota hôm nay)
 *       YTKEYS.kill(key, reason)  -> đánh dấu hết quota, trả về true nếu vừa đánh dấu
 *       YTKEYS.exhaustedAt()      -> mốc hết quota (0h Pacific) để hiện thông báo cho người chơi
 */
const YTKEYS = (() => {
  const LS = 'gcity_yt_keys_dead';
  let list = null, rr = 0;

  // 0h00 ngày kế tiếp theo giờ Pacific (giới hạn quota của Google reset ở múi giờ này)
  let _cut = 0;
  function nextPacificMidnight(){
    try{
      const now = new Date();
      const pt = new Date(now.toLocaleString('en-US', { timeZone:'America/Los_Angeles' }));
      if(isNaN(pt)) throw 0;
      const off = Date.UTC(pt.getFullYear(), pt.getMonth(), pt.getDate(), pt.getHours(), pt.getMinutes(), pt.getSeconds()) - now.getTime(); // ≈ +7h/+8h
      return Date.UTC(pt.getFullYear(), pt.getMonth(), pt.getDate() + 1) - off;
    }catch(e){
      return Date.now() + 24*3600*1000;      // trình duyệt không hỗ trợ múi giờ → chờ 24h
    }
  }
  function cut(){ if(!_cut || _cut <= Date.now()) _cut = nextPacificMidnight(); return _cut; }

  // key nào đã chết hôm nay: { key: mốc hết hạn }
  function dead(){
    try{ const d = JSON.parse(localStorage.getItem(LS) || '{}');
      return (d && typeof d === 'object') ? d : {};
    }catch(e){ return {}; }
  }
  function saveDead(d){ try{ localStorage.setItem(LS, JSON.stringify(d)); }catch(e){} }

  function read(){
    const raw = (window.GCITY_KEYS || []);
    const arr = Array.isArray(raw) ? raw
      : String(raw || '').split(/[\s,;]+/);                     // chịu cả dạng chuỗi
    const seen = {};
    return arr.map(k => String(k||'').trim()).filter(k => /^AIza[0-9A-Za-z_\-]{10,}$/.test(k) && !seen[k] && (seen[k]=1));
  }

  return {
    list(){ if(!list) list = read(); return list.slice(); },
    count(){ return this.list().length; },
    // key kế tiếp còn sống, quay vòng; bắt đầu ngẫu nhiên để không dồn vào key đầu tiên
    pick(){
      const ks = this.list(); if(!ks.length) return null;
      if(rr === 0) rr = Math.floor(Math.random()*ks.length);
      const d = dead(), now = Date.now();
      for(let i=0;i<ks.length;i++){
        const k = ks[(rr+i) % ks.length];
        if(!d[k] || d[k] <= now){ rr = (rr+i+1) % ks.length; return k; }
      }
      return null;                                              // hết quota cả ngày
    },
    kill(key, reason){
      if(!key) return false;
      const d = dead(), now = Date.now();
      if(d[key] && d[key] > now) return false;
      d[key] = cut(); saveDead(d);
      return true;
    },
    exhaustedAt(){ return cut(); },
    // hết quota trong bao lâu nữa (phút), để hiện cho người chơi
    resetInMin(){ return Math.max(1, Math.round((cut() - Date.now())/60000)); },
    // gỡ key chết (nếu hôm nay Google cộng thêm quota / mình vừa thêm key mới)
    revive(){ saveDead({}); }
  };
})();