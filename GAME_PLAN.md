# Kế hoạch thiết kế game — "No Humans Bar" (tên tạm)

> Bản clone lấy cảm hứng từ _Animaly Bar: NO HUMANITY!_ (Domnaier, Steam 2026).
> Không dùng tên, logo, asset gốc. Toàn bộ art, tên món, tên loài tự thiết kế.
> Phiên bản 0.1 · 30/09/2026 · Trạng thái: chờ duyệt trước khi code.

---

## 1. Tổng quan

| Hạng mục           | Quyết định                                                                  |
| ------------------ | --------------------------------------------------------------------------- |
| Thể loại           | Quản lý quán bar + suy luận (deduction) + sinh tồn ban đêm                  |
| Góc nhìn           | Thứ nhất (FPS), người chơi là gorilla bartender                             |
| Nền tảng           | Trình duyệt desktop (Chrome/Edge), chuột + bàn phím                         |
| Công nghệ          | Vite + TypeScript + Three.js, UI overlay HTML/CSS                           |
| Phong cách         | 3D low-poly, toon shading, hài đen                                          |
| Thời lượng một ván | Chiến dịch 7 ngày, mỗi ngày 6–8 phút thật                                   |
| Cảm giác cốt lõi   | "Papers, Please" gặp "Five Nights at Freddy's" trong một quán bar hoạt hình |

**Bối cảnh:** Động vật thắng cuộc chiến với loài người. Thành phố cấm người. Một số người sống sót mặc costume thú để lẻn vào quán uống rượu, do thám và cướp kho ban đêm. Bạn là gorilla chủ quán, vừa pha chế vừa lọc khách. Bắn nhầm thú thật thì mất tiền, mất uy tín. Bỏ sót người thì đêm đó chúng dẫn đồng bọn quay lại.

**Điều kiện thắng:** sống sót hết ngày 7 với tiền > 0.
**Điều kiện thua:** tiền âm sau tổng kết ngày · uy tín về 0 · bị hạ gục trong đêm.

---

## 2. Gameplay

### 2.1 Vòng lặp một ngày

```
Sáng (chuẩn bị)  →  Mở cửa (phục vụ + lọc khách)  →  Đóng cửa  →  Đêm (phòng thủ)  →  Tổng kết  →  Nâng cấp
   60 giây                 4–5 phút                              90 giây             bảng điểm     cửa hàng
```

**Sáng:** đọc tin tức (gợi ý tỷ lệ người hôm nay, sự kiện đặc biệt), nhập nguyên liệu và đạn, dọn quán nếu tối qua bị phá.

**Mở cửa:** khách vào từng người một, đứng ở quầy. Với mỗi khách người chơi làm theo thứ tự tự do:

1. Nghe khách gọi món (hộp thoại + giọng loài).
2. Quan sát: zoom, yêu cầu khách quay người, hỏi khẩu hiệu, dùng công cụ (UV, scanner, cân).
3. Pha chế món.
4. Ra quyết định: **phục vụ** (khách trả tiền, rời quán) hoặc **bắn**.

**Đóng cửa:** khi hết giờ hoặc hết khách. Người chơi được 20 giây chốt cửa sổ, đặt bẫy trước khi đêm bắt đầu.

**Đêm:** phòng thủ theo đợt (mục 2.5).

**Tổng kết:** doanh thu, chi phí, số người bắt đúng, số bắn nhầm, số người lọt, thiệt hại đêm, thay đổi uy tín.

### 2.2 Khách hàng và manh mối (hệ thống trung tâm)

**Loài trong bản đầu (6):** Gấu, Cáo, Thỏ, Lợn rừng, Sói, Hươu. Mỗi loài có một "hồ sơ chuẩn" ghi trong sổ tay người chơi:

