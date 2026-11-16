export type CommissionBalance = {
  leftAvailable: number;
  rightAvailable: number;
  stageOneAchieved: boolean;
  stageTwoAchieved: boolean;
};

export type CommissionAward = {
  stage: "STAGE_1" | "STAGE_2" | "STAGE_3";
  pairs: number;
  amount: number;
};

export type CommissionCalculation = {
  awards: CommissionAward[];
  leftRemaining: number;
  rightRemaining: number;
  stageOneAchieved: boolean;
  stageTwoAchieved: boolean;
};

export function calculateAccountCommission(
  balance: CommissionBalance
): CommissionCalculation {
  let left = Math.max(0, Math.trunc(balance.leftAvailable));
  let right = Math.max(0, Math.trunc(balance.rightAvailable));
  let stageOne = balance.stageOneAchieved;
  let stageTwo = balance.stageTwoAchieved;
  const awards: CommissionAward[] = [];

  function canMatch(pairs: number) {
    return left >= pairs && right >= pairs;
  }

  function consume(
    stage: CommissionAward["stage"],
    pairs: number,
    amount: number
  ) {
    left -= pairs;
    right -= pairs;
    awards.push({ stage, pairs, amount });
  }

  if (!stageOne && canMatch(1)) {
    consume("STAGE_1", 1, 2500);
    stageOne = true;
  }
  if (stageOne && !stageTwo && canMatch(2)) {
    consume("STAGE_2", 2, 5000);
    stageTwo = true;
  }
  if (stageOne && stageTwo && canMatch(3)) {
    consume("STAGE_3", 3, 8000);
  }

  return {
    awards,
    leftRemaining: left,
    rightRemaining: right,
    stageOneAchieved: stageOne,
    stageTwoAchieved: stageTwo
  };
}
