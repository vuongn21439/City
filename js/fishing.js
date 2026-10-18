/* ===== GCITY Fishing Mini-Game ===== */
const Fishing = (() => {
  const BAITS = [
    { id:'worm', name:'Giun', icon:'🪱', price:5, quantity:5, attracts:'Cá chép, cá quả', note:'Hợp với cá ăn mồi tự nhiên.' },
    { id:'shrimp', name:'Tép', icon:'🦐', price:15, quantity:5, attracts:'Cá rô phi, cá chép', note:'Thu hút nhóm cá nhỏ ven bờ.' },
    { id:'lure', name:'Mồi giả', icon:'✨', price:40, quantity:5, attracts:'Cá quả, cá vàng', note:'Dẫn dụ cá săn mồi và cá hiếm.' },
  ];
  // Trọng số theo mồi: [giun, tép, mồi giả]. Mỗi cột cộng thành 100.
  const FISH_TYPES = [
    { id:'carp', name:'Cá chép', icon:'🐟', rarity:'Phổ biến', value:12, preferredBait:'worm', description:'Cá nước ngọt hiền, thường tìm thấy gần bờ.', weight:[50,20,5] },
    { id:'tilapia', name:'Cá rô phi', icon:'🐠', rarity:'Phổ biến', value:22, preferredBait:'shrimp', description:'Bơi thành đàn và rất dễ bị tép thu hút.', weight:[32,48,13] },
    { id:'bass', name:'Cá quả', icon:'🐡', rarity:'Hiếm', value:55, preferredBait:'lure', description:'Cá săn mồi khỏe, thích mồi chuyển động.', weight:[15,26,42] },
    { id:'golden', name:'Cá vàng huyền thoại', icon:'✨', rarity:'Huyền thoại', value:220, preferredBait:'lure', description:'Cực hiếm; mồi giả và cần tốt giúp tăng cơ hội gặp.', weight:[3,6,40] },
  ];
  const RODS = {
    1: { name:'Cần cơ bản', price:0, rarityMultiplier:1 },
    2: { name:'Cần cao cấp', price:100, durability:'Bền vĩnh viễn', rarityMultiplier:1.65 },
  };

  let state = 'idle'; // idle | casting | waiting | biting | caught
  let castBait = null;
  let timer = 0;
  let currentFish = null;
  let reelWindow = 0;

  function getFishForBait(bait, rodTier){
    const idx = ({worm:0, shrimp:1, lure:2})[bait] ?? 0;
    const rareBoost = (RODS[rodTier] || RODS[1]).rarityMultiplier;
    const weights = FISH_TYPES.map(f => f.weight[idx] * (f.rarity === 'Phổ biến' ? 1 : rareBoost));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    for(let i=0;i<FISH_TYPES.length;i++){
      roll -= weights[i];
      if(roll < 0) return FISH_TYPES[i];
    }
    return FISH_TYPES[0];
  }

  const pickBait = player => player.inventory.lure>0 ? 'lure' : (player.inventory.shrimp>0 ? 'shrimp' : (player.inventory.worm>0 ? 'worm' : null));

  function cast(player, onEvent){
    if(state !== 'idle') return false;
    if(!pickBait(player)){ onEvent({type:'error', msg:'Bạn đã hết mồi. Hãy mua thêm mồi.'}); return false; }
    state = 'casting'; timer = 4;
    onEvent({type:'casting'});
    return true;
  }

  // Chỉ trừ mồi khi phao đã chạm mặt nước.
  function landed(player, onEvent){
    if(state !== 'casting') return false;
    const bait = pickBait(player);
    if(!bait){ state = 'idle'; onEvent({type:'error', msg:'Bạn đã hết mồi. Hãy mua thêm mồi.'}); return false; }
    player.inventory[bait]--; castBait = bait;
    state = 'waiting'; timer = 2 + Math.random()*6;
    onEvent({type:'waiting'});
    return true;
  }

  function update(dt, player, onEvent, rodTier){
    if(state==='casting'){
      timer -= dt;
      if(timer<=0) landed(player, onEvent);
    } else if(state==='waiting'){
      timer -= dt;
      if(timer<=0){
        state='biting'; reelWindow = 1.2;
        currentFish = getFishForBait(castBait || 'worm', rodTier);
        onEvent({type:'biting'});
      }
    } else if(state==='biting'){
      reelWindow -= dt;
      if(reelWindow<=0){ state='idle'; castBait=null; onEvent({type:'escaped'}); }
    } else if(state==='caught'){
      timer -= dt;
      if(timer<=0){ state='idle'; currentFish=null; }
    }
  }

  function reel(player, onEvent){
    if(state==='biting'){
      state='caught'; timer=1.5;
      player.inventory.fish++;
      player.inventory.fishValue = (player.inventory.fishValue||0) + currentFish.value;
      player.inventory.fishDex = player.inventory.fishDex || {};
      player.inventory.fishDex[currentFish.id] = (player.inventory.fishDex[currentFish.id]||0) + 1;
      onEvent({type:'caught', fish:currentFish});
      castBait=null;
      return true;
    } else if(state==='waiting'){
      state='idle'; castBait=null; onEvent({type:'too_early'});
    }
    return false;
  }

  function sellAll(player){
    const count = player.inventory.fish || 0;
    const money = player.inventory.fishValue || 0;
    player.coins += money;
    player.inventory.fish = 0; player.inventory.fishValue = 0;
    return { count, money };
  }

  function getState(){ return { state, timer, currentFish, reelWindow }; }
  function reset(){ state='idle'; timer=0; currentFish=null; castBait=null; reelWindow=0; }

  return { cast, landed, update, reel, sellAll, getState, reset, BAITS, RODS, FISH_TYPES };
})();
