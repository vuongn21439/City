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
- Nhân vật 3D dựng từ khối nguyên thủy (6 nam + 6 nữ), animation đi/nhảy lên/ngồi/vẫy/1 điệu nhảy (icon nam/nữ riêng)
- Camera third-person, kéo chuột xoay, lăn chuột zoom
- WASD di chuyển tương đối camera, E tương tác tòa nhà
- 2 zone: Quảng trường ↔ Đảo câu cá (cổng tàu)
- Chat real-time (bong bóng trên đầu), mini-game câu cá, xổ số, rạp phim, thuê đồ
- Multiplayer Firebase (đổi USE_FIREBASE=true trong js/config.js)
- NPC đứng ở các điểm chơi; offline không có bot (đổi `botCount` trong js/config.js nếu muốn)

## Asset
Phần lớn asset tự vẽ bằng Three.js geometry. Riêng nhân vật nam #1 dùng model GLB (xem mục *Nhân vật 3D từ file GLB* bên dưới).
## Nhân vật 3D từ file GLB (thay nhân vật dựng khối)
Nhân vật nam #1 (`male:0`) giờ dùng model GLB có xương; 11 nhân vật còn lại vẫn là bản dựng khối cũ. Làm từng nhân vật một: thêm 1 dòng vào `MODELS` trong `js/config.js`.

**Cách hoạt động** (`js/glbchar.js`): `character.js` vẫn dựng bộ pivot vô hình và vẫn chạy toàn bộ animation cũ (đi, chạy, nhảy, ngồi ghế, xếp bằng, vẫy, buồn, nhảy múa, ăn mừng, lái xe, câu cá). Mỗi khung, `GLBChar.sync()` đổi góc quay các pivot đó sang xương của model (retarget theo hệ toạ độ thế giới, nên không phụ thuộc T-pose/A-pose hay trục xương của từng loại rig). Tự nhận xương Mixamo, Quaternius, KayKit, Unreal, Rigify, Bip01. Cần câu bám đúng bàn tay model.

**Đổi model:** đặt file `.glb` vào `assets/models/`, sửa `url` trong `js/config.js`. Mở console (F12), thấy dòng `[GLBChar] male:0 → k=… legScale=…` là nhận xương OK. Không nhận được xương / không tải được file / quá 12 giây → game **tự dùng lại nhân vật cũ** và in lý do ra console, không bao giờ treo.

| Tuỳ chọn (mỗi model) | Ý nghĩa |
|---|---|
| `height` (3.1) | chiều cao mong muốn theo đơn vị rig (nhân vật cũ ≈ 3.45) |
| `headScale` (1.25) | phóng đầu cho hợp phong cách chibi; `1` = giữ nguyên |
| `legScale` (tự tính) | co chân để hông đúng độ cao 1.2 mà ghế/xếp bằng/xe đã chỉnh sẵn. Đặt `1` = chân thật, ngồi ghế sẽ lệch |
| `outline` (true) | viền toon giống nhân vật cũ |
| `lift` (0.22) | nâng sáng nền, model tối thì tăng |
| `gripAhead` (0.14) | chỉnh chỗ cầm cần câu so với cổ tay |
| `yaw` (tự dò) | xoay thêm nếu model quay mặt sai hướng |
| `bones` | ép tên xương khi tự nhận sai, vd `{ handL:'Palm2.L' }` |

