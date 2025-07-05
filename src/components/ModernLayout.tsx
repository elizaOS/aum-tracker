import { html } from 'hono/html';

interface LayoutProps {
  title?: string;
  children: any;
}

export const ModernLayout = ({ title = 'Spartan AUM', children }: LayoutProps) => {
  return html`
    <!DOCTYPE html>
    <html lang="en" class="dark">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      
      <!-- Tailwind CSS -->
      <script src="https://cdn.tailwindcss.com"></script>
      
      <!-- Chart.js -->
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      
      <!-- Inter Font -->
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
      
      <!-- Custom styles -->
      <style>
        * {
          font-family: 'Inter', sans-serif;
        }
        
        body {
          background: #0A0A0A;
        }
        
        .glass-card {
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(20px);
        }
        
        .sidebar-item {
          transition: all 0.2s ease;
        }
        
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        
        .sidebar-item.active {
          background: rgba(99, 102, 241, 0.1);
          border-left: 3px solid #6366F1;
        }
        
        .gradient-text {
          background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        
        .token-logo {
          background: #1A1A1A;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .performance-chart {
          background: rgba(30, 30, 30, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        ::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        
        ::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        
        ::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .fade-in {
          animation: fadeIn 0.3s ease-in-out;
        }
        
        @keyframes fadeIn {
          from { 
            opacity: 0; 
            transform: translateY(10px); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0); 
          }
        }
        
        .loading-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      </style>
      
      <!-- Tailwind Config -->
      <script>
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              colors: {
                'glass-bg': '#0A0A0A',
                'glass-card': '#141414',
                'glass-border': 'rgba(255, 255, 255, 0.08)',
              }
            }
          }
        }
      </script>
    </head>
    <body class="bg-glass-bg text-white min-h-screen flex">
      <!-- Sidebar -->
      <aside class="w-16 lg:w-64 glass-card border-r border-glass-border h-screen sticky top-0 flex flex-col">
        <!-- Logo -->
        <div class="p-4 lg:p-6 border-b border-glass-border">
          <a href="/" class="flex items-center space-x-3 hover:opacity-80 transition-opacity">
            <div class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <span class="text-white font-bold text-xl">S</span>
            </div>
            <span class="hidden lg:block font-semibold text-xl">Spartan</span>
          </a>
        </div>
        
        <!-- Navigation -->
        <nav class="flex-1 p-2 lg:p-4">
          <div class="space-y-1">
            <a href="/" class="sidebar-item active flex items-center px-3 py-3 rounded-lg text-white">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
              </svg>
              <span class="ml-3 hidden lg:block">Overview</span>
            </a>
            
            <div class="sidebar-item flex items-center px-3 py-3 rounded-lg text-gray-400 opacity-50 cursor-not-allowed" title="Coming soon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path>
              </svg>
              <span class="ml-3 hidden lg:block">Explore</span>
            </div>
            
            <div class="sidebar-item flex items-center px-3 py-3 rounded-lg text-gray-400 opacity-50 cursor-not-allowed" title="Coming soon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
              </svg>
              <span class="ml-3 hidden lg:block">Rewards</span>
            </div>
            
            <div class="sidebar-item flex items-center px-3 py-3 rounded-lg text-gray-400 opacity-50 cursor-not-allowed" title="Coming soon">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <span class="ml-3 hidden lg:block">Favorites</span>
            </div>
          </div>
        </nav>
        
        <!-- Settings -->
        <div class="p-2 lg:p-4 border-t border-glass-border">
          <div class="sidebar-item flex items-center px-3 py-3 rounded-lg text-gray-400 opacity-50 cursor-not-allowed" title="Coming soon">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>
            <span class="ml-3 hidden lg:block">Settings</span>
          </div>
        </div>
      </aside>
      
      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto">
        ${children}
      </main>
      
      <!-- Global Scripts -->
      <script>
        // Utility functions
        window.formatCurrency = function(amount, decimals = 2) {
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(amount);
        };
        
        window.formatNumber = function(num, decimals = 2) {
          return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          }).format(num);
        };
        
        window.formatPercentage = function(value, showSign = true) {
          const formatted = Math.abs(value).toFixed(2) + '%';
          if (!showSign) return formatted;
          
          if (value > 0) return '+' + formatted;
          if (value < 0) return '-' + formatted;
          return formatted;
        };
        
        window.formatCompact = function(num) {
          const formatter = new Intl.NumberFormat('en-US', {
            notation: 'compact',
            maximumFractionDigits: 1
          });
          return formatter.format(num);
        };
        
        window.getChangeColor = function(value) {
          if (value > 0) return 'text-green-400';
          if (value < 0) return 'text-red-400';
          return 'text-gray-400';
        };
        
        window.getChangeBg = function(value) {
          if (value > 0) return 'bg-green-400/10';
          if (value < 0) return 'bg-red-400/10';
          return 'bg-gray-400/10';
        };
      </script>
    </body>
    </html>
  `;
};