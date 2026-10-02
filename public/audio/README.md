# Nhạc nền riêng

Mặc định, nhạc trong quán là video YouTube nhúng chính thức ("Phép Màu" · Tuấn Kiệt Saxophone cover, cấu hình
`JUKEBOX` trong `src/data/music.ts`). Khi không nhúng được (mất mạng, video chặn nhúng, hoặc `?nojukebox`),
Vịt Sax thổi bản ballad **"Đêm Không Người"** được tổng hợp bằng WebAudio (giai điệu trong `src/data/music.ts`).

Muốn vịt chơi một bản thu thật thay cho bản tổng hợp, chép file vào đây với tên **`ballad.mp3`**, **`ballad.ogg`**
hoặc **`ballad.wav`**. Game tự phát lặp, và vịt gật đầu theo nhịp đo từ âm thanh. Muốn file này ưu tiên hơn YouTube,
đặt `JUKEBOX.videoId = ''`.

**Chỉ dùng bản thu bạn có quyền sử dụng**: tự thu, mua bản quyền, hoặc được nghệ sĩ cho phép bằng văn bản.
Tải nhạc từ YouTube về rồi đưa lên trang web công khai là vi phạm bản quyền và điều khoản YouTube.
File `*.mp3`, `*.ogg`, `*.wav` trong thư mục này được `.gitignore` bỏ qua để không vô tình đưa lên repo công khai;
khi đã có quyền phát hành, xóa dòng tương ứng trong `.gitignore` rồi commit.
