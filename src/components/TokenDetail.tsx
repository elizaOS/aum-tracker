import { html } from "hono/html";

interface TokenDetailProps {
  mint: string;
}

export const TokenDetail = ({ mint }: TokenDetailProps) => {
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
              <h1 class="text-2xl font-semibold text-white" id="token-name">Loading...</h1>
              <p class="text-gray-400 text-sm mt-1 font-mono">${mint.substring(0, 8)}...${mint.slice(-6)}</p>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <button onclick="copyTokenMint('${mint}')" class="px-4 py-2 glass-card rounded-lg text-gray-300 hover:text-white transition-colors flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
              <span>Copy Mint</span>
            </button>
            
            <a href="https://solscan.io/token/${mint}" target="_blank" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center space-x-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
              </svg>
              <span>View on Solscan</span>
            </a>
          </div>
        </div>
      </header>
      
      <div class="px-6 lg:px-8 py-8">
        <!-- Token Overview Card -->
        <div class="glass-card rounded-2xl p-8 mb-8 fade-in">
          <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p class="text-gray-400 text-sm mb-1">Price</p>
              <p class="text-2xl font-bold text-white" id="token-price">$0.00</p>
              <p class="text-sm" id="token-price-change">0.00%</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Total Holdings</p>
              <p class="text-2xl font-bold text-white" id="token-total-amount">0.00</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Total Value</p>
              <p class="text-2xl font-bold text-white" id="token-total-value">$0.00</p>
            </div>
            <div>
              <p class="text-gray-400 text-sm mb-1">Holders</p>
              <p class="text-2xl font-bold text-white" id="token-holder-count">0</p>
            </div>
          </div>
        </div>
        
        <!-- Token Statistics -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <!-- Distribution Chart -->
          <div class="glass-card rounded-2xl p-6 fade-in">
            <h3 class="text-lg font-semibold text-white mb-4">Distribution</h3>
            <div style="position: relative; height: 200px;">
              <canvas id="distribution-chart"></canvas>
            </div>
          </div>
          
          <!-- PNL Summary -->
          <div class="glass-card rounded-2xl p-6 fade-in">
            <h3 class="text-lg font-semibold text-white mb-4">Portfolio PNL</h3>
            <div class="space-y-4">
              <div>
                <p class="text-gray-400 text-sm mb-1">Total PNL</p>
                <p class="text-xl font-bold" id="token-total-pnl">$0.00</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm mb-1">Average Entry Price</p>
                <p class="text-lg text-white" id="token-avg-entry">$0.00</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm mb-1">Current vs Average</p>
                <p class="text-lg font-semibold" id="token-price-diff">0.00%</p>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Wallet Holdings -->
        <div class="glass-card rounded-2xl overflow-hidden fade-in">
          <div class="px-6 py-4 border-b border-glass-border flex items-center justify-between">
            <h3 class="text-lg font-semibold text-white">Wallet Holdings</h3>
            <p class="text-sm text-gray-400">Sorted by balance</p>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full">
              <thead>
                <tr class="text-left text-gray-400 text-sm border-b border-glass-border">
                  <th class="px-6 py-4 font-medium">Wallet</th>
                  <th class="px-6 py-4 font-medium text-right">Balance</th>
                  <th class="px-6 py-4 font-medium text-right">Value</th>
                  <th class="px-6 py-4 font-medium text-right">% of Total</th>
                  <th class="px-6 py-4 font-medium text-right">PNL</th>
                </tr>
              </thead>
              <tbody id="token-holders-table">
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-gray-400">
                    <div class="loading-pulse">Loading holders...</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    
    <script>
      const tokenMint = '${mint}';
      let tokenData = null;
      let distributionChart = null;
      let isLoading = false;
      
      // Initialize distribution chart
      function initDistributionChart(holders) {
        const ctx = document.getElementById('distribution-chart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (distributionChart) {
          distributionChart.destroy();
          distributionChart = null;
        }
        
        // Calculate distribution
        const sortedHolders = holders.sort((a, b) => b.balance - a.balance);
        const top5 = sortedHolders.slice(0, 5);
        const others = sortedHolders.slice(5);
        
        const labels = [];
        const data = [];
        
        top5.forEach(holder => {
          labels.push(holder.address.substring(0, 6) + '...');
          data.push(holder.balance);
        });
        
        if (others.length > 0) {
          const othersTotal = others.reduce((sum, h) => sum + h.balance, 0);
          labels.push('Others');
          data.push(othersTotal);
        }
        
        distributionChart = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: data,
              backgroundColor: [
                '#6366F1',
                '#8B5CF6',
                '#EC4899',
                '#EF4444',
                '#F59E0B',
                '#10B981'
              ],
              borderWidth: 0,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1.5,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  color: '#9CA3AF',
                  padding: 10,
                  font: {
                    size: 12
                  }
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                    const percentage = ((context.parsed / total) * 100).toFixed(1);
                    return context.label + ': ' + formatNumber(context.parsed, 2) + ' (' + percentage + '%)';
                  }
                }
              }
            }
          }
        });
      }
      
      // Load token data
      async function loadTokenData() {
        if (isLoading) return;
        isLoading = true;
        
        try {
          // Fetch token holders data
          const response = await fetch(\`/api/tokens/holders/\${tokenMint}\`);
          const result = await response.json();
          
          if (result.success && result.data) {
            tokenData = result.data;
            
            // Update header
            document.getElementById('token-name').textContent = \`\${tokenData.symbol} (\${tokenData.name})\`;
            
            // Update overview
            document.getElementById('token-price').textContent = formatCurrency(tokenData.price, tokenData.price < 0.01 ? 6 : 4);
            document.getElementById('token-price-change').textContent = formatPercentage(tokenData.priceChange24h || 0);
            document.getElementById('token-price-change').className = 'text-sm ' + getChangeColor(tokenData.priceChange24h || 0);
            
            document.getElementById('token-total-amount').textContent = formatNumber(tokenData.totalAmount, 2);
            document.getElementById('token-total-value').textContent = formatCurrency(tokenData.totalValue);
            document.getElementById('token-holder-count').textContent = tokenData.holderCount;
            
            // Update PNL if available
            if (tokenData.pnl) {
              document.getElementById('token-total-pnl').textContent = formatCurrency(tokenData.pnl.totalPNL || 0);
              document.getElementById('token-total-pnl').className = 'text-xl font-bold ' + getChangeColor(tokenData.pnl.totalPNL || 0);
              
              document.getElementById('token-avg-entry').textContent = formatCurrency(tokenData.pnl.avgEntryPrice || 0, 6);
              
              const priceDiff = tokenData.price && tokenData.pnl.avgEntryPrice 
                ? ((tokenData.price - tokenData.pnl.avgEntryPrice) / tokenData.pnl.avgEntryPrice * 100)
                : 0;
              document.getElementById('token-price-diff').textContent = formatPercentage(priceDiff);
              document.getElementById('token-price-diff').className = 'text-lg font-semibold ' + getChangeColor(priceDiff);
            }
            
            // Update holders table
            updateHoldersTable(tokenData.holders);
            
            // Initialize distribution chart
            initDistributionChart(tokenData.holders);
          }
        } catch (error) {
          console.error('Error loading token data:', error);
        } finally {
          isLoading = false;
        }
      }
      
      // Update holders table
      function updateHoldersTable(holders) {
        const tbody = document.getElementById('token-holders-table');
        tbody.innerHTML = '';
        
        if (!holders || holders.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">No holders found</td></tr>';
          return;
        }
        
        const sortedHolders = holders.sort((a, b) => b.balance - a.balance);
        
        sortedHolders.forEach(holder => {
          const row = document.createElement('tr');
          row.className = 'border-b border-glass-border hover:bg-white/5 transition-colors cursor-pointer';
          row.onclick = () => window.location.href = \`/wallet/\${holder.address}\`;
          
          const percentOfTotal = tokenData.totalAmount > 0 
            ? (holder.balance / tokenData.totalAmount * 100).toFixed(2)
            : '0.00';
          
          row.innerHTML = \`
            <td class="px-6 py-4">
              <div class="flex items-center space-x-2">
                <p class="font-mono text-sm text-white">\${holder.address.substring(0, 6)}...\${holder.address.slice(-4)}</p>
                <button onclick="event.stopPropagation(); copyAddress('\${holder.address}')" class="text-gray-400 hover:text-white transition-colors" title="Copy address">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                  </svg>
                </button>
              </div>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white">\${formatNumber(holder.balance, 4)}</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white font-medium">\${formatCurrency(holder.value)}</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="text-white">\${percentOfTotal}%</p>
            </td>
            <td class="px-6 py-4 text-right">
              <p class="\${getChangeColor(holder.pnl || 0)}">\${holder.pnl ? formatCurrency(holder.pnl) : '-'}</p>
            </td>
          \`;
          
          tbody.appendChild(row);
        });
      }
      
      // Copy token mint function
      window.copyTokenMint = function(mint) {
        navigator.clipboard.writeText(mint).then(() => {
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
          console.error('Failed to copy mint:', err);
        });
      };
      
      // Copy address function
      window.copyAddress = function(address) {
        navigator.clipboard.writeText(address).then(() => {
          const button = event.target.closest('button');
          if (button) {
            button.classList.add('text-green-400');
            setTimeout(() => {
              button.classList.remove('text-green-400');
            }, 1000);
          }
        }).catch(err => {
          console.error('Failed to copy address:', err);
        });
      };
      
      // Initialize on load
      document.addEventListener('DOMContentLoaded', loadTokenData);
    </script>
  `;
};