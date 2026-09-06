# TypoBlend (CEP cho Photoshop)

Panel CEP tái tạo lại phần lớn dialog **Layer Style / Blending Options** của
Photoshop, nhưng ở dạng "sống": panel nằm nguyên trên màn hình, đổi sang layer
khác chỉ cần bấm **Sync** để đọc lại thông số, chỉnh sửa rồi bấm **Apply** để
ghi đè — không phải mở/đóng dialog `fx` mỗi lần đổi layer nữa. Giao diện panel
(nhãn, tooltip, thông báo) dùng tiếng Anh toàn bộ; tài liệu này viết tiếng
Việt cho anh dễ theo dõi thôi.

Bảng màu đồng bộ theo theme tối của **TypoCore** (nền `#2b2b2b`, accent cam
`#f90`, nút CTA xanh `#288edf`...).

## 1. Cấu trúc thư mục

```
TypoBlend/
├── CSXS/
│   ├── manifest.xml              ← khai báo extension CEP (kích thước, icon...)
│   └── icons/
│       ├── icon.png              ← icon 23px (2 chữ "T" chồng nhau, dùng chung mọi trạng thái)
│       ├── icon@2x.png           ← bản 46px cho màn Retina
│       └── logo_preview_512.png  ← bản xem trước phóng to, không dùng trong manifest
├── client/
│   ├── index.html                ← giao diện panel
│   ├── style.css
│   ├── scripts.js                ← logic UI, Sync/Apply, hàng chờ lệnh, gradient editor nhiều màu
│   └── host.jsx                  ← ExtendScript build/đọc ActionDescriptor
├── lib/                           ← (anh cần tự thêm, xem bước 2)
│   └── CSInterface.js
└── README.md
```

## 2. Cài đặt

