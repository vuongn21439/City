/* ===== GCITY Configuration =====
 * Để dùng Firebase: tạo project Firebase, bật Realtime Database + Authentication,
 * copy config dưới đây và đặt USE_FIREBASE = true.
 * Hướng dẫn chi tiết xem README.md
 */
const GCITY_CONFIG = {
  USE_FIREBASE: false,  // đổi thành true khi đã cấu hình Firebase

  // Tìm video YouTube bằng cách gõ tên (NPC 📺 Anh Chiếu Màn).
  // KHÔNG chứa key ở đây. Key thật do GitHub Actions chèn vào js/keys.js lúc deploy,
  // đọc qua YTKEYS (xoay vòng nhiều key — mỗi key miễn phí ~100 lượt tìm/ngày).
  // Chạy local không có key vẫn chơi được, chỉ dán link video thay vì gõ từ khoá.
  YOUTUBE: { KEYS_FILE:'js/keys.js', GLOBAL:'GCITY_KEYS' },
  FIREBASE: {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "0000000000",
    appId: "1:000:web:abcdef"
  },

  GAME: {
    startCoins: 100,
    moveSpeed: 160,          // px/sec
    runSpeed: 280,
    playerName: "Player",
    defaultZone: "plaza",
    botCount: 0              // 0 = không có bot (đặt >0 nếu muốn bot mô phỏng người chơi khi offline)
  }
};
