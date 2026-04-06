/**
 * Interfaces pour les réponses Pinax API (The Graph Token API)
 */

/**
 * Transaction brute retournée par Pinax (EVM Token Transfers)
 */
export interface PinaxRawTransaction {
  transaction_hash: string;
  block_number: number;
  datetime: string;

  from: string;
  to: string;

  value: string;

  // Token info (peut être absent selon le cas)
  token_address?: string;
  token_symbol?: string;
  token_name?: string;
  token_decimals?: number;
}

/**
 * Réponse réelle de l'API Pinax
 */
export interface PinaxTransactionsResponse {
  data: PinaxRawTransaction[];
}

/**
 * Paramètres de requête Pinax
 */
export interface PinaxQueryParams {
  address: string;
  network: string;
  limit?: number;
}