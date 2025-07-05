# Product Requirements Document: Solana Portfolio Tracker

## Executive Summary
A high-performance web application to track and analyze Solana wallet holdings across multiple addresses, providing real-time portfolio valuation and asset distribution insights.

## Core Requirements

### 1. Data Source
- [x] **Input**: CSV file (`wallets.csv`) containing wallet addresses
  - [x] Format: `id,solana_public_key`

### 2. Blockchain Integration
- [x] **Helius SDK**: Primary blockchain data provider
  - [x] SDK Configuration: Set via `HELIUS_RPC_URL` environment variable
  - [x] Enhanced API features:
    - [x] `getAssetsByOwner()` for comprehensive token data
    - [x] `getAssetBatch()` for efficient batch token metadata
    - [x] `getBalance()` for SOL balances
    - [x] Automatic token metadata resolution
    - [x] Built-in retry logic and rate limiting
  - [x] Fallback: Direct Solana RPC for redundancy
- [x] **Data to Fetch**:
  - [x] SOL balances via Helius SDK `getBalance()`
  - [x] SPL token balances via `getAssetsByOwner()`
  - [x] Token-2022 balances via Enhanced APIs
  - [x] Token metadata automatically included in responses
  - [x] Historical balance snapshots for PNL calculations
  - [ ] Compressed NFT support (future enhancement)

### 3. Performance Requirements
- [x] **Response Time**: <100ms for portfolio overview
- [x] **Scalability**: Handle 300+ wallets efficiently
- [x] **Solution**: Pre-fetch and cache all data in SQLite
  - [x] Batch processing with rate limiting
  - [x] Resume capability for interrupted fetches
  - [x] Periodic refresh (5-minute intervals)
  - [x] Historical data snapshots for PNL calculations

### 4. User Interface
- [x] **Single Page Application** (no authentication)
- [x] **Dashboard Overview**:
  - [x] Total AUM (Assets Under Management) in USD
  - [x] Total SOL balance across all wallets
  - [x] Number of unique wallets
  - [x] Number of unique tokens held
  - [x] Top 20 tokens by value
  - [x] **PNL Metrics**:
    - [x] Total PNL (USD and percentage)
    - [x] 24h, 7d, 30d PNL changes
    - [x] Individual wallet PNL breakdown
    - [x] Top gainers/losers by token
- [x] **Visual Design**: Clean, modern, Zerion-like interface
  - [x] Gradient backgrounds
  - [x] Card-based layout
  - [x] Responsive design
  - [x] Real-time update indicators
  - [x] PNL color coding (green/red)

### 5. Technical Architecture

#### Backend (Bun + Hono + Helius SDK)
```
/api
  /portfolio
    GET /overview - Aggregated portfolio stats (from SQLite)
    GET /status - Data freshness info
    GET /metrics - Performance and error metrics
    GET /pnl - Combined PNL across all wallets
    GET /pnl/timeframe/:period - PNL for specific timeframe (24h, 7d, 30d)
  /wallets
    GET /balance/:address - Individual wallet data
    POST /balances - Batch wallet data
    GET /history/:address - Historical balance data
    GET /pnl/:address - Individual wallet PNL
    GET /pnl/:address/:period - Wallet PNL for specific timeframe
  /tokens
    GET /prices - Current token prices from Jupiter
    POST /prices/refresh - Force price refresh
    GET /pnl/tokens - PNL breakdown by token
  /health - Service health check
  /admin
    POST /refresh - Trigger full data refresh
    GET /logs - Recent error logs
    POST /snapshot - Create manual portfolio snapshot
```

#### Frontend (Bun + Hono JSX + Server APIs)
- [x] **Hono JSX Rendering**: Server-side JSX components for dynamic UI
- [x] **Server APIs**: RESTful endpoints for portfolio data
- [x] **Client-side Hydration**: Progressive enhancement with JavaScript
- [x] **Styling**: Tailwind CSS (via CDN or JSX integration)
- [x] **Charts**: Chart.js or similar for visualizations
- [x] **Documentation**: Context7 MCP for accessing library docs during development

