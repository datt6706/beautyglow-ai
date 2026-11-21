# BeautyGlow AI – Website bán mỹ phẩm có chatbot tư vấn

Đồ án môn Phát triển dự án CNTT – Nhóm 10. Công nghệ: **React (Vite) + Node.js (Express) + MySQL**.

## Cấu trúc
```
database/schema.sql   Tạo CSDL, bảng và dữ liệu mẫu (6 danh mục, 16 sản phẩm)
backend/              API Express (JWT, bcrypt, mysql2)
frontend/             Giao diện React
```

## Chạy dự án
Cần Node.js 18 trở lên (bản LTS) và MySQL 8 (hoặc MariaDB 10.5+).

1. **CSDL**: mở MySQL rồi chạy file `database/schema.sql`
   `mysql -u root -p < database/schema.sql`
2. **Backend**
   ```
   cd backend
   cp .env.example .env      # sửa DB_PASSWORD, JWT_SECRET cho phù hợp
   npm install
   npm run dev               # http://localhost:5000
   ```
   Lần chạy đầu tự tạo tài khoản quản trị: `admin@beautyglow.vn` / `Admin@123` (đổi trong `.env`).
3. **Frontend** (terminal khác)
   ```
   cd frontend
   npm install
   npm run dev               # http://localhost:5173
   ```

## Chatbot AI
- Không có `ANTHROPIC_API_KEY` trong `backend/.env`: chatbot dùng bộ luật dự phòng (nhận diện loại da, vấn đề, ngân sách).
- Có khóa: backend gửi danh mục sản phẩm còn hàng cho Claude và chỉ gợi ý sản phẩm có thật. Khóa chỉ nằm ở backend.
- Lịch sử hỏi đáp lưu ở bảng `chat_logs`.

## Lưu ý
- **OTP**: chưa tích hợp gửi email. Mã được in ra console của backend và (khi chưa đặt `NODE_ENV=production`) hiện trên màn hình OTP. Muốn gửi thật, thêm nodemailer vào hàm `sendOtp` trong `backend/src/index.js`.
- **VNPay**: là lựa chọn mô phỏng, chưa gọi cổng thanh toán thật.
- **Triển khai**: `npm run build` trong `frontend`, phục vụ thư mục `dist` bằng Nginx và proxy `/api` về backend; đặt `NODE_ENV=production`, `JWT_SECRET` mạnh và `CLIENT_URL` đúng tên miền.

## API chính
| Nhóm | Endpoint |
|---|---|
| Xác thực | `POST /api/auth/register, verify-otp, resend-otp, forgot, reset, login` · `GET/PUT /api/auth/me` · `PUT /api/auth/password` |
| Sản phẩm | `GET /api/products?q&category&brand&min&max&skin&sort` · `GET /api/products/:id` · `GET /api/brands` |
| Danh mục | `GET /api/categories` · admin: `POST/PUT/DELETE` |
| Đơn hàng | `POST /api/orders` · `GET /api/orders/mine` · `POST /api/orders/:id/cancel` |
| Quản trị | `GET /api/admin/stats, orders, customers, products` · `PUT /api/admin/orders/:id/status` · `POST/PUT/DELETE /api/products` |
| Chatbot | `POST /api/chat` |
