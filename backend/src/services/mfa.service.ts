import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { pool } from '../db/pool';

export type MFASetupResult = {
  secret: string;
  qrCode: string;
  backupCodes: string[];
};

export type MFAVerificationResult = {
  success: boolean;
  backupCodeUsed?: boolean;
};

/**
 * Generate a new MFA secret and QR code for a user
 */
export async function setupMFA(userId: string, email: string): Promise<MFASetupResult> {
  // Generate secret
  const secret = authenticator.generateSecret();

  // Create service name for the authenticator app
  const serviceName = 'LedgerLift';

  // Generate the otpauth URL
  const otpauthUrl = authenticator.keyuri(email, serviceName, secret);

  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(otpauthUrl);

  // Generate backup codes (10 codes, 8 characters each)
  const backupCodes = generateBackupCodes(10);

  // Store in database
  await pool.query(
    `UPDATE users 
     SET mfa_secret = $1, 
         mfa_backup_codes = $2,
         updated_at = NOW()
     WHERE wallet_address = $3`,
    [secret, backupCodes, userId]
  );

  return {
    secret,
    qrCode,
    backupCodes,
  };
}

/**
 * Verify a TOTP code for a user
 */
export async function verifyMFA(userId: string, code: string): Promise<MFAVerificationResult> {
  // Get user's MFA secret (don't check mfa_enabled - works during setup too)
  const { rows } = await pool.query(
    `SELECT mfa_secret, mfa_backup_codes, mfa_enabled
     FROM users 
     WHERE wallet_address = $1`,
    [userId]
  );

  if (rows.length === 0) {
    throw new Error('User not found');
  }

  const { mfa_secret, mfa_backup_codes, mfa_enabled } = rows[0];

  if (!mfa_secret) {
    throw new Error('MFA not set up for this user');
  }

  // Try verifying as TOTP code
  const isValidTOTP = authenticator.verify({
    token: code,
    secret: mfa_secret,
  });

  if (isValidTOTP) {
    return { success: true };
  }

  // Try verifying as backup code
  const backupCodes = mfa_backup_codes || [];
  const backupCodeIndex = backupCodes.indexOf(code);

  if (backupCodeIndex !== -1) {
    // Remove the used backup code
    const updatedBackupCodes = backupCodes.filter((_code: string, index: number) => index !== backupCodeIndex);
    
    await pool.query(
      `UPDATE users 
       SET mfa_backup_codes = $1, 
           updated_at = NOW()
       WHERE wallet_address = $2`,
      [updatedBackupCodes, userId]
    );

    return { success: true, backupCodeUsed: true };
  }

  return { success: false };
}

/**
 * Enable MFA for a user (after they've verified their first code)
 */
export async function enableMFA(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users 
     SET mfa_enabled = TRUE,
         updated_at = NOW()
     WHERE wallet_address = $1`,
    [userId]
  );
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users 
     SET mfa_enabled = FALSE,
         mfa_secret = NULL,
         mfa_backup_codes = NULL,
         updated_at = NOW()
     WHERE wallet_address = $1`,
    [userId]
  );
}

/**
 * Check if MFA is enabled for a user
 */
export async function isMFAEnabled(userId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT mfa_enabled FROM users WHERE wallet_address = $1`,
    [userId]
  );

  return rows.length > 0 && rows[0].mfa_enabled === true;
}

/**
 * Get remaining backup codes for a user
 */
export async function getBackupCodes(userId: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT mfa_backup_codes FROM users WHERE wallet_address = $1`,
    [userId]
  );

  return rows.length > 0 ? (rows[0].mfa_backup_codes || []) : [];
}

/**
 * Generate new backup codes for a user
 */
export async function regenerateBackupCodes(userId: string): Promise<string[]> {
  const backupCodes = generateBackupCodes(10);

  await pool.query(
    `UPDATE users 
     SET mfa_backup_codes = $1,
         updated_at = NOW()
     WHERE wallet_address = $2`,
    [backupCodes, userId]
  );

  return backupCodes;
}

/**
 * Helper function to generate backup codes
 */
function generateBackupCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    // Generate 8-character alphanumeric code
    const code = Math.random().toString(36).substring(2, 10).toUpperCase();
    codes.push(code);
  }
  return codes;
}