#### Data Layer
- **SQLite Database**:
  ```sql
  wallet_balances:
    - wallet_address (PRIMARY KEY)
    - wallet_id
    - sol_balance
    - tokens (JSON)
    - last_updated
    - fetch_status (success/error/pending)
    - error_message (nullable)
    - retry_count (default 0)

  token_prices:
    - mint (PRIMARY KEY)
    - symbol
    - name
    - price
    - price_change_24h
    - market_cap
    - last_updated
    - source (jupiter/coingecko/fallback)

  portfolio_snapshots:
    - id (PRIMARY KEY)
    - wallet_address
    - snapshot_timestamp
    - sol_balance
    - tokens (JSON)
    - total_usd_value
    - snapshot_type (hourly/daily/manual)

  wallet_pnl:
    - wallet_address (PRIMARY KEY)
    - initial_value_usd
    - current_value_usd
    - realized_pnl_usd
    - unrealized_pnl_usd
    - total_pnl_usd
    - total_pnl_percentage
    - first_snapshot_date
    - last_updated

  token_pnl:
    - id (PRIMARY KEY)
    - wallet_address
    - token_mint
    - initial_amount
    - current_amount
    - initial_price_usd
    - current_price_usd
    - realized_pnl_usd
    - unrealized_pnl_usd
    - total_pnl_usd
    - last_updated

  fetch_logs:
    - id (PRIMARY KEY)
    - wallet_address
    - timestamp
    - operation (balance/tokens/prices/snapshot)
    - status (success/error/timeout)
    - error_details (nullable)
    - response_time_ms

  system_metrics:
    - metric_name (PRIMARY KEY)
    - metric_value
    - last_updated
  ```

#### Scripts
- [x] **Prefetch Script**: Populates SQLite with all wallet data
  - [x] **Retry Logic**: Exponential backoff (1s, 2s, 4s, 8s, 16s max)
  - [x] **Rate Limiting**:
    - [x] Helius SDK: 100 requests/minute (auto-handled)
    - [x] Jupiter API: 600 requests/minute
    - [x] Batch size: 10 wallets per request
    - [x] Inter-batch delay: 2s
  - [x] **Progress Tracking**:
    - [x] SQLite-based checkpoint system
    - [x] Resume from last successful batch
    - [x] ETA calculations and progress reporting
  - [x] **Error Handling**:
    - [x] Graceful degradation for individual wallet failures
    - [x] Timeout handling (30s per request)
    - [x] Network error recovery
    - [x] Invalid address handling

### 6. Data Flow
1. **Initial Data Loading**:
   - CSV file → Prefetch script → Helius SDK → SQLite database
   - Error handling at each step with logging
   - Resume capability for interrupted processes

2. **User Interface**:
   - Browser request → Hono JSX → Server-rendered HTML response
   - Client-side requests → Hono API → SQLite → JSON response
   - Real-time updates via polling (5-minute intervals)

3. **Price Data Pipeline**:
   - Jupiter API → Price normalization → SQLite cache
   - Fallback to CoinGecko if Jupiter fails
   - Price change calculation and trend analysis

4. **Token Metadata Pipeline**:
   - Helius Enhanced APIs → Metadata validation → SQLite cache
   - Image URL validation and caching
   - Token categorization (DeFi, GameFi, etc.)

5. **Development Support**:
   - Documentation queries → Context7 MCP → Library documentation
   - Real-time API reference during development

### 7. Key Features
- [x] **No Authentication**: Public dashboard
- [x] **Fast Performance**: All data served from local SQLite
- [x] **Automatic Refresh**: Frontend polls every 5 minutes
- [x] **Error Resilience**: Graceful handling of RPC/price API failures
- [x] **Token Metadata**: Fetch and display token names/symbols
- [x] **PNL Tracking**:
  - [x] Individual wallet PNL calculation
  - [x] Combined portfolio PNL across all wallets
  - [x] Time-based PNL analysis (24h, 7d, 30d)
  - [x] Token-level PNL breakdown
  - [x] Realized vs unrealized gains/losses
  - [x] Historical snapshots for accurate cost basis

### 8. PNL Calculation Strategy

#### PNL Methodology
- **Cost Basis Calculation**:
  - Use first recorded balance as initial cost basis
  - Apply FIFO (First In, First Out) for token transactions
  - Handle token balance increases/decreases over time
  - Account for airdrops and rewards as zero-cost basis

- **Snapshot Strategy**:
  - Daily snapshots at 00:00 UTC for historical tracking
  - Hourly snapshots during high-volatility periods
  - Manual snapshots triggered by admin endpoints
  - Retention policy: 1 year of daily snapshots

- **PNL Components**:
  - **Unrealized PNL**: (Current Value - Cost Basis) for held tokens
  - **Realized PNL**: Gains/losses from tokens no longer held
  - **Total PNL**: Unrealized + Realized PNL
  - **Percentage PNL**: (Total PNL / Initial Investment) × 100