| Loài     | Màu lông        | Tai            | Đuôi           | Món ưa thích | Khẩu hiệu           | Câu hỏi kiểm tra      |
| -------- | --------------- | -------------- | -------------- | ------------ | ------------------- | --------------------- |
| Gấu      | nâu đậm         | tròn nhỏ       | cụt            | Mật ong đá   | "Rừng là nhà"       | "Ngủ đông tháng mấy?" |
| Cáo      | cam, ngực trắng | nhọn, đen chóp | xù, chóp trắng | Rượu dâu     | "Khôn hơn người"    | "Săn lúc nào?"        |
| Thỏ      | trắng / xám     | dài đứng       | bông tròn      | Nước cà rốt  | "Nhảy cho tự do"    | "Mấy con một lứa?"    |
| Lợn rừng | xám nâu         | nhỏ, vểnh      | ngắn thẳng     | Bia sồi      | "Húc trước hỏi sau" | "Nanh dài bao nhiêu?" |
| Sói      | xám bạc         | nhọn thẳng     | dài rủ         | Rượu trăng   | "Bầy trên hết"      | "Hú khi nào?"         |
| Hươu     | nâu vàng, đốm   | to, hướng bên  | ngắn trắng     | Trà lá       | "Chạy không ngoảnh" | "Rụng gạc mùa nào?"   |

**Người giả dạng** = hồ sơ một loài + từ 1 đến 3 lỗi (manh mối). Manh mối chia 3 tầng:

| Tầng     | Manh mối                         | Cách phát hiện            | Ngày xuất hiện |
| -------- | -------------------------------- | ------------------------- | -------------- |
| Thị giác | Khóa kéo sau lưng                | Yêu cầu quay người        | 1              |
| Thị giác | Tai lệch / một tai rơi           | Nhìn thẳng                | 1              |
| Thị giác | Màu lông sai loài                | So sổ tay                 | 1              |
| Thị giác | 5 ngón tay người lộ khi cầm ly   | Zoom lúc khách uống       | 2              |
| Thị giác | Giày người lộ dưới chân          | Zoom xuống                | 2              |
| Thị giác | Mắt nhựa không chớp              | Nhìn lâu 3 giây           | 3              |
| Hành vi  | Gọi sai món đặc trưng            | Nghe order                | 1              |
| Hành vi  | Đọc sai khẩu hiệu                | Hỏi khẩu hiệu             | 2              |
| Hành vi  | Trả lời sai câu hỏi loài         | Hỏi kiểm tra              | 3              |
| Hành vi  | Không phản ứng tiếng loài        | Bấm còi loài              | 4              |
| Ẩn       | Thẻ ID: tem giả, ngày sinh vô lý | Máy scan (nâng cấp)       | 4              |
| Ẩn       | Keo dán costume phát sáng        | Đèn UV (nâng cấp)         | 5              |
| Ẩn       | Cân nặng thấp hơn loài           | Cân ở sàn quầy (nâng cấp) | 5              |
| Ẩn       | Đổ mồ hôi, thở dốc               | Particle nhỏ, khó thấy    | 6              |

**Bẫy ngược (thú thật nhưng lạ):** cáo bị băng bó, gấu bạc lông vì già, thỏ đeo kính. Chúng có đúng 1 điểm lạ nhưng không nằm trong danh sách manh mối. Mục đích: ép người chơi cần ≥ 2 manh mối thật mới bắn. Xuất hiện từ ngày 2.

**Sinh khách theo ngày:**

| Ngày | Số khách | Tỷ lệ người | Manh mối tối thiểu / người | Bẫy ngược |
| ---- | -------- | ----------- | -------------------------- | --------- |
| 1    | 8        | 15%         | 3                          | 0         |
| 2    | 10       | 20%         | 3                          | 1         |
| 3    | 12       | 25%         | 2                          | 1         |
| 4    | 12       | 30%         | 2                          | 2         |
| 5    | 14       | 30%         | 2                          | 2         |
| 6    | 14       | 35%         | 1                          | 3         |
| 7    | 16       | 40%         | 1                          | 3         |

**Hậu quả quyết định:**

| Tình huống           | Tiền                       | Uy tín                        | Khác                            |
| -------------------- | -------------------------- | ----------------------------- | ------------------------------- |
| Bắn đúng người       | +$60 tiền thưởng thành phố | +5                            | Costume rơi, lộ người bên trong |
| Bắn nhầm thú         | −$150 bồi thường           | −20                           | 2 khách kế tiếp bỏ về           |
| Phục vụ người (lọt)  | +tiền món                  | −10 (lộ sáng hôm sau qua tin) | +1 đợt tấn công đêm             |
| Phục vụ thú đúng món | +tiền món                  | +1                            | —                               |
| Phục vụ sai món      | +50% tiền món              | −2                            | —                               |

