/**
 * Tự mở tài khoản: nhận email/họ tên/mật khẩu, gọi FastAPI, đặt cookie httpOnly.
 *
 * Cùng khuôn với `../login/route.ts` — và cố ý dùng CHUNG một đường: API trả về
 * đúng `LoginResponse`, nên mở tài khoản xong là đã đăng nhập, không có bước
 * thứ hai nào để hỏng ở giữa. Token vẫn không bao giờ chạm vào JavaScript phía
 * trình duyệt.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiFetch } from '@/lib/api-client';
import { isSecureRequest } from '@/lib/secure-cookie';
import { SESSION_COOKIE } from '@/lib/session';
import { selfSignupEnabled } from '@/lib/signup';

interface SignupBody {
  email?: unknown;
  display_name?: unknown;
  password?: unknown;
}

interface SignupResult {
  access_token: string;
  expires_in: number;
  user: { role: string; home_route: string; display_name: string };
}

export async function POST(request: NextRequest) {
  // Chặn ngay ở đây nữa, dù API mới là chốt thật. Tắt chức năng mà route này
  // vẫn chuyển tiếp thì mỗi lần ai đó thử là một request vô ích đi tới API.
  if (!selfSignupEnabled()) {
    return NextResponse.json({ error: { code: 'SIGNUP_DISABLED' } }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as SignupBody;

  if (
    typeof body.email !== 'string' ||
    typeof body.display_name !== 'string' ||
    typeof body.password !== 'string'
  ) {
    return NextResponse.json({ error: { code: 'VALIDATION_FAILED' } }, { status: 422 });
  }

  try {
    const result = await apiFetch<SignupResult>('/auth/signup', {
      method: 'POST',
      body: {
        email: body.email,
        display_name: body.display_name,
        password: body.password,
      },
      auth: false,
    });

    const response = NextResponse.json({
      home_route: result.user.home_route,
      role: result.user.role,
      display_name: result.user.display_name,
    });

    response.cookies.set(SESSION_COOKIE, result.access_token, {
      httpOnly: true,
      sameSite: 'lax',
      // Theo giao thức của request, KHÔNG theo NODE_ENV — xem secure-cookie.ts.
      secure: isSecureRequest(request),
      path: '/',
      maxAge: result.expires_in,
    });

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json(
        { error: { code: error.code, params: error.params } },
        { status: error.status || 502 },
      );
    }
    return NextResponse.json({ error: { code: 'INTERNAL_ERROR' } }, { status: 500 });
  }
}
