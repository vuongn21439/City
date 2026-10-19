/* ===== GCITY Fishing Mini-Game ===== */
const Fishing = (() => {
  // Mồi thật (tiêu hao mỗi lần quăng). Hình minh hoạ riêng từng mồi: BaitArt trong js/fishart.js (cùng id).
  const BAITS = [
    { id:'worm', name:'Giun', price:5, quantity:5, attracts:'Cá chép, cá bống, cá trê', note:'Rẻ, hợp cá ăn đáy nước ngọt.' },
    { id:'shrimp', name:'Tép', price:15, quantity:5, attracts:'Cá rô phi, cá trích, cá nóc, cá hề, cá đuối, cá koi', note:'Hợp cá nhỏ và cá ven bờ.' },
    { id:'minnow', name:'Cá con', price:40, quantity:5, attracts:'Cá quả, cá thu, cá hồi, cá kiếm và các loài hiếm', note:'Mồi sống, dụ cá săn mồi và cá lớn.' },
  ];
  const BAIT_IDX = { worm:0, shrimp:1, minnow:2 };   // cột trọng số trong FISH_TYPES.weight

  // 16 loài, xếp từ phổ biến → huyền thoại. Mỗi loài có một tranh riêng trong js/fishart.js (cùng id):
  // Sổ cá và cá kéo lên ở đầu dây dùng chung bức tranh đó. KHÔNG đổi id cũ (carp, tilapia, bass, golden): Sổ cá đã lưu theo id.
  // weight = trọng số theo mồi [giun, tép, cá con]; mỗi cột cộng đúng 100 nên cũng chính là % gặp với cần cơ bản.
  // Tỉ lệ theo nhóm (giun / tép / cá con): Phổ biến 90 / 80 / 62 · Ít gặp 8 / 14,5 / 24 · Hiếm 1,8 / 4,5 / 10 · Sử thi 0,18 / 0,85 / 3 · Huyền thoại 0,02 / 0,15 / 1.
  // value = xu khi bán. Kỳ vọng mỗi lần quăng (cần cơ bản): giun ≈ 8 xu (vốn 1), tép ≈ 12 xu (vốn 3), cá con ≈ 23 xu (vốn 8).
  // preferredBait = mồi cho tỉ lệ gặp loài đó cao nhất (Sổ cá hiển thị "Mồi hợp").
  const FISH_TYPES = [
    { id:'sardine', name:'Cá trích', icon:'🐟', rarity:'Phổ biến', value:4, preferredBait:'shrimp', description:'Đàn nhỏ bạc lấp lánh, hay bơi sát mặt nước.', weight:[7.2,28.8,18.6] },
    { id:'goby', name:'Cá bống', icon:'🐟', rarity:'Phổ biến', value:5, preferredBait:'worm', description:'Nằm ì dưới đáy bùn, ngoi lên đớp giun.', weight:[28.8,11.2,9.92] },
    { id:'carp', name:'Cá chép', icon:'🐟', rarity:'Phổ biến', value:6, preferredBait:'worm', description:'Cá nước ngọt hiền, thường tìm thấy gần bờ.', weight:[34.2,14.4,14.88] },
    { id:'tilapia', name:'Cá rô phi', icon:'🐠', rarity:'Phổ biến', value:8, preferredBait:'shrimp', description:'Bơi thành đàn và rất dễ bị tép thu hút.', weight:[19.8,25.6,18.6] },
    { id:'catfish', name:'Cá trê', icon:'🐟', rarity:'Ít gặp', value:14, preferredBait:'worm', description:'Râu dài, thích rúc dưới đáy tối tìm giun.', weight:[5.6,2.9,3.6] },
    { id:'mackerel', name:'Cá thu', icon:'🐟', rarity:'Ít gặp', value:18, preferredBait:'minnow', description:'Bơi nhanh thành đàn, lưng xanh sọc sóng.', weight:[0.8,5.08,14.4] },
    { id:'puffer', name:'Cá nóc', icon:'🐡', rarity:'Ít gặp', value:24, preferredBait:'shrimp', description:'Tò mò đớp tép, hoảng lên là phồng tròn.', weight:[1.6,6.53,6.0] },
    { id:'bass', name:'Cá quả', icon:'🐡', rarity:'Hiếm', value:40, preferredBait:'minnow', description:'Cá săn mồi khỏe, thích mồi sống đang bơi.', weight:[0.99,0.81,4.4] },
    { id:'salmon', name:'Cá hồi', icon:'🐟', rarity:'Hiếm', value:50, preferredBait:'minnow', description:'Thân bạc hồng đốm đen, vùng vẫy rất mạnh.', weight:[0.18,0.77,3.0] },
    { id:'clownfish', name:'Cá hề', icon:'🐠', rarity:'Hiếm', value:58, preferredBait:'shrimp', description:'Dải trắng nổi bật, hay mon men quanh tép nhỏ.', weight:[0.18,1.57,1.4] },
    { id:'stingray', name:'Cá đuối', icon:'🐟', rarity:'Hiếm', value:72, preferredBait:'shrimp', description:'Lượn êm sát đáy cát, rất mê tép.', weight:[0.45,1.35,1.2] },
    { id:'swordfish', name:'Cá kiếm', icon:'🐟', rarity:'Sử thi', value:130, preferredBait:'minnow', description:'Mõm kiếm dài, lao như tên bắn, đớp cá con rất dữ.', weight:[0.01,0.21,1.38] },
    { id:'koi', name:'Cá koi', icon:'🐠', rarity:'Sử thi', value:160, preferredBait:'shrimp', description:'Vảy đỏ trắng quý hiếm, hay ghé đớp tép nhỏ.', weight:[0.14,0.38,0.3] },
    { id:'angler', name:'Cá lồng đèn', icon:'🐟', rarity:'Sử thi', value:200, preferredBait:'minnow', description:'Sống nơi nước tối, dùng chiếc đèn trên đầu để dụ mồi.', weight:[0.03,0.26,1.32] },
    { id:'golden', name:'Cá vàng huyền thoại', icon:'✨', rarity:'Huyền thoại', value:400, preferredBait:'minnow', description:'Cực hiếm; mồi cá con và cần tốt giúp tăng cơ hội gặp.', weight:[0.01,0.07,0.6] },
    { id:'arowana', name:'Cá rồng', icon:'🐉', rarity:'Huyền thoại', value:650, preferredBait:'minnow', description:'Vảy ánh vàng hồng, chỉ lộ diện trước mồi cá con.', weight:[0.01,0.07,0.4] },
  ];
  const RODS = {
    1: { name:'Cần cơ bản', price:0, rarityMultiplier:1 },
    2: { name:'Cần cao cấp', price:100, durability:'Bền vĩnh viễn', rarityMultiplier:1.65 },
  };
  // Cần cao cấp nhân thêm cơ hội gặp cá hiếm: nhóm càng hiếm càng được hưởng nhiều (Phổ biến không đổi).
  // Với rarityMultiplier 1,65: Ít gặp ×1,23 · Hiếm ×1,65 · Sử thi ×1,81 · Huyền thoại ×1,98.
  const TIER_BOOST = { 'Phổ biến':0, 'Ít gặp':0.35, 'Hiếm':1, 'Sử thi':1.25, 'Huyền thoại':1.5 };

  let state = 'idle'; // idle | casting | waiting | biting | caught
  let castBait = null;
  let timer = 0;
  let currentFish = null;
  let reelWindow = 0;
  let outBait = null;   // loại mồi vừa dùng nốt ở lượt đang câu → khi lượt này xong thì dừng câu và báo người chơi

  function getFishForBait(bait, rodTier){
    const idx = BAIT_IDX[bait] ?? 0;
    const rareBoost = (RODS[rodTier] || RODS[1]).rarityMultiplier;
    const weights = FISH_TYPES.map(f => f.weight[idx] * (1 + (rareBoost - 1) * (TIER_BOOST[f.rarity] || 0)));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    for(let i=0;i<FISH_TYPES.length;i++){
      roll -= weights[i];
      if(roll < 0) return FISH_TYPES[i];
    }
    return FISH_TYPES[0];
  }

  // Mồi đang dùng = loại người chơi đã chọn trong Balo (inventory.equippedBait). Không tự đổi sang mồi khác: hết loại đó là dừng câu.
  const totalBait = player => BAITS.reduce((sum, b) => sum + (player.inventory[b.id] || 0), 0);
  function usableBait(player){
    const id = player.inventory.equippedBait;
    return (id && BAIT_IDX[id] !== undefined && (player.inventory[id] || 0) > 0) ? id : null;
  }
  const baitHint = player => totalBait(player) > 0 ? 'Hãy mở Balo và chọn mồi trước.' : 'Bạn đã hết mồi. Hãy mua thêm ở quầy câu cá.';
  function takeOut(player){   // mồi vừa hết (nếu người chơi chưa kịp chọn loại khác)
    const b = outBait; outBait = null;
    return (b && !player.inventory.equippedBait) ? b : null;
  }

  function cast(player, onEvent){
    if(state !== 'idle') return false;
    if(!usableBait(player)){ onEvent({type:'error', msg:baitHint(player)}); return false; }
    state = 'casting'; timer = 4;
    onEvent({type:'casting'});
    return true;
  }

  // Chỉ trừ mồi khi phao đã chạm mặt nước.
  function landed(player, onEvent){
    if(state !== 'casting') return false;
    const bait = usableBait(player);
    if(!bait){ state = 'idle'; onEvent({type:'error', msg:baitHint(player)}); return false; }
    player.inventory[bait]--; castBait = bait;
    if(player.inventory[bait] <= 0){ outBait = bait; player.inventory.equippedBait = null; }   // mồi cuối: lượt này vẫn câu tiếp, xong là dừng
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
      if(reelWindow<=0){ state='idle'; castBait=null; onEvent({type:'escaped', baitOut:takeOut(player)}); }
    } else if(state==='caught'){
      timer -= dt;
      if(timer<=0){ state='idle'; currentFish=null; const b = takeOut(player); if(b) onEvent({type:'baitout', bait:b}); }
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
      state='idle'; castBait=null; onEvent({type:'too_early', baitOut:takeOut(player)});
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
  function reset(){ state='idle'; timer=0; currentFish=null; castBait=null; reelWindow=0; outBait=null; }

  return { cast, landed, update, reel, sellAll, getState, reset, getFishForBait, usableBait, totalBait, baitHint, BAITS, RODS, FISH_TYPES };
})();