### 2.3 Pha chế

Menu 8 món. Mỗi món là công thức 3–4 bước, thực hiện bằng cách click prop trên quầy 3D theo đúng thứ tự.

| Món          | Ly       | Nguyên liệu 1 | Nguyên liệu 2 | Thao tác cuối           |
| ------------ | -------- | ------------- | ------------- | ----------------------- |
| Mật ong đá   | Cốc thấp | Mật ong       | Đá            | Khuấy                   |
| Rượu dâu     | Ly cao   | Rượu nền      | Siro dâu      | Lắc                     |
| Nước cà rốt  | Ly cao   | Cà rốt ép     | Đá            | Không                   |
| Bia sồi      | Vại      | Bia           | —             | Rót nghiêng (giữ chuột) |
| Rượu trăng   | Cốc thấp | Rượu nền      | Bạc hà        | Lắc                     |
| Trà lá       | Tách     | Trà           | Nước nóng     | Khuấy                   |
| Hỗn hợp rừng | Ly cao   | Rượu nền      | Mật ong       | Lắc + topping lá        |
| Nước lã      | Cốc thấp | Nước          | —             | Không                   |

Quy tắc: sai một bước thì món thành "hỏng", khách vẫn nhận nhưng trả nửa tiền. Nguyên liệu trừ tồn kho. Hết nguyên liệu thì món bị gạch trên menu và khách gọi món đó sẽ đổi món hoặc bỏ về. Tab mở bảng công thức.

Người giả có 60% xác suất gọi sai "món đặc trưng" của loài đang giả. Đây là manh mối rẻ nhất nhưng không đủ để bắn một mình.

### 2.3b Tồn kho đồ uống (đã làm 02/10/2026, theo yêu cầu "hết nước thì đặt hàng rồi châm")

Tám bình rót trên quầy sau, mỗi bình tối đa 8 ly, bắt đầu 3 ly, không tự nạp lại qua đêm. Mức nước trong bình là tồn kho thật; bảng menu gạch đỏ món đã hết. Khách gọi món hết hàng đứng đợi và kiên nhẫn vẫn trôi; bấm E phục vụ thì báo hết. Phím **R** mở menu đặt hàng (thùng 6 ly, giá 2,5 lần giá ly, giao sau 20 giây thật), thùng xuất hiện dưới sàn cạnh cửa kho; nhìn thùng bấm **E** để vác (không rút súng được khi đang vác), nhìn đúng bình và **giữ E** 2 giây để châm (có tiếng rót, mức nước dâng). Chi phí nhập hàng hiện ở tổng kết ngày. Mã: `src/systems/Inventory.ts`, phần tương tác trong `Game.ts` (updateFocus / updateFilling / openOrderMenu), bình và thùng trong `Bar.ts`.

### 2.4 Quản lý quán

| Chỉ số  | Khoảng             | Tác động                                                   |
| ------- | ------------------ | ---------------------------------------------------------- |
| Tiền    | có thể âm          | Âm sau tổng kết = thua                                     |
| Uy tín  | 0–100, khởi đầu 50 | Quyết định số khách/ngày (±30%) và giá bán (±20%)          |
| Vệ sinh | 0–100              | Dưới 40: mỗi khách có 20% bỏ về. Lau sàn / dọn ly phục hồi |
| Tồn kho | theo nguyên liệu   | Nhập buổi sáng, giá tăng 5% mỗi ngày                       |
| Đạn     | bắt đầu 6          | $15/viên, dùng cả ngày và đêm                              |

**Cửa hàng nâng cấp (mở sau tổng kết):**

| Nâng cấp         | Giá      | Hiệu quả                                 |
| ---------------- | -------- | ---------------------------------------- |
| Đèn UV cầm tay   | $200     | Lộ keo dán costume                       |
| Máy scan ID      | $300     | Đọc thẻ, lộ tem giả                      |
| Cân sàn quầy     | $150     | Hiện cân nặng khách                      |
| Còi loài         | $100     | Phát tiếng 6 loài để test phản xạ        |
| Chốt cửa gia cố  | $250     | Cửa chịu thêm 2 đòn phá                  |
| Bẫy kẹp          | $80/cái  | Làm chậm kẻ xâm nhập 4 giây              |
| Camera kho       | $350     | Xem góc kho trên màn hình ở quầy ban đêm |
| Thuê bảo vệ nhím | $120/đêm | Chặn 1 kẻ xâm nhập mỗi đêm               |

