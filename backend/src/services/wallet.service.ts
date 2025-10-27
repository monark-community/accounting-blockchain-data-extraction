import {
  findUserWalletsByMainAddress,
  createUserWallet,
  deleteUserWallet,
  findWalletByAddressAndMain,
} from "../repositories/wallet.repo";

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
 */
export async function getUserWallets(mainAddress: string) {
  return await findUserWalletsByMainAddress(mainAddress);
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

