import { HardhatUserConfig } from "hardhat/types";
import * as dotenv from "dotenv";
import "@nomiclabs/hardhat-ethers";

// Load environment variables from .env file
dotenv.config();

console.log("DEBUG: Loading config. Private Key exists?", !!(process.env.LOCAL_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY));
console.log("DEBUG: RPC URL:", process.env.HOST_RPC_URL || process.env.RPC_URL);

import "@nomiclabs/hardhat-waffle";
import "solidity-coverage";

// Helper to parse private keys from env
function getAccounts(privateKey?: string): string[] {
  if (!privateKey) return [];
  return privateKey.split(',').map(key => key.trim()).filter(key => key.length > 0);
}

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
      accounts: { 
        count: 10, 
      },
    },
    // Local development (Host machine accessing local node or docker forwarded port)
    local: {
      url: process.env.LOCAL_RPC_URL || process.env.HOST_RPC_URL || process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: parseInt(process.env.LOCAL_CHAIN_ID || process.env.CHAIN_ID || "31337"),
      accounts: getAccounts(process.env.LOCAL_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY),
      timeout: 120000,
    },
    // Test environment (Docker)
    test: {
      url: process.env.TEST_RPC_URL || process.env.RPC_URL || "http://hardhat:9545",
      chainId: parseInt(process.env.TEST_CHAIN_ID || process.env.CHAIN_ID || "31337"),
      accounts: getAccounts(process.env.TEST_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY),
      timeout: 120000,
    },
    // Development/Production environment
    dev: {
      url: process.env.DEV_RPC_URL || process.env.RPC_URL || "",
      chainId: parseInt(process.env.DEV_CHAIN_ID || process.env.CHAIN_ID || "1"),
      accounts: getAccounts(process.env.DEV_DEPLOYER_PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.ISSUER_PRIVATE_KEY),
      timeout: 120000,
    },
  },
  solidity: {
    compilers: [{ version: "0.8.18" }],
  },
};

export default config;
