import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';

// Everything (pages, API, photos) needs the shop password when APP_PASSWORD is set.
// If the app is connected to Supabase (online) but no password is set, it refuses to open
// at all, so customer ID photos can never be public by mistake.
export function middleware(req) {
  const password = process.env.APP_PASSWORD || '';
  const online = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!password) {
    if (!online) return NextResponse.next(); // local use on your own computer
    return new NextResponse('Set the APP_PASSWORD environment variable (Netlify > Site configuration > Environment variables).', { status: 503 });
  }
  if (checkAuth(req.headers.get('authorization'), password)) return NextResponse.next();
  return new NextResponse('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Rental POS", charset="UTF-8"' },
  });
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
