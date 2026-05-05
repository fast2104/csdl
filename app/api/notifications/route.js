import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getNotifications } from "@/lib/wallet";

export const runtime = "nodejs";

export async function GET(request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit")) || 20;
    const onlyUnread = searchParams.get("unread") === "true";

    const notifications = await getNotifications({
      userId: session.userId,
      limit,
      onlyUnread,
    });

    return NextResponse.json({ ok: true, notifications });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load notifications.",
      },
      { status: 400 },
    );
  }
}
