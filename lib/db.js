const globalForSql = globalThis;

function readBoolean(value, fallback = true) {
  if (value == null) {
    return fallback;
  }

  return String(value).toLowerCase() !== "false";
}

function getConfig() {
  const server = process.env.DB_SERVER || "localhost\\SQLEXPRESS";
  const database = process.env.DB_DATABASE || "TransferDemoDB";
  const trustedConnection = readBoolean(
    process.env.DB_TRUSTED_CONNECTION,
    true,
  );
  const trustServerCertificate = readBoolean(
    process.env.DB_TRUST_SERVER_CERTIFICATE,
    true,
  );

  return {
    server,
    database,
    driver: "msnodesqlv8",
    connectionString: [
      "Driver={ODBC Driver 18 for SQL Server}",
      `Server=${server}`,
      `Database=${database}`,
      `Trusted_Connection=${trustedConnection ? "Yes" : "No"}`,
      `TrustServerCertificate=${trustServerCertificate ? "Yes" : "No"}`,
    ].join(";"),
    options: {
      trustedConnection,
      trustServerCertificate,
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

export async function getSqlModule() {
  if (!globalForSql.__walletSqlModulePromise) {
    globalForSql.__walletSqlModulePromise = import("mssql/msnodesqlv8.js").then(
      (module) => module.default ?? module,
    );
  }

  return globalForSql.__walletSqlModulePromise;
}

export async function getPool() {
  if (!globalForSql.__walletSqlPoolPromise) {
    globalForSql.__walletSqlPoolPromise = getSqlModule().then((sql) =>
      sql.connect(getConfig()),
    );
  }

  return globalForSql.__walletSqlPoolPromise;
}
