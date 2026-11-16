import { describe, expect, it } from "vitest";
import {
  convertStudentToConsultant,
  DIRECT_ADMISSION_INCOME,
  formatAccountNumber,
  nextStudentAccountNumber,
  qualifiesForDirectAdmissionIncome,
  reservedConsultantNumbers,
  unlocksCourseAndPoints
} from "./business-rules";

describe("Adil Academy business rules", () => {
  it("awards exactly Rs. 3,000 for partial or full direct admissions", () => {
    expect(DIRECT_ADMISSION_INCOME).toBe(3000);
    expect(qualifiesForDirectAdmissionIncome("PARTIAL")).toBe(true);
    expect(qualifiesForDirectAdmissionIncome("APPROVED")).toBe(true);
    expect(qualifiesForDirectAdmissionIncome("UNDER_REVIEW")).toBe(false);
    expect(qualifiesForDirectAdmissionIncome("REJECTED")).toBe(false);
  });
  it("formats sequential SR and CN account numbers", () => {
    expect(formatAccountNumber("SR", 527694)).toBe("SR527694");
    expect(formatAccountNumber("CN", 527695)).toBe("CN527695");
  });

  it("preserves the numeric part when a student becomes a consultant", () => {
    expect(convertStudentToConsultant("SR527694")).toBe("CN527694");
  });

  it("reserves seven-number blocks for every new student", () => {
    expect(nextStudentAccountNumber(null)).toBe(527694);
    expect(nextStudentAccountNumber(527694)).toBe(527701);
    expect(nextStudentAccountNumber(527700)).toBe(527701);
    expect(nextStudentAccountNumber(527701)).toBe(527708);
    expect(reservedConsultantNumbers(527694)).toEqual([
      527694, 527695, 527696, 527697, 527698, 527699, 527700
    ]);
  });

  it("unlocks access and points only after full approved payment", () => {
    expect(unlocksCourseAndPoints("APPROVED", 50000, 50000)).toBe(true);
    expect(unlocksCourseAndPoints("PARTIAL", 25000, 50000)).toBe(false);
    expect(unlocksCourseAndPoints("APPROVED", 25000, 50000)).toBe(false);
  });
});
