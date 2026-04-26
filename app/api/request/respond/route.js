import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { respondToMoneyRequest } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const requestId = Number(body?.requestId);
    const accept = Boolean(body?.accept);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return NextResponse.json(
        { error: "Invalid request ID." },
        { status: 400 },
      );
    }

    const result = await respondToMoneyRequest({
      requestId,
      payerUserId: session.userId,
      accept,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to respond to money request.",
      },
      { status: 400 },
    );
  }
}
