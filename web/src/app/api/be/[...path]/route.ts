/**
 * Cầu nối từ trình duyệt sang FastAPI.
 *
 *     fetch('/api/be/questions?limit=20')  ->  GET  {API}/questions?limit=20
 *
 * Vì sao cần: token nằm trong cookie `httpOnly`, nên mã chạy trên trình duyệt
 * không đọc được để tự gắn header `Authorization`. Route handler này chạy ở
 * server, đọc được cookie, và gắn hộ.
 *
 * Đổi lại ta được ba thứ:
 *   - Token không bao giờ chạm JavaScript phía trình duyệt.
 *   - Trình duyệt chỉ nói chuyện với một origin, nên không dính CORS.
 *   - Đổi địa chỉ API là đổi `API_INTERNAL_URL`, không phải build lại frontend.
 *
 * Đây KHÔNG phải chỗ kiểm quyền. Vai trò vẫn do `require_role()` ở FastAPI
 * quyết định — proxy chỉ chuyển tiếp, kể cả chuyển tiếp một lỗi 403.
 */

import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

import { apiBaseUrl } from '@/lib/api-client';
import { SESSION_COOKIE } from '@/lib/session';

/** Ký tự cho phép trong một đoạn đường dẫn. Chặn `..` và mọi trò lách thư mục. */
const SAFE_SEGMENT = /^[A-Za-z0-9._~-]+$/;

async function forward(request: NextRequest, segments: string[]): Promise<Response> {
  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  const target = `${apiBaseUrl()}/${segments.join('/')}${request.nextUrl.search}`;

  const headers = new Headers();
  headers.set('Accept', 'application/json');

  // Chuyển tiếp Content-Type nguyên vẹn để multipart giữ được `boundary`.
  const contentType = request.headers.get('content-type');
  if (contentType) headers.set('Content-Type', contentType);

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      // Đọc hết vào bộ nhớ thay vì truyền luồng: đơn giản hơn nhiều, và trần
      // upload vốn đã là 32MB (api/app/modules/media/service.py MAX_BYTES).
      body: hasBody ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: { code: 'NETWORK' } }, { status: 502 });
  }

  // 204 không được có thân phản hồi.
  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
      // Dữ liệu theo từng người dùng — không được nằm trong cache dùng chung.
      'Cache-Control': 'no-store',
    },
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PATCH(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function PUT(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
