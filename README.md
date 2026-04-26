# CSDL Wallet Demo

This project is now a Next.js App Router demo built to showcase SQL Server transactions, triggers, and stored procedures with a more realistic digital wallet flow.

## What it includes

- account registration through `sp_RegisterWalletUser`
- login through `sp_LoginWalletUser`
- dashboard loading through `sp_GetWalletDashboard`
- money transfer through `sp_TransferMoney`
- trigger-based balance audit logging in `AccountAuditLogs`
- SQL Server connection via `localhost\SQLEXPRESS` using Windows authentication

## Setup

1. Create a database named `TransferDemoDB` in SQL Server Express if you do not already have it.
2. Run [db_init.sql](C:\Users\miyori\WebstormProjects\csdl\db_init.sql) against that database from SSMS or Azure Data Studio while connected with Windows auth.
3. Install dependencies:

```bash
npm install
```

4. Use Node `20.x`. The `msnodesqlv8` driver used for Windows authentication does not currently install cleanly in this workspace under Node `25.8.2` without a compatible native toolchain.
5. Review or adjust [.env.local](C:\Users\miyori\WebstormProjects\csdl\.env.local) values.
6. Start the app:

```bash
npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000).

## Seeded demo logins

- `alice@wallet.demo` / `demo123`
- `bob@wallet.demo` / `demo123`
- `charlie@wallet.demo` / `demo123`

## Notes

- The Node driver is configured for Windows-authenticated SQL Server connections through `msnodesqlv8`.
- The profile tab explains the purpose of the project inside the app so the demo can stand on its own.
- Prisma Studio is available for browsing the seeded SQL Server tables:

```bash
npm run prisma:pull
npm run prisma:studio
```
