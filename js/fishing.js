/* ===== GCITY Fishing Mini-Game =====
 * Cơ chế: quăng cần → chờ cá cắn (random 2-8s) → click kéo đúng lúc → bắt cá.
 * Loại cá giá trị khác nhau, phụ thuộc vào mồi.
 */
const Fishing = (() => {
  const FISH_TYPES = [
    { id:'carp', name:'Cá chép', icon:'🐟', value:10, weight:[60,25,5] },
    { id:'tilapia', name:'Cá rô phi', icon:'🐠', value:25, weight:[30,50,20] },
    { id:'bass', name:'Cá quả', icon:'🐡', value:60, weight:[8,20,40] },
    { id:'golden', name:'Cá vàng huyền thoại', icon:'✨', value:300, weight:[2,5,35] },
  ];
  // weight theo mồi: [worm, shrimp, lure] - xác suất tương đối

  let state = 'idle'; // idle | casting | waiting | biting | reeling | caught
  let timer = 0;
  let currentFish = null;
  let reelWindow = 0; // thời gian cửa sổ kéo cá

  function getFishForBait(bait){
    const idx = {worm:0, shrimp:1, lure:2}[bait] || 0;
    let total = 0;
    const probs = FISH_TYPES.map(f=>{ total += f.weight[idx]; return total; });
    const r = Math.random()*total;
    for(let i=0;i<FISH_TYPES.length;i++){ if(r < probs[i]) return FISH_TYPES[i]; }
    return FISH_TYPES[0];
  }

  function cast(player, onEvent){
    if(state !== 'idle') return false;
    // kiểm tra mồi
    const bait = player.inventory.lure>0 ? 'lure' : (player.inventory.shrimp>0 ? 'shrimp' : (player.inventory.worm>0 ? 'worm' : null));
    if(!bait){ onEvent({type:'error', msg:'Bạn đã hết mồi. Hãy mua thêm mồi.'}); return false; }
    player.inventory[bait]--;
    state = 'casting'; timer = 1.2;
    onEvent({type:'casting'});
    return true;
  }

  function update(dt, player, onEvent){
    if(state==='casting'){
      timer -= dt;
      if(timer<=0){ state='waiting'; timer = 2 + Math.random()*6; onEvent({type:'waiting'}); }
    } else if(state==='waiting'){
      timer -= dt;
      if(timer<=0){
        state='biting'; reelWindow = 1.2; // 1.2s để người chơi kéo
        currentFish = getFishForBait(player.inventory.lure>0?'lure':(player.inventory.shrimp>0?'shrimp':'worm'));
        onEvent({type:'biting'});
      }
    } else if(state==='biting'){
      reelWindow -= dt;
      if(reelWindow<=0){ state='idle'; onEvent({type:'escaped'}); }
    }
  }

  // người chơi click "kéo"
  function reel(player, onEvent){
    if(state==='biting'){
      // thành công
      state='caught'; timer=1.5;
      player.inventory.fish++; player.inventory.fishValue = (player.inventory.fishValue||0) + currentFish.value;
      player.coins += 0; // bán mới được tiền
      onEvent({type:'caught', fish:currentFish});
      setTimeout(()=>{ state='idle'; }, 1500);
      return true;
    } else if(state==='waiting'){
      // kéo sớm quá - cá chạy
      state='idle'; onEvent({type:'too_early'});
    }
    return false;
  }

  function sellAll(player){
    const n = player.inventory.fish;
    // giá trung bình mỗi con = 30 (đơn giản hóa)
    const money = player.inventory.fishValue || 0;
    player.coins += money;
    player.inventory.fish = 0; player.inventory.fishValue = 0;
    return { count:n, money };
  }

  function getState(){ return { state, timer, currentFish, reelWindow }; }
  function reset(){ state='idle'; timer=0; currentFish=null; }

  return { cast, update, reel, sellAll, getState, reset, FISH_TYPES };
})();