### 2.5 Đêm phòng thủ

Người chơi ở lại trong quán tối, cầm súng và đèn pin. Kẻ xâm nhập (người, không hóa trang) đến theo đợt qua 3 điểm: cửa chính, cửa sau kho, cửa sổ trái.

| Yếu tố                | Thiết kế                                                      |
| --------------------- | ------------------------------------------------------------- |
| Số đợt cơ bản         | Ngày 1–2: 1 đợt · Ngày 3–5: 2 đợt · Ngày 6–7: 3 đợt           |
| Đợt cộng thêm         | +1 cho mỗi người lọt ban ngày                                 |
| Mỗi đợt               | 1–3 kẻ xâm nhập, chọn ngẫu nhiên điểm vào                     |
| Thời gian phá cửa     | 8 giây cửa thường, 14 giây cửa gia cố                         |
| Tín hiệu              | Tiếng gõ, bóng đen qua cửa sổ, tay nắm cửa lắc                |
| Cách chặn             | Giữ E để chốt lại (3 giây), hoặc bắn khi cửa mở               |
| Thiệt hại nếu lọt vào | Mỗi kẻ vào lấy 20% một loại nguyên liệu và bỏ chạy sau 6 giây |
| Bị áp sát             | 2 lần bị đánh = hạ gục = thua ván                             |

Bản đầu giữ đêm ngắn (90 giây) và dễ đọc. Nếu người chơi lọc ban ngày tốt thì đêm gần như yên tĩnh, đó là phần thưởng.

### 2.6 Sự kiện đặc biệt

| Ngày | Sự kiện                    | Ảnh hưởng                                            |
| ---- | -------------------------- | ---------------------------------------------------- |
| 3    | Thanh tra vệ sinh          | Vệ sinh < 60 lúc thanh tra đến: phạt $100            |
| 4    | Cúp điện 60 giây giữa ngày | Chỉ soi được bằng đèn pin, người giả tranh thủ vào   |
| 5    | Khách VIP (thị trưởng gấu) | Phục vụ đúng: +$200, +10 uy tín. Bắn nhầm: thua ngay |
| 6    | Lễ hội "Ngày chiến thắng"  | Khách gấp rưỡi, người giả gấp đôi                    |
| 7    | Đêm cuối                   | 3 đợt lớn, có kẻ dùng xà beng phá nhanh gấp đôi      |

### 2.6b Cốt truyện: Đặc vụ Lửng và Thợ May (đã làm 02/10/2026)

Đặc vụ Lửng (lửng mặt trắng sọc đen, áo khoác dài, mũ phớt, kính đen, "Cục Kiểm Soát Nhân Loại") ghé quầy mỗi sáng trước khách; đồng hồ dừng, bấm E / chuột trái để tiếp lời. Bí ẩn xuyên suốt là **Thợ May**, kẻ may costume cho người. Ba khách cốt truyện chen vào hàng chờ giữa ngày:

| Ngày | Sự kiện                                                                                                                                                                     |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Đặc vụ kể bối cảnh, luật thưởng phạt, cách soi, nhắc tới Thợ May                                                                                                            |
| 2    | Đặc vụ ra lệnh: khách nào nhắc Thợ May phải báo                                                                                                                             |
| 3    | **Thỏ run rẩy** (thú thật) thì thầm: Thợ May may cho người muốn trốn, có trẻ con; Lửng chỉ cần chỉ tiêu. Người chơi chọn **hứa báo** hoặc **giữ kín**, rồi thỏ gọi món bình thường |
| 4    | Đặc vụ phản ứng theo lựa chọn ngày 3 (khen, nghi ngờ nói dối, hoặc trách nếu đã bắn chỉ điểm)                                                                              |
| 5    | **Thị trưởng Gấu** (thú thật, ba đời) tiết lộ Cục thiếu chỉ tiêu "30 cái đầu". Phục vụ: +$200, +10 uy tín. Bắn: thua ngay                                                   |
| 6    | Đặc vụ ép "nghi là bắn", hứa ký giấy; nhắc nếu thị trưởng đã khen người chơi                                                                                                |
| 7    | **Thợ May** (chồn đeo kính, người thật, costume không một sơ hở) đề nghị để 12 người trốn qua kho, để lại $500. Đặc vụ xông vào, đứng cạnh quầy: bắn (+$300, huy chương) hoặc phục vụ |