**Lưu ý**
- Phải chạy qua http (`npx serve .` hoặc GitHub Pages). Mở thẳng `index.html` kiểu `file://` thì trình duyệt chặn tải GLB và game dùng nhân vật cũ.
- `assets/models/male0.glb` hiện là **model thử** (Soldier trong ví dụ của three.js, nguồn Mixamo). Chỉ để kiểm tra; trước khi đăng Google Play/Facebook hãy thay bằng model có giấy phép rõ (ưu tiên CC0: Quaternius, Kenney) hoặc kiểm tra điều khoản Mixamo.
- Nén GLB cho nhẹ (2.1MB → ~0.55MB): `npx @gltf-transform/cli optimize in.glb out.glb --compress meshopt --texture-compress webp`. Bản r186 giải nén meshopt sẵn. Bản r128 (three.min.js) chỉ nạp được GLB không nén.
- Mỗi model GLB thêm 1 lớp viền nên số draw call gấp đôi số mesh của model: chọn model ít mesh (gộp vật liệu) cho điện thoại yếu.


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
- **Câu cá**: câu được khi đứng trên bến hoặc sát mép nước (`Island.atDock`); nhân vật tự quay mặt ra phía nước (`Island.fishDir`). Nút **🎣 nổi bên trái** (chỉ hiện ở đảo): bấm để quăng, khi cá cắn nút đỏ nhấp nháy "KÉO!". Kéo cần khi phao còn đang chờ bị chặn bằng thông báo (chỉ nút nổi; bảng ở NPC vẫn giữ logic cũ). Đi chuyển hoặc bấm emote thì thôi câu, mồi đã quăng coi như mất. Animation câu cá: xem mục ngay bên dưới (`js/character.js`).
- **Animation câu cá (chuẩn hoá)**: lượt quăng chỉ được tính khi **phao chạm mặt nước**. Nhân vật giương cần → vung → buông dây (0,52s); phao bay theo đường vòng cung tới điểm rơi trên mặt nước (`Island.castTarget` tự né đất / ván bến / thuyền), bắn gợn nước; `ud.castLanded` bật lên thì `game.js` mới gọi `Fishing.landed()` → lúc đó mới **trừ mồi** và bắt đầu chờ cá (đi mất giữa lúc đang quăng thì không mất mồi). Phao luôn nằm đúng mặt nước (trước đây lơ lửng trên không). Cá đớp: phao nhúng + gợn nhanh; kéo cá: phao + cá (màu theo loại) kéo từ nước lên đầu cần; chưa quăng / cá thoát: dây thu về, phao treo dưới đầu cần.
- **Cần câu thường / cao cấp (`ud.rodTier` 1 | 2, theo `inventory.rod`)**: cơ bản = cần tre-gỗ ngắn, cuộn nhựa xám nhỏ, 2 khoen sắt, phao đỏ-trắng, quăng 5,2 đơn vị; cao cấp = thân carbon đen dài, tay cầm bần, cuộn bạc lớn + quay vàng, 5 khoen vàng, dải quấn đỏ, phao vàng-đỏ có đèn xanh, quăng xa 6,6 đơn vị. Chủ chòi (NPC) cầm cần cao cấp.
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

## Fix va chạm đèn đường / bồn hoa · vẽ lại bồn hoa (cập nhật)
- **Va chạm**: nhân vật không còn đi xuyên **đèn đường** và **bồn hoa**. Đèn = vòng tròn quanh cột (`0.3 + r·0.55`), bồn hoa = hình chữ nhật đúng cỡ viền đá (hằng số `BED` trong `js/three-scene.js`, dùng chung cho cả vẽ lẫn va chạm). Cả hai luôn là vật cản, kể cả lúc đang tự đi tới ghế. Xe thuê cũng không còn lướt qua đèn / bồn hoa; máy bay thấp hơn ~4.5 (đèn) / ~1.25 (bồn hoa) thì đâm vào, bay cao hơn thì lướt qua (`aircraftCollision`).
- **Bồn hoa vẽ lại** (`makeFlowerBed`): viền đá kem có đế + gờ mũ, đất nâu, bụi lá xanh low-poly và **hoa thật** — cúc (8 cánh quanh nhuỵ vàng), tulip (5 cánh chụm thành đài, 2 lá dài), oải hương (chùm nụ dọc thân), mỗi bông có thân + lá. Màu/loại/chiều cao cố định theo toạ độ bồn nên lần nào dựng lại cũng giống nhau. Mỗi bồn gộp thành 1 mesh (`Batch`) nên chỉ 1 draw call.
- 2 bồn ở sân cổng tàu nhích nhẹ (`±7.4,35` → `±7.2,34.7`) để không chạm chân đèn `(±8,36)` khi bồn mới sâu hơn.

## Cập nhật: tab "Số may mắn" (chọn 3 chữ số) làm lại
Chạm NPC 🍀 **Số May Mắn** (hoặc toà nhà Số may mắn, bấm E) → mở tab riêng, code ở `js/lotto.js` (module `Lotto`).
- **Cách chơi ngay trên tab**: 3 bước (Chọn 3 số → Bấm Quay → Khớp từ số cuối) + **bảng thưởng** có ký hiệu chấm (chấm đầy = chữ số phải khớp). Luật giữ nguyên như cũ: phí **10 xu**; khớp cả 3 số **1.000 xu** · khớp 2 số cuối **100 xu** · khớp số cuối **20 xu**; mỗi lượt chỉ nhận giải cao nhất.
- **Chọn số**: ▲/▼ từng chữ số, 🎲 chọn ngẫu nhiên (3 chữ số nhảy rồi dừng lần lượt). Desktop: bấm vào chữ số rồi gõ 0–9, phím ↑/↓/←/→, Enter để quay.
- **Hiệu ứng quay**: 3 cuộn số quay cùng lúc rồi dừng **từ phải sang trái** (khớp liên tiếp thì chờ lâu hơn cho hồi hộp). Chữ số khớp: viền xanh + nảy + pháo xu; trúng thì dòng thưởng bật sáng, hàng giải tương ứng trong bảng thưởng nổi lên, số dư chạy lên; độc đắc có thêm loé sáng + pháo lớn. Tự tắt hiệu ứng khi hệ thống bật "giảm chuyển động".
- **An toàn dữ liệu**: kết quả được tính, trả thưởng và lưu ngay lúc bấm Quay; phần hiệu ứng chỉ là "lộ" kết quả. HUD giữ số xu cũ tới khi cuộn cuối dừng (`UI.holdCoin` / `UI.releaseCoin`) nên không lộ kết quả sớm. Đóng panel / tắt tab giữa chừng vẫn nhận đúng thưởng; mở lại panel khi đang quay thì tiếp tục đúng trạng thái.
- Đổi phí / giải thưởng: hằng số `FEE` và `TIERS` đầu `js/lotto.js` (bảng thưởng tự cập nhật theo).

