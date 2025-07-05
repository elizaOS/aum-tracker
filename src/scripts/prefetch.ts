#!/usr/bin/env bun

import { csvService } from "../services/csv";
import { solanaService } from "../services/solana";
import { db } from "../services/database";

interface PrefetchConfig {
  batchSize: number;
  delayBetweenBatches: number;
  maxRetries: number;
  resumeFromFailures: boolean;
  forceRefresh: boolean;
  limit?: number;
}

interface PrefetchStats {
  totalWallets: number;
  processed: number;
  successful: number;
  failed: number;
  skipped: number;
  startTime: Date;
  endTime?: Date;
  errors: string[];
}

class PrefetchService {
  private config: PrefetchConfig;
  private stats: PrefetchStats;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(config: Partial<PrefetchConfig> = {}) {
    this.config = {
      batchSize: 50, // Optimized for premium Helius endpoint (1000+ req/min)
      delayBetweenBatches: 200, // 200ms for premium endpoint
      maxRetries: 3,
      resumeFromFailures: true,
      forceRefresh: false,
      limit: undefined,
      ...config,
    };

    // If limit is set and it's for testing, adjust batch settings for faster processing
    if (this.config.limit && this.config.limit <= 20) {
      this.config.batchSize = Math.min(this.config.batchSize, 20);
      this.config.delayBetweenBatches = Math.min(
        this.config.delayBetweenBatches,
        100,
      );
    }

    this.stats = {
      totalWallets: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      startTime: new Date(),
      errors: [],
    };

    // Handle graceful shutdown
    process.on("SIGINT", this.handleShutdown.bind(this));
    process.on("SIGTERM", this.handleShutdown.bind(this));
  }

  private async handleShutdown(): Promise<void> {
    console.log("\n🛑 Shutdown signal received. Stopping gracefully...");
    this.shouldStop = true;

    if (this.isRunning) {
      console.log("⏳ Waiting for current batch to complete...");
      // Wait for current operations to finish
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    this.printFinalStats();
    process.exit(0);
  }

  private printProgress(): void {
    const progress = (this.stats.processed / this.stats.totalWallets) * 100;
    const elapsed = Date.now() - this.stats.startTime.getTime();
    const rate = this.stats.processed / (elapsed / 1000);
    const eta =
      this.stats.totalWallets > this.stats.processed
        ? (this.stats.totalWallets - this.stats.processed) / rate
        : 0;

    console.log(
      `   📊 ${this.stats.processed}/${this.stats.totalWallets} (${progress.toFixed(1)}%) | ` +
        `✅ ${this.stats.successful} | ❌ ${this.stats.failed} | ⏭️ ${this.stats.skipped} | ` +
        `📈 ${rate.toFixed(2)}/s | ⏱️ ${Math.round(eta)}s remaining`,
    );
  }

  private printFinalStats(): void {
    this.stats.endTime = new Date();
    const duration =
      this.stats.endTime.getTime() - this.stats.startTime.getTime();
    const durationMinutes = Math.round(duration / 60000);

    console.log("\n🎉 Prefetch completed!");
    console.log("=".repeat(60));
    console.log(`📊 Total Wallets: ${this.stats.totalWallets}`);
    console.log(`✅ Successful: ${this.stats.successful}`);
    console.log(`❌ Failed: ${this.stats.failed}`);
    console.log(`⏭️ Skipped: ${this.stats.skipped}`);
    console.log(`⏱️ Duration: ${durationMinutes} minutes`);
    console.log(
      `📈 Average Rate: ${(this.stats.processed / (duration / 1000)).toFixed(2)} wallets/second`,
    );

    if (this.stats.errors.length > 0) {
      console.log("\n❌ Errors:");
      this.stats.errors.slice(0, 10).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`... and ${this.stats.errors.length - 10} more errors`);
      }
    }

