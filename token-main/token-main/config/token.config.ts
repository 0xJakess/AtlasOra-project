/**
 * Token Configuration
 *
 * This file contains all configurable parameters for the ERC20 token.
 * Modify these values according to your token requirements.
 */

export interface TokenConfig {
  name: string;
  symbol: string;
  decimals: number;
  initialSupply: string;
  maxSupply: string;
  burnable: boolean;
  foundationAddress: string;
}

/**
 * Main token configuration
 *
 * @property name - Full name of the token
 * @property symbol - Token symbol
 * @property decimals - Number of decimal places
 * @property initialSupply - Initial token supply in whole tokens
 * @property maxSupply - Maximum total supply
 * @property burnable - Whether tokens can be burned
 * @property foundationAddress - Address that receives minted tokens from emission schedule
 */
export const TOKEN_CONFIG: TokenConfig = {
  name: "AtlasOra",
  symbol: "AORA",
  decimals: 18,
  initialSupply: "30000000",
  maxSupply: "200000000",
  burnable: true,
  foundationAddress: "0x9c819acC5c2112C0495D5dC794a516e76C269170",
};

/**
 * Validates the token configuration
 */
export function validateConfig(config: TokenConfig): void {
  if (!config.name || config.name.trim().length === 0) {
    throw new Error("Token name cannot be empty");
  }

  if (!config.symbol || config.symbol.trim().length === 0) {
    throw new Error("Token symbol cannot be empty");
  }

  if (config.decimals < 0 || config.decimals > 18) {
    throw new Error("Decimals must be between 0 and 18");
  }

  const initialSupply = BigInt(config.initialSupply);
  if (initialSupply <= 0n) {
    throw new Error("Initial supply must be greater than 0");
  }

  const maxSupply = BigInt(config.maxSupply);
  if (maxSupply < initialSupply) {
    throw new Error("Max supply cannot be less than initial supply");
  }

  // Validate initial supply is exactly 15% of max supply
  const expectedInitialSupply = (maxSupply * 15n) / 100n;
  if (initialSupply !== expectedInitialSupply) {
    throw new Error(
      `Initial supply must be exactly 15% of max supply (${expectedInitialSupply.toString()} tokens)`
    );
  }
}

// Validate configuration on import
validateConfig(TOKEN_CONFIG);
