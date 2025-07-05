import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, PublicKey } from "@solana/web3.js";
import { db, TokenPrice } from "./database";
import tokenMetadataService from "./background/token-metadata";

export interface TokenAccount {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
  usdValue?: number;
}

export interface WalletData {
  address: string;
  solBalance: number;
  tokens: TokenAccount[];
  totalUsdValue: number;
  lastUpdated: string;
}

export interface PriceData {
  [mint: string]: {
    price: number;
    symbol: string;
    name: string;
    change24h?: number;
    marketCap?: number;
  };
}

export class SolanaService {
  private connection: Connection;
  private fallbackConnection: Connection;
  private rpcUrl: string;
  private jupiterApiUrl: string;
  private jupiterTokensApiUrl: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue: boolean = false;
  private rateLimitDelay: number = 100; // 100ms between requests for premium Helius
  private maxRetries: number = 3;

  constructor() {
    // Helius RPC endpoint from environment variable
    this.rpcUrl = process.env.HELIUS_RPC_URL || "";

    if (!this.rpcUrl) {
      throw new Error("HELIUS_RPC_URL environment variable is required");
    }

    // Initialize connection using Helius RPC endpoint
    this.connection = new Connection(this.rpcUrl, {
      commitment: "confirmed",
      httpHeaders: {
        "Content-Type": "application/json",
      },
    });

    // Fallback to public RPC if Helius fails
    this.fallbackConnection = new Connection(clusterApiUrl("mainnet-beta"), {
      commitment: "confirmed",
    });

    this.jupiterApiUrl =
      process.env.JUPITER_API_URL || "https://lite-api.jup.ag/price/v2";
    this.jupiterTokensApiUrl =
      process.env.JUPITER_TOKENS_API_URL || "https://lite-api.jup.ag/tokens/v1";
  }

  // Rate limiting queue management
  private async addToQueue<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      if (!this.isProcessingQueue) {
        this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const operation = this.requestQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          console.error("Queue operation failed:", error);
        }

