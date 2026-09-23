# Bài Chắn

[English](README.md) · **Tiếng Việt**

<img src="apps/web/public/tiles/png/3_vanh.png" alt="Tam Văn" width="42"> <img src="apps/web/public/tiles/png/3_vanh.png" alt="Tam Văn" width="42"> &nbsp; <img src="apps/web/public/tiles/png/3_vanh.png" alt="Tam Văn" width="42"> <img src="apps/web/public/tiles/png/3_sach.png" alt="Tam Sách" width="42">

**Chắn:** hai quân giống hệt. **Cạ:** hai quân hợp lệ cùng hàng, khác chất. Xem [luật chơi 120 quân có hình](docs/public-rules.vi.md) hoặc [hướng dẫn trong trò chơi](https://bai-chan-play.white-violet-3211.workers.dev/rules).

Trò chơi web này ghi lại một lối chơi Bài Chắn 120 quân của gia đình tôi. Có thể [chơi trực tuyến](https://bai-chan-play.white-violet-3211.workers.dev/), đọc [trang tư liệu tiếng Việt](https://michaelnguyen.net/baichan-vi.html), hoặc [chia sẻ luật gia đình bạn](https://github.com/mnguyen92646/bai-chan-game/issues/new?template=family-rules-vi.yml).

## Chế độ chơi

- **Luyện tập:** chơi ngay với ba máy; ván hiện tại được lưu trong trình duyệt.
- **Tạo phòng:** mở phòng riêng bốn hoặc năm ghế. Mời người khác bằng liên kết dài; ai có liên kết có thể vào ghế còn trống. Có thể dùng máy để lấp ghế trống sau khi có ít nhất hai người kết nối.
- **Vào lại:** làm mới trang vẫn nhận lại ghế trên thiết bị đó bằng mã riêng của phòng. Người chơi mất kết nối giữ ghế để quay lại; người mới chỉ thay máy giữa các ván.

## Chạy trên máy của bạn

Cần Node.js 20 trở lên. Từ thư mục gốc của kho mã nguồn:

```bash
npm install
npm run dev -w apps/server
# Mở terminal khác:
npm run dev -w apps/web
```

Mở `http://localhost:3000`. Nếu thử trên thiết bị khác trong cùng mạng, mở địa chỉ mạng của máy phát triển và cấu hình `CORS_ORIGINS` cùng `DEV_ALLOWED_ORIGINS` khi cần. Biến `NEXT_PUBLIC_SERVER_URL` chỉ đến máy chủ trò chơi nếu nó không cùng địa chỉ suy ra từ trang web.

## Cấu trúc và đóng góp

- `packages/game`: luật, trạng thái ván, máy chơi và kiểm thử.
- `apps/web`: giao diện, luyện tập và hình quân bài.
- `apps/edge`: phòng riêng và lưu trạng thái trên Cloudflare Workers.
- `apps/server`: máy chủ Express/Socket.IO để phát triển tại chỗ.

Vui lòng mở issue trước khi đề xuất thay đổi luật lớn; nêu ví dụ một tay bài hoặc lượt chơi cụ thể. Khi sửa luật, cập nhật kiểm thử, giao diện tiếng Anh/Việt, [hai bản luật công khai](docs/public-rules.vi.md) và hai trang web. Dữ liệu bảng hỏi gia đình và nhật ký riêng tư không nằm trong kho công khai. Xem [hướng dẫn đóng góp](CONTRIBUTING.md).

## Giấy phép

Mã nguồn và tài liệu theo giấy phép MIT. Hình quân bài và âm thanh không thuộc giấy phép MIT; xem [LICENSE](LICENSE) và [quyền sử dụng media](MEDIA_RIGHTS.md) trước khi dùng lại.
