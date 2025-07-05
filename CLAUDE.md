# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
Spartan AUM is a Solana portfolio tracker that monitors wallet holdings across multiple addresses, providing real-time portfolio valuation and PNL (Profit/Loss) analytics.

## Essential Commands

### Development
```bash
bun run dev                    # Start development server with hot reload
bun run start                  # Start production server
bun run build                  # Build for production
```

### Data Management
```bash
bun run prefetch               # Populate database with wallet data
bun run prefetch:force         # Force refresh all wallet data
bun run prefetch:test          # Test prefetch with 5 wallets
bun run prefetch:test10        # Test prefetch with 10 wallets
bun run prefetch:test-force    # Test prefetch with 5 wallets + force refresh
bun run prefetch:health        # Check system health
bun run db:cleanup             # Database cleanup with batch processing
```

### Token Metadata Management
```bash
bun run token-metadata:start   # Start continuous token metadata service
bun run token-metadata:refresh # Refresh stale metadata once
bun run token-metadata:health  # Check metadata service health
bun run token-metadata:queue   # Show metadata queue status
bun run token-metadata:clear   # Clear metadata queue
```

## Architecture Overview

### Service Layer Architecture
The codebase follows a service-oriented pattern with four core services:

1. **DatabaseService** (`src/services/database.ts`)
   - Singleton pattern managing all SQLite operations
   - Comprehensive schema supporting wallet balances, token prices, PNL tracking, and system metrics
   - WAL mode enabled for concurrent read performance

2. **SolanaService** (`src/services/solana.ts`)
   - Manages all blockchain interactions with built-in rate limiting
   - Queue-based request management (1000+ req/min for Premium Helius RPC)
   - Fallback mechanism from Helius to public RPC
   - Batch processing with exponential backoff retry logic

3. **TokenMetadataService** (`src/services/background/token-metadata.ts`)
   - Dedicated background service for token metadata fetching
   - Processes tokens one at a time to respect Jupiter API rate limits
   - Priority queue system with automatic retry and exponential backoff
   - Can run as standalone process or integrated service
   - Automatic stale metadata refresh every 24 hours

4. **CSVService** (`src/services/csv.ts`)
   - Parses `data/wallets.csv` containing wallet addresses
   - Handles CSV parsing and validation for wallet data

### API Architecture
RESTful endpoints in `src/routes/api.ts` follow this pattern:
- `/api/portfolio/*` - Aggregated portfolio data
- `/api/wallets/*` - Individual wallet operations
- `/api/tokens/*` - Token price management
- `/api/tokens/metadata/*` - Token metadata service control
- `/api/admin/*` - Administrative functions

All endpoints read from SQLite cache for sub-100ms response times.

### Data Flow Pipeline
1. **Initial Load**: CSV → Prefetch Script → Blockchain → SQLite
2. **User Requests**: Browser → Hono Server → SQLite → JSON Response
3. **Price Updates**: Jupiter API → Price Cache → SQLite
4. **Token Metadata**: Background Service → Jupiter Token API → SQLite (one token at a time)
5. **PNL Calculations**: Historical Snapshots → PNL Service → Aggregated Metrics

## Critical Implementation Details

### Environment Configuration
Required environment variable:
```bash
HELIUS_RPC_URL=your_helius_rpc_endpoint  # REQUIRED - will throw error if missing
```

Optional environment variables (with defaults):
```bash
JUPITER_API_URL=https://lite-api.jup.ag/price/v2
JUPITER_TOKENS_API_URL=https://lite-api.jup.ag/tokens/v1
DATABASE_PATH=./data/portfolio.db
PORT=3000
```

### Rate Limiting Strategy
- Premium Helius RPC: 1000+ requests/minute (handled by queue in SolanaService)
- Jupiter Price API: 600 requests/minute
- Jupiter Token Metadata API: 500ms delay between requests (sequential processing)
- Inter-batch delay: 100ms (optimized for premium endpoint)
- Batch size: 50 wallets per operation (premium configuration)

### Token Metadata & Images
- Token metadata (symbol, name, image URL) fetched from Jupiter Token List API
- Images stored in `token_prices` table with `image_url` column
- Automatic fallback to placeholder when image fails to load
- SOL has hardcoded image URL from Solana Labs token list

### Database Performance
- Read-heavy optimization with proper indexing
- Composite indexes on wallet_address + last_updated
- JSON columns for flexible token storage
- 5-minute cache freshness for portfolio data

### Error Handling Pattern
All services implement:
- Exponential backoff (1s, 2s, 4s, 8s, 16s max)
- Graceful degradation with fallback RPC
- Comprehensive error logging in fetch_logs table
- Resume capability for interrupted operations
- Premium Helius endpoint optimization for faster processing
- Token metadata service: Priority queue with retry logic and graceful shutdown

## Development Workflow

### Adding New Features
1. Check PRD.md for requirements and architecture guidelines
2. Extend existing services rather than creating new ones
3. Update database schema if needed (migrations in database.ts)
4. Add new API endpoints to src/routes/api.ts
5. Test with small batches using prefetch:test

### Common Tasks

**Checking Portfolio Data**:
```bash
# View current portfolio overview
curl http://localhost:3000/api/portfolio/overview

# Check specific wallet
curl http://localhost:3000/api/wallets/balance/[address]
```

**Monitoring System Health**:
```bash
# Check system status
curl http://localhost:3000/api/portfolio/status

# View fetch logs for errors
curl http://localhost:3000/api/admin/logs
```

**Force Data Refresh**:
```bash
# Trigger full refresh via API
curl -X POST http://localhost:3000/api/admin/refresh

# Or use prefetch script
bun run prefetch:force

# Refresh token metadata
curl -X POST http://localhost:3000/api/tokens/metadata/refresh
```

**Token Metadata Management**:
```bash
# Start background metadata service
bun run token-metadata:start

# Check metadata queue status
curl http://localhost:3000/api/tokens/metadata/status

# Add tokens to metadata queue
curl -X POST http://localhost:3000/api/tokens/metadata/queue \
  -H "Content-Type: application/json" \
  -d '{"mints": ["mint1", "mint2"], "priority": 5}'
```

## Key Files Reference

- **Server Configuration**: `src/index.ts` - Hono server setup with middleware
- **Database Schema**: `src/services/database.ts` - All table definitions (including token_prices with image_url)
- **Blockchain Integration**: `src/services/solana.ts` - RPC and token fetching with metadata
- **API Routes**: `src/routes/api.ts` - All REST endpoints including new token endpoints
- **Modern Dashboard**: `src/components/ModernDashboard.tsx` - Dark theme UI with real token images
- **Detail Views**: `src/components/WalletDetail.tsx` & `TokenDetail.tsx` - Individual pages
- **Data Prefetching**: `src/scripts/prefetch.ts` - Batch wallet processing with token metadata
- **Token Metadata Service**: `src/scripts/token-metadata-service.ts` - Standalone metadata processor
- **Background Services**: `src/services/background/token-metadata.ts` - Token metadata queue management
