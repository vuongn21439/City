# 🏙️ GCITY 3D - Game Thành phố (bản 3D WebGL)

Bản 3D thật dùng Three.js. Yêu cầu trình duyệt hỗ trợ WebGL (Chrome, Edge, Firefox, Safari mới nhất).

## Nâng cấp three.js r128 → r186 (2026)
- three.js giờ chỉ phát hành dạng ES module (không còn `three.min.js`). `index.html` dùng **importmap** trỏ tới `three@0.186.0` trên jsDelivr; `js/three-global.js` import rồi gắn `window.THREE` + `window.GFX` để các script cũ chạy không phải sửa. Các script game nạp bằng `defer` theo đúng thứ tự.
- Chạy offline / tự host: tải `three.module.min.js` **và** `three.core.min.js` (từ gói npm `three@0.186.0`, thư mục `build/`) vào `js/vendor/`, rồi đổi URL trong importmap thành `js/vendor/three.module.min.js`.
- Đã sửa: bỏ `THREE.Clock` (deprecated từ r183, vốn không được dùng), `PCFSoftShadowMap` → `PCFShadowMap`, đèn Ambient/Hemisphere/Directional nhân π (`GFX.LI`), renderer dùng sRGB + `NeutralToneMapping`, `CanvasTexture` mặc định sRGB, thêm `shadow.normalBias`.
- Xem lại màu kiểu cũ để so sánh: mở game với `?legacy=1` (VD `index.html?legacy=1`).
- Muốn chỉnh độ sáng tổng thể: `GFX.LI` (đèn) hoặc `toneMappingExposure` trong `js/three-global.js`.

## Chạy
Mở `index.html` hoặc `npx serve .`

## 

## Tính năng
- Quảng trường 3D thật: tòa nhà, cây, đài phun nước Hoàng Gia 3 tầng có tia nước hạt, đèn đường, ghế đá
- Nhân vật 3D dựng từ khối nguyên thủy (6 nam + 6 nữ), animation đi/nhảy/ngồi/vẫy/7 điệu nhảy
- Camera third-person, kéo chuột xoay, lăn chuột zoom
- WASD di chuyển tương đối camera, E tương tác tòa nhà
- 2 zone: Quảng trường ↔ Đảo câu cá (cổng tàu)
- Chat real-time (bong bóng trên đầu), mini-game câu cá, xổ số, rạp phim, thuê đồ
- Multiplayer Firebase (đổi USE_FIREBASE=true trong js/config.js)
- NPC đứng ở các điểm chơi; offline không có bot (đổi `botCount` trong js/config.js nếu muốn)

## Asset
Toàn bộ asset tự vẽ bằng Three.js geometry (không file ngoài). Thay bằng model GLTF/ảnh của bạn trong `js/three-scene.js`.

## Bản Công viên (cập nhật)
- Zone chính là **Công viên GCITY**: đài phun nước ở giữa, 8 ghế quanh đài + 3 ghế hướng về màn hình (**chạm vào ghế để ngồi** — xa thì nhân vật tự đi tới; chạm ra chỗ khác hoặc di chuyển joystick/WASD để đứng dậy)
- **Màn hình lớn** phía bắc chiếu YouTube: lại gần **chạm vào NPC 📺 Anh Chiếu Màn** (cạnh sân khấu) hoặc bấm E, **gõ tên video để tìm** (cần `YOUTUBE_API_KEY` trong `js/config.js`) hoặc dán link. Video bám theo màn hình 3D khi xoay camera
- **Game chơi qua NPC** (không có menu, không có chữ gợi ý): lại gần NPC (🃏 Lật hình, 🎟 Đánh lô, 🎟 Trường đua) rồi **chạm vào NPC** (hoặc bấm E trên desktop). Đánh lô: chọn số 01–99, tự đặt xu, 10 giải quay độc lập, mỗi giải trúng thưởng ×10 tiền đặt, trúng nhiều giải thì cộng dồn
- Phải chạy qua http (`npx serve .` / GitHub Pages). Mở file:// thì YouTube báo lỗi 153

