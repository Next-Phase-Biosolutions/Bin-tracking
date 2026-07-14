/** @type {import('next').NextConfig} */
const nextConfig = {
  // Not a static export: keep SSR / API routes open for the backend the team adds later.
  reactStrictMode: true,
  transpilePackages: ["@bin-tracker/api", "@bin-tracker/db", "@bin-tracker/types", "@bin-tracker/validators"],
  // Served under nextphasebiosolutions.com/app via a Netlify proxy from the marketing site.
  // basePath puts every route + asset under /app so the proxy and links line up.
  basePath: "/app",
  // Match the marketing site's trailingSlash so /app <-> /app/ doesn't ping-pong across the
  // proxy (the marketing site uses trailingSlash: true). Prevents ERR_TOO_MANY_REDIRECTS.
  trailingSlash: true,
  // Serve images raw (like the marketing site) instead of via the optimizer — the optimizer
  // mis-resolves the basePath through the proxy and 404s, so the logo fell back to alt text.
  images: { unoptimized: true },
};

export default nextConfig;
