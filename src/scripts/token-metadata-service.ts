#!/usr/bin/env bun

import tokenMetadataService from "../services/background/token-metadata";

// Command line argument parsing
const args = process.argv.slice(2);
const command = args[0] || "start";

async function main() {
  console.log("🚀 Token Metadata Service");
  console.log("========================");

  switch (command) {
    case "start":
      await startContinuousService();
      break;
    case "refresh":
      await refreshStaleMetadata();
      break;
    case "health":
      await healthCheck();
      break;
    case "queue":
      await showQueueStatus();
      break;
    case "clear":
      await clearQueue();
      break;
    case "help":
      showHelp();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function startContinuousService() {
  console.log("Starting continuous token metadata service...");
  console.log("Press Ctrl+C to stop gracefully");

  try {
    // Start background refresh every 60 minutes
    tokenMetadataService.startBackgroundRefresh(60);

    // Initial refresh of stale metadata
    console.log("Running initial metadata refresh...");
    tokenMetadataService.refreshStaleMetadata();

    // Keep the process alive
    console.log("Service is running. Monitoring for new tokens...");

    // Set up periodic status logging
    const statusInterval = setInterval(() => {
      const status = tokenMetadataService.getQueueStatus();
      if (status.queueSize > 0) {
        console.log(`Queue status: ${status.queueSize} tokens pending, processing: ${status.isProcessing}`);
        if (status.nextToken) {
          console.log(`Next token: ${status.nextToken}`);
        }
      }
    }, 30000); // Log every 30 seconds if queue has items

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log("\n🛑 Shutdown signal received");
      clearInterval(statusInterval);
    });

    process.on('SIGTERM', () => {
      console.log("\n🛑 Termination signal received");
      clearInterval(statusInterval);
    });

    // Keep process alive
    await new Promise(() => {}); // Never resolves, keeps process running
  } catch (error) {
    console.error("❌ Error starting continuous service:", error);
    process.exit(1);
  }
}

async function refreshStaleMetadata() {
  console.log("🔄 Refreshing stale token metadata...");

  try {
    const staleTokens = tokenMetadataService.getTokensNeedingMetadata();
    console.log(`Found ${staleTokens.length} tokens needing metadata refresh`);

    if (staleTokens.length === 0) {
      console.log("✅ No tokens need metadata refresh");
      return;
    }

    // Add tokens to queue
    tokenMetadataService.addBatchToQueue(staleTokens, 5);

    // Wait for processing to complete
    let lastQueueSize = -1;
    while (true) {
      const status = tokenMetadataService.getQueueStatus();

      if (status.queueSize !== lastQueueSize) {
        console.log(`Processing... ${status.queueSize} tokens remaining`);
        lastQueueSize = status.queueSize;
      }

      if (status.queueSize === 0 && !status.isProcessing) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log("✅ Metadata refresh completed");
  } catch (error) {
    console.error("❌ Error during metadata refresh:", error);
    process.exit(1);
  }
}

async function healthCheck() {
  console.log("🏥 Running health check...");

  try {
    const health = await tokenMetadataService.healthCheck();

    console.log(`Status: ${health.status === "healthy" ? "✅ Healthy" : "❌ Unhealthy"}`);
    console.log("Details:");
    console.log(JSON.stringify(health.details, null, 2));

    if (health.status === "unhealthy") {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Health check failed:", error);
    process.exit(1);
  }
}

async function showQueueStatus() {
  console.log("📊 Queue Status");
  console.log("===============");

  const status = tokenMetadataService.getQueueStatus();
  console.log(`Queue Size: ${status.queueSize}`);
  console.log(`Processing: ${status.isProcessing ? "Yes" : "No"}`);

  if (status.nextToken) {
    console.log(`Next Token: ${status.nextToken}`);
  }

  if (status.queueSize === 0) {
    console.log("✅ Queue is empty");
  }
}

async function clearQueue() {
  console.log("🧹 Clearing token metadata queue...");

  const status = tokenMetadataService.getQueueStatus();
  if (status.queueSize > 0) {
    tokenMetadataService.clearQueue();
    console.log(`✅ Cleared ${status.queueSize} items from queue`);
  } else {
    console.log("✅ Queue was already empty");
  }
}

function showHelp() {
  console.log(`
Token Metadata Service Commands:
================================

bun run token-metadata-service start     - Start continuous service (default)
bun run token-metadata-service refresh   - Refresh stale metadata once
bun run token-metadata-service health    - Check service health
bun run token-metadata-service queue     - Show queue status
bun run token-metadata-service clear     - Clear the queue
bun run token-metadata-service help      - Show this help

Examples:
---------
# Start the service and keep it running
bun run token-metadata-service start

# Do a one-time refresh of stale metadata
bun run token-metadata-service refresh

# Check if the service can connect to Jupiter API
bun run token-metadata-service health

Environment Variables:
----------------------
JUPITER_TOKENS_API_URL  - Jupiter tokens API endpoint (default: https://lite-api.jup.ag/tokens/v1)
DATABASE_PATH           - Path to SQLite database (default: ./data/portfolio.db)
`);
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
main().catch((error) => {
  console.error('❌ Application error:', error);
  process.exit(1);
});
