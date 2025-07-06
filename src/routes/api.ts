import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { db } from "../services/database";
import { solanaService } from "../services/solana";
import { csvService } from "../services/csv";
import tokenMetadataService from "../services/background/token-metadata";
import { PrefetchService } from "../scripts/prefetch";

const api = new Hono();

// Global prefetch service instance to track running state
let globalPrefetchService: PrefetchService | null = null;

// Middleware
api.use("*", cors());
api.use("*", logger());

// Helper function to handle errors
const handleError = (error: any, c: any) => {
  console.error("API Error:", error);
  return c.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
    },
    500,
  );
};

// Helper function to validate wallet address
const validateWalletAddress = (address: string) => {
  if (!address || !solanaService.isValidSolanaAddress(address)) {
    throw new Error("Invalid wallet address");
  }
};

// Portfolio endpoints
api.get("/portfolio/overview", async (c) => {
  try {
    const overview = db.getPortfolioOverview();
    const combinedPNL = db.getCombinedPNL();

    return c.json({
      success: true,
      data: {
        ...overview,
        pnl: {
          totalInitialValue: combinedPNL.totalInitialValue,
          totalCurrentValue: combinedPNL.totalCurrentValue,
          totalPNL: combinedPNL.totalPNL,
          totalPNLPercentage: combinedPNL.totalPNLPercentage,
          unrealizedPNL: combinedPNL.totalUnrealizedPNL,
          realizedPNL: combinedPNL.totalRealizedPNL,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/portfolio/status", async (c) => {
  try {
    const dbHealth = db.healthCheck();
    const solanaHealth = await solanaService.healthCheck();
    const stats = csvService.getStats();
    const overview = db.getPortfolioOverview();

    // Calculate data freshness
    const lastUpdate = new Date(overview.lastUpdated);
    const now = new Date();
    const minutesSinceUpdate = Math.floor(
      (now.getTime() - lastUpdate.getTime()) / (1000 * 60),
    );

    return c.json({
      success: true,
      data: {
        database: dbHealth.status,
        solana: solanaHealth.status,
        dataFreshness: {
          lastUpdated: overview.lastUpdated,
          minutesSinceUpdate,
          isFresh: minutesSinceUpdate < 10,
        },
        walletStats: {
          totalFromCSV: stats.totalEntries,
          uniqueWallets: stats.uniqueWallets,
          processedWallets: overview.totalWallets,
          successfulWallets: overview.successfulWallets,
          errorWallets: overview.errorWallets,
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/portfolio/metrics", async (c) => {
  try {
    const recentLogs = db.getRecentFetchLogs(100);
    const errorLogs = db.getErrorLogs(20);
    const systemMetrics = db.getAllSystemMetrics();

    // Calculate performance metrics
    const successfulLogs = recentLogs.filter((log) => log.status === "success");
    const errorLogs24h = errorLogs.filter(
      (log) =>
        new Date(log.timestamp).getTime() > Date.now() - 24 * 60 * 60 * 1000,
    );

    const avgResponseTime =
      successfulLogs.length > 0
        ? successfulLogs.reduce((sum, log) => sum + log.response_time_ms, 0) /
          successfulLogs.length
        : 0;

    const errorRate =
      recentLogs.length > 0
        ? (errorLogs24h.length / recentLogs.length) * 100
        : 0;

    return c.json({
      success: true,
      data: {
        performance: {
          averageResponseTime: Math.round(avgResponseTime),
          errorRate: Math.round(errorRate * 100) / 100,
          totalRequests24h: recentLogs.length,
          successfulRequests24h: successfulLogs.length,
          errorRequests24h: errorLogs24h.length,
        },
        systemMetrics: systemMetrics.reduce(
          (obj, metric) => {
            obj[metric.metric_name] = metric.metric_value;
            return obj;
          },
          {} as Record<string, string>,
        ),
        recentErrors: errorLogs.slice(0, 5),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/portfolio/pnl", async (c) => {
  try {
    const combinedPNL = db.getCombinedPNL();

    return c.json({
      success: true,
      data: {
        totalInitialValue: combinedPNL.totalInitialValue,
        totalCurrentValue: combinedPNL.totalCurrentValue,
        totalRealizedPNL: combinedPNL.totalRealizedPNL,
        totalUnrealizedPNL: combinedPNL.totalUnrealizedPNL,
        totalPNL: combinedPNL.totalPNL,
        totalPNLPercentage: combinedPNL.totalPNLPercentage,
        topGainers: combinedPNL.topGainers.slice(0, 10),
        topLosers: combinedPNL.topLosers.slice(0, 10),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/portfolio/pnl/timeframe/:period", async (c) => {
  try {
    const period = c.req.param("period");
    const validPeriods = ["24h", "7d", "30d"];

    if (!validPeriods.includes(period)) {
      return c.json(
        {
          success: false,
          error: "Invalid period. Use 24h, 7d, or 30d",
        },
        400,
      );
    }

    // TODO: Implement timeframe-specific PNL calculation
    // This would require historical snapshots and price data

    return c.json({
      success: true,
      data: {
        period,
        message: "Timeframe-specific PNL calculation not yet implemented",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Wallet endpoints
api.get("/wallets/balance/:address", async (c) => {
  try {
    const address = c.req.param("address");
    validateWalletAddress(address);

    const balance = db.getWalletBalance(address);
    if (!balance) {
      return c.json(
        {
          success: false,
          error: "Wallet not found",
        },
        404,
      );
    }

    return c.json({
      success: true,
      data: {
        walletAddress: balance.wallet_address,
        walletId: balance.wallet_id,
        solBalance: balance.sol_balance,
        tokens: JSON.parse(balance.tokens),
        lastUpdated: balance.last_updated,
        fetchStatus: balance.fetch_status,
        errorMessage: balance.error_message,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.post("/wallets/balances", async (c) => {
  try {
    const body = await c.req.json();
    const { addresses } = body;

    if (!Array.isArray(addresses)) {
      return c.json(
        {
          success: false,
          error: "addresses must be an array",
        },
        400,
      );
    }

    const balances = addresses
      .map((address) => {
        try {
          validateWalletAddress(address);
          return db.getWalletBalance(address);
        } catch (error) {
          return null;
        }
      })
      .filter((balance) => balance !== null);

    return c.json({
      success: true,
      data: balances.map((balance) => ({
        walletAddress: balance!.wallet_address,
        walletId: balance!.wallet_id,
        solBalance: balance!.sol_balance,
        tokens: JSON.parse(balance!.tokens),
        lastUpdated: balance!.last_updated,
        fetchStatus: balance!.fetch_status,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/wallets/history/:address", async (c) => {
  try {
    const address = c.req.param("address");
    validateWalletAddress(address);

    const limit = parseInt(c.req.query("limit") || "50");
    const snapshots = db.getPortfolioSnapshots(address, limit);

    return c.json({
      success: true,
      data: snapshots.map((snapshot) => ({
        timestamp: snapshot.snapshot_timestamp,
        solBalance: snapshot.sol_balance,
        tokens: JSON.parse(snapshot.tokens),
        totalUsdValue: snapshot.total_usd_value,
        snapshotType: snapshot.snapshot_type,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/wallets/pnl/:address", async (c) => {
  try {
    const address = c.req.param("address");
    validateWalletAddress(address);

    const walletPNL = db.getWalletPNL(address);
    if (!walletPNL) {
      return c.json(
        {
          success: false,
          error: "Wallet PNL not found",
        },
        404,
      );
    }

    const tokenPNL = db.getWalletTokenPNL(address);

    return c.json({
      success: true,
      data: {
        walletAddress: walletPNL.wallet_address,
        initialValue: walletPNL.initial_value_usd,
        currentValue: walletPNL.current_value_usd,
        realizedPNL: walletPNL.realized_pnl_usd,
        unrealizedPNL: walletPNL.unrealized_pnl_usd,
        totalPNL: walletPNL.total_pnl_usd,
        totalPNLPercentage: walletPNL.total_pnl_percentage,
        firstSnapshotDate: walletPNL.first_snapshot_date,
        lastUpdated: walletPNL.last_updated,
        tokenBreakdown: tokenPNL.map((token) => ({
          mint: token.token_mint,
          initialAmount: token.initial_amount,
          currentAmount: token.current_amount,
          initialPrice: token.initial_price_usd,
          currentPrice: token.current_price_usd,
          realizedPNL: token.realized_pnl_usd,
          unrealizedPNL: token.unrealized_pnl_usd,
          totalPNL: token.total_pnl_usd,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/wallets/pnl/:address/:period", async (c) => {
  try {
    const address = c.req.param("address");
    const period = c.req.param("period");

    validateWalletAddress(address);

    const validPeriods = ["24h", "7d", "30d"];
    if (!validPeriods.includes(period)) {
      return c.json(
        {
          success: false,
          error: "Invalid period. Use 24h, 7d, or 30d",
        },
        400,
      );
    }

    // TODO: Implement timeframe-specific wallet PNL calculation

    return c.json({
      success: true,
      data: {
        walletAddress: address,
        period,
        message:
          "Timeframe-specific wallet PNL calculation not yet implemented",
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Token endpoints
api.get("/tokens/prices", async (c) => {
  try {
    const prices = db.getAllTokenPrices();

    return c.json({
      success: true,
      data: prices.map((price) => ({
        mint: price.mint,
        symbol: price.symbol,
        name: price.name,
        price: price.price,
        priceChange24h: price.price_change_24h,
        marketCap: price.market_cap,
        lastUpdated: price.last_updated,
        source: price.source,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.post("/tokens/prices/refresh", async (c) => {
  try {
    await solanaService.refreshStaleTokenPrices();

    return c.json({
      success: true,
      message: "Token prices refresh initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/tokens/pnl", async (c) => {
  try {
    const combinedPNL = db.getCombinedPNL();

    return c.json({
      success: true,
      data: {
        topGainers: combinedPNL.topGainers.map((token) => ({
          mint: token.token_mint,
          totalPNL: token.total_pnl_usd,
          currentPrice: token.current_price_usd,
          totalAmount: token.current_amount,
        })),
        topLosers: combinedPNL.topLosers.map((token) => ({
          mint: token.token_mint,
          totalPNL: token.total_pnl_usd,
          currentPrice: token.current_price_usd,
          totalAmount: token.current_amount,
        })),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/tokens/aggregated", async (c) => {
  try {
    const allBalances = db.getAllWalletBalances();
    const tokenPrices = db.getAllTokenPrices();

    // Get SOL price from database
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const solPriceData = tokenPrices.find((p) => p.mint === SOL_MINT);
    const solPrice = solPriceData?.price || 150; // Fallback to $150

    // Aggregate tokens across all wallets
    const tokenMap = new Map<string, any>();

    for (const wallet of allBalances) {
      if (wallet.fetch_status === "success") {
        try {
          const tokens = JSON.parse(wallet.tokens);
          for (const token of tokens) {
            const existing = tokenMap.get(token.mint) || {
              mint: token.mint,
              symbol: token.symbol || "Unknown",
              name: token.name || "Unknown Token",
              totalAmount: 0,
              totalValue: 0,
              walletCount: 0,
              price: 0,
              priceChange24h: 0,
            };

            existing.totalAmount += token.amount || 0;
            existing.totalValue += token.usdValue || 0;
            existing.walletCount += 1;

            tokenMap.set(token.mint, existing);
          }
        } catch (e) {
          console.error(
            "Error parsing tokens for wallet",
            wallet.wallet_address,
          );
        }
      }
    }

    // Add price data and update metadata from current token_prices table
    const priceMap = new Map(tokenPrices.map((p) => [p.mint, p]));
    for (const [mint, token] of tokenMap) {
      const priceData = priceMap.get(mint);
      if (priceData) {
        token.price = priceData.price;
        token.priceChange24h = priceData.price_change_24h || 0;
        token.imageUrl = priceData.image_url || null;
        // Update symbol and name with current metadata from token_prices table
        token.symbol = priceData.symbol || token.symbol;
        token.name = priceData.name || token.name;
      }
    }

    const tokens = Array.from(tokenMap.values()).sort(
      (a, b) => b.totalValue - a.totalValue,
    );

    return c.json({
      success: true,
      data: {
        solPrice,
        tokens,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/wallets/all", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "100");
    const offset = parseInt(c.req.query("offset") || "0");

    const wallets = db.getAllWalletBalances().slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        wallets: wallets.map((wallet) => ({
          ...wallet,
          tokens: wallet.tokens, // Keep as string, let frontend parse
        })),
        total: db.getAllWalletBalances().length,
        limit,
        offset,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/tokens/holders/:mint", async (c) => {
  try {
    const mint = c.req.param("mint");
    const allBalances = db.getAllWalletBalances();
    const tokenPrices = db.getAllTokenPrices();

    // Find token price info
    const priceInfo = tokenPrices.find((p) => p.mint === mint);
    const price = priceInfo?.price || 0;

    // Find all wallets holding this token
    const holders = [];
    let totalAmount = 0;
    let totalValue = 0;

    for (const wallet of allBalances) {
      if (wallet.fetch_status === "success") {
        try {
          const tokens = JSON.parse(wallet.tokens);
          const token = tokens.find((t: any) => t.mint === mint);

          if (token && token.amount > 0) {
            const value = token.amount * price;
            holders.push({
              address: wallet.wallet_address,
              balance: token.amount,
              value: value,
              pnl: null, // TODO: Calculate individual PNL
            });

            totalAmount += token.amount;
            totalValue += value;
          }
        } catch (e) {
          console.error(
            "Error parsing tokens for wallet",
            wallet.wallet_address,
          );
        }
      }
    }

    // Get token PNL data
    const tokenPNL = db
      .getCombinedPNL()
      .topGainers.concat(db.getCombinedPNL().topLosers)
      .find((t) => t.token_mint === mint);

    return c.json({
      success: true,
      data: {
        mint,
        symbol: priceInfo?.symbol || "Unknown",
        name: priceInfo?.name || "Unknown Token",
        price,
        priceChange24h: priceInfo?.price_change_24h || 0,
        imageUrl: priceInfo?.image_url || null,
        totalAmount,
        totalValue,
        holderCount: holders.length,
        holders,
        pnl: tokenPNL
          ? {
              totalPNL: tokenPNL.total_pnl_usd,
              avgEntryPrice: tokenPNL.initial_price_usd,
            }
          : null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Token metadata service endpoints
api.get("/tokens/metadata/status", async (c) => {
  try {
    const status = tokenMetadataService.getQueueStatus();

    return c.json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.post("/tokens/metadata/refresh", async (c) => {
  try {
    tokenMetadataService.refreshStaleMetadata();

    return c.json({
      success: true,
      message: "Token metadata refresh initiated",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.post("/tokens/metadata/queue", async (c) => {
  try {
    const body = await c.req.json();
    const { mints, priority = 0 } = body;

    if (!Array.isArray(mints)) {
      return c.json(
        {
          success: false,
          error: "mints must be an array",
        },
        400,
      );
    }

    tokenMetadataService.addBatchToQueue(mints, priority);

    return c.json({
      success: true,
      message: `Added ${mints.length} tokens to metadata queue`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.delete("/tokens/metadata/queue", async (c) => {
  try {
    tokenMetadataService.clearQueue();

    return c.json({
      success: true,
      message: "Token metadata queue cleared",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/tokens/metadata/health", async (c) => {
  try {
    const health = await tokenMetadataService.healthCheck();

    return c.json(
      {
        success: true,
        status: health.status,
        data: health.details,
        timestamp: new Date().toISOString(),
      },
      health.status === "healthy" ? 200 : 503,
    );
  } catch (error) {
    return handleError(error, c);
  }
});

// Admin endpoints
api.post("/admin/refresh", async (c) => {
  try {
    // Check if refresh is already running
    if (globalPrefetchService) {
      return c.json(
        {
          success: false,
          message: "Background refresh is already running",
          timestamp: new Date().toISOString(),
        },
        409,
      );
    }

    // Parse query parameters
    const forceRefresh = c.req.query("force") === "true";
    const limitParam = c.req.query("limit");
    const limit = limitParam ? parseInt(limitParam) : undefined;

    // Start refresh process in background
    const refreshConfig = {
      forceRefresh,
      limit,
      resumeFromFailures: !forceRefresh,
    };

    globalPrefetchService = new PrefetchService(refreshConfig);

    // Run refresh in background without blocking the response
    (async () => {
      try {
        await globalPrefetchService!.run();
      } catch (error) {
        console.error("Background refresh failed:", error);
      } finally {
        // Clear the global service when done
        globalPrefetchService = null;
      }
    })();

    return c.json({
      success: true,
      message: "Full data refresh initiated",
      config: refreshConfig,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Admin refresh status endpoint
api.get("/admin/refresh/status", async (c) => {
  try {
    const isRunning = globalPrefetchService !== null;

    return c.json({
      success: true,
      isRunning,
      message: isRunning
        ? "Background refresh is running"
        : "No refresh currently running",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.get("/admin/logs", async (c) => {
  try {
    const limit = parseInt(c.req.query("limit") || "50");
    const type = c.req.query("type") || "all";

    let logs;
    if (type === "error") {
      logs = db.getErrorLogs(limit);
    } else {
      logs = db.getRecentFetchLogs(limit);
    }

    return c.json({
      success: true,
      data: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

api.post("/admin/snapshot", async (c) => {
  try {
    const wallets = db.getAllWalletBalances();
    const now = new Date().toISOString();

    for (const wallet of wallets) {
      if (wallet.fetch_status === "success") {
        try {
          const tokens = JSON.parse(wallet.tokens);
          const totalUsdValue = tokens.reduce(
            (sum: number, token: any) => sum + (token.usdValue || 0),
            0,
          );

          db.insertPortfolioSnapshot({
            wallet_address: wallet.wallet_address,
            snapshot_timestamp: now,
            sol_balance: wallet.sol_balance,
            tokens: wallet.tokens,
            total_usd_value: totalUsdValue,
            snapshot_type: "manual",
          });
        } catch (error) {
          console.error(
            `Failed to create snapshot for ${wallet.wallet_address}:`,
            error,
          );
        }
      }
    }

    return c.json({
      success: true,
      message: `Manual snapshots created for ${wallets.length} wallets`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return handleError(error, c);
  }
});

// Health endpoint
api.get("/health", async (c) => {
  try {
    const dbHealth = db.healthCheck();
    const solanaHealth = await solanaService.healthCheck();

    const isHealthy =
      dbHealth.status === "healthy" && solanaHealth.status === "healthy";

    return c.json(
      {
        success: true,
        status: isHealthy ? "healthy" : "unhealthy",
        checks: {
          database: dbHealth,
          solana: solanaHealth,
        },
        timestamp: new Date().toISOString(),
      },
      isHealthy ? 200 : 503,
    );
  } catch (error) {
    return handleError(error, c);
  }
});

export default api;