    // Update system metrics
    db.setSystemMetric("last_full_refresh", this.stats.endTime.toISOString());
    db.setSystemMetric("total_wallets", this.stats.totalWallets.toString());
    db.setSystemMetric("successful_wallets", this.stats.successful.toString());
    db.setSystemMetric("failed_wallets", this.stats.failed.toString());
  }

  private async processWalletBatch(
    wallets: Array<{ id: string; address: string }>,
  ): Promise<void> {
    const promises = wallets.map(async (wallet) => {
      if (this.shouldStop) return;

      try {
        // Check if wallet should be skipped
        if (!this.config.forceRefresh && !this.config.resumeFromFailures) {
          const existing = db.getWalletBalance(wallet.address);
          if (existing && existing.fetch_status === "success") {
            this.stats.skipped++;
            return;
          }
        }

        // If resumeFromFailures is true, only process failed wallets
        if (this.config.resumeFromFailures && !this.config.forceRefresh) {
          const existing = db.getWalletBalance(wallet.address);
          if (existing && existing.fetch_status === "success") {
            this.stats.skipped++;
            return;
          }
        }

        // Fetch wallet data
        await solanaService.getWalletData(wallet.address, wallet.id);
        this.stats.successful++;
      } catch (error) {
        this.stats.failed++;
        const errorMessage = `${wallet.address}: ${error instanceof Error ? error.message : "Unknown error"}`;
        this.stats.errors.push(errorMessage);

        // Log error but continue processing
        console.error(
          `❌ Failed to process ${wallet.address}:`,
          error instanceof Error ? error.message : error,
        );
      } finally {
        this.stats.processed++;
      }
    });

    await Promise.allSettled(promises);
  }

  private async refreshPrices(): Promise<void> {
    console.log("🔄 Refreshing token prices...");

    try {
      // Get all unique tokens from successful wallets
      const wallets = db.getWalletBalancesByStatus("success");
      const uniqueTokens = new Set<string>();

      for (const wallet of wallets) {
        try {
          const tokens = JSON.parse(wallet.tokens);
          if (Array.isArray(tokens)) {
            tokens.forEach((token) => {
              if (token.mint) {
                uniqueTokens.add(token.mint);
              }
            });
          }
        } catch (error) {
          console.error(
            `Error parsing tokens for ${wallet.wallet_address}:`,
            error,
          );
        }
      }

      // Refresh prices in batches
      const tokenMints = Array.from(uniqueTokens);
      const pricesBatchSize = 300; // Jupiter API can handle large batches

      for (let i = 0; i < tokenMints.length; i += pricesBatchSize) {
        const batch = tokenMints.slice(i, i + pricesBatchSize);

        try {
          await solanaService.getTokenPrices(batch);
          console.log(
            `✅ Refreshed prices for ${batch.length} tokens (${i + batch.length}/${tokenMints.length})`,
          );
        } catch (error) {
          console.error(
            `❌ Failed to refresh prices for batch ${i + 1}:`,
            error,
          );
        }

        // Small delay between price batches
        if (i + pricesBatchSize < tokenMints.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      console.log(
        `🎉 Price refresh completed for ${tokenMints.length} unique tokens`,
      );
    } catch (error) {
      console.error("❌ Price refresh failed:", error);
    }
  }

  public async run(): Promise<void> {
    if (this.isRunning) {
      console.log("⚠️ Prefetch is already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting wallet data prefetch...");
    console.log("=".repeat(60));

    try {
      // Load wallet data from CSV
      console.log("📂 Loading wallet data from CSV...");
      csvService.loadWallets();
      let wallets = csvService.getWalletsForProcessing();

      // Apply limit if specified
      if (this.config.limit && this.config.limit > 0) {
        wallets = wallets.slice(0, this.config.limit);
        console.log(
          `🔢 Limiting to first ${this.config.limit} wallets for testing`,
        );
      }

      this.stats.totalWallets = wallets.length;

      console.log(`📊 Found ${wallets.length} unique wallets to process`);
      console.log(`⚙️ Configuration:`);
      console.log(`   - Batch size: ${this.config.batchSize}`);
      console.log(
        `   - Delay between batches: ${this.config.delayBetweenBatches}ms`,
      );
      console.log(`   - Force refresh: ${this.config.forceRefresh}`);
      console.log(
        `   - Resume from failures: ${this.config.resumeFromFailures}`,
      );
      console.log("");

      // Process wallets in batches
      for (let i = 0; i < wallets.length; i += this.config.batchSize) {
        if (this.shouldStop) break;

        const batch = wallets.slice(i, i + this.config.batchSize);

        const batchNum = Math.floor(i / this.config.batchSize) + 1;
        const totalBatches = Math.ceil(wallets.length / this.config.batchSize);

        console.log(`\n${"─".repeat(60)}`);
        console.log(
          `🔄 Batch ${batchNum}/${totalBatches} - Processing ${batch.length} wallets`,
        );
        console.log(`${"─".repeat(60)}`);

        await this.processWalletBatch(batch);
        this.printProgress();

        // Delay between batches (except for the last batch)
        if (i + this.config.batchSize < wallets.length && !this.shouldStop) {
          console.log(
            `   ⏸️ Batch complete, waiting ${this.config.delayBetweenBatches}ms...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.delayBetweenBatches),
          );
        }
      }

      if (!this.shouldStop) {
        // Refresh token prices
        await this.refreshPrices();

        // Cleanup database
        console.log("🧹 Cleaning up database...");
        db.cleanup();
      }

      this.printFinalStats();
    } catch (error) {
      console.error("💥 Prefetch failed:", error);
      this.stats.errors.push(
        `Fatal error: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      this.isRunning = false;
    }
  }

  public async runHealthCheck(): Promise<void> {
    console.log("🔍 Running health check...");

    try {
      // Check CSV file
      const csvValidation = csvService.validateCSVFile();
      if (!csvValidation.isValid) {
        console.error("❌ CSV file validation failed:", csvValidation.error);
        return;
      }
      console.log("✅ CSV file is valid");

      // Check database connection
      const dbHealth = db.healthCheck();
      if (dbHealth.status !== "healthy") {
        console.error("❌ Database health check failed:", dbHealth.details);
        return;
      }
      console.log("✅ Database is healthy");

      // Check Solana service
      const solanaHealth = await solanaService.healthCheck();
      if (solanaHealth.status !== "healthy") {
        console.error(
          "❌ Solana service health check failed:",
          solanaHealth.details,
        );
        return;
      }
      console.log("✅ Solana service is healthy");

      // Print current stats
      const stats = csvService.getStats();
      const overview = db.getPortfolioOverview();

      console.log("\n📊 Current Status:");
      console.log(`   - CSV entries: ${stats.totalEntries}`);
      console.log(`   - Unique wallets: ${stats.uniqueWallets}`);
      console.log(`   - Processed wallets: ${overview.totalWallets}`);
      console.log(`   - Successful wallets: ${overview.successfulWallets}`);
      console.log(`   - Failed wallets: ${overview.errorWallets}`);
      console.log(`   - Last updated: ${overview.lastUpdated}`);

      console.log("\n🎉 Health check completed successfully!");
    } catch (error) {
      console.error("💥 Health check failed:", error);
    }
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "run";

  const config: Partial<PrefetchConfig> = {};

  // Parse command line arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--batch-size" && args[i + 1]) {
      config.batchSize = parseInt(args[i + 1]);
      i++;
    } else if (arg === "--delay" && args[i + 1]) {
      config.delayBetweenBatches = parseInt(args[i + 1]);
      i++;
    } else if (arg === "--limit" && args[i + 1]) {
      config.limit = parseInt(args[i + 1]);
      i++;
    } else if (arg === "--force-refresh") {
      config.forceRefresh = true;
    } else if (arg === "--no-resume") {
      config.resumeFromFailures = false;
    }
  }

  const prefetchService = new PrefetchService(config);

  switch (command) {
    case "run":
      await prefetchService.run();
      break;
    case "health":
      await prefetchService.runHealthCheck();
      break;
    case "help":
      console.log(`
🚀 Solana Portfolio Prefetch Script

Usage: bun run src/scripts/prefetch.ts [command] [options]

Commands:
  run      Run the prefetch process (default)
  health   Run health check
  help     Show this help message

Options:
  --batch-size <n>     Number of wallets to process per batch (default: 50)
  --delay <ms>         Delay between batches in milliseconds (default: 200)
  --limit <n>          Limit number of wallets to process (useful for testing)
  --force-refresh      Force refresh all wallets, even if already processed
  --no-resume          Don't resume from previous failures, process all wallets

Examples:
  bun run src/scripts/prefetch.ts run
  bun run src/scripts/prefetch.ts run --limit 10
  bun run src/scripts/prefetch.ts run --batch-size 100 --delay 500
  bun run src/scripts/prefetch.ts run --force-refresh
  bun run src/scripts/prefetch.ts health
      `);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log('Use "help" command for usage information');
      process.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  main().catch(console.error);
}

export { PrefetchService };
