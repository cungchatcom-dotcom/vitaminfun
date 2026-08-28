/**
 * Lỗi có mã, dùng chung cho cả phía server lẫn phía trình duyệt.
 *
 * Nằm riêng một file KHÔNG import gì của Next: `api-client.ts` kéo theo
 * `next/headers` (chỉ chạy được ở server), nên nếu `ApiError` ở trong đó thì
 * mọi Client Component import nó sẽ làm vỡ build.
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly params: Record<string, unknown> = {},
    readonly traceId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }

  /**
   * Khoá tra bản dịch: `AUTH_REQUIRED` -> `error.AUTH_REQUIRED`.
   *
   * Có sẵn ở đây để không chỗ nào phải tự ghép chuỗi — ghép tay thì sẽ có chỗ
   * quên tiền tố `error.`, và người dùng nhìn thấy chữ in hoa gạch dưới.
   */
  get messageKey(): string {
    return `error.${this.code}`;
  }
}
