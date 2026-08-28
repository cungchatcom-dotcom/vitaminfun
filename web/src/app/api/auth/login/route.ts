/**
 * Đăng nhập: nhận email/mật khẩu, gọi FastAPI, đặt cookie httpOnly.
 *
 * Vì sao đi vòng qua đây thay vì để trình duyệt gọi thẳng FastAPI: cookie được
 * đặt trên chính origin của web nên không dính rắc rối cookie cross-origin, và
 * token không bao giờ chạm vào JavaScript phía trình duyệt.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { ApiError, apiFetch } from '@/lib/api-client';
import { isSecureRequest } from '@/lib/secure-cookie';
import { SESSION_COOKIE } from '@/lib/session';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

interface LoginResult {
  access_token: string;
  expires_in: number;
  user: { role: string; home_route: string; display_name: string };
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as LoginBody;

  if (typeof body.email !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: { code: 'VALIDATION_FAILED' } }, { status: 422 });
  }

  try {
    const result = await apiFetch<LoginResult>('/auth/login', {
      method: 'POST',
      body: { email: body.email, password: body.password },
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