## Trường đua thú (cập nhật: 7 thú)
- Đường đua mở rộng thành **sân vận động 7 làn** (2 đoạn thẳng + 2 nửa vòng), có vạch xuất phát, cổng số làn, vạch đích caro, lan can 2 tầng, bãi cỏ giữa
- **7 bạn thú** dựng chi tiết bằng khối Three.js (`js/animals.js`): 🐎 Ngựa Đỏ, 🐕 Chó Xanh, 🐇 Thỏ Vàng, 🐢 Rùa Tím, 🦊 Cáo Cam, 🐖 Heo Hồng, 🐸 Ếch Xanh Lá. Mỗi con có yếm/vòng cổ màu làn, thẻ số bay trên đầu, chân chạy, đuôi vẫy, tai động, con thắng nhảy ăn mừng
- Tỷ lệ cược **1 ăn 6** (tự đặt xu: đặt 10🪙 → trúng nhận 60🪙). Đổi hệ số ở hằng số `MULT` trong `js/park.js`

## Đài phun nước Hoàng Gia (cập nhật)
- Dựng riêng trong `js/fountain.js` (module `Fountain`): bậc thềm đá, hồ chính viền vàng + 32 họa tiết chạm nổi, cột giữa có rãnh, 4 cột phụ, 8 con sơn, bồn giữa, bồn đỉnh, thiên cầu vàng xoay
- ~1500 hạt nước đi theo quỹ đạo tính trước nên luôn rơi đúng vào bồn đỉnh / bồn giữa / hồ, không bị cụt giữa không trung; chạy theo thời gian thực nên tốc độ không phụ thuộc màn hình 60Hz hay 120Hz
- Chi tiết lặp lại dùng `InstancedMesh` (3 draw call thay vì ~50), vật liệu Lambert cho nhẹ trên điện thoại
- Đổi kích thước: hằng số `SCALE` đầu `js/fountain.js` (va chạm `Fountain.RADIUS` tự theo). Đổi số hạt: `NM` (tia chính) và `NR` (tia vòng)

## Thuê xe · máy bay (cập nhật)
- **Bãi thuê xe** ở phía tây công viên (`rentLot` trong `js/three-scene.js`): 4 xe mui trần (đỏ / xanh dương / vàng / xanh lá) + 2 máy bay (xanh / vàng) đậu trong ô kẻ vạch, có biển hiệu và bong bóng đếm xe còn lại (`Thuê xe · 4/4 · ✈ 2/2`)
- Lại gần **NPC 🚗 Tài Xế Chớp Nhoáng** → chạm vào NPC (hoặc bấm E) → chọn đúng chiếc xe / máy bay muốn thuê (xe 50🪙, máy bay 150🪙, 5 phút). Nhân vật **ngồi thật lên ghế** (tư thế ngồi), xe rời bãi; xuống xe là xe tự về bãi
- Xe: joystick hoặc nút Lùi / Tiến. Máy bay: thêm **Bay lên ↑ / Hạ cánh ↓**; cánh quạt đứng yên khi đỗ, giữ "Bay lên" thì nổ máy, **cánh quạt quay dần** rồi mới cất cánh, bay thì quay hết tốc lực. Thả ga khi đang bay để **lơ lửng**; có thể hạ cánh trên mái nhà. Máy bay nghiêng cánh khi rẽ, ngóc đầu khi lên và camera tự bám theo hướng bay. Bấm "Xuống xe · 4:22" để xuống (đang bay thì tự hạ cánh trước)
- Model xe / máy bay nằm trong `js/vehicles.js` (dùng chung cho bãi đỗ và lúc lái). Đổi giá / thời gian thuê: `PRICE`, `RENT_SEC`; đổi màu / thêm xe: `CARS`, `PLANES`


