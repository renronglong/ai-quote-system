import { NextResponse } from 'next/server';

const ACCESS_PASSWORD = '9760';
const COOKIE_NAME = 'baojia_access';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    if (password === ACCESS_PASSWORD) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(COOKIE_NAME, ACCESS_PASSWORD, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        maxAge: MAX_AGE,
        path: '/',
      });
      return response;
    }

    return NextResponse.json({ success: false }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }
}