- **Aggregation Logic**:
  - Individual wallet PNL calculated independently
  - Combined portfolio PNL = Sum of all wallet PNLs
  - Token-level PNL = Sum across all wallets holding that token
  - Time-based PNL = Current Value - Value at start of period

#### PNL Data Sources
- **Historical Prices**: Jupiter API with fallback to CoinGecko
- **Balance History**: Portfolio snapshots stored in SQLite
- **Missing Data Handling**: Linear interpolation for missing price points
- **Accuracy Validation**: Cross-reference with multiple price sources

### 9. Error Handling & Resilience Strategy

#### API Error Handling
- **Helius SDK Errors**:
  - Rate limit exceeded: Auto-retry with exponential backoff
  - Invalid address: Log and skip, continue processing
  - Network timeout: Retry up to 3 times, then mark as failed
  - Service unavailable: Switch to direct Solana RPC fallback

- **Jupiter API Errors**:
  - Price not found: Use cached price or mark as unavailable
  - API rate limit: Implement request queue with 600/min limit
  - Service down: Graceful degradation with stale price warnings

- **Database Errors**:
  - Write conflicts: Implement retry logic with random jitter
  - Corruption: Automatic backup restore mechanism
  - Disk space: Cleanup old logs and implement rotation

#### Performance Monitoring
- **Key Metrics**:
  - API response times (target: <500ms average)
  - Error rates (target: <1% for successful operations)
  - Cache hit rates (target: >95% for repeated requests)
  - Database query performance (target: <50ms for portfolio overview)

- **Alerting Thresholds**:
  - Error rate >5% over 5 minutes
  - Average response time >1s over 2 minutes
  - Failed wallet updates >10% of total wallets
  - Price data staleness >30 minutes

#### Graceful Degradation
- **Partial Data**: Display available data with clear indicators for missing information
- **Stale Data**: Show last update timestamp and data freshness warnings
- **Service Outages**: Cached data with service status indicators
- **Rate Limiting**: Queue requests and show processing status to users

### 9. Rate Limiting & Performance Optimization

#### API Rate Limits
- **Helius SDK**: 100 requests/minute (handled automatically)
- **Jupiter API**: 600 requests/minute
- **Implementation Strategy**:
  - Request queuing with priority levels
  - Exponential backoff for failed requests
  - Intelligent batching to minimize API calls
  - Cache-first approach for frequently accessed data

#### Performance Targets
- **Initial Page Load**: <2s for complete dashboard
- **API Response Times**: <100ms for cached data, <500ms for live data
- **Database Queries**: <50ms for aggregated portfolio data
- **Price Updates**: <5s for complete refresh cycle
- **Memory Usage**: <512MB for entire application

#### Optimization Strategies
- **Database Indexing**: Composite indexes on wallet_address + last_updated
- **Connection Pooling**: Reuse database connections across requests
- **Response Caching**: In-memory cache for frequently accessed aggregations
- **Background Processing**: Async data updates separate from user requests
- **Lazy Loading**: Load token details on demand rather than upfront

### 10. Implementation Guidelines

#### Existing Project Setup
**IMPORTANT: Work in the existing Hono project directory (current working directory)**
- **Do NOT create a new project or initialize a new Hono setup**
- **Do NOT run `bun create hono` or similar initialization commands**
- **Use the existing package.json, tsconfig.json, and Hono configuration**
- **Extend the existing project structure with Solana portfolio tracking features**

#### Project Structure
**Note: Extend the existing Hono project structure**
```
. (current directory - existing Hono project)
├── src/
│   ├── server.ts          # Main Hono server with JSX rendering
│   ├── routes/
│   │   ├── api.ts         # API routes
│   │   ├── pages.ts       # JSX page routes
│   │   └── static.ts      # Static asset serving
│   ├── components/
│   │   ├── Dashboard.tsx  # Main dashboard JSX component
│   │   ├── Portfolio.tsx  # Portfolio overview component
│   │   ├── WalletCard.tsx # Individual wallet display
│   │   └── Layout.tsx     # Base layout component
│   ├── services/
│   │   ├── database.ts    # SQLite operations
│   │   ├── helius.ts      # Helius SDK integration
│   │   │                  # - SDK initialization and configuration
│   │   │                  # - Batch asset fetching
│   │   │                  # - Error handling and retries
│   │   ├── solana.ts      # Direct Solana RPC (fallback)
│   │   ├── prices.ts      # Price fetching via Jupiter
│   │   └── docs.ts        # Context7 MCP documentation access
│   ├── scripts/
│   │   └── prefetch.ts    # Data prefetching
│   └── public/
│       ├── app.js         # Client-side hydration
│       └── styles.css     # Additional styles
├── data/
│   ├── wallets.csv
│   └── portfolio.db
├── package.json           # Existing Hono project package.json
├── tsconfig.json          # Existing TypeScript configuration
└── README.md
```

