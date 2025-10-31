import {
  findUserWalletsByMainAddress,
  createUserWallet,
  deleteUserWallet,
  findWalletByAddressAndMain,
  updateUserWalletName,
} from "../repositories/wallet.repo";
import { findUserByWalletAddress } from "../repositories/user.repo";

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  // Check if it's a valid Ethereum address
  // Format: 0x followed by 40 hexadecimal characters (case-insensitive)
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}

/**
 * Validate chain ID (must be a positive integer)
 */
export function isValidChainId(chainId: number): boolean {
  return Number.isInteger(chainId) && chainId > 0;
}

/**
 * Get all wallets for a user
 * - Main wallet (address + name) from users table
 * - Secondary wallets (address + name) from user_wallets table
 */
export async function getUserWallets(mainAddress: string) {
  const allWallets = [];
  
  // 1. Get main wallet from users table (address + name)
  const mainUser = await findUserByWalletAddress(mainAddress);
  if (mainUser) {
    allWallets.push({
      main_wallet_address: mainUser.wallet_address,
      address: mainUser.wallet_address,
      name: mainUser.name, // Name comes from users table
      chain_id: 1, // Default to Ethereum mainnet
      is_active: true,
      created_at: mainUser.created_at,
      updated_at: mainUser.updated_at,
    });
  }
  
  // 2. Get secondary wallets from user_wallets table (address + name)
  // The query already excludes the main wallet if it exists in user_wallets
  const secondaryWallets = await findUserWalletsByMainAddress(mainAddress);
  allWallets.push(...secondaryWallets);
  
  return allWallets;
}

/**
 * Add a new wallet for a user
 */
export async function addWalletToUser(data: {
  mainWalletAddress: string;
  address: string;
  name: string;
  chainId: number;
}) {
  // Validate address format
  if (!isValidAddress(data.address)) {
    throw new Error("Invalid wallet address format");
  }

  // Validate chain ID
  if (!isValidChainId(data.chainId)) {
    throw new Error("Invalid chain ID");
  }

  // Check if wallet already exists for this user
  const existing = await findWalletByAddressAndMain(
    data.address,
    data.mainWalletAddress
  );

  if (existing) {
    throw new Error("This wallet is already added to your account");
  }

  // Create the wallet
  return await createUserWallet(data);
}

/**
 * Remove a wallet from user
 */
export async function removeWalletFromUser(
  mainAddress: string,
  address: string
) {
  // Validate address format
  if (!isValidAddress(address)) {
    throw new Error("Invalid wallet address format");
  }

  // Try to delete the wallet
  const deleted = await deleteUserWallet(mainAddress, address);

  if (!deleted) {
    throw new Error("Wallet not found or does not belong to you");
  }

  return deleted;
}

/**
 * Get a specific wallet by address
 */
export async function getUserWallet(mainAddress: string, address: string) {
  return await findWalletByAddressAndMain(mainAddress, address);
}

/**
 * Update wallet name
 */
export async function updateWalletName(
  mainAddress: string,
  address: string,
  name: string
) {
  // Validate name
  if (!name || name.trim().length === 0) {
    throw new Error("Wallet name cannot be empty");
  }

  // Validate address format
  if (!isValidAddress(address)) {
    throw new Error("Invalid wallet address format");
  }

  // Update the wallet name
  const updated = await updateUserWalletName(mainAddress, address, name.trim());

  if (!updated) {
    throw new Error("Wallet not found or does not belong to you");
  }

  return updated;
}

