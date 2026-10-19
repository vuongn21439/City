/* ===== GCITY FishArt — tranh minh hoạ riêng cho từng loài cá =====
 * Một nguồn duy nhất cho hai nơi:
 *   • Sổ cá (ui.js)            → FishArt.svg(id)      : chuỗi <svg> nhúng thẳng vào thẻ cá
 *   • Cá kéo lên ở đầu dây      → FishArt.texture(id)  : cùng bức tranh đó vẽ lên canvas, gắn vào Sprite (character.js)
 * Nên cá câu lên LUÔN giống hệt ảnh trong sổ. Mọi tranh quay mặt sang PHẢI, khung 120×72.
 * Không dùng ảnh ngoài / font ngoài; chạy giống nhau ở cả bản three.min.js lẫn three r186.
 */
const FishArt = (() => {
  const W = 120, H = 72;
  const INK = '#173340';                                   // nét viền chung
  const EYE = (x, y, r = 3.4) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="${x + r * 0.25}" cy="${y}" r="${r * 0.55}" fill="${INK}"/>`;
  const P = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const L = (d, stroke, w = 1.4, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const FILL = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
  const clip = (id, d, inner) => `<clipPath id="fa-${id}"><path d="${d}"/></clipPath><g clip-path="url(#fa-${id})">${inner}</g>`;

  // Chiều dài cá khi treo ở đầu dây (đơn vị thế giới) — to nhỏ khác nhau theo loài
  const LEN = {
    sardine: 0.50, goby: 0.50, carp: 0.70, tilapia: 0.62, catfish: 0.72, mackerel: 0.72, puffer: 0.52,
    bass: 0.78, salmon: 0.82, clownfish: 0.46, stingray: 0.86, swordfish: 1.08, koi: 0.82, angler: 0.68,
    golden: 0.72, arowana: 1.02
  };

  // ---------------------------------------------------------------- từng loài
  const ART = {
    // ---- PHỔ BIẾN ----
    sardine: () => {   // Cá trích: thon bạc, lưng xanh đen, chấm sẫm dọc thân
      const body = 'M108 37 C100 29 86 25 66 26 C48 27 34 31 26 36 C34 41 48 46 66 47 C86 48 100 45 108 37 Z';
      return P('M26 36 L10 22 L16 36 L10 50 Z', '#7e9aa6') +
        P('M62 26 L56 16 L72 26 Z', '#6b8794') + P('M60 47 L56 55 L72 47 Z', '#9fb6c0') +
        P(body, '#cfe0e6') +
        clip('sardine', body, FILL('M20 20 H112 V37 C90 34 60 33 20 37 Z', '#3f7f95') + FILL('M20 41 H112 V56 H20 Z', '#f3f8fa')) +
        [48, 58, 68, 78].map(x => `<circle cx="${x}" cy="${35 + (x % 3)}" r="1.5" fill="#2a5666"/>`).join('') +
        L('M32 37 C56 38 82 38 104 37', '#fff', 1, 'opacity=".7"') + EYE(97, 35, 3.2) +
        L('M105 38 L108 39', INK, 1.2);
    },
    goby: () => {      // Cá bống: đầu to dẹt, mắt trên đỉnh đầu, hai vây lưng, vây ngực to
      const body = 'M104 42 C102 30 92 27 80 28 C62 29 44 32 30 38 C42 44 62 48 80 48 C94 48 103 47 104 42 Z';
      return P('M30 38 C22 28 12 30 12 38 C12 46 22 48 30 38 Z', '#9a7a52') +
        P('M82 28 C80 18 72 17 66 21 C64 24 66 27 66 29 Z', '#8b6a44') + P('M62 29 C58 21 50 21 44 26 C42 29 44 31 46 32 Z', '#a98857') +
        P(body, '#b58e5e') +
        clip('goby', body, FILL('M20 20 H110 V38 C80 36 50 38 20 42 Z', '#8f6c43') + FILL('M20 42 H110 V56 H20 Z', '#dcc29a') +
          [[44, 40, 4], [58, 37, 3.4], [72, 41, 3.6], [84, 35, 3], [52, 45, 2.6], [66, 46, 2.4]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="#6a4a2a" opacity=".75"/>`).join('')) +
        P('M84 46 C78 56 70 58 66 53 C70 50 76 48 84 46 Z', '#c7a06b') +
        `<circle cx="94" cy="29" r="4" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="95" cy="28.6" r="2.2" fill="${INK}"/><circle cx="85" cy="29" r="3.2" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="85.8" cy="28.7" r="1.8" fill="${INK}"/>` +
        L('M100 43 Q103 43 104 41', INK, 1.2);
    },
    carp: () => {      // Cá chép: thân vàng nâu mập, vây lưng dài, râu, đuôi chẻ
      const body = 'M106 38 C102 24 86 17 64 18 C46 19 32 27 26 36 C32 46 48 55 68 55 C88 55 102 49 106 38 Z';
      return P('M27 36 L8 20 C12 30 12 42 8 52 Z', '#9a6f2a') +
        P('M92 22 C80 10 58 9 42 18 C54 18 78 20 92 22 Z', '#8a6424') +
        P('M62 55 L50 64 L78 56 Z', '#b98a3a') +
        P(body, '#c79a43') +
        clip('carp', body, FILL('M20 10 H112 V34 C84 30 52 32 20 40 Z', '#a67a2f') + FILL('M20 44 H112 V62 H20 Z', '#ecd9a4')) +
        [[44, 30], [56, 33], [68, 32], [80, 31], [50, 41], [62, 44], [74, 43], [86, 41]].map(c => L(`M${c[0] - 4} ${c[1]} Q${c[0]} ${c[1] + 5} ${c[0] + 4} ${c[1]}`, '#8a5f1d', 1, 'opacity=".7"')).join('') +
        P('M84 46 C78 54 72 53 68 49 C72 46 78 45 84 46 Z', '#d8ae5a') +
        L('M105 40 C110 42 113 46 112 52', INK, 1.3) + L('M104 42 C108 46 109 52 106 56', INK, 1.3) + EYE(93, 32, 3.6);
    },
    tilapia: () => {   // Cá rô phi: thân bầu hồng cam, sọc đứng, vây lưng gai cao suốt lưng
      const body = 'M108 38 C104 22 88 15 66 16 C46 17 32 26 26 37 C32 48 46 58 68 58 C90 58 104 52 108 38 Z';
      return P('M27 37 C16 28 12 30 10 37 C12 44 16 46 27 37 Z', '#d46a3a') +
        P('M96 22 L92 10 L84 16 L80 7 L72 14 L66 6 L58 14 L50 8 L44 17 L36 14 L32 26 C54 18 80 17 96 22 Z', '#e8854e') +
        P('M66 58 L58 68 L82 59 Z', '#e07a46') +
        P(body, '#f2a46c') +
        clip('tilapia', body, FILL('M20 8 H112 V36 C80 32 46 34 20 42 Z', '#e8803f') + FILL('M20 46 H112 V70 H20 Z', '#fbe0c4') +
          [44, 56, 68, 80].map(x => `<path d="M${x} 14 Q${x + 3} 36 ${x} 60" stroke="#8c3b22" stroke-width="3.4" fill="none" opacity=".55"/>`).join('')) +
        P('M86 44 C80 54 74 54 70 50 C74 46 80 44 86 44 Z', '#f6b684') + EYE(97, 33, 3.8) + L('M107 39 L109 40', INK, 1.3);
    },

    // ---- ÍT GẶP ----
    catfish: () => {   // Cá trê: da xám nâu trơn, đầu dẹt, 4 sợi râu dài, vây lưng/hậu môn dài
      const body = 'M104 38 C104 28 92 25 78 26 C58 27 38 31 26 36 C38 41 58 47 78 48 C92 49 104 47 104 38 Z';
      return P('M28 36 C18 28 10 32 10 38 C10 44 18 46 28 36 Z', '#5d6770') +
        P('M92 26 C70 18 44 22 30 32 C52 28 76 28 92 26 Z', '#6b7680') + P('M92 48 C70 56 46 54 32 42 C54 48 76 48 92 48 Z', '#6b7680') +
        P(body, '#7d8791') +
        clip('catfish', body, FILL('M20 20 H112 V36 C80 34 50 36 20 40 Z', '#5c6670') + FILL('M20 42 H112 V58 H20 Z', '#c9c4b2')) +
        P('M82 44 C78 54 72 56 68 52 C72 48 76 46 82 44 Z', '#6b7680') +
        L('M103 34 C110 28 116 28 118 22', INK, 1.5) + L('M103 36 C112 34 118 36 119 32', INK, 1.5) + L('M102 43 C110 48 114 54 112 60', INK, 1.5) + L('M100 44 C106 52 106 58 102 64', INK, 1.5) +
        EYE(91, 32, 2.8) + L('M96 40 Q102 41 104 38', INK, 1.2);
    },
    mackerel: () => {  // Cá thu: lưng xanh lục sọc sóng đen, bụng bạc, 2 vây lưng + vây phụ, đuôi lưỡi liềm
      const body = 'M110 37 C100 27 82 23 62 24 C46 25 34 30 28 36 C34 42 46 47 62 48 C82 49 100 46 110 37 Z';
      return P('M28 36 L10 16 C14 28 14 44 10 56 Z', '#2f6f7e') +
        P('M82 24 L78 12 L66 24 Z', '#2c6574') + P('M58 24 L54 16 L46 26 Z', '#2c6574') +
        [[44, 28], [40, 30], [36, 32]].map(f => `<path d="M${f[0]} ${f[1]} l-3 -5 l-1 6" fill="#e5c24a" stroke="${INK}" stroke-width=".8"/>`).join('') +
        P('M62 48 L56 56 L74 48 Z', '#9fc5cf') +
        P(body, '#c8dde3') +
        clip('mackerel', body, FILL('M20 18 H116 V36 C84 33 50 33 20 38 Z', '#2f8a86') + FILL('M20 41 H116 V58 H20 Z', '#f1f7f8') +
          [[40, 22, 46, 30], [50, 22, 56, 31], [60, 21, 66, 31], [70, 21, 76, 31], [80, 22, 86, 31], [90, 24, 94, 31]].map(c => L(`M${c[0]} ${c[1]} Q${(c[0] + c[2]) / 2 + 3} ${(c[1] + c[3]) / 2 - 2} ${c[2]} ${c[3]}`, '#173b46', 1.6)).join('')) +
        EYE(98, 33, 3.4) + L('M108 38 L110 38', INK, 1.2) + L('M96 38 Q100 40 104 39', '#7fa9b4', 1);
    },
    puffer: () => {    // Cá nóc: thân tròn phồng vàng đốm nâu, gai nhỏ, vây bé xíu, miệng chu
      const body = 'M100 38 C100 20 84 11 62 12 C40 13 24 22 24 38 C24 54 40 62 62 62 C84 62 100 56 100 38 Z';
      const spikes = [[44, 15], [56, 12], [68, 12], [80, 16], [90, 23], [94, 52], [84, 58], [72, 62], [60, 63], [46, 59], [34, 52], [30, 24]]
        .map(s => `<path d="M${s[0] - 1.6} ${s[1]} L${s[0]} ${s[1] + (s[1] < 38 ? -5 : 5)} L${s[0] + 1.6} ${s[1]}" fill="${INK}"/>`).join('');
      return P('M24 38 C14 30 8 34 8 38 C8 42 14 46 24 38 Z', '#d9a334') + spikes +
        P(body, '#f4d467') +
        clip('puffer', body, FILL('M20 44 H110 V70 H20 Z', '#fff4cf') +
          [[40, 28, 4], [54, 22, 3.2], [66, 30, 4.4], [80, 24, 3.4], [48, 40, 3], [62, 44, 3.6], [76, 40, 3.2], [34, 40, 2.6], [88, 36, 2.6]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="#8a5a1d" opacity=".8"/>`).join('')) +
        P('M70 44 C66 52 60 52 58 48 C60 44 64 42 70 44 Z', '#e7b94a') + `<path d="M62 22 q6 -6 14 -2" fill="#e7b94a" stroke="${INK}" stroke-width="1.2"/>` +
        `<circle cx="86" cy="32" r="6" fill="#fff" stroke="${INK}" stroke-width="1.2"/><circle cx="88" cy="32" r="3.3" fill="${INK}"/><circle cx="89" cy="31" r="1" fill="#fff"/>` +
        `<ellipse cx="99" cy="42" rx="3.4" ry="2.6" fill="#e0866a" stroke="${INK}" stroke-width="1.2"/>`;
    },

    // ---- HIẾM ----
    bass: () => {      // Cá quả (lóc): thân trụ dài xanh ô liu có vằn, vây lưng chạy hết lưng, miệng rộng
      const body = 'M110 38 C108 28 94 26 76 26 C54 26 34 30 24 36 C34 42 54 48 76 48 C94 48 108 46 110 38 Z';
      return P('M26 36 C16 28 8 32 8 38 C8 44 16 46 26 36 Z', '#4c5a2a') +
        P('M96 27 C80 17 52 17 30 31 C56 26 78 27 96 27 Z', '#55652f') + P('M90 47 C74 56 50 54 34 42 C56 47 74 48 90 47 Z', '#55652f') +
        P(body, '#7a8a45') +
        clip('bass', body, FILL('M20 18 H116 V36 C84 34 50 35 20 40 Z', '#4f5c2a') + FILL('M20 42 H116 V58 H20 Z', '#d8d2a6') +
          [[44, 33], [58, 32], [72, 32], [86, 32]].map(c => `<path d="M${c[0] - 5} ${c[1] - 4} q5 -4 10 0 q-2 6 -5 7 q-3 -2 -5 -7z" fill="#2c3716" opacity=".8"/>`).join('') +
          [[50, 44], [64, 45], [78, 44]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="2" fill="#a59d6a" opacity=".8"/>`).join('')) +
        P('M84 44 C80 52 74 53 70 49 C74 46 78 44 84 44 Z', '#6a7a3a') +
        L('M110 38 C102 41 96 41 90 40', INK, 1.4) + EYE(96, 32, 3.4) + L('M88 36 L94 29', '#2c3716', 1.2, 'opacity=".6"');
    },
    salmon: () => {    // Cá hồi: lưng bạc hồng, đốm đen, hàm móc, vây mỡ nhỏ, đuôi chẻ
      const body = 'M108 38 C102 26 86 21 64 22 C46 23 33 29 26 36 C33 44 46 50 64 51 C86 52 102 49 108 38 Z';
      return P('M27 36 L9 20 C13 31 13 41 9 52 Z', '#b86a5a') +
        P('M80 23 C78 14 68 12 62 22 Z', '#c8766a') + P('M44 27 l-5 -6 l-3 8 z', '#b86a5a') +
        P('M64 51 L58 60 L78 52 Z', '#d68c7e') +
        P(body, '#d7dfe4') +
        clip('salmon', body, FILL('M20 14 H116 V35 C86 32 50 32 20 38 Z', '#7c9aa8') + FILL('M20 40 H116 V60 H20 Z', '#f7c4b8') + FILL('M20 35 C60 33 90 33 116 36 V41 C86 38 52 38 20 41 Z', '#e69a94') +
          [[44, 27], [54, 29], [64, 27], [74, 28], [84, 30], [50, 32], [60, 33], [70, 32], [92, 33]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="1.5" fill="#1d3340"/>`).join('')) +
        P('M82 44 C78 52 72 53 68 49 C72 46 76 44 82 44 Z', '#e7a79b') +
        EYE(96, 31, 3.4) + L('M108 38 Q104 44 98 44', INK, 1.3);
    },
    clownfish: () => { // Cá hề: cam rực, 3 dải trắng viền đen, thân ngắn mập, đuôi tròn
      const body = 'M106 40 C106 24 90 15 68 16 C46 17 30 26 28 38 C30 52 46 60 68 60 C90 60 106 54 106 40 Z';
      return P('M28 38 C18 28 12 32 12 38 C12 46 18 48 28 38 Z', '#f27a1a') +
        P('M92 22 C84 10 56 8 42 20 C60 18 80 19 92 22 Z', '#f27a1a') +
        P('M68 60 L60 68 L84 60 Z', '#f27a1a') +
        P(body, '#fb8c24') +
        clip('clownfish', body, [[40, 8], [70, 7], [94, 6]].map((b, i) => FILL(`M${b[0]} 0 H${b[0] + (i === 1 ? 10 : 8)} V72 H${b[0]} Z`, '#1c1c1c') +
          FILL(`M${b[0] + 1.6} 0 H${b[0] + (i === 1 ? 8.4 : 6.4)} V72 H${b[0] + 1.6} Z`, '#fff')).join('') +
          FILL('M20 56 H116 V72 H20 Z', '#ff9d3f', 'opacity=".6"')) +
        P('M82 46 C76 54 70 54 66 50 C70 46 76 44 82 46 Z', '#ff9a30') +
        `<circle cx="96" cy="35" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="97" cy="35" r="2" fill="${INK}"/>` + L('M105 41 Q101 44 98 43', INK, 1.2);
    },
    stingray: () => {  // Cá đuối: nhìn từ trên xuống, thân dẹt hình thoi, đuôi roi dài, hai mắt trên đầu
      const body = 'M106 36 C98 28 84 14 60 8 C50 22 30 30 22 36 C30 42 50 50 60 64 C84 58 98 44 106 36 Z';
      return L('M26 36 C14 36 8 38 2 44', '#4b6b84', 3.4) + L('M26 36 C14 36 8 38 2 44', INK, 1, 'opacity=".5"') +
        P(body, '#6e93ad') +
        clip('stingray', body, FILL('M20 20 H110 V52 H20 Z', '#6e93ad') + FILL('M30 36 C52 22 70 20 100 36 C70 52 52 50 30 36 Z', '#88adc4') +
          [[56, 28, 3], [66, 24, 2.4], [48, 34, 2.4], [74, 30, 2.6], [58, 42, 2.8], [70, 46, 2.2], [46, 40, 2]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="${c[2]}" fill="#f1f6f9" opacity=".75"/>`).join('')) +
        L('M30 36 C50 34 66 32 80 36', '#4b6b84', 1.2, 'opacity=".5"') +
        `<circle cx="92" cy="28" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="93" cy="28.4" r="2" fill="${INK}"/><circle cx="92" cy="44" r="3.6" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="93" cy="43.6" r="2" fill="${INK}"/>` +
        L('M82 31 q3 2 6 0', '#385468', 1.4) + L('M82 41 q3 -2 6 0', '#385468', 1.4) + L('M99 36 L103 36', INK, 1.3);
    },

    // ---- SỬ THI ----
    swordfish: () => { // Cá kiếm: mõm kiếm dài, vây lưng cánh buồm, đuôi lưỡi liềm lớn
      const body = 'M84 38 C78 26 62 22 46 24 C34 26 24 31 18 37 C24 43 34 48 46 50 C62 52 78 49 84 38 Z';
      return P('M20 37 L4 16 C8 28 8 46 4 58 Z', '#274f8c') +
        P('M70 25 C66 14 52 6 36 5 C40 12 42 20 44 25 Z', '#2f64b0') +
        P('M52 50 L46 60 L64 50 Z', '#4b84c6') + P('M82 38 L118 35 L84 41 Z', '#3a6fb8', 'stroke-width="1.2"') +
        P(body, '#3b79c4') +
        clip('swordfish', body, FILL('M10 14 H100 V36 C70 33 40 33 10 38 Z', '#245aa5') + FILL('M10 40 H100 V60 H10 Z', '#dbe9f5') + FILL('M10 36 C50 34 76 34 100 37 V40 C70 38 40 38 10 40 Z', '#8fb6e0')) +
        EYE(76, 34, 3.6) + L('M44 30 C52 31 60 31 68 30', '#cfe3f7', 1, 'opacity=".7"');
    },
    koi: () => {       // Cá koi: thân trắng, mảng đỏ cam + đen, vây mềm dài, 2 râu
      const body = 'M108 38 C104 24 88 18 66 19 C46 20 32 27 26 36 C32 45 46 54 66 55 C88 56 104 50 108 38 Z';
      return P('M27 36 C14 22 6 24 6 30 C8 36 12 38 16 36 C12 40 8 46 10 50 C16 50 22 46 27 36 Z', '#fde6d6') +
        P('M90 22 C80 10 58 10 42 19 C60 18 78 19 90 22 Z', '#fdeee4') +
        P('M62 55 C58 64 48 68 44 64 C52 62 56 58 62 55 Z', '#fdeee4') +
        P(body, '#fbf6ef') +
        clip('koi', body, FILL('M30 18 C44 12 60 14 66 24 C70 32 58 40 44 38 C34 36 26 28 30 18 Z', '#e8462a') + FILL('M72 20 C84 14 98 20 104 30 C98 36 84 36 76 32 C70 28 68 24 72 20 Z', '#ef6a1c') +
          FILL('M52 44 C60 38 74 40 80 50 C74 58 58 58 52 44 Z', '#d8381f') + `<circle cx="60" cy="25" r="4" fill="#1d1d1d"/><circle cx="84" cy="27" r="3" fill="#1d1d1d"/><circle cx="68" cy="47" r="2.6" fill="#1d1d1d"/><path d="M38 40 q4 -4 8 0 q-2 5 -6 4 z" fill="#1d1d1d"/>`) +
        P('M84 45 C78 53 72 53 68 49 C72 46 78 44 84 45 Z', '#fdeee4') +
        L('M106 40 C112 42 116 48 114 56', INK, 1.3) + L('M104 41 C108 47 108 54 104 58', INK, 1.3) + EYE(95, 32, 3.4);
    },
    angler: () => {    // Cá lồng đèn: thân tròn sẫm, miệng rộng nhiều răng, cần câu phát sáng
      const body = 'M100 40 C100 22 84 14 62 15 C40 16 24 26 24 40 C24 54 40 62 60 62 C74 62 86 60 94 54 C98 50 100 46 100 40 Z';
      return `<circle cx="104" cy="8" r="9" fill="#ffe27a" opacity=".28"/><circle cx="104" cy="8" r="5.4" fill="#fff3a8" opacity=".55"/>` +
        L('M78 16 C84 4 94 2 104 8', INK, 1.8) + `<circle cx="104" cy="8" r="3.4" fill="#fff9c4" stroke="#e9b82c" stroke-width="1.2"/>` +
        P('M24 40 C14 30 8 34 8 40 C8 46 14 50 24 40 Z', '#3a2f55') +
        P('M64 15 L58 6 L70 14 Z', '#3a2f55') + P('M62 62 L56 69 L72 62 Z', '#3a2f55') +
        P(body, '#4a3d6b') +
        clip('angler', body, FILL('M20 44 H112 V70 H20 Z', '#6a5a8e') + [[40, 30], [52, 24], [64, 32], [48, 46], [70, 48]].map(c => `<circle cx="${c[0]}" cy="${c[1]}" r="2" fill="#7fe6ff" opacity=".7"/>`).join('')) +
        P('M100 38 C94 34 88 36 84 42 C90 48 96 50 100 46 Z', '#1d1230') +
        '<path d="M99 38 l-3 6 l-2 -5 l-3 6 l-2 -5 l-3 6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/><path d="M98 46 l-3 -5 l-2 5 l-3 -5 l-3 5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>' +
        `<circle cx="80" cy="30" r="5.4" fill="#fff6c0" stroke="${INK}" stroke-width="1.2"/><circle cx="81.5" cy="30.4" r="2.6" fill="${INK}"/>`;
    },

    // ---- HUYỀN THOẠI ----
    golden: () => {    // Cá vàng huyền thoại: vàng óng, đuôi voan xoè 2 thuỳ, vương miện vây lưng, lấp lánh
      const body = 'M98 38 C96 22 82 16 64 17 C46 18 34 26 32 38 C34 50 46 58 64 59 C82 60 96 54 98 38 Z';
      const star = (x, y, s) => `<path d="M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z" fill="#fff8c8" stroke="#e9a91a" stroke-width=".8"/>`;
      return P('M33 38 C20 18 4 14 3 26 C2 34 10 38 16 38 C8 42 2 50 6 58 C12 64 26 56 33 38 Z', '#ffb52b') +
        L('M30 36 C20 30 12 24 8 20', '#ffe08a', 1, 'opacity=".8"') + L('M30 40 C20 46 12 52 8 56', '#ffe08a', 1, 'opacity=".8"') +
        P('M84 20 C80 8 70 3 62 5 C64 10 62 14 56 16 C50 12 44 12 40 18 C56 16 74 17 84 20 Z', '#ffb02a') +
        P('M64 59 C60 68 50 70 46 66 C52 64 58 62 64 59 Z', '#ffbd3d') +
        P(body, '#ffd23f') +
        clip('golden', body, FILL('M20 12 H110 V34 C80 30 50 32 20 40 Z', '#ffbe26') + FILL('M20 46 H110 V66 H20 Z', '#fff0a6') +
          [[48, 30], [60, 33], [72, 31], [84, 33], [54, 42], [66, 45], [78, 43]].map(c => L(`M${c[0] - 4} ${c[1]} Q${c[0]} ${c[1] + 5} ${c[0] + 4} ${c[1]}`, '#d98c12', 1, 'opacity=".75"')).join('') +
          FILL('M40 22 C60 16 80 22 92 30 C70 24 56 26 40 32 Z', '#fff9d6', 'opacity=".55"')) +
        P('M80 46 C74 54 68 54 64 50 C68 46 74 44 80 46 Z', '#ffc938') +
        EYE(89, 32, 3.6) + L('M97 40 Q94 43 90 42', INK, 1.2) + star(24, 12, 5) + star(110, 16, 4) + star(100, 62, 3.4) + star(14, 56, 3);
    },
    arowana: () => {   // Cá rồng: thân dài dẹt, vảy lớn ánh vàng hồng, râu hàm dưới, vây hậu môn liền đuôi
      const body = 'M110 34 C106 24 90 21 70 22 C48 23 30 28 22 34 C30 42 48 48 70 49 C92 50 104 46 110 40 Z';
      let scales = '';
      for(let r = 0; r < 3; r++) for(let c = 0; c < 8; c++){
        const x = 34 + c * 9 + (r % 2) * 4.5, y = 28 + r * 6.6;
        scales += `<path d="M${x - 4} ${y - 3} Q${x} ${y + 4} ${x + 4} ${y - 3}" fill="none" stroke="#a8421f" stroke-width="1.1" opacity=".75"/>`;
      }
      return P('M24 34 C14 28 6 32 6 38 C6 44 14 48 24 40 Z', '#e8793a') +
        P('M76 49 C60 58 38 58 24 42 C44 50 62 50 76 49 Z', '#e8793a') +
        P('M52 23 C46 14 38 14 30 20 C38 22 44 24 52 23 Z', '#e8793a') +
        P(body, '#f4b24a') +
        clip('arowana', body, FILL('M20 16 H116 V32 C84 30 50 31 20 38 Z', '#e8913a') + FILL('M20 44 H116 V60 H20 Z', '#fde3a8') + scales +
          FILL('M30 26 C54 22 82 23 106 29 C80 26 54 28 30 32 Z', '#fff4cf', 'opacity=".55"')) +
        P('M84 42 C78 51 70 52 66 47 C70 43 76 41 84 42 Z', '#e8793a') +
        P('M110 34 C112 38 112 40 110 40', '#f4b24a') + L('M108 40 C114 44 118 50 116 58', INK, 1.4) + L('M105 41 C110 47 112 54 108 62', INK, 1.4) +
        EYE(98, 31, 3.4) + L('M96 38 Q102 40 108 38', '#a8421f', 1.1);
    }
  };

  // ---------------------------------------------------------------- API
  const ids = () => Object.keys(ART);
  const has = id => !!ART[id];
  const svgCache = {};
  // Chuỗi <svg> hoàn chỉnh (có width/height để vẽ lên canvas được trên mọi trình duyệt). id gradient/clip đã gắn tiền tố riêng cho từng loài.
  function svg(id, cls){
    const key = (has(id) ? id : 'carp') + '|' + (cls || '');
    return svgCache[key] || (svgCache[key] =
      `<svg class="${cls || 'fish-art'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${id}">${ART[has(id) ? id : 'carp']()}</svg>`);
  }

  // Texture cho Sprite: cùng bức tranh SVG vẽ lên canvas 2x. Ảnh nạp xong thì tự đánh dấu cập nhật.
  const texCache = {};
  function texture(id){
    id = has(id) ? id : 'carp';
    if(texCache[id]) return texCache[id];
    const c = document.createElement('canvas'); c.width = W * 3; c.height = H * 3;
    const tex = new THREE.CanvasTexture(c);          // bản r186 đã tự gắn sRGB cho CanvasTexture (three-global.js)
    tex.anisotropy = 4;
    const img = new Image();
    img.onload = () => { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height); tex.needsUpdate = true; };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(id, 'x'));
    return (texCache[id] = tex);
  }
  const preload = () => ids().forEach(texture);
  const len = id => LEN[has(id) ? id : 'carp'];

  return { svg, texture, preload, ids, has, len, W, H };
})();

