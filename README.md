# No Humans Bar

**Chơi ngay:** https://tuanvase140819.github.io/human_no_bar/ (Chrome, Edge, Firefox hoặc Safari 15+ trên máy tính)

Âm thanh tổng hợp bằng WebAudio (không có file nhạc), bấm **M** để tắt hoặc bật.
Trên **macOS**: chuột phải = chạm hai ngón trên trackpad hoặc Ctrl + click; có thể giữ **Shift** để soi và bấm **Space** để bắn.
Màn Retina tự hạ độ phân giải khi khung hình thấp (thêm `?hd` để giữ nguyên). Nút **Toàn màn hình** có ở menu chính và menu tạm dừng.

Game quản lý quán bar + suy luận, góc nhìn thứ nhất, chạy trên trình duyệt. Bạn là gorilla chủ quán,
khách là thú, nhưng một số là người mặc costume. Soi kỹ, hỏi khẽ, chỉ bóp cò khi chắc chắn.

Cách chơi: bấm **Bắt đầu ca làm** rồi **Mở cửa**, trình duyệt sẽ khóa chuột để nhìn quanh. Khách đến quầy và gọi món:
**Q** yêu cầu khách (quay người, đọc khẩu hiệu, trả lời câu hỏi), **chuột phải** giữ để soi, **Tab** mở sổ tay so hồ sơ loài,
**E** phục vụ nếu là thú thật, **2** rút súng và **chuột trái** bắn nếu chắc đó là người. Bắn nhầm thú thật mất tiền và uy tín.

Công nghệ: Vite + TypeScript + Three.js, đồ họa toon có viền, nhân vật dựng và rig bằng Blender (script Python).

## Chạy

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # tsc + vite build -> dist/
```

Tham số địa chỉ hữu ích: `?debug` vào ca ngay (thêm `&intro` để giữ cảnh đặc vụ), `?lineup` xếp 6 loài trước quầy, `?nofx` tắt hậu kỳ, `?nomodels` dùng nhân vật procedural.

## Cốt truyện

Mỗi sáng, **Đặc vụ Lửng** của Cục Kiểm Soát Nhân Loại bước vào quầy trước khi khách tới: ngày 1 kể bối cảnh và luật,
các ngày sau báo cáo hậu quả hôm trước và phản ứng theo lựa chọn của bạn. Xuyên suốt là bí ẩn về **Thợ May**, kẻ may
costume cho người. Ngày 3 một con thỏ run rẩy thì thầm sự thật và bắt bạn chọn hứa báo hay giữ kín; ngày 5 thị trưởng
Gấu ghé thăm (đừng bắn ông ấy); ngày 7 Thợ May xuất hiện cùng một đề nghị, đặc vụ xông vào đứng xem, và quyết định của
bạn dẫn tới một trong hai kết thúc. Lời thoại nằm trong `src/data/story.ts`, bấm **E** để tiếp, **1** / **2** để trả lời.

## Dựng lại model nhân vật bằng Blender

Model glTF trong `public/models/` được sinh từ `tools/blender/build_characters.py` (thân liền bằng Remesh,
armature 20 xương, clip Idle / Walk / Talk). Cần Blender 4.2+ (bản portable đặt trong
`%LOCALAPPDATA%\Programs\Blender` hoặc trỏ biến môi trường `BLENDER` tới `blender.exe`).

```bash
npm run assets            # tất cả loài
npm run assets -- fox     # một loài
```

## Deploy

Push lên nhánh `main` sẽ chạy workflow `.github/workflows/deploy.yml` để build và đưa lên GitHub Pages.

Kế hoạch thiết kế chi tiết: [GAME_PLAN.md](GAME_PLAN.md).