## Cập nhật: 16 loài cá · mỗi loài một tranh · cá câu lên đúng như trong Sổ cá · cân lại giá
- **16 loài, 5 độ hiếm** (`js/fishing.js`): Phổ biến (cá trích 4 · cá bống 5 · cá chép 6 · cá rô phi 8) · Ít gặp (cá trê 14 · cá thu 18 · cá nóc 24) · Hiếm (cá quả 40 · cá hồi 50 · cá hề 58 · cá đuối 72) · Sử thi (cá kiếm 130 · cá koi 160 · cá lồng đèn 200) · Huyền thoại (cá vàng 400 · cá rồng 650). Đơn vị: xu. Id cũ (`carp`, `tilapia`, `bass`, `golden`) giữ nguyên nên Sổ cá đã lưu không mất.
- **Mỗi loài một tranh riêng** (`js/fishart.js`, module `FishArt`): vẽ bằng SVG, không dùng ảnh/font ngoài. `FishArt.svg(id)` cho Sổ cá; `FishArt.texture(id)` vẽ cùng bức đó lên canvas làm texture.
- **Cá kéo lên giống ảnh trong Sổ cá**: cá treo ở đầu dây là một `Sprite` dùng đúng texture của loài vừa câu (`character.js`, `updateGear`), to nhỏ theo loài (`LEN` trong `fishart.js`), đầu hướng lên và quẫy nhẹ. Thêm loài mới = thêm 1 mục vào `FISH_TYPES` + 1 hàm vẽ cùng id trong `ART`.
- **Cân lại giá và tỉ lệ**: mỗi cột `weight` cộng đúng 100 nên chính là % gặp với cần cơ bản. Tỉ lệ theo nhóm (giun / tép / mồi giả): Phổ biến 90 / 80 / 62 · Ít gặp 8 / 14,5 / 24 · Hiếm 1,8 / 4,5 / 10 · Sử thi 0,18 / 0,85 / 3 · Huyền thoại 0,02 / 0,15 / 1. Kỳ vọng mỗi lần quăng (cần cơ bản): giun ≈ 8 xu (vốn 1) · tép ≈ 12 xu (vốn 3) · mồi giả ≈ 23 xu (vốn 8). Cần cao cấp (`rarityMultiplier` 1,65) tăng cơ hội theo nhóm: Ít gặp ×1,23 · Hiếm ×1,65 · Sử thi ×1,81 · Huyền thoại ×1,98 (`TIER_BOOST`). Giá mồi và giá cần giữ nguyên.
- **Sổ cá**: thẻ có ảnh to, nhãn độ hiếm có màu, hiện "Đã câu X/16 loài". "Mồi hợp" lấy theo mồi cho tỉ lệ gặp cao nhất.


## Câu cá: mồi thật · chọn mồi trong Balo · thông báo cá
- **Mồi**: Giun · Tép · Cá con (bỏ "Mồi giả"). Mỗi mồi có hình riêng (`BaitArt` trong `js/fishart.js`) dùng ở Balo, quầy mua mồi và bảng câu cá. Save cũ còn `lure` được tự đổi thành `minnow` (Cá con) khi vào game.
- **Dùng mồi**: cầm cần câu bất kỳ rồi mở Balo chọn loại mồi (`inventory.equippedBait`). Chưa cầm cần thì chưa chọn được mồi; không có chuyện tự đổi sang mồi khác.
- **Hết mồi**: dùng nốt mồi đang chọn thì lượt câu đó vẫn chạy tiếp; xong lượt là dừng câu và báo "Đã hết …". Người chơi tự mở Balo chọn loại khác, hoặc mua thêm rồi chọn lại. Nút 🎣 nổi hiện "Chọn mồi" khi đang cầm cần mà chưa chọn mồi. Cất cần / rời đảo / vào lại game thì bỏ chọn mồi.
- **Thông báo câu được cá**: chỉ báo tên cá (VD "Câu được Cá trích"), không kèm giá / độ hiếm. Thông báo dài (VD báo hết mồi) tự xuống dòng, không bị bóp hẹp.
- Màn hình chỉ hiện thông tin cần cho người chơi (mồi đang dùng, số lượng, loại cá mỗi mồi thu hút); đã bỏ các dòng giải thích kỹ thuật.
