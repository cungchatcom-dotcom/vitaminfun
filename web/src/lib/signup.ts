/**
 * Máy chủ này có cho người lạ tự mở tài khoản không.
 *
 * MỘT BIẾN cho cả hai phía: `ALLOW_SELF_SIGNUP` trong `.env` ở gốc repo. API
 * đọc nó qua `settings.allow_self_signup` và từ chối thẳng `POST /auth/signup`
 * khi tắt; web đọc chính biến ấy để giấu nút Đăng ký và đóng trang `/signup`.
 *
 * KHÔNG dùng `NEXT_PUBLIC_*`: biến `NEXT_PUBLIC_` bị nướng vào bản dựng, nên
 * tắt chức năng này sẽ phải build lại toàn bộ web thay vì sửa một dòng `.env`
 * rồi khởi động lại. Hàm này chỉ chạy ở phía server (Server Component và route
 * handler), nơi `process.env` được đọc tại thời điểm có request.
 *
 * Mặc định BẬT khi biến vắng mặt: đây là hành vi của bản đang chạy hôm nay, và
 * một máy chủ cũ nâng cấp lên không nên lặng lẽ đổi hành vi vì thiếu một dòng
 * trong `.env`. Muốn tắt thì nói rõ ra.
 */
export function selfSignupEnabled(): boolean {
  const raw = process.env.ALLOW_SELF_SIGNUP?.trim().toLowerCase();
  if (raw === undefined || raw === '') return true;
  return !['false', '0', 'no', 'off'].includes(raw);
}
