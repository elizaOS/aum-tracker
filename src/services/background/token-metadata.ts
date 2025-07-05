import { DatabaseService } from "../database";

interface TokenMetadataRequest {
  mint: string;
  priority: number;
  retryCount: number;
  requestedAt: Date;
}

interface TokenMetadataResponse {
  symbol: string;
  name: string;
  logoURI?: string;
}

class TokenMetadataService {
  private db: DatabaseService;
  private jupiterTokensApiUrl: string;
  private requestQueue: TokenMetadataRequest[] = [];
  private isProcessing = false;
  private maxRetries = 3;
  private baseDelay = 1000;
  private requestDelay = 500; // 500ms between requests to respect rate limits
  private maxConcurrentRequests = 1; // Process one at a time
  private shutdownRequested = false;
  private batchStats = {
    processed: 0,
    successful: 0,
    failed: 0,
    batchStartTime: 0,
  };

  constructor() {
    this.db = DatabaseService.getInstance();
    this.jupiterTokensApiUrl =
      process.env.JUPITER_TOKENS_API_URL || "https://lite-api.jup.ag/tokens/v1";

    // Setup graceful shutdown
    process.on("SIGINT", this.gracefulShutdown.bind(this));
    process.on("SIGTERM", this.gracefulShutdown.bind(this));
  }

  // Add token to metadata fetch queue
  public addToQueue(mint: string, priority: number = 0): void {
    // Check if already in queue
    const existingRequest = this.requestQueue.find((req) => req.mint === mint);
    if (existingRequest) {
      // Update priority if higher
      if (priority > existingRequest.priority) {
        existingRequest.priority = priority;
      }
      return;
    }

    // Check if we already have recent metadata
    const existingMetadata = this.db.getTokenPrice(mint);
    if (
      existingMetadata &&
      this.isMetadataFresh(existingMetadata.last_updated)
    ) {
      console.log(`Token ${mint} metadata is fresh, skipping queue`);
      return;
    }

    this.requestQueue.push({
      mint,
      priority,
      retryCount: 0,
      requestedAt: new Date(),
    });

    // Sort queue by priority (high to low)
    this.requestQueue.sort((a, b) => b.priority - a.priority);

    // Silently add to queue to reduce log verbosity

    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  // Add multiple tokens to queue
  public addBatchToQueue(mints: string[], priority: number = 0): void {
    mints.forEach((mint) => this.addToQueue(mint, priority));
  }

  // Check if metadata is fresh (less than 24 hours old)
  private isMetadataFresh(lastUpdated: string): boolean {
    const updated = new Date(lastUpdated);
    const now = new Date();
    const hoursDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
    return hoursDiff < 24;
  }

  // Start processing the queue
  private async startProcessing(): Promise<void> {
    if (this.isProcessing || this.shutdownRequested) {
      return;
    }

    this.isProcessing = true;

    // Reset batch stats
    this.batchStats = {
      processed: 0,
      successful: 0,
      failed: 0,
      batchStartTime: Date.now(),
    };

    while (this.requestQueue.length > 0 && !this.shutdownRequested) {
      const request = this.requestQueue.shift();
      if (!request) continue;

      try {
        await this.processTokenMetadata(request);
        this.batchStats.successful++;
      } catch (error) {
        this.batchStats.failed++;

        // Retry logic
        if (request.retryCount < this.maxRetries) {
          request.retryCount++;
          // Add back to queue with lower priority
          this.requestQueue.push({
            ...request,
            priority: Math.max(0, request.priority - 1),
          });
        }
      }

      this.batchStats.processed++;

      // Delay between requests to respect rate limits
      if (this.requestQueue.length > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.requestDelay));
      }
    }

    // Print batch summary if any tokens were processed
    if (this.batchStats.processed > 0) {
      this.printBatchSummary();
    }

