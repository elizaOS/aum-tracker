import { readFileSync } from "fs";
import path from "path";

export interface WalletEntry {
  id: string;
  solana_public_key: string;
}

export interface UniqueWallet {
  address: string;
  ids: string[];
}

export class CSVService {
  private csvPath: string;
  private walletEntries: WalletEntry[] = [];
  private uniqueWallets: UniqueWallet[] = [];
  private isLoaded: boolean = false;

  constructor(csvFileName: string = "wallets.csv") {
    this.csvPath = path.join(process.cwd(), "data", csvFileName);
  }

  // Load and parse CSV file
  public loadWallets(): void {
    try {
      const csvContent = readFileSync(this.csvPath, "utf-8");
      const lines = csvContent.trim().split("\n");

      // Skip header line
      const dataLines = lines.slice(1);

      this.walletEntries = [];
      const walletMap = new Map<string, string[]>();

      for (const line of dataLines) {
        const [id, solana_public_key] = line.split(",");

        if (!id || !solana_public_key) {
          console.warn(`Invalid CSV line: ${line}`);
          continue;
        }

        const trimmedId = id.trim();
        const trimmedAddress = solana_public_key.trim();

        // Add to entries
        this.walletEntries.push({
          id: trimmedId,
          solana_public_key: trimmedAddress,
        });

        // Track unique wallets
        if (!walletMap.has(trimmedAddress)) {
          walletMap.set(trimmedAddress, []);
        }
        walletMap.get(trimmedAddress)!.push(trimmedId);
      }

      // Create unique wallets array
      this.uniqueWallets = Array.from(walletMap.entries()).map(
        ([address, ids]) => ({
          address,
          ids,
        }),
      );

      this.isLoaded = true;
      console.log(
        `Loaded ${this.walletEntries.length} wallet entries (${this.uniqueWallets.length} unique wallets)`,
      );
    } catch (error) {
      console.error("Error loading CSV file:", error);
      throw new Error(`Failed to load wallet data from ${this.csvPath}`);
    }
  }

  // Get all wallet entries
  public getAllWalletEntries(): WalletEntry[] {
    if (!this.isLoaded) {
      this.loadWallets();
    }
    return this.walletEntries;
  }

  // Get unique wallet addresses
  public getUniqueWallets(): UniqueWallet[] {
    if (!this.isLoaded) {
      this.loadWallets();
    }
    return this.uniqueWallets;
  }

  // Get wallet addresses only (for processing)
  public getWalletAddresses(): string[] {
    if (!this.isLoaded) {
      this.loadWallets();
    }
    return this.uniqueWallets.map((wallet) => wallet.address);
  }

  // Get wallets for batch processing
  public getWalletsForProcessing(): Array<{ id: string; address: string }> {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    return this.uniqueWallets.map((wallet) => ({
      id: wallet.ids[0], // Use first ID as primary
      address: wallet.address,
    }));
  }

  // Get statistics
  public getStats(): {
    totalEntries: number;
    uniqueWallets: number;
    duplicateWallets: number;
    averageIdsPerWallet: number;
  } {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    const duplicateWallets = this.uniqueWallets.filter(
      (wallet) => wallet.ids.length > 1,
    ).length;
    const totalIds = this.uniqueWallets.reduce(
      (sum, wallet) => sum + wallet.ids.length,
      0,
    );
    const averageIdsPerWallet =
      this.uniqueWallets.length > 0 ? totalIds / this.uniqueWallets.length : 0;

    return {
      totalEntries: this.walletEntries.length,
      uniqueWallets: this.uniqueWallets.length,
      duplicateWallets,
      averageIdsPerWallet: Math.round(averageIdsPerWallet * 100) / 100,
    };
  }

  // Find wallet by address
  public findWalletByAddress(address: string): UniqueWallet | null {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    return (
      this.uniqueWallets.find((wallet) => wallet.address === address) || null
    );
  }

  // Find wallet by ID
  public findWalletById(id: string): WalletEntry | null {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    return this.walletEntries.find((entry) => entry.id === id) || null;
  }

  // Get wallets with multiple IDs
  public getWalletsWithMultipleIds(): UniqueWallet[] {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    return this.uniqueWallets.filter((wallet) => wallet.ids.length > 1);
  }

  // Validate CSV file exists and is readable
  public validateCSVFile(): { isValid: boolean; error?: string } {
    try {
      const csvContent = readFileSync(this.csvPath, "utf-8");
      const lines = csvContent.trim().split("\n");

      if (lines.length < 2) {
        return {
          isValid: false,
          error: "CSV file must have at least a header and one data row",
        };
      }

      const header = lines[0].toLowerCase();
      if (!header.includes("id") || !header.includes("solana_public_key")) {
        return {
          isValid: false,
          error: 'CSV file must have "id" and "solana_public_key" columns',
        };
      }

      // Check first few data rows for basic format
      const sampleRows = lines.slice(1, Math.min(6, lines.length));
      for (const row of sampleRows) {
        const columns = row.split(",");
        if (columns.length < 2) {
          return {
            isValid: false,
            error: "CSV rows must have at least 2 columns",
          };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error reading CSV file",
      };
    }
  }

  // Reload CSV file (useful for development)
  public reload(): void {
    this.isLoaded = false;
    this.walletEntries = [];
    this.uniqueWallets = [];
    this.loadWallets();
  }

  // Export processed data to JSON (for debugging)
  public exportToJSON(filePath?: string): string {
    if (!this.isLoaded) {
      this.loadWallets();
    }

    const data = {
      stats: this.getStats(),
      entries: this.walletEntries,
      uniqueWallets: this.uniqueWallets,
      exportedAt: new Date().toISOString(),
    };

    const jsonString = JSON.stringify(data, null, 2);

    if (filePath) {
      try {
        Bun.write(filePath, jsonString);
        console.log(`Exported wallet data to ${filePath}`);
      } catch (error) {
        console.error("Error exporting to JSON:", error);
      }
    }

    return jsonString;
  }
}

// Export singleton instance
export const csvService = new CSVService();

// Export utility functions
export const loadWalletData = () => csvService.loadWallets();
export const getWalletAddresses = () => csvService.getWalletAddresses();
export const getWalletsForProcessing = () =>
  csvService.getWalletsForProcessing();
export const getWalletStats = () => csvService.getStats();
