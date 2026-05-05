import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { transferMoney } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const recipientUserId = Number(body?.recipientUserId);
    const amount = Number(body?.amount);
    const memo = body?.memo?.trim() || null;
    const tag = body?.tag?.trim() || null;

    if (!Number.isInteger(recipientUserId) || recipientUserId <= 0) {
      return NextResponse.json(
        { error: "Choose a recipient account." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Transfer amount must be greater than zero." },
        { status: 400 },
      );
    }

    const result = await transferMoney({
      senderUserId: session.userId,
      recipientUserId,
      amount,
      memo,
      tag,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transfer failed." },
      { status: 400 },
    );
  }
}
