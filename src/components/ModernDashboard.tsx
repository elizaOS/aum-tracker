import { html } from "hono/html";

interface DashboardProps {
  initialData?: any;
}

export const ModernDashboard = ({ initialData }: DashboardProps) => {
  return html`
    <div class="min-h-screen">
      <!-- Header -->
      <header class="px-6 lg:px-8 py-6 border-b border-glass-border">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-semibold text-white">Portfolio</h1>
            <p class="text-gray-400 text-sm mt-1">Track your Solana holdings</p>
          </div>

          <div class="flex items-center space-x-4">
            <!-- Network Selector -->
            <div
              class="flex items-center space-x-2 px-4 py-2 glass-card rounded-lg"
            >
              <div class="w-2 h-2 bg-green-400 rounded-full"></div>
              <span class="text-sm text-gray-300">All Networks</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Portfolio Overview -->
      <div class="px-6 lg:px-8 py-8">
        <!-- Total Value Card -->
        <div class="glass-card rounded-2xl p-8 mb-8 fade-in">
          <div class="flex items-center justify-between mb-8">
            <div>
              <div class="flex items-center space-x-4 mb-2">
                <h2 class="text-3xl font-bold text-white" id="total-value">
                  $0.00
                </h2>
                <span
                  id="total-change"
                  class="px-3 py-1 rounded-full text-sm font-medium"
                ></span>
              </div>
              <p class="text-gray-400 text-sm">
                <span id="sol-amount">0.00</span> SOL
              </p>
            </div>

            <div class="flex items-center space-x-2">
              <button
                class="px-4 py-2 glass-card rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                Tokens
              </button>
              <button
                class="px-4 py-2 glass-card rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                NFTs
              </button>
              <button
                class="px-4 py-2 glass-card rounded-lg text-gray-300 hover:text-white transition-colors"
              >
                History
              </button>
            </div>
          </div>

          <!-- Performance Chart -->
          <div class="performance-chart rounded-xl p-4">
            <canvas id="performance-chart" height="100"></canvas>
          </div>
        </div>

        <!-- Performance Metrics -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div class="glass-card rounded-xl p-4 fade-in">
            <p class="text-gray-400 text-sm mb-1">24h Change</p>
            <p class="text-xl font-semibold" id="change-24h">+0.00%</p>
          </div>

          <div class="glass-card rounded-xl p-4 fade-in">
            <p class="text-gray-400 text-sm mb-1">7d Change</p>
            <p class="text-xl font-semibold" id="change-7d">+0.00%</p>
          </div>

          <div class="glass-card rounded-xl p-4 fade-in">
            <p class="text-gray-400 text-sm mb-1">30d Change</p>
            <p class="text-xl font-semibold" id="change-30d">+0.00%</p>
          </div>

          <div class="glass-card rounded-xl p-4 fade-in">
            <p class="text-gray-400 text-sm mb-1">Total Wallets</p>
            <p class="text-xl font-semibold" id="total-wallets">0</p>
          </div>

          <div class="glass-card rounded-xl p-4 fade-in">
            <p class="text-gray-400 text-sm mb-1">Unique Tokens</p>
            <p class="text-xl font-semibold" id="unique-tokens">0</p>
          </div>
        </div>

        <!-- Assets Table -->
        <div class="glass-card rounded-2xl overflow-hidden fade-in">
          <div class="px-6 py-4 border-b border-glass-border">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold text-white">
                Assets
                <span
                  id="assets-count"
                  class="text-sm font-normal text-gray-400 ml-2"
                  >(0)</span
                >
              </h3>
              <div class="relative">
                <input
                  type="text"
                  id="assets-search"
                  placeholder="Search tokens..."
                  class="px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                  onkeyup="filterAssets()"
                />
                <svg
                  class="w-4 h-4 absolute left-3 top-3 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  ></path>
                </svg>
              </div>
            </div>
          </div>

          <div class="overflow-x-auto max-h-96 overflow-y-auto">
            <table class="w-full">
              <thead class="sticky top-0 bg-glass-card z-10">
                <tr
                  class="text-left text-gray-400 text-sm border-b border-glass-border"
                >
                  <th class="px-6 py-4 font-medium">Asset</th>
                  <th class="px-6 py-4 font-medium text-right">Price</th>
                  <th class="px-6 py-4 font-medium text-right">Balance</th>
                  <th class="px-6 py-4 font-medium text-right">Value</th>
                  <th class="px-6 py-4 font-medium text-right">24h</th>
                </tr>
              </thead>
              <tbody id="assets-table">
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    <div class="loading-pulse">Loading assets...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Wallet List -->
        <div class="mt-8 glass-card rounded-2xl overflow-hidden fade-in">
          <div class="px-6 py-4 border-b border-glass-border">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-white">Wallets</h3>
              <p class="text-sm text-gray-400">
                <span id="active-wallets">0</span> active
              </p>
            </div>
            <div class="relative">
              <input
                type="text"
                id="wallets-search"
                placeholder="Search by address..."
                class="w-full px-4 py-2 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-indigo-500 transition-colors"
                onkeyup="filterWallets()"
              />
              <svg
                class="w-4 h-4 absolute left-3 top-3 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                ></path>
              </svg>
            </div>
          </div>

          <div class="overflow-x-auto max-h-96 overflow-y-auto">
            <table class="w-full">
              <thead class="sticky top-0 bg-glass-card z-10">
                <tr
                  class="text-left text-gray-400 text-sm border-b border-glass-border"
                >
                  <th class="px-6 py-4 font-medium">Address</th>
                  <th class="px-6 py-4 font-medium text-right">SOL Balance</th>
                  <th class="px-6 py-4 font-medium text-right">Token Value</th>
                  <th class="px-6 py-4 font-medium text-right">Total Value</th>
                  <th class="px-6 py-4 font-medium text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody id="wallets-table">
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    <div class="loading-pulse">Loading wallets...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <script>
      let performanceChart = null;
      let portfolioData = null;
      let allAssets = [];
      let allWallets = [];

      // Initialize performance chart
      function initPerformanceChart() {
        const ctx = document
          .getElementById("performance-chart")
          .getContext("2d");

        const gradient = ctx.createLinearGradient(0, 0, 0, 100);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.3)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0)");

        performanceChart = new Chart(ctx, {
          type: "line",
          data: {
            labels: [],
            datasets: [
              {
                label: "Portfolio Value",
                data: [],
                borderColor: "#6366F1",
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: "#6366F1",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: "index",
              intersect: false,
            },
            plugins: {
              legend: {
                display: false,
              },
              tooltip: {
                backgroundColor: "rgba(0, 0, 0, 0.8)",
                titleColor: "#fff",
                bodyColor: "#fff",
                borderColor: "rgba(255, 255, 255, 0.1)",
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                callbacks: {
                  label: function (context) {
                    return formatCurrency(context.parsed.y);
                  },
                },
              },
            },
            scales: {
              x: {
                display: false,
              },
              y: {
                display: false,
              },
            },
          },
        });
      }

      // Update dashboard with data
      async function updateDashboard(data) {
        portfolioData = data;

        // Update total value
        document.getElementById("total-value").textContent = formatCurrency(
          data.totalUSDValue,
        );
        document.getElementById("sol-amount").textContent = formatNumber(
          data.totalSOL,
        );

        // Update change indicator
        const change24h = data.priceChange24h || 0;
        const changeEl = document.getElementById("total-change");
        changeEl.textContent = formatPercentage(change24h);
        changeEl.className = \`px-3 py-1 rounded-full text-sm font-medium \${getChangeBg(change24h)} \${getChangeColor(change24h)}\`;

        // Update metrics
        document.getElementById("change-24h").textContent =
          formatPercentage(change24h);
        document.getElementById("change-24h").className =
          \`text-xl font-semibold \${getChangeColor(change24h)}\`;

        document.getElementById("change-7d").textContent = formatPercentage(
          data.priceChange7d || 0,
        );
        document.getElementById("change-7d").className =
          \`text-xl font-semibold \${getChangeColor(data.priceChange7d || 0)}\`;

        document.getElementById("change-30d").textContent = formatPercentage(
          data.priceChange30d || 0,
        );
        document.getElementById("change-30d").className =
          \`text-xl font-semibold \${getChangeColor(data.priceChange30d || 0)}\`;

        document.getElementById("total-wallets").textContent =
          data.totalWallets;
        document.getElementById("unique-tokens").textContent =
          data.uniqueTokens;

        // Update chart with mock data for now
        updatePerformanceChart();

        // Load assets and wallets
        await Promise.all([loadAssets(), loadWallets()]);
      }

      // Update performance chart
      function updatePerformanceChart() {
        if (!performanceChart) return;

        // Generate mock historical data
        const now = Date.now();
        const labels = [];
        const data = [];
        const baseValue = portfolioData?.totalUSDValue || 1000;

        for (let i = 30; i >= 0; i--) {
          const date = new Date(now - i * 24 * 60 * 60 * 1000);
          labels.push(
            date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
          );

          // Simulate some volatility
          const randomChange = (Math.random() - 0.5) * 0.1;
          const value = baseValue * (1 + (randomChange * (30 - i)) / 30);
          data.push(value);
        }

        performanceChart.data.labels = labels;
        performanceChart.data.datasets[0].data = data;
        performanceChart.update();
      }

      // Load assets data
      async function loadAssets() {
        try {
          const response = await fetch("/api/tokens/aggregated");
          const result = await response.json();

          if (result.success && result.data) {
            // Store all assets for filtering
            allAssets = [];

            // Add SOL as first asset
            if (portfolioData.totalSOL > 0) {
              allAssets.push({
                mint: "So11111111111111111111111111111111111111112",
                symbol: "SOL",
                name: "Solana",
                price: result.data.solPrice || 0,
                balance: portfolioData.totalSOL,
                value: portfolioData.totalSOL * (result.data.solPrice || 0),
                change24h: 0,
                imageUrl:
                  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
              });
            }

            // Add all tokens
            const tokens = result.data.tokens || [];
            tokens.forEach((token) => {
              allAssets.push({
                mint: token.mint,
                symbol: token.symbol || "Unknown",
                name: token.name || "Unknown Token",
                price: token.price || 0,
                balance: token.totalAmount || 0,
                value: token.totalValue || 0,
                change24h: token.priceChange24h || 0,
                imageUrl: token.imageUrl || null,
              });
            });

            // Sort by value descending
            allAssets.sort((a, b) => b.value - a.value);

            // Update count
            document.getElementById("assets-count").textContent =
              \`(\${allAssets.length})\`;

            // Display all assets
            displayAssets(allAssets);
          }
        } catch (error) {
          console.error("Error loading assets:", error);
        }
      }

      // Display assets in table
      function displayAssets(assets) {
        const tbody = document.getElementById("assets-table");
        tbody.innerHTML = "";

        if (assets.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No assets found</td></tr>';
          return;
        }

        assets.forEach((asset) => {
          const row = createAssetRow(asset);
          tbody.appendChild(row);
        });
      }

      // Create asset table row
      function createAssetRow(asset) {
        const row = document.createElement("tr");
        row.className =
          "border-b border-glass-border hover:bg-white/5 transition-colors cursor-pointer asset-row";
        row.setAttribute(
          "data-searchable",
          (asset.symbol + " " + asset.name).toLowerCase(),
        );

        // Add click handler to navigate to token detail page
        if (asset.mint) {
          row.onclick = () => {
            window.location.href = \`/token/\${asset.mint}\`;
          };
        }

        row.innerHTML = \`
          <td class="px-6 py-4">
            <div class="flex items-center space-x-3">
              <div class="w-10 h-10 token-logo rounded-full flex items-center justify-center overflow-hidden">
                \${
                  asset.imageUrl
                    ? \`<img src="\${asset.imageUrl}" alt="\${asset.symbol}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">\`
                    : ""
                }
                <span class="text-xs font-medium \${asset.imageUrl ? "hidden" : "flex"} w-full h-full items-center justify-center">\${asset.symbol.substring(0, 3)}</span>
              </div>
              <div>
                <p class="font-medium text-white">\${asset.symbol}</p>
                <p class="text-sm text-gray-400">\${asset.name}</p>
              </div>
            </div>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white">\${formatCurrency(asset.price, asset.price < 0.01 ? 4 : 2)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white">\${formatNumber(asset.balance, 2)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white font-medium">\${formatCurrency(asset.value)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="\${getChangeColor(asset.change24h)} font-medium">\${formatPercentage(asset.change24h)}</p>
          </td>
        \`;

        return row;
      }

      // Load wallets data
      async function loadWallets() {
        try {
          const response = await fetch("/api/wallets/all?limit=1000");
          const result = await response.json();

          if (result.success && result.data) {
            // Store all wallets for filtering
            allWallets = result.data.wallets || [];

            // Count active wallets
            let activeCount = allWallets.filter(
              (w) => w.fetch_status === "success",
            ).length;
            document.getElementById("active-wallets").textContent = activeCount;

            // Sort by SOL balance descending
            allWallets.sort((a, b) => b.sol_balance - a.sol_balance);

            // Display all wallets
            displayWallets(allWallets);
          }
        } catch (error) {
          console.error("Error loading wallets:", error);
        }
      }

      // Display wallets in table
      function displayWallets(wallets) {
        const tbody = document.getElementById("wallets-table");
        tbody.innerHTML = "";

        if (wallets.length === 0) {
          tbody.innerHTML =
            '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No wallets found</td></tr>';
          return;
        }

        wallets.forEach((wallet) => {
          const row = createWalletRow(wallet);
          tbody.appendChild(row);
        });
      }

      // Create wallet table row
      function createWalletRow(wallet) {
        const row = document.createElement("tr");
        row.className =
          "border-b border-glass-border hover:bg-white/5 transition-colors cursor-pointer wallet-row";
        row.setAttribute(
          "data-searchable",
          wallet.wallet_address.toLowerCase(),
        );
        row.onclick = (e) => {
          if (!e.target.closest("button")) {
            window.location.href = \`/wallet/\${wallet.wallet_address}\`;
          }
        };

        const tokens = JSON.parse(wallet.tokens || "[]");
        const tokenValue = tokens.reduce(
          (sum, token) => sum + (token.usdValue || 0),
          0,
        );
        const solPrice = portfolioData?.solPrice || 150;
        const totalValue = wallet.sol_balance * solPrice + tokenValue;

        row.innerHTML = \`
          <td class="px-6 py-4">
            <div class="flex items-center space-x-2">
              <p class="font-mono text-sm text-white">\${wallet.wallet_address.substring(0, 6)}...\${wallet.wallet_address.slice(-4)}</p>
              <button onclick="copyAddress('\${wallet.wallet_address}')" class="text-gray-400 hover:text-white">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                </svg>
              </button>
            </div>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white">\${formatNumber(wallet.sol_balance, 4)} SOL</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white">\${formatCurrency(tokenValue)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-white font-medium">\${formatCurrency(totalValue)}</p>
          </td>
          <td class="px-6 py-4 text-right">
            <p class="text-gray-400 text-sm">\${new Date(wallet.last_updated).toLocaleDateString()}</p>
          </td>
        \`;

        return row;
      }

      // Copy address to clipboard
      window.copyAddress = function (address) {
        navigator.clipboard.writeText(address);
        // Could add a toast notification here
      };

      // Filter assets
      window.filterAssets = function () {
        const searchTerm = document
          .getElementById("assets-search")
          .value.toLowerCase();

        if (!searchTerm) {
          displayAssets(allAssets);
          return;
        }

        const filtered = allAssets.filter((asset) => {
          const searchable = (asset.symbol + " " + asset.name).toLowerCase();
          return searchable.includes(searchTerm);
        });

        displayAssets(filtered);
      };

      // Filter wallets
      window.filterWallets = function () {
        const searchTerm = document
          .getElementById("wallets-search")
          .value.toLowerCase();

        if (!searchTerm) {
          displayWallets(allWallets);
          return;
        }

        const filtered = allWallets.filter((wallet) => {
          return wallet.wallet_address.toLowerCase().includes(searchTerm);
        });

        displayWallets(filtered);
      };

      // Check for existing running refresh jobs
      async function checkForRunningJobs() {
        try {
          const response = await fetch("/api/admin/refresh");
          const result = await response.json();

          if (result.success && result.jobs) {
            return result.jobs.some((job) => job.status === "running");
          }
          return false;
        } catch (error) {
          console.error("Error checking for running jobs:", error);
          return false;
        }
      }

      // Lightweight refresh - just fetch current data without triggering prefetch
      async function lightweightRefresh() {
        try {
          const response = await fetch("/api/portfolio/overview");
          const result = await response.json();

          if (result.success) {
            await updateDashboard(result.data);
          }
        } catch (error) {
          console.error("Error refreshing portfolio data:", error);
        }
      }

      // Initialize on load
      document.addEventListener("DOMContentLoaded", async function () {
        initPerformanceChart();
        await lightweightRefresh(); // Use lightweight refresh on page load

        // Auto-refresh every 5 minutes (lightweight)
        setInterval(lightweightRefresh, 5 * 60 * 1000);
      });
    </script>
  `;
};
