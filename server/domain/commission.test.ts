import { describe, expect, it } from "vitest";
import { calculateAccountCommission } from "./commission";

describe("weekly commission calculation", () => {
  it("releases one-time 1:1 and preserves carry forward", () => {
    const result = calculateAccountCommission({
      leftAvailable: 2,
      rightAvailable: 1,
      stageOneAchieved: false,
      stageTwoAchieved: false
    });
    expect(result.awards).toEqual([
      { stage: "STAGE_1", pairs: 1, amount: 2500 }
    ]);
    expect(result.leftRemaining).toBe(1);
    expect(result.rightRemaining).toBe(0);
  });

  it("releases one-time 2:2 after stage one", () => {
    const result = calculateAccountCommission({
      leftAvailable: 4,
      rightAvailable: 2,
      stageOneAchieved: true,
      stageTwoAchieved: false
    });
    expect(result.awards).toEqual([
      { stage: "STAGE_2", pairs: 2, amount: 5000 }
    ]);
    expect(result.leftRemaining).toBe(2);
  });

  it("releases at most one weekly 3:3 and carries the remainder", () => {
    const result = calculateAccountCommission({
      leftAvailable: 8,
      rightAvailable: 7,
      stageOneAchieved: true,
      stageTwoAchieved: true
    });
    expect(result.awards).toEqual([
      { stage: "STAGE_3", pairs: 3, amount: 8000 }
    ]);
    expect(result.leftRemaining).toBe(5);
    expect(result.rightRemaining).toBe(4);
  });
});