1. Copy nguyên thư mục `TypoBlend` vào:
   - Windows: `C:\Program Files (x86)\Common Files\Adobe\CEP\extensions\`
   - macOS: `/Library/Application Support/Adobe/CEP/extensions/`
2. Copy file `CSInterface.js` từ bộ TypoCore anh gửi (`../lib/CSInterface.js`)
   vào đúng `TypoBlend/lib/CSInterface.js` — file này Adobe cung
   cấp sẵn, TypoCore của anh đã có rồi nên chỉ cần copy qua.
3. Bật chế độ debug để Photoshop chấp nhận extension chưa ký:
   - Windows: thêm registry `HKEY_CURRENT_USER\Software\Adobe\CSXS.9`
     (hoặc `.10`/`.11` tuỳ bản CEP của Photoshop anh đang dùng) → key
     `PlayerDebugMode` = `1` (String).
   - macOS: Terminal chạy
     `defaults write com.adobe.CSXS.9 PlayerDebugMode 1`
     (đổi `9` thành version CSXS đúng với Photoshop của anh nếu khác).
4. Mở Photoshop → `Window > Extensions (Legacy)` (hoặc `Plugins`) →
   **TypoBlend**. Icon 2 chữ T sẽ hiện trong danh sách/menu Extensions.

Panel co giãn được từ **200px đến 500px** ngang (chỉnh trong `manifest.xml`
nếu cần đổi lại), cao 400px–2400px.

Nếu anh muốn gộp panel này vào chung 1 extension với TypoCore thay vì cài
riêng, chỉ cần thêm 1 khối `<Extension>` nữa vào `manifest.xml` hiện có của
TypoCore, trỏ `MainPath`/`ScriptPath` sang thư mục `client` này — em có thể
làm giúp anh việc đó nếu anh gửi lại `manifest.xml` gốc.

## 3. Cách dùng

- **Sync / Apply / Clear / Copy Style / Paste Style**: 5 nút icon SVG gọn ở
  thanh trên cùng (rê chuột vào để xem tooltip từng nút).
  - **Sync**: đọc toàn bộ fx + Blend Mode/Opacity/Fill của layer đang chọn
    lên panel.
  - **Apply**: ghi đè xuống layer đang chọn (chọn nhiều layer cùng lúc cũng
    được — áp dụng y hệt lên tất cả). Nút này tô màu xanh vì là hành động
    chính, khớp màu nút CTA của TypoCore.
  - **Clear**: xoá sạch fx của layer đang chọn.
  - **Copy Style / Paste Style**: copy toàn bộ fx + blend mode của 1 layer,
    dán sang layer/nhiều layer khác — không cần Sync/Apply.
- **Thu gọn tất cả** (icon ⬍ nhỏ góc phải thanh trên cùng): bấm 1 lần thu gọn
  hết các mục lại cho gọn màn hình, bấm lần nữa mở lại hết (Blending Options
  luôn giữ mở vì không có tick bật/tắt). Trạng thái thu gọn/mở của từng mục
  được **nhớ lại** cho lần mở panel sau (kể cả khi không dùng nút này mà tự
  bấm từng thanh tên).
- **Auto-Sync** / **Auto-Apply**: 2 checkbox dưới thanh nút.
  - Auto-Sync: bật lên thì panel tự Sync mỗi khi anh click chọn layer khác
    trong Photoshop, không cần bấm nút.
  - Auto-Apply: bật lên thì sau khi anh thả chuột/ngưng chỉnh một chút, nếu
    có thay đổi thật sự panel tự Apply luôn xuống layer đang chọn.
- **Settings** (chữ nhỏ gạch chân dưới cùng panel, bên phải dòng credit): mở
  menu **Show / Hide Tools** — ẩn/hiện hẳn các mục anh không dùng tới (kể cả
  Blending Options) để panel gọn hơn. Lựa chọn được nhớ lại cho lần mở panel
  sau. Lưu ý: ẩn đi chỉ là ẩn trên giao diện — nếu hiệu ứng đó đang bật sẵn
  trên layer thì vẫn giữ nguyên, không tự tắt.
- **Gradient (Stroke & Gradient Overlay)**: khác bản TypoCore cũ (giới hạn 2
  màu), giờ thêm được **bao nhiêu điểm màu tuỳ ý** — click vào thanh gradient
  để thêm điểm, kéo tam giác để đổi vị trí, double-click ô màu để mở đúng
  bảng chọn màu gốc của Photoshop (ô màu chọn sẽ canh giữa hàng, nút Remove
  ghim bên phải).
- **Hàng chờ lệnh**: mọi thao tác gửi sang Photoshop (Sync/Apply/Clear/Copy/
  Paste/Auto-Apply/Auto-Sync) đều chạy tuần tự, không chồng lệnh lên nhau —
  hạn chế Photoshop bị đơ khi anh chỉnh liên tục nhiều control cùng lúc.

## 4. Thứ tự các mục trong panel

Blending Options → Bevel & Emboss → Color Overlay → Stroke → Inner Shadow →
Inner Glow → Satin → Gradient Overlay → Outer Glow → Drop Shadow.

## 5. Đã tái tạo (≈ 85-90% dialog Layer Style)

Blending Options (Blend Mode / Opacity / Fill) · Bevel & Emboss · Stroke
(màu đặc hoặc gradient nhiều màu) · Inner Shadow · Inner Glow · Satin ·
Color Overlay · Gradient Overlay (nhiều màu) · Outer Glow · Drop Shadow.

## 6. Chưa làm (phần khó/rủi ro cao, cố tình bỏ qua)

- **Pattern Overlay** và **Texture** trong Bevel & Emboss: cần đọc danh sách
  pattern preset đang load trong Photoshop, API không ổn định giữa các bản
  Photoshop nên em không đưa vào để tránh làm hỏng cả bộ fx khi Apply.
- **Custom Contour** (đường cong Gloss Contour...): mọi effect đang dùng
  contour mặc định "Linear" của Photoshop (giống trạng thái mặc định khi
  anh mở 1 effect mới trong dialog gốc).
- **Blend If** (2 thanh kéo tách kênh xám dưới cùng dialog Blending Options):
  anh xác nhận không cần nên em không làm, muốn thêm sau thì báo em.

Nếu sau này anh cần thêm phần nào ở trên, cứ nói em làm tiếp nhé.

## 7. Xử lý lỗi thường gặp

**Triệu chứng: dropdown Blend Mode trống, ô màu không lên màu, Sync/Apply bấm
không có phản ứng gì (không nhận layer đang chọn).**

Đây là lỗi thiếu file `lib/CSInterface.js` — panel không kết nối được vào
Photoshop nên toàn bộ giao diện dựng lên "trơ", không có gì hoạt động. Panel
sẽ tự phát hiện và hiện chữ đỏ cảnh báo ngay trên panel
(`⚠ Could not connect to Photoshop...`) thay vì im lặng. Cách sửa: kiểm tra
lại đúng file `CSInterface.js` đã nằm ở `TypoBlend/lib/CSInterface.js`
(ngang hàng với `CSXS` và `client`, **không** để trong `client`) chưa —
copy từ TypoCore của anh qua là được.

**Triệu chứng: bấm Clear không xoá được fx.** Đã sửa ở bản hiện tại — Clear
giờ xoá hẳn property `layerEffects` trước, sau đó còn set tường minh
`enabled:false` cho từng effect (đi cùng cơ chế với Apply) để chắc chắn ăn.

**Cách xem lỗi chi tiết qua Chrome (khi vẫn còn lỗi khác):**
1. Mở panel trong Photoshop như bình thường.
2. Mở trình duyệt Chrome, gõ địa chỉ `http://localhost:8088`.
3. Chrome sẽ liệt kê panel đang chạy → bấm vào để mở DevTools y hệt web
   thường, tab Console sẽ hiện đúng dòng lỗi (đỏ) kèm số dòng trong
   `scripts.js`/`index.html`. Chụp màn hình gửi em là em đọc được ngay.

(Nếu `localhost:8088` không hiện gì, đóng Photoshop rồi mở lại — cổng debug
chỉ có tác dụng sau khi Photoshop load lại extension.)
