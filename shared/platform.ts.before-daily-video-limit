export type UserRole = "student" | "consultant" | "staff" | "admin";

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  learningPortalEnabled?: boolean;
  accountNumber?: string;
};

export type PlatformOverview = {
  course: {
    title: string;
    language: string;
    modules: number;
    access: string;
  };
  features: string[];
  paymentMethods: string[];
};

export type StudentDashboardSummary = {
  enrollmentStatus: "NOT_ENROLLED" | "ACTIVE" | "COMPLETED";
  enrollmentId?: string | null;
  courseTitle: string | null;
  totalLessons: number;
  completedLessons: number;
  progressPercent: number;
  quizAverage: number | null;
  accountNumber: string | null;
  accountStatus: string | null;
  accessLevel?: "HALF" | "FULL";
  halfPaymentLessonLimit?: number;
  unlockedLessons?: number;
  modules: Array<{
    title: string;
    totalLessons: number;
    completedLessons: number;
    progressPercent: number;
    lessons?: Array<{ id: string; title: string; locked: boolean; progressPercent: number }>;
  }>;
  recentActivity: Array<{ title: string; detail: string }>;
};
