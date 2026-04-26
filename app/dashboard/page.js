import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { getSession } from "@/lib/session";
import { getDashboardData } from "@/lib/wallet";

export const dynamic = "force-dynamic";

function emptyDashboard(session) {
  return {
    profile: {
      userId: session.userId,
      fullName: session.fullName,
      email: session.email,
      accountId: null,
      balance: 0,
      createdAt: new Date().toISOString(),
      currencyCode: "USD",
    },
    contacts: [],
    history: [],
    audits: [],
  };
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  let dashboard = emptyDashboard(session);
  let dbError = "";

  try {
    dashboard = await getDashboardData(session.userId);
  } catch (error) {
    dbError =
      error instanceof Error
        ? error.message
        : "Could not load the SQL Server dashboard data.";
  }

  return (
    <main className="dashboard-page">
      <DashboardShell
        dbError={dbError}
        initialData={dashboard}
        session={session}
      />
    </main>
  );
}