/* ===== BaitArt — tranh minh hoạ cho từng loại mồi (giun · tép · cá con) =====
 * Dùng ở Balo, quầy mua mồi và bảng câu cá: BaitArt.svg(id, cls). Khung vuông 48×48, cùng nét viền với FishArt.
 */
const BaitArt = (() => {
  const INK = '#173340';
  const P = (d, fill, w = 1.4, extra = '') => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${extra}/>`;
  const L = (d, stroke, w = 1.2, extra = '') => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
  const ART = {
    // Giun đất: thân hồng nâu chia đốt, ngoi lên từ nắm đất ẩm
    worm: () =>
      P('M5 42 C8 34 16 31 24 31 C32 31 40 34 43 42 Z', '#7b5236', 1.4) +
      `<circle cx="14" cy="38" r="1.3" fill="#58381f"/><circle cx="30" cy="36.5" r="1.2" fill="#58381f"/><circle cx="36" cy="39.5" r="1.1" fill="#9a7048"/><circle cx="21" cy="40" r="1" fill="#9a7048"/>` +
      L('M9 35 C12 20 21 19 24 28 C27 37 34 36 38 22', INK, 9.6) +
      L('M9 35 C12 20 21 19 24 28 C27 37 34 36 38 22', '#e2988a', 7) +
      L('M9 35 C12 20 21 19 24 28 C27 37 34 36 38 22', '#a24d44', 7, 'stroke-dasharray="1.3 2.5"') +
      L('M10.5 31 C13 22 20 21.6 22.4 27', '#f7cfc4', 1.5, 'opacity=".75"') +
      `<circle cx="38" cy="21.2" r="1" fill="#8d4338"/>`,
    // Tép: thân cong chia đốt, đuôi xoè, hai râu dài
    shrimp: () =>
      L('M36 12 C41 6 45 5 47 7', INK, 1.2) + L('M37 15 C42 12 46 14 47 19', INK, 1.2) +
      P('M19 36 C22 33.4 26 32.8 29.5 34 C27.5 36.6 23 38 19.6 37.6 Z', '#e8794a', 1.2) +
      P('M19.5 38 C23.5 38.4 27.5 39.8 29.5 42.4 C25.8 44 22 42.4 19 39 Z', '#e8794a', 1.2) +
      P('M19 37 C23.5 36.4 28.5 36.4 31.5 37.8 C28.5 39.8 23.5 39.8 19 38 Z', '#f08c5c', 1.2) +
      L('M16.6 25.5 L20.4 27.4', '#c85a36', 1.6) + L('M16 29.5 L20 31.6', '#c85a36', 1.6) + L('M17 33.2 L20.6 34.4', '#c85a36', 1.6) +
      L('M33 15 C23 11 12 18 11.5 28.5 C11.2 33.5 14 36.6 19 36.8', INK, 11.2) +
      L('M33 15 C23 11 12 18 11.5 28.5 C11.2 33.5 14 36.6 19 36.8', '#f6a07a', 8.6) +
      L('M33 15 C23 11 12 18 11.5 28.5 C11.2 33.5 14 36.6 19 36.8', '#dc6a42', 8.6, 'stroke-dasharray="1.2 4.3"') +
      L('M31 11.8 C23 9.6 14.5 15 13.4 24', '#ffd7bf', 1.6, 'opacity=".8"') +
      P('M33 15 C34 9.5 41 9.5 42 14.5 C42.6 18 38.5 20.6 35 19.6 C32.6 18.8 32.4 16.6 33 15 Z', '#f6a07a', 1.4) +
      P('M39 10.5 L47 8.6 L42 14.5 Z', '#e8794a', 1.2) +
      `<circle cx="37" cy="14" r="2.1" fill="#fff" stroke="${INK}" stroke-width=".9"/><circle cx="37.4" cy="14" r="1.1" fill="${INK}"/>`,
    // Cá con: cá mồi nhỏ sống, lưng xanh bụng bạc, đuôi chẻ
    minnow: () => {
      const body = 'M41 25 C38 17 29 15 20 18.5 C15 20.5 11.5 23 9.5 25 C11.5 27 15 29.5 20 31.5 C29 35 38 33 41 25 Z';
      return P('M10 25 L2.5 17 L5 25 L2.5 33 Z', '#8fb3c2', 1.3) +
        P('M22 17.5 L26 10.5 L31 16.2 Z', '#6f9bb0', 1.2) + P('M24 32.5 L26.5 38.5 L31 33.6 Z', '#9fbfcb', 1.2) +
        P(body, '#e8f1f4', 1.4) +
        `<clipPath id="ba-minnow"><path d="${body}"/></clipPath><g clip-path="url(#ba-minnow)"><path d="M0 8 H48 V24.5 C36 23 22 22.6 0 25 Z" fill="#5d8fa8"/><path d="M0 24.5 C22 22.6 36 23 48 24.5 V27 C34 25.6 22 25.6 0 27.6 Z" fill="#b9d3dc"/><path d="M0 30 H48 V44 H0 Z" fill="#fbf6e4"/></g>` +
        L('M20 19 C23 23 23 28 20 31.5', '#7fa6b7', 1.1) +
        `<circle cx="34" cy="23" r="3.1" fill="#fff" stroke="${INK}" stroke-width="1"/><circle cx="34.7" cy="23" r="1.7" fill="${INK}"/><circle cx="35.2" cy="22.4" r=".6" fill="#fff"/>` +
        L('M41 25.2 L38.6 26.2', INK, 1.1);
    }
  };
  const ids = () => Object.keys(ART);
  const has = id => !!ART[id];
  const cache = {};
  function svg(id, cls){
    const k = (has(id) ? id : 'worm') + '|' + (cls || '');
    return cache[k] || (cache[k] = `<svg class="${cls || 'bait-art'}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48" role="img" aria-label="${id}">${ART[has(id) ? id : 'worm']()}</svg>`);
  }
  return { svg, ids, has };
})();
