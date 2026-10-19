/* ===== GCITY Player =====
 * Player entity: dữ liệu người chơi + danh sách hành động (emotes). Di chuyển/animation nằm ở game.js + three-scene.js.
 */
const Player = (() => {
  // icon: chuỗi dùng chung, hoặc { male, female } để hiện icon riêng theo giới tính nhân vật
  const EMOTES = [
    { id:'wave', icon:'👋', name:'Vẫy tay', duration:2.5 },
    { id:'cry', icon:'😢', name:'Buồn', duration:3 },
    { id:'lotus', icon:'🧘', name:'Ngồi xếp bằng', duration:999 }, // toggle · ngồi xếp bằng dưới đất (ngồi ghế là action 'sit' riêng)
    { id:'jump', icon:{ male:'🙋‍♂️', female:'🙋‍♀️' }, name:'Nhảy lên', duration:0.8 },
    { id:'dance', icon:{ male:'🕺', female:'💃' }, name:'Nhảy', duration:4 },
    { id:'holla', icon:'✊', name:'Ăn mừng', duration:2 },
  ];

  function create(opts){
    return {
      id: opts.id || 'me',
      name: opts.name || 'Player',
      gender: opts.gender || 'male',
      charIndex: opts.charIndex || 0,
      x: opts.x || 600, y: opts.y || 400,
      dir: 0,              // 0=down,1=right,2=up,3=left
      moving: false,
      frame: 0, frameT: 0,
      action: null, actionT: 0, actionDur: 0,
      targetX: null, targetY: null, // click-to-move
      speed: GCITY_CONFIG.GAME.moveSpeed,
      chatBubble: null, chatT: 0,
      coins: GCITY_CONFIG.GAME.startCoins,
      inventory: { worm:10, shrimp:0, minnow:0, fish:0, fishValue:0, fishDex:{}, rod:1, equippedRod:0, equippedBait:null },
      zone: 'plaza'
    };
  }

  function doAction(p, emoteId){
    const e = EMOTES.find(e=>e.id===emoteId);
    if(!e) return;
    if(emoteId === 'lotus' && p.action === 'lotus'){ p.action = null; return; }   // bấm lần nữa = đứng dậy
    p.action = emoteId; p.actionT = 0; p.actionDur = e.duration;
  }

  function say(p, text){
    p.chatBubble = text; p.chatT = 5;
  }

  const emoteIcon = (e, gender) => (e.icon && typeof e.icon === 'object') ? (e.icon[gender] || e.icon.male) : e.icon;

  const isSeated = a => a === 'sit' || a === 'lotus';   // sit = ngồi ghế · lotus = ngồi xếp bằng

  return { create, doAction, say, EMOTES, emoteIcon, isSeated };
})();