Hai kết thúc hiển thị ở màn kết quả: **Quán vẫn là quán** (để Thợ May đi) và **Trạm Kiểm Soát số 7** (nộp Thợ May); kết thúc trung tính nếu Thợ May không kịp tới. Toàn bộ lời thoại và cờ cốt truyện nằm trong `src/data/story.ts`; luồng ở `Game.ts` (startLines / offerChoice / startFinale / agentEpilogue). Kiểm thử nhanh: `?debug&day=3&storyfirst`, `?debug&day=5&storyfirst`, `?debug&day=7&storyfirst` (thêm `&shoot` cho nhánh bắn).

### 2.7 Điều khiển

| Phím             | Hành động                                                                  |
| ---------------- | -------------------------------------------------------------------------- |
| Chuột            | Nhìn (pointer lock)                                                        |
| W A S D          | Di chuyển trong khu vực sau quầy                                           |
| Chuột phải (giữ) | Zoom soi khách                                                             |
| Chuột trái       | Tương tác prop / bắn khi cầm súng                                          |
| E                | Tương tác (chốt cửa, nhặt)                                                 |
| 1 2 3 4          | Tay không / Súng / Đèn UV / Scanner                                        |
| Q                | Menu yêu cầu khách: quay người, đọc khẩu hiệu, trả lời câu hỏi, cho xem ID |
| Tab              | Sổ tay: hồ sơ loài, công thức, ghi chú ngày                                |
| F                | Đèn pin (đêm)                                                              |
| Esc              | Pause                                                                      |

### 2.8 HUD và thông tin

- Góc trên trái: đồng hồ trong ngày, số ngày.
- Góc trên phải: tiền, uy tín, vệ sinh (3 thanh nhỏ).
- Góc dưới phải: đạn, công cụ đang cầm.
- Giữa dưới: hộp thoại khách, gợi ý phím.
- Đồng hồ và bảng menu còn hiện dạng vật thể 3D trong quán (diegetic) để bớt HUD.

---

## 3. Đồ họa

### 3.1 Định hướng nghệ thuật

**Từ khóa:** ấm áp bề ngoài, bất an bên trong. Ban ngày quán bar màu gỗ, đèn vàng, khách thú dễ thương. Ban đêm cùng không gian đó ngả xanh tím, chỉ còn đèn pin.

**Phong cách:** low-poly, tô màu phẳng, viền đen mảnh kiểu toon. Tham chiếu về hình khối: _Untitled Goose Game_, bộ asset Kenney, _A Short Hike_. Tham chiếu về không khí: _Papers, Please_ (áp lực trên bàn làm việc), _Five Nights at Freddy's_ (đêm).

**Tỷ lệ nhân vật:** đầu to khoảng 1.3 lần tỷ lệ thật, thân ngắn, tay dài. Lý do: manh mối nằm ở tai, mắt, tay nên đầu và tay cần chiếm nhiều pixel.

**Bảng màu:**

| Vai trò            | Màu              |
| ------------------ | ---------------- |
| Gỗ quán, quầy      | #8B5A2B, #A9714B |
| Đèn ban ngày       | #FFD27F          |
| Tường              | #E8D9C0          |
| Đêm nền            | #1B1F3B          |
| Đèn pin            | #FFF4D6          |
| Điểm nhấn cảnh báo | #E63946          |
| UV                 | #7A4DFF          |

### 3.2 Nhân vật

**Giai đoạn A (procedural, không cần asset):** mỗi loài là một hàm dựng từ khối cơ bản của Three.js (Box, Sphere, Cylinder, Capsule), nhận tham số màu lông, hình tai, hình đuôi, mõm. Người giả dùng cùng hàm đó rồi gắn thêm "module lỗi": mesh khóa kéo ở lưng, tai xoay lệch 25°, bàn tay 5 ngón thay tay 4 ngón, giày dưới chân, mắt không có animation chớp.