#### Technology Stack
- **Runtime**: Bun (latest)
- **Framework**: Hono with JSX rendering
- **Frontend**: Server-side JSX components + client-side hydration
- **Database**: SQLite (via Bun)
- **Blockchain**:
  - Primary: Helius SDK (@helius-labs/sdk)
  - Fallback: @solana/web3.js for direct RPC
- **Styling**: Tailwind CSS (via CDN or JSX integration)
- **Charts**: Chart.js (via CDN)
- **Documentation**: Context7 MCP for library docs

#### Development Workflow
**Working in existing Hono project directory:**
```bash
# STEP 1: Install additional dependencies for Solana portfolio tracking
bun add @helius-labs/sdk @solana/web3.js

# STEP 2: Create required directories and files
mkdir -p data src/services src/components src/scripts

# STEP 3: Add the wallets.csv file to data directory
# (Copy wallets.csv to data/wallets.csv)

# STEP 4: Use Context7 MCP during development for documentation access
# Query libraries like: hono, @helius-labs/sdk, @solana/web3.js, bun

# STEP 5: Extend existing server.ts with portfolio routes
# Modify existing src/server.ts or create new route files

# STEP 6: Create database services and Helius integration
# Add files: src/services/database.ts, src/services/helius.ts

# STEP 7: Build JSX components for portfolio dashboard
# Add files: src/components/Dashboard.tsx, src/components/Portfolio.tsx

# STEP 8: Create prefetch script for data population
# Add file: src/scripts/prefetch.ts

# STEP 9: Run prefetch to populate database
bun run prefetch

# STEP 10: Start server (JSX rendering + API endpoints)
bun run dev

# Production build (if needed)
bun run build
bun run start
```

#### Helius SDK Configuration
- **Installation**: `bun add @helius-labs/sdk`
- **Initialization**:
  ```typescript
  import { Helius } from '@helius-labs/sdk';

  const helius = new Helius(process.env.HELIUS_RPC_URL);
  ```
- **Key Methods**:
  - `helius.getAssetsByOwner(ownerAddress)` - Get all tokens for a wallet
  - `helius.getBalance(address)` - Get SOL balance
  - `helius.getAssetBatch(assetIds)` - Batch token metadata
- **Error Handling**: Built-in retry logic with exponential backoff
- **Rate Limiting**: SDK handles rate limiting automatically

#### Hono JSX Configuration
- **Installation**: `bun add hono` (JSX support built-in)
- **JSX Setup**:
  ```typescript
  import { Hono } from 'hono';
  import { renderer } from 'hono/jsx-renderer';

  const app = new Hono();
  app.use(renderer);

  app.get('/', (c) => c.render(<Dashboard />));
  ```
- **Key Features**:
  - Server-side rendering with JSX
  - Client-side hydration support
  - API routes alongside page routes
  - TypeScript support for components

#### Context7 MCP Integration
- **Developer Usage**: Use Context7 MCP tools during development for real-time documentation access
- **Key Libraries to Query**:
  - `hono` - For JSX rendering patterns, routing, and middleware
  - `@helius-labs/sdk` - For Helius SDK methods and examples
  - `@solana/web3.js` - For fallback RPC implementations
  - `bun` - For runtime-specific SQLite and performance optimizations
- **Usage Pattern**:
  - Query documentation before implementing new features
  - Get code examples for complex integrations
  - Reference best practices for error handling
  - Find performance optimization techniques

### 11. Deployment Strategy

#### Local Development
- **Environment Setup**:
  - Bun runtime (latest stable)
  - SQLite database in `data/` directory
  - Environment variables for API keys
  - Hot reload for development efficiency

#### Production Deployment
- **Infrastructure Options**:
  - **Option A**: Railway.app (recommended)
    - Automatic deployments from Git
    - Built-in SQLite persistence
    - Environment variable management
    - Zero-config scaling

  - **Option B**: Fly.io
    - Dockerfile-based deployment
    - Regional deployment options
    - Persistent volume for SQLite
    - Custom domain support

