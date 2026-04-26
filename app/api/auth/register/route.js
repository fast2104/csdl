import { NextResponse } from "next/server";
import { registerUser } from "@/lib/wallet";
import { setSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const fullName = body?.fullName?.trim();
    const email = body?.email?.trim();
    const password = body?.password?.trim();
    const openingBalance = Number(body?.openingBalance ?? 1000);

    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: "Full name, email, and password are required." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      return NextResponse.json(
        { error: "Opening balance must be zero or greater." },
        { status: 400 },
      );
    }

    const user = await registerUser({
      fullName,
      email,
      password,
      openingBalance,
    });

    await setSessionCookie(user);

    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed." },
      { status: 400 },
    );
  }
}