Ưu điểm: manh mối sinh hoàn toàn bằng code, dễ cân bằng, không phụ thuộc ai vẽ. Đây là giai đoạn dùng để chốt gameplay.

**Giai đoạn B (asset CC0):** thay khối bằng model glTF miễn phí bản quyền, ưu tiên gói động vật low-poly có sẵn animation của Quaternius và gói nhân vật của Kenney. Manh mối gắn vào xương (khóa kéo vào xương sống, tai vào xương đầu). Giữ nguyên toàn bộ logic từ giai đoạn A.

> **Cập nhật 01/10/2026:** các gói động vật CC0 kể trên đều là thú bốn chân, không hợp với khách đứng hai chân trong costume và không gắn được manh mối. Thay vào đó đã nâng giai đoạn A lên "procedural chi tiết": tay chân có khớp vung khi đi, mõm riêng từng loài, mắt có mống màu và điểm sáng, lông mày, má, răng cửa, phụ kiện ngẫu nhiên (nơ, khăn, dải băng chéo, dây đeo, mũ quả dưa, mũ nồi). Xem bằng `?lineup`.
>
> **Giai đoạn B thực tế (cùng ngày):** thân nhân vật được dựng bằng Blender qua script `tools/blender/build_characters.py` (ghép khối → Remesh voxel → Smooth → Decimate thành một lưới liền, armature 20 xương với trọng số tự động, clip Idle / Walk / Talk, mặt nạ vùng màu bằng vertex color để game trộn bụng / mảng mặt / mõm mượt). Mắt có mí chớp, miệng cười, lông mày, phụ kiện và các manh mối vẫn do game gắn vào xương lúc chạy. Đầu khách quay theo người chơi. Model nằm ở `public/models/*.glb`, dựng lại bằng `npm run assets`.
>
> **Đợt nâng 02/10/2026:** đầu có gò trán, gò má, cằm; tay chân dày mỏng theo loài, hươu và lợn rừng móng guốc, thỏ bàn chân dài, cáo và sói có yếm lông ngực, lợn rừng bờm gai; bóng tiếp xúc (AO) nướng vào thuộc tính `_AO` trên đỉnh và nhân vào màu trong shader; thêm clip Wave (vẫy chào khi tới quầy) và Drink (nâng ly uống khi được phục vụ, ly đặt trước miệng theo đầu, màu theo món).

**Người bên trong costume:** một mesh người đơn giản, da xám xịt, mặc đồ rách. Chỉ xuất hiện 2 giây khi costume rơi sau khi bị bắn đúng, và trong đêm.

**Gorilla người chơi:** chỉ thấy hai bàn tay đen lông ở góc dưới màn hình, cầm ly, súng, đèn. Không cần model toàn thân.

**Animation:**

| Trạng thái  | Giai đoạn A (tween code)                | Giai đoạn B (clip glTF)   |
| ----------- | --------------------------------------- | ------------------------- |
| Đi vào / ra | Trượt + nhấp nhô                        | Walk                      |
| Đứng chờ    | Thở (scale Y ±2%)                       | Idle                      |
| Nói         | Đầu gật nhẹ, mõm mở                     | Talk hoặc Idle + mõm code |
| Uống        | Tay nâng ly, đầu ngửa                   | Custom từ Idle            |
| Quay người  | Xoay 180° trong 1 giây                  | Xoay root                 |
| Hoảng sợ    | Rung + lùi                              | Hit                       |
| Bị bắn      | Costume rơi (mesh tách), người ngã cứng | Death                     |

### 3.3 Môi trường

Một phòng duy nhất, kích thước khoảng 12 × 8 m, trần 3.5 m.

- Quầy bar chữ L ở giữa phải, người chơi đứng phía trong.
- Kệ rượu 3 tầng sau lưng, chai làm bằng trụ nhiều màu.
- 4 bàn tròn, 12 ghế cho khách ngồi nền (không tương tác, chỉ tạo không khí).
- Cửa chính (trước), cửa kho (sau), 2 cửa sổ (trái).
- Bảng menu phấn, poster tuyên truyền "KHÔNG NGƯỜI", đồng hồ tường, đầu hươu giả trang trí.
- Kho nhỏ sau cửa kho: thùng, kệ, nơi bị cướp ban đêm.

