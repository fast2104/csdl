import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  createRecurringTransfer,
  getRecurringTransfers,
  cancelRecurringTransfer,
} from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const recurring = await getRecurringTransfers(session.userId);
    return NextResponse.json({ ok: true, recurring });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load recurring transfers.",
      },
      { status: 400 },
    );
  }
}

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
    const frequency = body?.frequency;
    const nextRunDate = body?.nextRunDate;

    if (!Number.isInteger(recipientUserId) || recipientUserId <= 0) {
      return NextResponse.json(
        { error: "Choose a recipient." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (!["daily", "weekly", "biweekly", "monthly"].includes(frequency)) {
      return NextResponse.json(
        { error: "Invalid frequency." },
        { status: 400 },
      );
    }

    if (!nextRunDate) {
      return NextResponse.json(
        { error: "A start date is required." },
        { status: 400 },
      );
    }

    const result = await createRecurringTransfer({
      senderUserId: session.userId,
      recipientUserId,
      amount,
      memo,
      tag,
      frequency,
      nextRunDate,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create recurring transfer.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const recurringId = Number(body?.recurringId);

    if (!Number.isInteger(recurringId) || recurringId <= 0) {
      return NextResponse.json(
        { error: "Invalid recurring transfer ID." },
        { status: 400 },
      );
    }

    const result = await cancelRecurringTransfer({
      recurringId,
      senderUserId: session.userId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to cancel recurring transfer.",
      },
      { status: 400 },
    );
  }
}
