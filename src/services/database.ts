import { Database } from "bun:sqlite";
import path from "path";

export interface WalletBalance {
  wallet_address: string;
  wallet_id: string;
  sol_balance: number;
  tokens: string; // JSON string
  last_updated: string;
  fetch_status: "success" | "error" | "pending";
  error_message?: string;
  retry_count: number;
}

export interface TokenPrice {
  mint: string;
  symbol: string;
  name: string;
  price: number;
  price_change_24h?: number;
  market_cap?: number;
  image_url?: string;
  last_updated: string;
  source: "jupiter" | "coingecko" | "fallback" | "jupiter-metadata";
}

export interface FetchLog {
  id?: number;
  wallet_address: string;
  timestamp: string;
  operation: "balance" | "tokens" | "prices" | "token-metadata";
  status: "success" | "error" | "timeout";
  error_details?: string;
  response_time_ms: number;
  details?: string;
}

export interface SystemMetric {
  metric_name: string;
  metric_value: string;
  last_updated: string;
}

export interface PortfolioSnapshot {
  id?: number;
  wallet_address: string;
  snapshot_timestamp: string;
  sol_balance: number;
  tokens: string; // JSON string
  total_usd_value: number;
  snapshot_type: "hourly" | "daily" | "manual";
}

export interface WalletPNL {
  wallet_address: string;
  initial_value_usd: number;
  current_value_usd: number;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  total_pnl_usd: number;
  total_pnl_percentage: number;
  first_snapshot_date: string;
  last_updated: string;
}

export interface TokenPNL {
  id?: number;
  wallet_address: string;
  token_mint: string;
  initial_amount: number;
  current_amount: number;
  initial_price_usd: number;
  current_price_usd: number;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  total_pnl_usd: number;
  last_updated: string;
}

export class DatabaseService {
  private db: Database;
  private static instance: DatabaseService;

