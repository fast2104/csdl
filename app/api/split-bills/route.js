import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createSplitBill, getSplitBills } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const splitBills = await getSplitBills(session.userId);
    return NextResponse.json({ ok: true, splitBills });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load split bills.",
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
    const description = body?.description?.trim();
    const totalAmount = Number(body?.totalAmount);
    const splitMethod = body?.splitMethod || "equal";
    const participantUserIds = body?.participantUserIds;
    const participantAmounts = body?.participantAmounts || null;

    if (!description) {
      return NextResponse.json(
        { error: "A description is required." },
        { status: 400 },
      );
    }

    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Total amount must be greater than zero." },
        { status: 400 },
      );
    }

    if (!Array.isArray(participantUserIds) || participantUserIds.length === 0) {
      return NextResponse.json(
        { error: "At least one participant is required." },
        { status: 400 },
      );
    }

    const result = await createSplitBill({
      creatorUserId: session.userId,
      description,
      totalAmount,
      splitMethod,
      participantUserIds: participantUserIds.map(Number),
      participantAmounts: participantAmounts
        ? participantAmounts.map(Number)
        : null,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create split bill.",
      },
      { status: 400 },
    );
  }
}