    this.isProcessing = false;
  }

  // Process individual token metadata
  private async processTokenMetadata(
    request: TokenMetadataRequest,
  ): Promise<void> {
    const { mint } = request;
    const startTime = Date.now();

    try {
      const metadata = await this.withRetry(async () => {
        const response = await fetch(
          `${this.jupiterTokensApiUrl}/token/${mint}`,
        );

        if (!response.ok) {
          throw new Error(
            `Jupiter API error: ${response.status} - ${response.statusText}`,
          );
        }

        const data = await response.json();
        return {
          symbol: data.symbol || "Unknown",
          name: data.name || "Unknown Token",
          logoURI: data.logoURI || undefined,
        };
      });

      // Store metadata in database
      this.db.upsertTokenPrice({
        mint,
        symbol: metadata.symbol,
        name: metadata.name,
        price: 0, // Price will be updated by price service
        price_change_24h: undefined,
        market_cap: undefined,
        image_url: metadata.logoURI,
        last_updated: new Date().toISOString(),
        source: "jupiter-metadata",
      });

      // Log successful fetch
      this.db.insertFetchLog({
        wallet_address: "metadata-service",
        timestamp: new Date().toISOString(),
        operation: "token-metadata",
        status: "success",
        response_time_ms: Date.now() - startTime,
        details: mint,
      });

      // Successfully fetched metadata silently
    } catch (error) {
      // Log error
      this.db.insertFetchLog({
        wallet_address: "metadata-service",
        timestamp: new Date().toISOString(),
        operation: "token-metadata",
        status: "error",
        error_details: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - startTime,
        details: mint,
      });

      throw error;
    }
  }

  // Retry mechanism with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.maxRetries,
    baseDelay: number = this.baseDelay,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) throw error;

        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error("All retry attempts failed");
  }

  // Get queue status
  public getQueueStatus(): {
    queueSize: number;
    isProcessing: boolean;
    nextToken?: string;
  } {
    return {
      queueSize: this.requestQueue.length,
      isProcessing: this.isProcessing,
      nextToken: this.requestQueue[0]?.mint,
    };
  }

  // Clear the queue
  public clearQueue(): void {
    this.requestQueue = [];
    console.log("Token metadata queue cleared");
  }

  // Get tokens that need metadata refresh
  public getTokensNeedingMetadata(): string[] {
    const allTokens = this.db.getAllTokenPrices();
    return allTokens
      .filter(
        (token) =>
          !token.symbol ||
          token.symbol === "Unknown" ||
          !this.isMetadataFresh(token.last_updated),
      )
      .map((token) => token.mint);
  }

  // Refresh stale metadata
  public refreshStaleMetadata(): void {
    const staleTokens = this.getTokensNeedingMetadata();
    console.log(`Found ${staleTokens.length} tokens needing metadata refresh`);

    this.addBatchToQueue(staleTokens, 1);
  }

  // Health check
  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details: any;
  }> {
    try {
      const startTime = Date.now();

      // Test Jupiter Token API
      const response = await fetch(
        `${this.jupiterTokensApiUrl}/token/So11111111111111111111111111111111111111112`,
      );
      const responseTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      return {
        status: "healthy",
        details: {
          jupiter_tokens_api: {
            url: this.jupiterTokensApiUrl,
            response_time_ms: responseTime,
            status: response.status,
          },
          queue_status: this.getQueueStatus(),
          last_check: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          queue_status: this.getQueueStatus(),
          last_check: new Date().toISOString(),
        },
      };
    }
  }

  // Graceful shutdown
  private async gracefulShutdown(): Promise<void> {
    console.log("Shutting down token metadata service...");
    this.shutdownRequested = true;

    // Wait for current processing to complete
    while (this.isProcessing) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("Token metadata service shut down gracefully");
    process.exit(0);
  }

  // Start background metadata refresh (run periodically)
  public startBackgroundRefresh(intervalMinutes: number = 60): void {
    console.log(
      `Starting background metadata refresh every ${intervalMinutes} minutes`,
    );

    const interval = setInterval(
      () => {
        if (!this.shutdownRequested) {
          console.log("Running background metadata refresh...");
          this.refreshStaleMetadata();
        } else {
          clearInterval(interval);
        }
      },
      intervalMinutes * 60 * 1000,
    );
  }

  // Print batch processing summary
  private printBatchSummary(): void {
    const duration = Date.now() - this.batchStats.batchStartTime;
    const rate = this.batchStats.processed / (duration / 1000);

    console.log(
      `   🎯 Metadata batch complete: ${this.batchStats.successful} successful, ` +
        `${this.batchStats.failed} failed, ${rate.toFixed(1)}/s`,
    );
  }

  // Get current batch processing stats
  public getBatchStats(): {
    processed: number;
    successful: number;
    failed: number;
    isProcessing: boolean;
  } {
    return {
      processed: this.batchStats.processed,
      successful: this.batchStats.successful,
      failed: this.batchStats.failed,
      isProcessing: this.isProcessing,
    };
  }
}

// Create singleton instance
const tokenMetadataService = new TokenMetadataService();
export default tokenMetadataService;
export { TokenMetadataService };
