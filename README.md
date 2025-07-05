# Spartan AUM - Solana Portfolio Tracker

A high-performance web application to track and analyze Solana wallet holdings across multiple addresses, providing real-time portfolio valuation and PNL (Profit/Loss) analytics.

## Features

- 📊 **Portfolio Overview** - Aggregated view of total assets under management
- 💰 **Multi-Wallet Tracking** - Monitor 1000+ Solana wallets simultaneously
- 📈 **PNL Analytics** - Track profit/loss across time periods (24h, 7d, 30d)
- ⚡ **High Performance** - Sub-100ms response times with SQLite caching
- 🔄 **Real-time Prices** - Live token prices with automatic refresh on dashboard load
- 🖼️ **Token Images** - Display real token logos fetched from Jupiter Token List
- 📱 **Modern UI** - Sleek dark theme with glass morphism design
- 🔍 **Detailed Views** - Individual wallet and token detail pages

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast all-in-one JavaScript runtime
- **Framework**: [Hono](https://hono.dev) - Lightweight web framework with JSX support
- **Database**: SQLite with WAL mode for concurrent reads
- **Blockchain**: 
  - [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - Core Solana blockchain interactions
  - [Helius SDK](https://docs.helius.xyz/) - Enhanced RPC with asset APIs
  - [Metaplex Foundation JS](https://github.com/metaplex-foundation/js) - NFT and token metadata
  - [@solana/spl-token](https://spl.solana.com/token) - SPL token program interactions
- **UI**: Server-side JSX with Tailwind CSS via CDN

## Prerequisites

- Bun runtime (latest version)
- Helius RPC endpoint (required)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/elizaOS/aum-tracker
cd aum-tracker
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Edit `.env` with your configuration:
```env
# Required
HELIUS_RPC_URL=your_helius_rpc_endpoint_here

# Optional (defaults provided)
JUPITER_API_URL=https://lite-api.jup.ag/price/v2
JUPITER_TOKENS_API_URL=https://lite-api.jup.ag/tokens/v1
DATABASE_PATH=./data/portfolio.db
PORT=3000
```

## Usage

### Command Breakdown

**Web Server Commands** (API endpoints)
```bash
bun run dev      # Starts development server with hot reload (port 3000)
bun run start    # Starts production server (port 3000)
```
These start the **Hono web server** that serves the API endpoints.

**Data Prefetch Commands** (populate database)
```bash
bun run prefetch              # Fetches wallet data from blockchain
bun run prefetch:force        # Force refresh all wallet data
bun run prefetch:test         # Test with 5 wallets
bun run prefetch:test10       # Test with 10 wallets
bun run prefetch:test-force   # Test with 5 wallets + force refresh
bun run prefetch:health       # Check system health
bun run db:cleanup            # Database cleanup with batch processing
```
These run the **data prefetch script** that reads wallet addresses from CSV, fetches balance data from Solana blockchain, and populates the SQLite database.

**Token Metadata Service** (background processing)
```bash
bun run token-metadata:start   # Starts continuous background service
bun run token-metadata:refresh # One-time metadata refresh
bun run token-metadata:health  # Check metadata service health
bun run token-metadata:queue   # Show metadata queue status
bun run token-metadata:clear   # Clear metadata queue
```
These manage the **background token metadata service** that processes tokens one at a time to respect Jupiter API rate limits.

### Typical Workflow

1. **First time setup** - Populate database with wallet data:
   ```bash
   # Test with a few wallets first
   bun run prefetch:test
   
   # Then fetch all wallet data
   bun run prefetch
   ```

2. **Start the web server**:
   ```bash
   # Development (with hot reload)
   bun run dev
   
   # OR Production
   bun run start
   ```

3. **Optional: Start background metadata service** (in a separate terminal):
   ```bash
   bun run token-metadata:start
   ```

4. **View the dashboard**: Open http://localhost:3000

### What Each Process Does

| Command | Purpose | Runs Once | Continuous |
|---------|---------|-----------|------------|
| `bun run dev` | Web server with hot reload | ❌ | ✅ |
| `bun run start` | Production web server | ❌ | ✅ |
| `bun run prefetch` | Fetch wallet data | ✅ | ❌ |
| `bun run token-metadata:start` | Background metadata service | ❌ | ✅ |

**Important**: The **prefetch needs to be run first** to populate the database, then you can start the web server to access the API endpoints.

### Production

Build and run for production:
```bash
bun run build
bun run start
```

## API Endpoints

### Portfolio Endpoints
- `GET /api/portfolio/overview` - Aggregated portfolio statistics
- `GET /api/portfolio/status` - System health and data freshness
- `GET /api/portfolio/metrics` - Performance and error metrics
- `GET /api/portfolio/pnl` - Combined PNL across all wallets
- `GET /api/portfolio/pnl/timeframe/:period` - PNL for specific timeframe

### Wallet Endpoints
- `GET /api/wallets/balance/:address` - Individual wallet data
- `POST /api/wallets/balances` - Batch wallet data
- `GET /api/wallets/history/:address` - Historical balance data
- `GET /api/wallets/pnl/:address` - Individual wallet PNL
- `GET /api/wallets/pnl/:address/:period` - Wallet PNL for specific timeframe
- `GET /api/wallets/all` - All wallet balances (paginated)

### Token Endpoints
- `GET /api/tokens/prices` - Current token prices
- `POST /api/tokens/prices/refresh` - Force price refresh
- `GET /api/tokens/aggregated` - Aggregated token holdings with real-time prices
- `GET /api/tokens/holders/:mint` - Get all wallets holding a specific token
- `GET /api/tokens/pnl` - Top gainers and losers

### Admin Endpoints
- `POST /api/admin/refresh` - Trigger full data refresh
- `GET /api/admin/logs` - View recent error logs
- `POST /api/admin/snapshot` - Create manual portfolio snapshot

### Health Endpoints
- `GET /api/health` - Service health check

## Project Structure

```
.
├── src/
│   ├── index.ts              # Main server entry point
│   ├── routes/
│   │   └── api.ts           # API route definitions
│   ├── services/
│   │   ├── database.ts      # SQLite operations
│   │   ├── solana.ts        # Blockchain integration
│   │   └── csv.ts           # CSV parsing
│   ├── components/
│   │   ├── ModernDashboard.tsx  # Modern dashboard UI
│   │   ├── ModernLayout.tsx     # Dark theme layout
│   │   ├── WalletDetail.tsx     # Individual wallet view
│   │   └── TokenDetail.tsx      # Individual token view
│   └── scripts/
│       └── prefetch.ts      # Data prefetching script
├── data/
│   ├── wallets.csv          # Wallet addresses
│   └── portfolio.db         # SQLite database (created at runtime)
├── .gitignore
├── CLAUDE.md                 # Development guidelines
├── PRD.md                    # Product requirements
├── README.md
├── bun.lock
├── package.json
└── tsconfig.json
```

## Performance

- **Response Times**: <100ms for cached data
- **Data Freshness**: Real-time price updates on dashboard load
- **Rate Limits**:
  - Premium Helius RPC: 1000+ requests/minute
  - Jupiter API: 600 requests/minute
- **Batch Processing**: 50 wallets per batch (optimized for premium endpoints)
- **Token Metadata**: Cached with images from Jupiter Token List
- **Database**: SQLite with WAL mode for concurrent read performance
- **Caching**: 5-minute cache freshness with automatic refresh

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `HELIUS_RPC_URL` | Helius RPC endpoint | Yes | - |
| `JUPITER_API_URL` | Jupiter price API URL | No | https://lite-api.jup.ag/price/v2 |
| `JUPITER_TOKENS_API_URL` | Jupiter tokens API URL | No | https://lite-api.jup.ag/tokens/v1 |
| `DATABASE_PATH` | SQLite database path | No | ./data/portfolio.db |
| `PORT` | Server port | No | 3000 |

**Note**: Only `HELIUS_RPC_URL` is currently required. Other environment variables are defined in `.env.example` but may use hardcoded defaults in the current implementation.

## Development

### Additional Scripts

All available development scripts:

```bash
# Development & Production
bun run dev                    # Development server with hot reload
bun run start                  # Production server
bun run build                  # Build for production

# Data Management
bun run prefetch               # Fetch all wallet data
bun run prefetch:force         # Force refresh all data
bun run prefetch:test          # Test with 5 wallets
bun run prefetch:test10        # Test with 10 wallets
bun run prefetch:test-force    # Test with 5 wallets + force refresh
bun run prefetch:health        # Check system health
bun run db:cleanup             # Database cleanup with batch processing

# Token Metadata Management
bun run token-metadata:start   # Start continuous token metadata service
bun run token-metadata:refresh # Refresh stale metadata once
bun run token-metadata:health  # Check metadata service health
bun run token-metadata:queue   # Show metadata queue status
bun run token-metadata:clear   # Clear metadata queue

# Testing
bun run test                   # Run tests (not configured yet)
```

### Architecture & Guidelines

See [CLAUDE.md](./CLAUDE.md) for detailed development guidelines and architecture information.

## License

MIT
