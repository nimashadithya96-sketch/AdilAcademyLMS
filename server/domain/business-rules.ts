export type PaymentStatus =
  | "PENDING"
  | "UNDER_REVIEW"
  | "PARTIAL"
  | "APPROVED"
  | "REJECTED"
  | "REFUNDED";

export const FIRST_ACCOUNT_NUMBER = 527694;
export const ACCOUNT_BLOCK_SIZE = 7;
export const DIRECT_ADMISSION_INCOME = 3000;

export function qualifiesForDirectAdmissionIncome(status: string) {
  return status === "PARTIAL" || status === "APPROVED";
}

export function nextStudentAccountNumber(maxUsedNumber?: number | null): number {
  if (maxUsedNumber == null || maxUsedNumber < FIRST_ACCOUNT_NUMBER) {
    return FIRST_ACCOUNT_NUMBER;
  }
  const usedBlock = Math.floor(
    (maxUsedNumber - FIRST_ACCOUNT_NUMBER) / ACCOUNT_BLOCK_SIZE
  );
  return FIRST_ACCOUNT_NUMBER + (usedBlock + 1) * ACCOUNT_BLOCK_SIZE;
}

export function reservedConsultantNumbers(mainNumber: number): number[] {
  if (
    !Number.isInteger(mainNumber) ||
    mainNumber < FIRST_ACCOUNT_NUMBER ||
    (mainNumber - FIRST_ACCOUNT_NUMBER) % ACCOUNT_BLOCK_SIZE !== 0
  ) {
    throw new Error("Main account number is not a valid account-block start.");
  }
  return Array.from({ length: ACCOUNT_BLOCK_SIZE }, (_, index) => mainNumber + index);
}

export function formatAccountNumber(
  prefix: "SR" | "CN",
  numericPart: number
): string {
  if (!Number.isInteger(numericPart) || numericPart < 1) {
    throw new Error("Account number must be a positive integer.");
  }
  return prefix + numericPart;
}

export function convertStudentToConsultant(accountNumber: string): string {
  if (!/^SR\d+$/.test(accountNumber)) {
    throw new Error("Only an SR account can be converted.");
  }
  return "CN" + accountNumber.slice(2);
}

export function unlocksCourseAndPoints(
  status: PaymentStatus,
  paidAmount: number,
  totalAmount: number
): boolean {
  return status === "APPROVED" && paidAmount >= totalAmount && totalAmount > 0;
}
