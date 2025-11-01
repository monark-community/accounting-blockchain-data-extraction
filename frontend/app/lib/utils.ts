import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Clears Web3Auth keys from sessionStorage
 * Used as fallback when Web3Auth logout() fails or for cleanup
 */
export function clearWeb3AuthSessionStorage(): void {
  if (typeof window === "undefined") return;
  
  try {
    Object.keys(sessionStorage).forEach(key => {
      if (key.includes("web3auth") || key.includes("openlogin") || key.includes("W3A")) {
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Failed to clear Web3Auth sessionStorage:", error);
  }
}

/**
 * Clears Web3Auth keys from localStorage
 * Used for migration from localStorage to sessionStorage
 */
export function clearWeb3AuthLocalStorage(): void {
  if (typeof window === "undefined") return;
  
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("openlogin.") || key.includes("W3A") || key.includes("web3auth"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn(`Failed to remove localStorage key: ${key}`, e);
      }
    });
  } catch (error) {
    console.warn("Failed to clear Web3Auth localStorage:", error);
  }
}