- **Environment Variables**:
  ```bash
  HELIUS_API_KEY=your_helius_api_key
  JUPITER_API_URL=https://price.jup.ag/v6
  DATABASE_PATH=./data/portfolio.db
  NODE_ENV=production
  PORT=3000
  ```

#### Database Migration Strategy
- **Schema Versioning**: Track database schema version in system_metrics table
- **Migration Scripts**: Automated migration on application startup
- **Backup Strategy**: Daily database backups with 7-day retention
- **Zero-Downtime Updates**: Blue-green deployment pattern for updates

#### Monitoring & Observability
- **Health Checks**: `/health` endpoint for uptime monitoring
- **Logging Strategy**:
  - Structured JSON logging
  - Log rotation (100MB files, 10 file retention)
  - Error aggregation and alerting
- **Metrics Collection**:
  - Application metrics via `/api/metrics`
  - System metrics (CPU, memory, disk)
  - Custom business metrics (portfolio value, wallet count)

### 12. Security Considerations

#### Data Protection
- **No Sensitive Data**: Only public wallet addresses and balances
- **Rate Limiting**: Prevent abuse of API endpoints
- **Input Validation**: Sanitize all wallet addresses and parameters
- **CORS Configuration**: Restrict cross-origin requests appropriately

#### API Security
- **No Authentication Required**: Public dashboard design
- **DDoS Protection**: Rate limiting and request throttling
- **Error Information**: Limit error details in production responses
- **Admin Endpoints**: IP-based access control for admin routes

### 13. Success Metrics
- **Performance Targets**:
  - Portfolio overview loads in <100ms (cached data)
  - Full data refresh completes in <5 minutes
  - API response times <500ms (95th percentile)
  - Uptime >99.9% (excluding planned maintenance)

- **Data Accuracy**:
  - All 329 unique wallets tracked successfully
  - SOL and SPL token balances accurate within 5 minutes
  - Price data fresh within 10 minutes
  - <1% error rate for successful wallet updates
  - PNL calculations accurate within 2% of actual values
  - Historical snapshots stored with 99.9% reliability

- **User Experience**:
  - Clean, intuitive UI with modern design
  - Mobile-responsive layout
  - Real-time update indicators
  - Clear error messages and loading states
  - Zero authentication overhead

### 14. Future Enhancements (Out of Scope)
- **Phase 2 Features**:
  - Advanced PNL analytics with detailed charts
  - Transaction history and analysis
  - Wallet grouping and tagging system
  - CSV upload interface for dynamic wallet management
  - Real-time WebSocket updates
  - Mobile app with push notifications
  - Tax reporting and capital gains calculations

- **Advanced Analytics**:
  - Portfolio performance metrics and benchmarking
  - Risk analysis and diversification scores
  - Yield farming opportunity detection
  - Automated rebalancing suggestions
  - Advanced PNL attribution analysis
  - Performance comparison against market indices

## Implementation Notes

### Critical Guidelines
- **CRITICAL: Work in existing Hono project directory** - Do not create new project or initialize new Hono setup
- **Extend existing Hono configuration** - Build upon the current server.ts and project structure
- **Preserve existing functionality** - Add portfolio tracking features without breaking existing routes

### Architecture Principles
- **Simplicity First**: One server, one database, one process
- **Performance Priority**: Speed over real-time accuracy (5-minute refresh acceptable)
- **Reliability Focus**: Graceful degradation and comprehensive error handling
- **Scalability Ready**: Efficient SQLite usage with proper indexing

### Technology Integration
- **Hono JSX**: Server-side rendering with minimal client-side JavaScript
- **SQLite Optimization**: Read-heavy optimization with proper indexing
- **Helius SDK Advantages**:
  - Automatic token metadata resolution
  - Built-in error handling and retries
  - Compressed NFT support
  - Enhanced API endpoints
- **Fallback Strategy**: Direct RPC implementation if Helius SDK fails

### Development Workflow
- **Context7 MCP Integration**: Use during development for:
  - Real-time documentation lookup (Hono, Helius SDK, Solana Web3.js)
  - Code examples and implementation patterns
  - Performance optimization techniques
  - Error handling best practices
- **Progressive Enhancement**: Server-side rendering for fast initial loads
- **Dependency Management**: Minimal external dependencies beyond core requirements

### Quality Assurance
- **Testing Strategy**: Unit tests for critical business logic
- **Error Monitoring**: Comprehensive logging and error tracking
- **Performance Monitoring**: Built-in metrics and monitoring endpoints
- **Code Quality**: TypeScript strict mode and consistent formatting
