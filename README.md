# No Humans Bar

**Chơi ngay:** https://tuanvase140819.github.io/human_no_bar/ (Chrome hoặc Edge trên máy tính, cần chuột và bàn phím)

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

Tham số địa chỉ hữu ích: `?debug` vào ca ngay, `?lineup` xếp 6 loài trước quầy, `?nofx` tắt hậu kỳ, `?nomodels` dùng nhân vật procedural.

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