Dựng modular: tường, sàn, đồ nội thất từ khối hoặc từ gói nội thất Kenney. Prop tương tác có viền sáng khi rê chuột.

### 3.4 Ánh sáng

| Thời điểm            | Nguồn sáng                                                       | Ghi chú                                         |
| -------------------- | ---------------------------------------------------------------- | ----------------------------------------------- |
| Sáng                 | DirectionalLight qua cửa sổ, góc thấp, ấm + HemisphereLight      | Shadow map 2048 cho nguồn chính                 |
| Trưa → chiều         | Directional xoay dần theo đồng hồ, chuyển sang cam               | Lerp màu theo giờ trong ngày                    |
| Hoàng hôn (đóng cửa) | Đèn treo PointLight vàng bật lên, trời tím                       | 20 giây chuyển cảnh                             |
| Đêm                  | Chỉ ambient rất yếu xanh tím + SpotLight đèn pin gắn camera      | Fog nhẹ, bật vignette                           |
| Bắn                  | PointLight trắng flash 80 ms                                     |                                                 |
| Đèn UV               | SpotLight tím, vật liệu "keo" chuyển emissive khi trong hình nón | Kiểm tra bằng góc giữa hướng đèn và vị trí mesh |

### 3.5 Camera và hậu kỳ

- FOV 70°, zoom soi xuống 30° với chuyển động mượt 0.2 giây.
- Khi soi, camera khóa mục tiêu vào khách; người chơi yêu cầu khách quay thay vì tự đi vòng.
- Head-bob biên độ nhỏ khi đi, tắt khi zoom.
- Hậu kỳ: viền toon (kỹ thuật inverted hull cho nhân vật, OutlinePass cho prop), bloom nhẹ cho đèn, vignette và nhiễu hạt ban đêm. Có công tắc tắt toàn bộ hậu kỳ cho máy yếu.

### 3.6 Hiệu ứng

| Sự kiện              | Hiệu ứng                                                                                              |
| -------------------- | ----------------------------------------------------------------------------------------------------- |
| Bắn                  | Muzzle flash sprite, vỏ đạn văng, giật camera, lỗ đạn decal trên tường                                |
| Bắn đúng người       | Costume nứt rồi rơi thành 3–4 mảnh, người ngã, hiện huy hiệu "+$60"                                   |
| Bắn nhầm thú         | Lông bay như confetti, khách xung quanh hoảng, màn hình đỏ viền 1 giây. Không máu để giữ tông hài đen |
| Pha chế              | Khói khi rót nóng, bọt bia, giọt đá                                                                   |
| Mồ hôi (manh mối ẩn) | Particle nhỏ ở trán, rơi chậm                                                                         |
| Đêm: cửa bị phá      | Cửa rung, dăm gỗ bay, âm thanh gõ tăng dần                                                            |
| Cúp điện             | Tắt toàn bộ đèn trong 0.3 giây, tiếng rè                                                              |

### 3.7 UI

- Overlay HTML/CSS, font tròn kiểu hoạt hình, nền bán trong màu gỗ tối.
- Hộp thoại khách kiểu bong bóng, có chân dung 3D render nhỏ ở góc.
- Sổ tay dạng hai trang giấy, hồ sơ loài bên trái, ghi chú ngày bên phải.
- Bảng tổng kết ngày dạng hóa đơn in nhiệt, chữ đánh máy.
- Màn hình chính: quán nhìn từ cửa vào, đèn nhấp nháy, tiêu đề neon.

### 3.8 Âm thanh (ghi ngắn để đủ kế hoạch)

- Ngày: jazz lo-fi vòng lặp, tiếng ly, tiếng khách rì rầm.
- Đêm: drone trầm, tiếng gió, tim đập khi cửa sắp vỡ.
- Mỗi loài một tiếng kêu ngắn, vừa tạo cá tính vừa là manh mối (người giả bắt chước lệch tông).
- Nguồn: freesound và Kenney Audio, giấy phép CC0.

> **Đã làm 02/10/2026 (không cần file):** `src/core/Audio.ts` tổng hợp mọi âm thanh bằng WebAudio: súng, chuông và kẹt cửa, bước chân theo khoảng cách, ly chạm, tiền, chữ chạy, tiếng ngã, và nhạc nền lo-fi jazz tự sinh (vòng hợp âm Dm9 G13 Cmaj9 Am9 ở 84 BPM, trống swing, giai điệu thưa, rè đĩa than). Phím M tắt / bật, lưu trong localStorage. Tiếng kêu từng loài và âm thanh đêm còn chờ M3 / M5.

