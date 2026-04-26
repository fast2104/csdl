import { NextResponse } from "next/server";
import { loginUser } from "@/lib/wallet";
import { setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim();
    const password = body?.password?.trim();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const user = await loginUser({ email, password });
    await setSessionCookie(user);

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Login failed." },
      { status: 400 },
    );
  }
}
