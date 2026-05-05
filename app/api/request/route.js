import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createMoneyRequest } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const payerUserId = Number(body?.payerUserId);
    const amount = Number(body?.amount);
    const memo = body?.memo?.trim() || null;

    if (!Number.isInteger(payerUserId) || payerUserId <= 0) {
      return NextResponse.json(
        { error: "Choose a contact to request money from." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Request amount must be greater than zero." },
        { status: 400 },
      );
    }

    const result = await createMoneyRequest({
      requesterUserId: session.userId,
      payerUserId,
      amount,
      memo,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create money request.",
      },
      { status: 400 },
    );
  }
}