## Chuyển từ v20 sang City-main — Đảo câu cá mới · nút 🎣 nổi · ban đêm
Giữ nguyên logic City-main (đường vòng vuông + vạch sang đường, vòng đu quay, đổi giờ theo đồng hồ máy, lưu key YouTube qua `js/keys.js`, nút thoát, v.v.). Chỉ lấy các điểm sau từ v20:
- **Đảo câu cá (`js/island.js` thay hoàn toàn)**: đảo bầu dục giữa biển có bãi cát, cỏ, đường đất chữ S, ~22 cây dừa, đá ven biển và 7 đảo con ngoài xa; chòi lợp lá (phao cứu sinh, quầy xanh ngọc, cá gỗ trên mái), dù đỏ-trắng / xanh-trắng kèm ghế nằm, 3 đèn lồng; bến gỗ chữ T có thuyền chèo, cổng tàu về Quảng trường nằm ở mép đầu bến. Đã xóa hồ nước và bến cũ của đảo.
- **Câu cá**: câu được khi đứng trên bến hoặc sát mép nước (`Island.atDock`); nhân vật tự quay mặt ra phía nước (`Island.fishDir`). Nút **🎣 nổi bên trái** (chỉ hiện ở đảo): bấm để quăng, khi cá cắn nút đỏ nhấp nháy "KÉO!". Kéo cần khi phao còn đang chờ bị chặn bằng thông báo (chỉ nút nổi; bảng ở NPC vẫn giữ logic cũ). Đi chuyển hoặc bấm emote thì thôi câu, mồi đã quăng coi như mất. Animation câu cá vẫn là của City-main (`js/character.js`).
- **Về Quảng trường từ đảo** thì đứng trước cổng tàu (0, 32) thay vì giữa sân.
- **Ban đêm (Quảng trường + đảo)**: trời/sương mù xanh đen và ánh sáng đêm theo v20; đài phun nước phát sáng xanh ngọc; thêm 12 đèn đường quanh sân khấu, vỉa hè, sân cổng tàu, vòng quay và hai bên trường đua; đèn sân khấu; trên đảo có đèn chòi, 3 đèn lồng, đèn đầu bến, biển tối đi. Ánh sáng chỉ là sprite/đĩa cộng sáng (không dùng đèn thật) nên nhẹ cho điện thoại. Trời vẫn chuyển ngày/đêm mượt theo giờ máy như City-main.

## Cập nhật: đua thú đặt xu · số may mắn có hiệu ứng · ngồi xếp bằng
- **Đua thú**: chạm NPC 🎟 Trường đua → chọn 1 trong 7 thú, tự nhập số xu (hoặc bấm 10 / 100 / 1.000 / 10.000 / ½ / ×2 / Tất cả) → **Đặt cược**. Trúng nhận **×6** số xu đã đặt (hằng số `MULT` trong `js/park.js`). Có vé cược, đồng hồ đóng vé, đường đua mini xem trực tiếp, nút huỷ vé (hoàn xu) trước khi đua. Đóng tab giữa ván → lần sau vào game được hoàn xu vé.
- **Số may mắn** (Vòng quay may mắn): chọn số bằng −/+ hoặc 🎲 (số quay chậm dần rồi dừng). Khi quay, cả 10 ô cùng quay rồi dừng lần lượt; ô khớp nảy lên + pháo xu, thắng thì khung nháy sáng và số dư chạy lên. Tự tắt hiệu ứng khi hệ thống bật "giảm chuyển động".
- **Ngồi xếp bằng** (emote 🧘): tư thế riêng ngồi dưới đất (hông sát đất, đầu gối dang, cẳng chân vắt chéo, tay đặt lên gối) — action `lotus`. Ngồi ghế vẫn là action `sit`. Bấm lại emote, chạm ra ngoài hoặc di chuyển để đứng dậy.

## Bản C — lái máy bay (cập nhật)
Dựng trên bản A (hitbox 3D theo hình máy bay) + sửa thêm:
- **Hướng lái máy bay**: bản gốc bấm phải làm `yaw` tăng = mũi quay TRÁI; nay đảo dấu cho máy bay (xe giữ nguyên) và đảo luôn chiều nghiêng cánh → bấm phải thì rẽ phải trên màn hình khi camera ở sau lưng.
- **Camera đuổi sau lưng máy bay**: kéo chuột/ngón tay để liếc quanh, thả tay ~1.4s thì camera êm ái quay về sau lưng (hằng số `CAM_RECENTER_DELAY`, `CAM_RECENTER_RATE` trong `js/three-scene.js`).
- **Va chạm 3D thêm**: vòng quay (cao tới h+R), trường đua (lan can ~1.2) + cổng đích (~4.7), sân khấu + 2 loa. Tòa nhà / cây / đèn / đài phun / ghế / màn hình giữ nguyên từ bản A.
- Hạ cánh được lên nóc nhà (đúng mặt nóc), lơ lửng khi thả ga, nghiêng cánh khi rẽ, ngóc đầu khi lên/xuống.