  private constructor() {
    const dbPath = path.join(process.cwd(), "data", "portfolio.db");
    this.db = new Database(dbPath);
    this.initializeDatabase();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initializeDatabase(): void {
    // Enable WAL mode for better performance
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA synchronous = NORMAL");
    this.db.exec("PRAGMA cache_size = 1000");
    this.db.exec("PRAGMA temp_store = MEMORY");

    // Create wallet_balances table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_balances (
        wallet_address TEXT PRIMARY KEY,
        wallet_id TEXT NOT NULL,
        sol_balance REAL NOT NULL DEFAULT 0,
        tokens TEXT NOT NULL DEFAULT '[]',
        last_updated TEXT NOT NULL,
        fetch_status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        retry_count INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Create token_prices table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS token_prices (
        mint TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        price_change_24h REAL,
        market_cap REAL,
        image_url TEXT,
        last_updated TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'jupiter'
      )
    `);

    // Add image_url column if it doesn't exist (migration)
    try {
      this.db.exec(`ALTER TABLE token_prices ADD COLUMN image_url TEXT`);
    } catch (e) {
      // Column already exists, ignore error
    }

    // Add details column to fetch_logs if it doesn't exist (migration)
    try {
      this.db.exec(`ALTER TABLE fetch_logs ADD COLUMN details TEXT`);
    } catch (e) {
      // Column already exists, ignore error
    }

    // Create fetch_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS fetch_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        operation TEXT NOT NULL,
        status TEXT NOT NULL,
        error_details TEXT,
        response_time_ms INTEGER NOT NULL,
        details TEXT,
        FOREIGN KEY (wallet_address) REFERENCES wallet_balances(wallet_address)
      )
    `);

    // Create system_metrics table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS system_metrics (
        metric_name TEXT PRIMARY KEY,
        metric_value TEXT NOT NULL,
        last_updated TEXT NOT NULL
      )
    `);

    // Create portfolio_snapshots table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS portfolio_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        snapshot_timestamp TEXT NOT NULL,
        sol_balance REAL NOT NULL,
        tokens TEXT NOT NULL,
        total_usd_value REAL NOT NULL,
        snapshot_type TEXT NOT NULL,
        FOREIGN KEY (wallet_address) REFERENCES wallet_balances(wallet_address)
      )
    `);

    // Create wallet_pnl table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS wallet_pnl (
        wallet_address TEXT PRIMARY KEY,
        initial_value_usd REAL NOT NULL DEFAULT 0,
        current_value_usd REAL NOT NULL DEFAULT 0,
        realized_pnl_usd REAL NOT NULL DEFAULT 0,
        unrealized_pnl_usd REAL NOT NULL DEFAULT 0,
        total_pnl_usd REAL NOT NULL DEFAULT 0,
        total_pnl_percentage REAL NOT NULL DEFAULT 0,
        first_snapshot_date TEXT NOT NULL,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (wallet_address) REFERENCES wallet_balances(wallet_address)
      )
    `);

    // Create token_pnl table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS token_pnl (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        token_mint TEXT NOT NULL,
        initial_amount REAL NOT NULL DEFAULT 0,
        current_amount REAL NOT NULL DEFAULT 0,
        initial_price_usd REAL NOT NULL DEFAULT 0,
        current_price_usd REAL NOT NULL DEFAULT 0,
        realized_pnl_usd REAL NOT NULL DEFAULT 0,
        unrealized_pnl_usd REAL NOT NULL DEFAULT 0,
        total_pnl_usd REAL NOT NULL DEFAULT 0,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (wallet_address) REFERENCES wallet_balances(wallet_address),
        UNIQUE(wallet_address, token_mint)
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallet_balances_updated
      ON wallet_balances(last_updated)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallet_balances_status
      ON wallet_balances(fetch_status)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_prices_updated
      ON token_prices(last_updated)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fetch_logs_timestamp
      ON fetch_logs(timestamp)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fetch_logs_wallet
      ON fetch_logs(wallet_address)
    `);

    // Create indexes for PNL tables
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_wallet_timestamp
      ON portfolio_snapshots(wallet_address, snapshot_timestamp)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_timestamp
      ON portfolio_snapshots(snapshot_timestamp)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_wallet_pnl_updated
      ON wallet_pnl(last_updated)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_token_pnl_wallet_token
      ON token_pnl(wallet_address, token_mint)
    `);

    // Initialize system metrics
    this.initializeSystemMetrics();
  }

  private initializeSystemMetrics(): void {
    const now = new Date().toISOString();
    const metrics = [
      { name: "db_schema_version", value: "1.0.0" },
      { name: "total_wallets", value: "0" },
      { name: "last_full_refresh", value: now },
      { name: "app_start_time", value: now },
    ];

    const insertMetric = this.db.prepare(`
      INSERT OR REPLACE INTO system_metrics (metric_name, metric_value, last_updated)
      VALUES (?, ?, ?)
    `);

    for (const metric of metrics) {
      insertMetric.run(metric.name, metric.value, now);
    }
  }

  // Wallet Balance Operations
  public upsertWalletBalance(balance: WalletBalance): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wallet_balances
      (wallet_address, wallet_id, sol_balance, tokens, last_updated, fetch_status, error_message, retry_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      balance.wallet_address,
      balance.wallet_id,
      balance.sol_balance,
      balance.tokens,
      balance.last_updated,
      balance.fetch_status,
      balance.error_message || null,
      balance.retry_count,
    );
  }

  public getWalletBalance(address: string): WalletBalance | null {
    const stmt = this.db.prepare(`
      SELECT * FROM wallet_balances WHERE wallet_address = ?
    `);
    return stmt.get(address) as WalletBalance | null;
  }

  public getAllWalletBalances(): WalletBalance[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wallet_balances ORDER BY last_updated DESC
    `);
    return stmt.all() as WalletBalance[];
  }

  public getWalletBalancesByStatus(status: string): WalletBalance[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wallet_balances WHERE fetch_status = ?
    `);
    return stmt.all(status) as WalletBalance[];
  }

  // Token Price Operations
  public upsertTokenPrice(price: TokenPrice): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_prices
      (mint, symbol, name, price, price_change_24h, market_cap, image_url, last_updated, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      price.mint,
      price.symbol,
      price.name,
      price.price,
      price.price_change_24h || null,
      price.market_cap || null,
      price.image_url || null,
      price.last_updated,
      price.source,
    );
  }

  public getTokenPrice(mint: string): TokenPrice | null {
    const stmt = this.db.prepare(`
      SELECT * FROM token_prices WHERE mint = ?
    `);
    return stmt.get(mint) as TokenPrice | null;
  }

  public getAllTokenPrices(): TokenPrice[] {
    const stmt = this.db.prepare(`
      SELECT * FROM token_prices ORDER BY last_updated DESC
    `);
    return stmt.all() as TokenPrice[];
  }

  public getStaleTokenPrices(olderThanMinutes: number = 30): TokenPrice[] {
    const threshold = new Date(
      Date.now() - olderThanMinutes * 60 * 1000,
    ).toISOString();
    const stmt = this.db.prepare(`
      SELECT * FROM token_prices WHERE last_updated < ?
    `);
    return stmt.all(threshold) as TokenPrice[];
  }

  // Fetch Log Operations
  public insertFetchLog(log: Omit<FetchLog, "id">): void {
    const stmt = this.db.prepare(`
      INSERT INTO fetch_logs
      (wallet_address, timestamp, operation, status, error_details, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.wallet_address,
      log.timestamp,
      log.operation,
      log.status,
      log.error_details || null,
      log.response_time_ms,
    );
  }

  public getRecentFetchLogs(limit: number = 100): FetchLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM fetch_logs
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit) as FetchLog[];
  }

  public getFetchLogsByWallet(
    walletAddress: string,
    limit: number = 50,
  ): FetchLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM fetch_logs
      WHERE wallet_address = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(walletAddress, limit) as FetchLog[];
  }

  public getErrorLogs(limit: number = 50): FetchLog[] {
    const stmt = this.db.prepare(`
      SELECT * FROM fetch_logs
      WHERE status = 'error'
      ORDER BY timestamp DESC
      LIMIT ?
    `);
    return stmt.all(limit) as FetchLog[];
  }

  // System Metrics Operations
  public setSystemMetric(name: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO system_metrics (metric_name, metric_value, last_updated)
      VALUES (?, ?, ?)
    `);
    stmt.run(name, value, new Date().toISOString());
  }

  public getSystemMetric(name: string): SystemMetric | null {
    const stmt = this.db.prepare(`
      SELECT * FROM system_metrics WHERE metric_name = ?
    `);
    return stmt.get(name) as SystemMetric | null;
  }

  public getAllSystemMetrics(): SystemMetric[] {
    const stmt = this.db.prepare(`
      SELECT * FROM system_metrics ORDER BY metric_name
    `);
    return stmt.all() as SystemMetric[];
  }

  // Portfolio Analytics
  public getPortfolioOverview(): {
    totalWallets: number;
    totalSOL: number;
    totalUSDValue: number;
    uniqueTokens: number;
    lastUpdated: string;
    successfulWallets: number;
    errorWallets: number;
  } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalWallets,
        SUM(sol_balance) as totalSOL,
        COUNT(CASE WHEN fetch_status = 'success' THEN 1 END) as successfulWallets,
        COUNT(CASE WHEN fetch_status = 'error' THEN 1 END) as errorWallets,
        MAX(last_updated) as lastUpdated
      FROM wallet_balances
    `);

    const result = stmt.get() as any;

    // Calculate unique tokens and USD value
    const tokenStmt = this.db.prepare(`
      SELECT tokens FROM wallet_balances WHERE fetch_status = 'success'
    `);
    const tokenResults = tokenStmt.all() as { tokens: string }[];

    const uniqueTokens = new Set<string>();
    let totalTokenUSDValue = 0;

    for (const row of tokenResults) {
      try {
        const tokens = JSON.parse(row.tokens);
        if (Array.isArray(tokens)) {
          for (const token of tokens) {
            if (token.mint) {
              uniqueTokens.add(token.mint);
            }
            if (token.usdValue) {
              totalTokenUSDValue += token.usdValue;
            }
          }
        }
      } catch (error) {
        console.error("Error parsing tokens JSON:", error);
      }
    }

    // Get SOL price to calculate total USD value
    const SOL_MINT = "So11111111111111111111111111111111111111112";
    const solPriceStmt = this.db.prepare(`
      SELECT price FROM token_prices WHERE mint = ?
    `);
    const solPriceResult = solPriceStmt.get(SOL_MINT) as {
      price: number;
    } | null;
    const solPrice = solPriceResult?.price || 150; // Fallback to $150

    // Calculate total USD value including SOL
    const totalSOLValue = (result.totalSOL || 0) * solPrice;
    const totalUSDValue = totalSOLValue + totalTokenUSDValue;

    return {
      totalWallets: result.totalWallets || 0,
      totalSOL: result.totalSOL || 0,
      totalUSDValue,
      uniqueTokens: uniqueTokens.size,
      lastUpdated: result.lastUpdated || new Date().toISOString(),
      successfulWallets: result.successfulWallets || 0,
      errorWallets: result.errorWallets || 0,
    };
  }

  public getTopTokensByValue(limit: number = 20): Array<{
    mint: string;
    symbol: string;
    name: string;
    totalValue: number;
    totalAmount: number;
    walletCount: number;
  }> {
    const stmt = this.db.prepare(`
      SELECT tokens FROM wallet_balances WHERE fetch_status = 'success'
    `);
    const results = stmt.all() as { tokens: string }[];

    const tokenMap = new Map<
      string,
      {
        mint: string;
        symbol: string;
        name: string;
        totalValue: number;
        totalAmount: number;
        walletCount: number;
      }
    >();

    for (const row of results) {
      try {
        const tokens = JSON.parse(row.tokens);
        if (Array.isArray(tokens)) {
          for (const token of tokens) {
            const existing = tokenMap.get(token.mint) || {
              mint: token.mint,
              symbol: token.symbol || "Unknown",
              name: token.name || "Unknown Token",
              totalValue: 0,
              totalAmount: 0,
              walletCount: 0,
            };

            existing.totalValue += token.usdValue || 0;
            existing.totalAmount += token.amount || 0;
            existing.walletCount += 1;
            tokenMap.set(token.mint, existing);
          }
        }
      } catch (error) {
        console.error("Error parsing tokens JSON:", error);
      }
    }

    return Array.from(tokenMap.values())
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, limit);
  }

  // Utility Methods
  public cleanup(): void {
    // Clean up old fetch logs (keep last 1000 entries)
    this.db.exec(`
      DELETE FROM fetch_logs
      WHERE id NOT IN (
        SELECT id FROM fetch_logs
        ORDER BY timestamp DESC
        LIMIT 1000
      )
    `);

    // Clean up old portfolio snapshots (keep last 365 days)
    const oneYearAgo = new Date(
      Date.now() - 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    this.db.exec(
      `
      DELETE FROM portfolio_snapshots
      WHERE snapshot_timestamp < ? AND snapshot_type = 'hourly'
    `,
      oneYearAgo,
    );

    // Keep daily snapshots for longer (2 years)
    const twoYearsAgo = new Date(
      Date.now() - 730 * 24 * 60 * 60 * 1000,
    ).toISOString();
    this.db.exec(
      `
      DELETE FROM portfolio_snapshots
      WHERE snapshot_timestamp < ? AND snapshot_type = 'daily'
    `,
      twoYearsAgo,
    );

    // Optimize database
    this.db.exec("PRAGMA optimize");
  }

  // Portfolio Snapshot Operations
  public insertPortfolioSnapshot(
    snapshot: Omit<PortfolioSnapshot, "id">,
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO portfolio_snapshots
      (wallet_address, snapshot_timestamp, sol_balance, tokens, total_usd_value, snapshot_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      snapshot.wallet_address,
      snapshot.snapshot_timestamp,
      snapshot.sol_balance,
      snapshot.tokens,
      snapshot.total_usd_value,
      snapshot.snapshot_type,
    );
  }

  public getPortfolioSnapshots(
    walletAddress: string,
    limit: number = 100,
  ): PortfolioSnapshot[] {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_snapshots
      WHERE wallet_address = ?
      ORDER BY snapshot_timestamp DESC
      LIMIT ?
    `);
    return stmt.all(walletAddress, limit) as PortfolioSnapshot[];
  }

  public getLatestPortfolioSnapshot(
    walletAddress: string,
  ): PortfolioSnapshot | null {
    const stmt = this.db.prepare(`
      SELECT * FROM portfolio_snapshots
      WHERE wallet_address = ?
      ORDER BY snapshot_timestamp DESC
      LIMIT 1
    `);
    return stmt.get(walletAddress) as PortfolioSnapshot | null;
  }

  // Wallet PNL Operations
  public upsertWalletPNL(pnl: WalletPNL): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wallet_pnl
      (wallet_address, initial_value_usd, current_value_usd, realized_pnl_usd,
       unrealized_pnl_usd, total_pnl_usd, total_pnl_percentage, first_snapshot_date, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pnl.wallet_address,
      pnl.initial_value_usd,
      pnl.current_value_usd,
      pnl.realized_pnl_usd,
      pnl.unrealized_pnl_usd,
      pnl.total_pnl_usd,
      pnl.total_pnl_percentage,
      pnl.first_snapshot_date,
      pnl.last_updated,
    );
  }

  public getWalletPNL(walletAddress: string): WalletPNL | null {
    const stmt = this.db.prepare(`
      SELECT * FROM wallet_pnl WHERE wallet_address = ?
    `);
    return stmt.get(walletAddress) as WalletPNL | null;
  }

  public getAllWalletPNL(): WalletPNL[] {
    const stmt = this.db.prepare(`
      SELECT * FROM wallet_pnl ORDER BY total_pnl_usd DESC
    `);
    return stmt.all() as WalletPNL[];
  }

  // Token PNL Operations
  public upsertTokenPNL(pnl: Omit<TokenPNL, "id">): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO token_pnl
      (wallet_address, token_mint, initial_amount, current_amount, initial_price_usd,
       current_price_usd, realized_pnl_usd, unrealized_pnl_usd, total_pnl_usd, last_updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      pnl.wallet_address,
      pnl.token_mint,
      pnl.initial_amount,
      pnl.current_amount,
      pnl.initial_price_usd,
      pnl.current_price_usd,
      pnl.realized_pnl_usd,
      pnl.unrealized_pnl_usd,
      pnl.total_pnl_usd,
      pnl.last_updated,
    );
  }

  public getTokenPNL(
    walletAddress: string,
    tokenMint: string,
  ): TokenPNL | null {
    const stmt = this.db.prepare(`
      SELECT * FROM token_pnl WHERE wallet_address = ? AND token_mint = ?
    `);
    return stmt.get(walletAddress, tokenMint) as TokenPNL | null;
  }

  public getWalletTokenPNL(walletAddress: string): TokenPNL[] {
    const stmt = this.db.prepare(`
      SELECT * FROM token_pnl WHERE wallet_address = ? ORDER BY total_pnl_usd DESC
    `);
    return stmt.all(walletAddress) as TokenPNL[];
  }

  public getTokenPNLByMint(tokenMint: string): TokenPNL[] {
    const stmt = this.db.prepare(`
      SELECT * FROM token_pnl WHERE token_mint = ? ORDER BY total_pnl_usd DESC
    `);
    return stmt.all(tokenMint) as TokenPNL[];
  }

  // Combined PNL Analytics
  public getCombinedPNL(): {
    totalInitialValue: number;
    totalCurrentValue: number;
    totalRealizedPNL: number;
    totalUnrealizedPNL: number;
    totalPNL: number;
    totalPNLPercentage: number;
    topGainers: TokenPNL[];
    topLosers: TokenPNL[];
  } {
    const walletPNLs = this.getAllWalletPNL();

    const totalInitialValue = walletPNLs.reduce(
      (sum, pnl) => sum + pnl.initial_value_usd,
      0,
    );
    const totalCurrentValue = walletPNLs.reduce(
      (sum, pnl) => sum + pnl.current_value_usd,
      0,
    );
    const totalRealizedPNL = walletPNLs.reduce(
      (sum, pnl) => sum + pnl.realized_pnl_usd,
      0,
    );
    const totalUnrealizedPNL = walletPNLs.reduce(
      (sum, pnl) => sum + pnl.unrealized_pnl_usd,
      0,
    );
    const totalPNL = totalRealizedPNL + totalUnrealizedPNL;
    const totalPNLPercentage =
      totalInitialValue > 0 ? (totalPNL / totalInitialValue) * 100 : 0;

    // Get top gainers and losers by token
    const topGainersStmt = this.db.prepare(`
      SELECT token_mint, SUM(total_pnl_usd) as total_pnl,
             AVG(current_price_usd) as avg_price,
             SUM(current_amount) as total_amount
      FROM token_pnl
      GROUP BY token_mint
      ORDER BY total_pnl DESC
      LIMIT 10
    `);

    const topLosersStmt = this.db.prepare(`
      SELECT token_mint, SUM(total_pnl_usd) as total_pnl,
             AVG(current_price_usd) as avg_price,
             SUM(current_amount) as total_amount
      FROM token_pnl
      GROUP BY token_mint
      ORDER BY total_pnl ASC
      LIMIT 10
    `);

    const topGainers = topGainersStmt.all() as TokenPNL[];
    const topLosers = topLosersStmt.all() as TokenPNL[];

    return {
      totalInitialValue,
      totalCurrentValue,
      totalRealizedPNL,
      totalUnrealizedPNL,
      totalPNL,
      totalPNLPercentage,
      topGainers,
      topLosers,
    };
  }

  // PNL Calculation Methods
  public calculateWalletPNL(walletAddress: string): WalletPNL | null {
    const currentBalance = this.getWalletBalance(walletAddress);
    const firstSnapshot = this.db
      .prepare(
        `
      SELECT * FROM portfolio_snapshots
      WHERE wallet_address = ?
      ORDER BY snapshot_timestamp ASC
      LIMIT 1
    `,
      )
      .get(walletAddress) as PortfolioSnapshot | null;

    if (!currentBalance || !firstSnapshot) {
      return null;
    }

    const initialValue = firstSnapshot.total_usd_value;
    const currentValue = this.calculateCurrentWalletValue(walletAddress);
    const unrealizedPNL = currentValue - initialValue;
    const realizedPNL = 0; // TODO: Calculate from transaction history
    const totalPNL = unrealizedPNL + realizedPNL;
    const totalPNLPercentage =
      initialValue > 0 ? (totalPNL / initialValue) * 100 : 0;

    return {
      wallet_address: walletAddress,
      initial_value_usd: initialValue,
      current_value_usd: currentValue,
      realized_pnl_usd: realizedPNL,
      unrealized_pnl_usd: unrealizedPNL,
      total_pnl_usd: totalPNL,
      total_pnl_percentage: totalPNLPercentage,
      first_snapshot_date: firstSnapshot.snapshot_timestamp,
      last_updated: new Date().toISOString(),
    };
  }

  private calculateCurrentWalletValue(walletAddress: string): number {
    const balance = this.getWalletBalance(walletAddress);
    if (!balance) return 0;

    try {
      const tokens = JSON.parse(balance.tokens);
      return tokens.reduce(
        (sum: number, token: any) => sum + (token.usdValue || 0),
        0,
      );
    } catch {
      return 0;
    }
  }

  public close(): void {
    this.db.close();
  }

  // Health check
  public healthCheck(): { status: "healthy" | "unhealthy"; details: any } {
    try {
      const result = this.db.query("SELECT 1").get();
      const metrics = this.getAllSystemMetrics();

      return {
        status: "healthy",
        details: {
          database: "connected",
          metrics: metrics.length,
          lastCheck: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        status: "unhealthy",
        details: {
          database: "disconnected",
          error: error instanceof Error ? error.message : "Unknown error",
          lastCheck: new Date().toISOString(),
        },
      };
    }
  }
}

// Export singleton instance
export const db = DatabaseService.getInstance();
