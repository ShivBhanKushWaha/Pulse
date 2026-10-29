/** @type {import('next').NextConfig} */
const nextConfig = {
  // The UI is plain static files (it only talks to the dashboard API from the browser), so the dashboard package
  // can serve it itself. `pnpm build:static` writes it to ./out.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

module.exports = nextConfig;
