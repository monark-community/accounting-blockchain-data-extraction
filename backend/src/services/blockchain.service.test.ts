import { BlockchainService } from "./blockchain.service";

describe("BlockchainService.normalize", () => {
  beforeEach(() => {
    process.env.TOKENAPI_KEY = "fake-token";
  });

  it("normalise un transfert entrant (direction in)", () => {
    const svc = new BlockchainService("fake-token");

    const raw = {
      tx_hash: "0xabc",
      block_num: 123,
      from: "0xFROM",
      to: "0xOWNER",
      value: "1000",
      symbol: "USDC",
      decimals: 6,
      timestamp: "2024-12-30T00:00:00Z"
    };

    const norm = svc.normalize(raw, "ethereum", "0xOWNER");

    expect(norm.txHash).toBe("0xabc");
    expect(norm.blockNumber).toBe(123);
    expect(norm.direction).toBe("in");
  });

  it("normalise un transfert sortant (direction out)", () => {
    const svc = new BlockchainService("fake-token");

    const raw = {
      tx_hash: "0xdef",
      block_num: 456,
      from: "0xOWNER",
      to: "0xTO",
      value: "250"
    };

    const norm = svc.normalize(raw, "ethereum", "0xOWNER");
    expect(norm.direction).toBe("out");
  });
});