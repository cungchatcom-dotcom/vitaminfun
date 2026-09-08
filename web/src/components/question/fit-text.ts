/**
 * Cỡ chữ co theo ĐỘ DÀI đoạn văn.
 *
 * Đoạn chữ ở đây do người dựng nội dung viết, và độ dài của nó thì không ai
 * chặn: lời chia tay của NPC có thể là một câu, cũng có thể là cả một đoạn tóm
 * tắt cốt truyện. Một cỡ chữ cố định thì hoặc quá bé cho câu ngắn, hoặc làm cái
 * khung phình ra khỏi màn hình với đoạn dài — và cái nút ở cuối khung trôi đi
 * mất.
 *
 * ## TÍNH, không ĐO
 *
 * Cùng nguyên tắc với `lobbyTextLines()` bên `game/world.ts`: đo DOM thì phải
 * dựng xong mới biết, tức là vẽ một lần sai rồi sửa — người đọc thấy chữ nhảy
 * cỡ ngay trước mắt. Đếm ký tự thì ra kết quả ngay từ lần vẽ đầu, giống nhau ở
 * server và ở trình duyệt, và không cần một vòng lặp đo-rồi-thu-nhỏ nào.
 *
 * Cái giá phải trả: đây là một phép XẤP XỈ. Một đoạn toàn từ dài sẽ xuống dòng
 * sớm hơn ước tính. Vì thế nó KHÔNG PHẢI là thứ duy nhất giữ cái khung trong
 * màn hình — khung vẫn phải cuộn được (xem chỗ gọi). Thu nhỏ chữ là để đoạn
 * văn bình thường trông cân đối; cuộn là để đoạn văn bất thường không làm hỏng
 * cái gì.
 *
 * ## Các mốc
 *
 * Tính cho khung rộng chừng 28rem (`max-w-md`) trừ lề: khoảng 45 ký tự một dòng
 * ở cỡ `1.125rem`. Các mốc đặt sao cho đoạn văn giữ trong khoảng 6–14 dòng —
 * dưới ngưỡng đó thì chữ to đọc cho sướng, trên ngưỡng đó thì thà chữ nhỏ hơn
 * còn hơn phải cuộn.
 */
const MOC: readonly (readonly [number, string])[] = [
  [120, '1.125rem'], // một hai câu — để to, nó là câu thoại
  [280, '1rem'],
  [500, '0.9375rem'],
  [800, '0.875rem'],
];

/** Sàn cỡ chữ. Dưới mức này thì trẻ con không đọc nổi, và cuộn là lối thoát. */
const NHO_NHAT = '0.8125rem';

/**
 * Cỡ chữ hợp với đoạn văn này, trả về chuỗi CSS.
 *
 * Dùng với `style` chứ không phải một lớp Tailwind: đây là một hàm bậc thang
 * trên một con số, và ánh xạ nó sang tên lớp chỉ thêm một bảng tra để lệch.
 */
export function fitProseSize(text: string | null | undefined): string {
  const n = (text ?? '').length;
  for (const [tran, co] of MOC) {
    if (n <= tran) return co;
  }
  return NHO_NHAT;
}
