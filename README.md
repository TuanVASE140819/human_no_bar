# No Humans Bar

Game quản lý quán bar + suy luận, góc nhìn thứ nhất, chạy trên trình duyệt. Bạn là gorilla chủ quán,
khách là thú, nhưng một số là người mặc costume. Soi kỹ, hỏi khẽ, chỉ bóp cò khi chắc chắn.

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
