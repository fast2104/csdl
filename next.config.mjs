/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["mssql", "msnodesqlv8"],
};

export default nextConfig;