---

## 4. Kỹ thuật

| Thành phần      | Lựa chọn                                                                       | Lý do                                                             |
| --------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Build           | Vite + TypeScript                                                              | Nhanh, quen thuộc                                                 |
| Render          | Three.js                                                                       | Chạy và kiểm tra được trong trình duyệt ngay trong phiên làm việc |
| Va chạm         | AABB đơn giản + raycast                                                        | Không cần physics engine cho phạm vi này                          |
| Animation code  | Tween tự viết hoặc GSAP                                                        | Nhẹ                                                               |
| Âm thanh        | Howler.js                                                                      | Quản lý loop và fade dễ                                           |
| UI              | HTML/CSS thuần                                                                 | Tách khỏi vòng render, dễ chỉnh. Có thể đổi sang Vue nếu bạn muốn |
| Trạng thái game | State machine: Boot → Menu → Morning → Open → Closing → Night → Summary → Shop | Mỗi state có enter/update/exit                                    |
| Dữ liệu         | JSON: species, drinks, clues, difficulty, events                               | Cân bằng không cần sửa code                                       |
| Lưu game        | localStorage sau mỗi tổng kết ngày                                             |                                                                   |
| Hiệu năng       | Mục tiêu 60 fps trên GPU tích hợp, dưới 60k tam giác toàn cảnh                 |                                                                   |

Cấu trúc thư mục dự kiến:

```
animaly-bar-clone/
  index.html
  src/
    main.ts
    core/        loop, state machine, input, audio
    render/      scene, lights, camera, postfx
    world/       bar geometry, props, doors
    characters/  species templates, clue modules, customer factory
    systems/     customers, drinks, economy, night, events
    ui/          hud, dialog, journal, summary, shop
    data/        *.json
  public/
    models/      glTF (giai đoạn B)
    audio/
```

---

## 5. Lộ trình

| Mốc           | Nội dung                                                                                                   | Kết quả kiểm tra được                   |
| ------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| M0 Khung      | Scene quán, camera FPS, đèn ngày, 1 khách đi vào và ra, HUD tiền/giờ                                       | Mở trình duyệt thấy quán và đi lại được |
| M1 Lọc khách  | 6 loài procedural, 6 manh mối tầng thị giác + hành vi, zoom, yêu cầu quay, hỏi khẩu hiệu, bắn, thưởng phạt | Chơi được 1 ngày, phân biệt được người  |
| M2 Quán       | 8 món pha chế, tồn kho, vệ sinh, uy tín, tổng kết ngày, cửa hàng, chuỗi 7 ngày                             | Chơi hết chiến dịch không có đêm        |
| M3 Đêm        | Phòng thủ 3 điểm vào, đợt tấn công, chốt cửa, đèn pin, thua/thắng đêm                                      | Vòng lặp ngày đêm hoàn chỉnh            |
| M4 Đồ họa     | Asset CC0, toon outline, hậu kỳ, VFX, animation, chuyển cảnh ánh sáng                                      | Nhìn giống bản demo hoàn chỉnh          |
| M5 Hoàn thiện | Menu chính, âm thanh, sự kiện đặc biệt, cân bằng, save, hướng dẫn                                          | Đưa người khác chơi thử được            |

Mỗi mốc kết thúc bằng chạy thử trên trình duyệt headless để chụp màn hình và kiểm tra lỗi console trước khi báo xong.

---

## 6. Câu hỏi cần bạn chốt trước khi code

1. **Mức bạo lực:** giữ phong cách lông bay như confetti, hay có máu?
2. **UI:** HTML/CSS thuần hay dùng Vue cho overlay?
3. **Số ngày chiến dịch:** 7 ngày như kế hoạch, hay ngắn hơn cho bản đầu?
4. **Tên game và tên loài:** dùng tạm như trên hay bạn muốn đặt lại?
5. **Ưu tiên:** làm M0 → M3 với đồ họa khối trước rồi mới đẹp hóa (khuyên dùng), hay dựng đồ họa đẹp ngay từ M0?
