import { html } from "hono/html";

interface WalletDetailProps {
  address: string;
}

export const WalletDetail = ({ address }: WalletDetailProps) => {
  return html`
    <div class="min-h-screen">
      <!-- Header -->
      <header class="px-6 lg:px-8 py-6 border-b border-glass-border">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <a href="/" class="text-gray-400 hover:text-white transition-colors">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
            </a>
            <div>
              <h1 class="text-2xl font-semibold text-white">Wallet Details</h1>
              <p class="text-gray-400 text-sm mt-1 font-mono">${address.substring(0, 8)}...${address.slice(-6)}</p>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <button onclick="copyWalletAddress('${address}')" class="px-4 py-2 glass-card rounded-lg text-gray-300 hover:text-white transition-colors flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span>Copy Address</span>
            </button>
            
            <a href="https://solscan.io/account/${address}" target="_blank" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              <span>View on Solscan</span>
            </a>
          </div>
        </div>
      </header>
      
      <div class="px-6 lg:px-8 py-8">
        <!-- Wallet Overview Card -->
        <div class="glass-card rounded-2xl p-8 mb-8 fade-in">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-1">Total Value</p>
              <p class="text-2xl font-bold text-white" id="wallet-total-value">$0.00</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">SOL Balance</p>
              <p class="text-2xl font-bold text-white" id="wallet-sol-balance">0.00 SOL</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Token Value</p>
              <p class="text-2xl font-bold text-white" id="wallet-token-value">$0.00</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Last Updated</p>
              <p class="text-lg text-gray-300" id="wallet-last-updated">-</p>
            </div>
          </div>
        </div>
        
        <!-- PNL Card -->
        <div class="glass-card rounded-2xl p-8 mb-8 fade-in">
          <h3 class="text-lg font-semibold text-white mb-4">Profit & Loss</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-1">Total PNL</p>
              <p class="text-2xl font-bold" id="wallet-total-pnl">$0.00</p>
              <p class="text-sm" id="wallet-total-pnl-percent">0.00%</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Unrealized PNL</p>
              <p class="text-xl font-semibold" id="wallet-unrealized-pnl">$0.00</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Realized PNL</p>
              <p class="text-xl font-semibold" id="wallet-realized-pnl">$0.00</p>
            </div>
          </div>
        </div>
        
        <!-- Token Holdings -->
        <div class="glass-card rounded-2xl overflow-hidden fade-in">
          <div class="px-6 py-4 border-b border-glass-border">
            <h3 class="text-lg font-semibold text-white">Token Holdings</h3>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-gray-400 text-sm border-b border-glass-border">
                  <th class="px-6 py-4 font-medium">Token</th>
                  <th class="px-6 py-4 font-medium text-right">Price</th>
                  <th class="px-6 py-4 font-medium text-right">Balance</th>
                  <th class="px-6 py-4 font-medium text-right">Value</th>
                  <th class="px-6 py-4 font-medium text-right">PNL</th>
                </tr>
              </thead>
              <tbody id="wallet-tokens-table">
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    <div class="loading-pulse">Loading tokens...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <!-- Transaction History (placeholder) -->
        <div class="mt-8 glass-card rounded-2xl p-6 fade-in">
          <h3 class="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <p class="text-gray-400 text-center py-8">Transaction history coming soon...</p>
        </div>
      </div>
    </div>
    
    <script>
      const walletAddress = '${address}';
      
      // Load wallet data
      async function loadWalletData() {
        try {
          // Fetch wallet balance
          const balanceRes = await fetch(\`/api/wallets/balance/\${walletAddress}\`);
          const balanceData = await balanceRes.json();
          
          if (balanceData.success) {
            const wallet = balanceData.data;
            const tokens = wallet.tokens || [];
            
            // Calculate totals
            const tokenValue = tokens.reduce((sum, token) => sum + (token.usdValue || 0), 0);
            const solValue = wallet.solBalance * 150; // TODO: Use actual SOL price
            const totalValue = solValue + tokenValue;
            
            // Update overview
            document.getElementById('wallet-total-value').textContent = formatCurrency(totalValue);
            document.getElementById('wallet-sol-balance').textContent = formatNumber(wallet.solBalance, 4) + ' SOL';
            document.getElementById('wallet-token-value').textContent = formatCurrency(tokenValue);
            document.getElementById('wallet-last-updated').textContent = new Date(wallet.lastUpdated).toLocaleString();
            
            // Load PNL data
            await loadWalletPNL();
            
            // Update token table
            updateTokenTable(tokens);
          }
        } catch (error) {
          console.error('Error loading wallet data:', error);
        }
      }
      
      // Load wallet PNL
      async function loadWalletPNL() {
        try {
          const response = await fetch(\`/api/wallets/pnl/\${walletAddress}\`);
          const result = await response.json();
          
          if (result.success && result.data) {
            const pnl = result.data;
            
            const totalPnlEl = document.getElementById('wallet-total-pnl');
            const totalPnlPercentEl = document.getElementById('wallet-total-pnl-percent');
            const unrealizedEl = document.getElementById('wallet-unrealized-pnl');
            const realizedEl = document.getElementById('wallet-realized-pnl');
            
            // Update PNL values
            totalPnlEl.textContent = formatCurrency(pnl.totalPNL || 0);
            totalPnlEl.className = 'text-2xl font-bold ' + getChangeColor(pnl.totalPNL || 0);
            
            totalPnlPercentEl.textContent = formatPercentage(pnl.totalPNLPercentage || 0);
            totalPnlPercentEl.className = 'text-sm ' + getChangeColor(pnl.totalPNLPercentage || 0);
            
            unrealizedEl.textContent = formatCurrency(pnl.unrealizedPNL || 0);
            unrealizedEl.className = 'text-xl font-semibold ' + getChangeColor(pnl.unrealizedPNL || 0);
            
            realizedEl.textContent = formatCurrency(pnl.realizedPNL || 0);
            realizedEl.className = 'text-xl font-semibold ' + getChangeColor(pnl.realizedPNL || 0);
          }
        } catch (error) {
          console.error('Error loading wallet PNL:', error);
        }
      }
      
      // Update token table
      function updateTokenTable(tokens) {
        const tbody = document.getElementById('wallet-tokens-table');
        tbody.innerHTML = '';
        
        if (tokens.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No tokens found</td></tr>';
          return;
        }
        
        tokens.forEach(token => {
          const row = document.createElement('tr');
          row.className = 'border-b border-glass-border hover:bg-white/5 transition-colors cursor-pointer';
          row.onclick = () => window.location.href = \`/token/\${token.mint}\`;
          
          row.innerHTML = \`
            <td class="px-6 py-4">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 token-logo rounded-full flex items-center justify-center">
                  <span class="text-xs font-medium">\${(token.symbol || 'UNK').substring(0, 3)}</span>
                </div>
                <div>
                  <p class="font-medium text-white">\${token.symbol || 'Unknown'}</p>
                  <p class="text-sm text-gray-400">\${token.name || 'Unknown Token'}</p>
                </div>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white">\${formatCurrency(token.usdValue && token.amount ? token.usdValue / token.amount : 0, 4)}</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white">\${formatNumber(token.amount || 0, 4)}</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white font-medium">\${formatCurrency(token.usdValue || 0)}</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-gray-400">-</p>
            </td>
          \`;
          
          tbody.appendChild(row);
        });
      }
      
      // Copy address function
      window.copyWalletAddress = function(address) {
        navigator.clipboard.writeText(address).then(() => {
          const button = event.target.closest('button');
          const span = button.querySelector('span');
          const originalText = span.textContent;
          span.textContent = 'Copied!';
          button.classList.add('text-green-400');
          
          setTimeout(() => {
            span.textContent = originalText;
            button.classList.remove('text-green-400');
          }, 1500);
        }).catch(err => {
          console.error('Failed to copy address:', err);
        });
      };
      
      // Initialize on load
      document.addEventListener('DOMContentLoaded', loadWalletData);
    </script>
  `;
};