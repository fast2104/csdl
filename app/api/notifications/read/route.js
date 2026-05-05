import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { markNotificationsRead } from "@/lib/wallet";

export const runtime = "nodejs";

export async function POST(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await request.json();
    const notificationIds = body?.notificationIds;

    if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { error: "Provide an array of notification IDs." },
        { status: 400 },
      );
    }

    const result = await markNotificationsRead({
      userId: session.userId,
      notificationIds: notificationIds.map(Number),
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to mark notifications as read.",
      },
      { status: 400 },
    );
  }
}
