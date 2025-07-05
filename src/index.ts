import { Hono } from "hono";
import { jsxRenderer } from "hono/jsx-renderer";
import { serveStatic } from "hono/bun";
import { logger } from "hono/logger";
import { cors } from "hono/cors";

import api from "./routes/api";
import { ModernLayout } from "./components/ModernLayout";
import { ModernDashboard } from "./components/ModernDashboard";
import { WalletDetail } from "./components/WalletDetail";
import { TokenDetail } from "./components/TokenDetail";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// JSX renderer
app.use(jsxRenderer());

// Serve static files
app.use("/static/*", serveStatic({ root: "./src/public" }));

// API routes
app.route("/api", api);

// Dashboard page
app.get("/", (c) => {
  return c.html(
    ModernLayout({
      title: "Spartan AUM",
      children: ModernDashboard({}),
    }),
  );
});

// Wallet detail page
app.get("/wallet/:address", (c) => {
  const address = c.req.param("address");
  return c.html(
    ModernLayout({
      title: `Wallet ${address.substring(0, 6)}...${address.slice(-4)}`,
      children: WalletDetail({ address }),
    }),
  );
});

// Token detail page
app.get("/token/:mint", (c) => {
  const mint = c.req.param("mint");
  return c.html(
    ModernLayout({
      title: "Token Details",
      children: TokenDetail({ mint }),
    }),
  );
});

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// 404 handler
app.notFound((c) => {
  return c.html(
    ModernLayout({
      title: "Page Not Found",
      children: `
        <div class="glass-card rounded-2xl p-8 text-center">
          <h1 class="text-2xl font-bold text-white mb-4">404 - Page Not Found</h1>
          <p class="text-gray-400 mb-4">The page you're looking for doesn't exist.</p>
          <a href="/" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Go Home
          </a>
        </div>
      `,
    }),
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.html(
    ModernLayout({
      title: "Server Error",
      children: `
        <div class="glass-card rounded-2xl p-8 text-center">
          <h1 class="text-2xl font-bold text-white mb-4">500 - Server Error</h1>
          <p class="text-gray-400 mb-4">Something went wrong on our end.</p>
          <a href="/" class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Go Home
          </a>
        </div>
      `,
    }),
  );
});

export default app;
