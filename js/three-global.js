/* ===== three.js r186 → biến toàn cục `THREE` + `GFX` =====
 * Từ r160 three.js không còn bản build/three.min.js, chỉ còn ES module.
 * File này import module rồi gắn vào window.THREE để toàn bộ code cũ (script thường) chạy tiếp không phải sửa.
 * Các script game được nạp bằng `defer` sau file này (xem index.html) nên luôn thấy THREE sẵn sàng.
 *
 * Thêm ?legacy=1 vào URL để xem lại cách lên màu kiểu r128 cũ (so sánh trước/sau).
 */
import * as NS from 'three';

const MODERN = !/[?&]legacy=1/.test(location.search);
if (!MODERN) NS.ColorManagement.enabled = false;

// Texture vẽ bằng canvas luôn là ảnh màu sRGB → gắn colorSpace mặc định để màu không bị bạc/cháy
class CanvasTexture extends NS.CanvasTexture {
  constructor(...args) { super(...args); if (MODERN) this.colorSpace = NS.SRGBColorSpace; }
}

window.THREE = Object.assign({}, NS, { CanvasTexture });

window.GFX = {
  modern: MODERN,
  LI: Math.PI,   // r155+ bỏ "legacy lights": nhân π để độ sáng đèn Ambient/Hemisphere/Directional giữ như r128
  setupRenderer(r, opt) {
    const tone = !opt || opt.tone !== false;
    if (MODERN) {
      r.outputColorSpace = NS.SRGBColorSpace;
      if (tone) { r.toneMapping = NS.NeutralToneMapping; r.toneMappingExposure = 1.0; }  // nén vùng quá sáng mượt hơn, ít cháy trắng
    } else {
      r.outputColorSpace = NS.LinearSRGBColorSpace;
    }
  }
};
