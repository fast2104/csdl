import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getBudgetSummary, upsertBudget, deleteBudget } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = Number(searchParams.get("month")) || now.getMonth() + 1;
    const year = Number(searchParams.get("year")) || now.getFullYear();

    const budgets = await getBudgetSummary({
      userId: session.userId,
      month,
      year,
    });

    return NextResponse.json({ ok: true, budgets });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load budgets.",
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
    const tag = body?.tag?.trim() || null;
    const monthlyLimit = Number(body?.monthlyLimit);

    if (!Number.isFinite(monthlyLimit) || monthlyLimit <= 0) {
      return NextResponse.json(
        { error: "Monthly limit must be greater than zero." },
        { status: 400 },
      );
    }

    const result = await upsertBudget({
      userId: session.userId,
      tag,
      monthlyLimit,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to save budget.",
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
    const budgetId = Number(body?.budgetId);

    if (!Number.isInteger(budgetId) || budgetId <= 0) {
      return NextResponse.json(
        { error: "Invalid budget ID." },
        { status: 400 },
      );
    }

    const result = await deleteBudget({
      userId: session.userId,
      budgetId,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete budget.",
      },
      { status: 400 },
    );
  }
}
