import { describe, expect, it } from "vitest";
import { formatJobPay, formatLpa } from "./format";

describe("formatLpa", () => {
  it("writes lakhs per annum", () => {
    expect(formatLpa(420000)).toBe("₹4.2 LPA");
    expect(formatLpa(1200000)).toBe("₹12 LPA");
    expect(formatLpa(300000)).toBe("₹3 LPA");
  });
});
describe("formatJobPay", () => {
  it("gives a range, a single figure or nothing", () => {
    expect(formatJobPay(400000, 600000)).toBe("₹4 LPA – ₹6 LPA");
    expect(formatJobPay(500000, 500000)).toBe("₹5 LPA");
    expect(formatJobPay(null, null)).toBeNull();
  });
});
