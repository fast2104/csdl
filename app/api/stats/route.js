import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getExpenseStats } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get("from") || null;
    const toDate = searchParams.get("to") || null;

    const stats = await getExpenseStats({
      userId: session.userId,
      fromDate: fromDate ? new Date(fromDate) : null,
      toDate: toDate ? new Date(toDate) : null,
    });

    return NextResponse.json({ ok: true, stats });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load expense stats.",
      },
      { status: 400 },
    );
  }
}
