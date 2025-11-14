import type {
  NormalizedLegRow,
  TxCursorPosition,
} from "../types/transactions";

const CURSOR_VERSION = 1;

type CursorPayload = TxCursorPosition & { v: number };

export function encodeCursorFromLeg(leg: NormalizedLegRow): string {
  const payload: CursorPayload = {
    v: CURSOR_VERSION,
    timestamp: leg.timestamp,
    blockNumber: leg.blockNumber,
    txHash: leg.txHash,
    logIndex: leg.logIndex ?? 0,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function encodeCursor(pos: TxCursorPosition): string {
  const payload: CursorPayload = { v: CURSOR_VERSION, ...pos };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeCursor(token?: string | null): TxCursorPosition | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, "base64url").toString("utf8");
    const payload = JSON.parse(json) as Partial<CursorPayload>;
    if (
      typeof payload?.timestamp !== "number" ||
      typeof payload?.blockNumber !== "number" ||
      typeof payload?.txHash !== "string" ||
      typeof payload?.logIndex !== "number"
    ) {
      return null;
    }
    return {
      timestamp: payload.timestamp,
      blockNumber: payload.blockNumber,
      txHash: payload.txHash as `0x${string}`,
      logIndex: payload.logIndex,
    };
  } catch (err) {
    console.error("[cursor] Failed to decode token", err);
    return null;
  }
}

export function compareLegToCursor(
  leg: NormalizedLegRow,
  cursor: TxCursorPosition
): number {
  if (leg.timestamp !== cursor.timestamp) {
    return leg.timestamp - cursor.timestamp;
  }
  if (leg.blockNumber !== cursor.blockNumber) {
    return leg.blockNumber - cursor.blockNumber;
  }
  if (leg.txHash !== cursor.txHash) {
    return leg.txHash < cursor.txHash ? -1 : 1;
  }
  const legIdx = leg.logIndex ?? 0;
  return legIdx - cursor.logIndex;
}

export function isLegOlderThanCursor(
  leg: NormalizedLegRow,
  cursor: TxCursorPosition
): boolean {
  return compareLegToCursor(leg, cursor) < 0;
}