        // Rate limiting delay (Premium Helius can handle 1000+ req/min)
        if (this.requestQueue.length > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, this.rateLimitDelay),
          );
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // Retry wrapper with exponential backoff
  private async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = this.maxRetries,
    baseDelay: number = 1000,
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

  // Get SOL balance for a wallet using Helius
  public async getSOLBalance(address: string): Promise<number> {
    const startTime = Date.now();

    try {
      const publicKey = new PublicKey(address);

      const balance = await this.addToQueue(async () => {
        return await this.withRetry(async () => {
          try {
            // Use Helius connection for better rate limits
            return await this.connection.getBalance(publicKey);
          } catch (error) {
            console.log(`Helius RPC failed for ${address}, trying fallback...`);
            return await this.fallbackConnection.getBalance(publicKey);
          }
        });
      });

      const solBalance = balance / 1e9; // Convert lamports to SOL

      // Log successful fetch
      db.insertFetchLog({
        wallet_address: address,
        timestamp: new Date().toISOString(),
        operation: "balance",
        status: "success",
        response_time_ms: Date.now() - startTime,
      });

      return solBalance;
    } catch (error) {
      // Log error
      db.insertFetchLog({
        wallet_address: address,
        timestamp: new Date().toISOString(),
        operation: "balance",
        status: "error",
        error_details: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  // Get ALL SPL token accounts for a wallet using Helius enhanced RPC
  public async getTokenAccounts(address: string): Promise<TokenAccount[]> {
    const startTime = Date.now();

    try {
      const publicKey = new PublicKey(address);

      const tokenAccounts = await this.addToQueue(async () => {
        return await this.withRetry(async () => {
          try {
            // Use Helius connection for better rate limits and enhanced data
            const [splTokens, token2022s] = await Promise.all([
              this.connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID,
              }),
              this.connection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_2022_PROGRAM_ID,
              }),
            ]);

            return [...splTokens.value, ...token2022s.value];
          } catch (error) {
            console.log(
              `Helius token fetch failed for ${address}, trying fallback...`,
            );
            const [splTokens, token2022s] = await Promise.all([
              this.fallbackConnection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_PROGRAM_ID,
              }),
              this.fallbackConnection.getParsedTokenAccountsByOwner(publicKey, {
                programId: TOKEN_2022_PROGRAM_ID,
              }),
            ]);

            return [...splTokens.value, ...token2022s.value];
          }
        });
      });

      const tokens: TokenAccount[] = [];

      // Process ALL token accounts found with CORRECT decimals
      for (const accountInfo of tokenAccounts) {
        const parsedInfo = accountInfo.account.data.parsed?.info;
        if (parsedInfo && parsedInfo.tokenAmount.uiAmount > 0) {
          tokens.push({
            mint: parsedInfo.mint,
            amount: parsedInfo.tokenAmount.uiAmount, // Already adjusted for decimals
            decimals: parsedInfo.tokenAmount.decimals, // REAL decimals from blockchain
          });
        }
      }

      // Log successful fetch
      db.insertFetchLog({
        wallet_address: address,
        timestamp: new Date().toISOString(),
        operation: "tokens",
        status: "success",
        response_time_ms: Date.now() - startTime,
      });

      return tokens;
    } catch (error) {
      // Log error
      db.insertFetchLog({
        wallet_address: address,
        timestamp: new Date().toISOString(),
        operation: "tokens",
        status: "error",
        error_details: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  // Get token metadata from cache or queue for background fetching
  public async getTokenMetadata(mints: string[]): Promise<{
    [mint: string]: { symbol: string; name: string; logoURI?: string };
  }> {
    if (mints.length === 0) return {};

    const metadata: {
      [mint: string]: { symbol: string; name: string; logoURI?: string };
    } = {};

    const missingTokens: string[] = [];

    // Check cache first
    for (const mint of mints) {
      const cachedToken = db.getTokenPrice(mint);
      if (
        cachedToken &&
        cachedToken.symbol &&
        cachedToken.symbol !== "Unknown"
      ) {
        metadata[mint] = {
          symbol: cachedToken.symbol,
          name: cachedToken.name || "Unknown Token",
          logoURI: cachedToken.image_url || undefined,
        };
      } else {
        // Set default metadata for immediate use
        metadata[mint] = {
          symbol: "Unknown",
          name: "Unknown Token",
          logoURI: undefined,
        };
        missingTokens.push(mint);
      }
    }

    // Queue missing tokens for background fetching with high priority
    if (missingTokens.length > 0) {
      tokenMetadataService.addBatchToQueue(missingTokens, 10); // High priority
    }

    return metadata;
  }

  // Get SOL price from Jupiter API
  public async getSOLPrice(): Promise<number> {
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    try {
      const solPrice = await this.withRetry(async () => {
        const response = await fetch(`${this.jupiterApiUrl}?ids=${SOL_MINT}`);

        if (!response.ok) {
          throw new Error(`Jupiter API error: ${response.status}`);
        }

        const data = await response.json();
        return parseFloat(data.data?.[SOL_MINT]?.price || "0");
      });

      // Store SOL price in database
      if (solPrice > 0) {
        db.upsertTokenPrice({
          mint: SOL_MINT,
          symbol: "SOL",
          name: "Solana",
          price: solPrice,
          price_change_24h: undefined,
          market_cap: undefined,
          image_url:
            "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
          last_updated: new Date().toISOString(),
          source: "jupiter",
        });
      }

      return solPrice;
    } catch (error) {
      console.error("Error fetching SOL price:", error);
      // Return cached price if available
      const cached = db.getAllTokenPrices().find((p) => p.mint === SOL_MINT);
      return cached?.price || 150; // Fallback to $150
    }
  }

  // Get token prices from Jupiter API (keep existing implementation)
  public async getTokenPrices(mints: string[]): Promise<PriceData> {
    if (mints.length === 0) return {};

    const startTime = Date.now();

    try {
      // Always include SOL in price fetches
      const SOL_MINT = "So11111111111111111111111111111111111111112";
      const mintsWithSol = Array.from(new Set([...mints, SOL_MINT]));

      // Fetch prices with retry, get metadata from cache/queue
      const [pricesResponse, metadata] = await Promise.all([
        this.withRetry(async () => {
          const response = await fetch(
            `${this.jupiterApiUrl}?ids=${mintsWithSol.join(",")}`,
          );
          if (!response.ok) {
            throw new Error(`Jupiter API error: ${response.status}`);
          }
          return response;
        }),
        this.getTokenMetadata(mintsWithSol),
      ]);

      const pricesData = await pricesResponse.json();
      const prices: PriceData = {};

      for (const [mint, priceInfo] of Object.entries(pricesData.data || {})) {
        const info = priceInfo as any;
        const tokenMetadata = metadata[mint] || {
          symbol: mint === SOL_MINT ? "SOL" : "Unknown",
          name: mint === SOL_MINT ? "Solana" : "Unknown Token",
        };

        prices[mint] = {
          price: parseFloat(info.price || "0"),
          symbol: tokenMetadata.symbol,
          name: tokenMetadata.name,
          change24h: undefined, // Not available in price API v2
          marketCap: undefined, // Not available in price API v2
        };

        // Store in database with proper metadata
        db.upsertTokenPrice({
          mint,
          symbol: tokenMetadata.symbol,
          name: tokenMetadata.name,
          price: parseFloat(info.price || "0"),
          price_change_24h: undefined,
          market_cap: undefined,
          image_url: tokenMetadata.logoURI,
          last_updated: new Date().toISOString(),
          source: "jupiter",
        });
      }

      // Log successful fetch
      db.insertFetchLog({
        wallet_address: "system",
        timestamp: new Date().toISOString(),
        operation: "prices",
        status: "success",
        response_time_ms: Date.now() - startTime,
      });

      return prices;
    } catch (error) {
      // Log error
      db.insertFetchLog({
        wallet_address: "system",
        timestamp: new Date().toISOString(),
        operation: "prices",
        status: "error",
        error_details: error instanceof Error ? error.message : "Unknown error",
        response_time_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  // Get complete wallet data (SOL + ALL tokens + prices) with enhanced Helius integration
  public async getWalletData(
    address: string,
    walletId: string,
  ): Promise<WalletData> {
    try {
      // Get SOL balance and ALL token accounts in parallel
      const [solBalance, tokenAccounts] = await Promise.all([
        this.getSOLBalance(address),
        this.getTokenAccounts(address),
      ]);

      // Get metadata and prices for ALL tokens found
      const mints = tokenAccounts.map((token) => token.mint);
      const [metadata, prices] = await Promise.all([
        this.getTokenMetadata(mints),
        this.getTokenPrices(mints),
      ]);

      // Enhance token data with metadata and prices
      const enhancedTokens: TokenAccount[] = tokenAccounts.map((token) => {
        const tokenMetadata = metadata[token.mint];
        const priceData = prices[token.mint];

        return {
          ...token,
          symbol: tokenMetadata?.symbol || priceData?.symbol || "Unknown",
          name: tokenMetadata?.name || priceData?.name || "Unknown Token",
          usdValue: priceData ? token.amount * priceData.price : 0,
        };
      });

      const totalUsdValue = enhancedTokens.reduce(
        (sum, token) => sum + (token.usdValue || 0),
        0,
      );

      const walletData: WalletData = {
        address,
        solBalance,
        tokens: enhancedTokens,
        totalUsdValue,
        lastUpdated: new Date().toISOString(),
      };

      // Store in database
      db.upsertWalletBalance({
        wallet_address: address,
        wallet_id: walletId,
        sol_balance: solBalance,
        tokens: JSON.stringify(enhancedTokens),
        last_updated: walletData.lastUpdated,
        fetch_status: "success",
        retry_count: 0,
      });

      return walletData;
    } catch (error) {
      // Store error in database
      db.upsertWalletBalance({
        wallet_address: address,
        wallet_id: walletId,
        sol_balance: 0,
        tokens: "[]",
        last_updated: new Date().toISOString(),
        fetch_status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
        retry_count: 0,
      });

      throw error;
    }
  }

  // Batch process multiple wallets with improved error handling
  public async processWalletBatch(
    wallets: Array<{ id: string; address: string }>,
    batchSize: number = 5,
  ): Promise<{
    successful: number;
    failed: number;
    errors: string[];
  }> {
    const results = {
      successful: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (let i = 0; i < wallets.length; i += batchSize) {
      const batch = wallets.slice(i, i + batchSize);

      const promises = batch.map(async (wallet) => {
        try {
          await this.getWalletData(wallet.address, wallet.id);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push(
            `${wallet.address}: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      });

      await Promise.allSettled(promises);

      // Shorter delay between batches with Helius
      if (i + batchSize < wallets.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    return results;
  }

  // Refresh stale prices
  public async refreshStaleTokenPrices(): Promise<void> {
    const staleTokens = db.getStaleTokenPrices(30); // 30 minutes

    if (staleTokens.length === 0) return;

    const mints = staleTokens.map((token) => token.mint);

    try {
      await this.getTokenPrices(mints);
      console.log(`Refreshed prices for ${mints.length} tokens`);
    } catch (error) {
      console.error("Failed to refresh stale token prices:", error);
    }
  }

  // Get cached token prices
  public getCachedTokenPrices(): TokenPrice[] {
    return db.getAllTokenPrices();
  }

  // Health check with Helius RPC endpoint testing
  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    details: any;
  }> {
    try {
      const startTime = Date.now();

      // Test Helius RPC connection
      const slot = await this.connection.getSlot();
      const heliusResponseTime = Date.now() - startTime;

      // Test Jupiter API
      const jupiterStartTime = Date.now();
      const jupiterResponse = await this.withRetry(async () => {
        const response = await fetch(
          `${this.jupiterApiUrl}?ids=So11111111111111111111111111111111111111112`,
        );
        if (!response.ok) {
          throw new Error(`Jupiter API error: ${response.status}`);
        }
        return response;
      });
      const jupiterResponseTime = Date.now() - jupiterStartTime;

      return {
        status: "healthy",
        details: {
          helius_rpc: {
            url: "[REDACTED]",
            slot,
            response_time_ms: heliusResponseTime,
          },
          jupiter_api: {
            url: this.jupiterApiUrl,
            response_time_ms: jupiterResponseTime,
            status: jupiterResponse.status,
          },
          queue_size: this.requestQueue.length,
          last_check: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          queue_size: this.requestQueue.length,
          last_check: new Date().toISOString(),
        },
      };
    }
  }

  // Validate Solana address
  public isValidSolanaAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const solanaService = new SolanaService();
