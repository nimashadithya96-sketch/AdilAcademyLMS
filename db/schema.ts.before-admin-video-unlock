import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("user_role", [
  "student",
  "consultant",
  "staff",
  "admin"
]);

export const accountTypeEnum = pgEnum("account_type", ["SR", "CN"]);
export const accountSideEnum = pgEnum("account_side", ["LEFT", "RIGHT"]);
export const accountStatusEnum = pgEnum("account_status", [
  "RESERVED",
  "ACTIVE",
  "SUSPENDED"
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "UNDER_REVIEW",
  "PARTIAL",
  "APPROVED",
  "REJECTED",
  "REFUNDED"
]);
export const applicationStatusEnum = pgEnum("application_status", [
  "PENDING",
  "INTERVIEW",
  "APPROVED",
  "REJECTED"
]);
export const payoutStatusEnum = pgEnum("payout_status", [
  "PENDING",
  "APPROVED",
  "PAID",
  "REJECTED"
]);
export const discountTypeEnum = pgEnum("discount_type", [
  "PERCENT",
  "FIXED"
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    phone: text("phone"),
    nicOrPassport: text("nic_or_passport"),
    address: text("address"),
    dateOfBirth: text("date_of_birth"),
    role: roleEnum("role").default("student").notNull(),
    isActive: boolean("is_active").default(false).notNull(),
    learningPortalEnabled: boolean("learning_portal_enabled").default(true).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordSetAt: timestamp("password_set_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    profilePhotoObjectKey: text("profile_photo_object_key"),
    profilePhotoMimeType: text("profile_photo_mime_type"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removalReason: text("removal_reason")
  },
  (table) => [uniqueIndex("users_email_unique").on(table.email)]
);

export const consultantAdmissionTargets = pgTable("consultant_admission_targets", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  dailyTarget: integer("daily_target").default(0).notNull(),
  weeklyTarget: integer("weekly_target").default(0).notNull(),
  monthlyTarget: integer("monthly_target").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)]
);

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    shortDescription: text("short_description").notNull(),
    description: text("description"),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    points: integer("points").default(0).notNull(),
    halfPaymentLessonLimit: integer("half_payment_lesson_limit").default(7).notNull(),
    currency: text("currency").default("LKR").notNull(),
    language: text("language").default("si-LK").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    isPublished: boolean("is_published").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("courses_slug_unique").on(table.slug)]
);

export const courseSections = pgTable("course_sections", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  position: integer("position").notNull()
});

export const lessons = pgTable("lessons", {
  id: uuid("id").defaultRandom().primaryKey(),
  sectionId: uuid("section_id")
    .notNull()
    .references(() => courseSections.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  videoProvider: text("video_provider"),
  videoId: text("video_id"),
  content: text("content"),
  resourceObjectKey: text("resource_object_key"),
  durationSeconds: integer("duration_seconds").default(0).notNull(),
  position: integer("position").notNull(),
  isPreview: boolean("is_preview").default(false).notNull()
});

export const enrollments = pgTable(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    status: text("status").default("ACTIVE").notNull(),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("enrollments_user_course_unique").on(
      table.userId,
      table.courseId
    )
  ]
);

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    progressPercent: integer("progress_percent").default(0).notNull(),
    watchedSeconds: integer("watched_seconds").default(0).notNull(),
    detectedDurationSeconds: integer("detected_duration_seconds").default(0).notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("lesson_progress_unique").on(
      table.enrollmentId,
      table.lessonId
    )
  ]
);

export const lessonQuizQuestions = pgTable(
  "lesson_quiz_questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    options: jsonb("options").notNull(),
    correctOption: integer("correct_option").notNull(),
    explanation: text("explanation"),
    position: integer("position").notNull(),
    isPublished: boolean("is_published").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("lesson_quiz_questions_lesson_position_unique").on(
      table.lessonId,
      table.position
    )
  ]
);

export const lessonQuizAttempts = pgTable(
  "lesson_quiz_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull(),
    score: integer("score"),
    totalQuestions: integer("total_questions"),
    scorePercent: integer("score_percent"),
    watchSecondsAtCompletion: integer("watch_seconds_at_completion"),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("lesson_quiz_attempts_user_lesson_number_unique").on(
      table.userId,
      table.lessonId,
      table.attemptNumber
    )
  ]
);

export const lessonQuizAnswers = pgTable(
  "lesson_quiz_answers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => lessonQuizAttempts.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => lessonQuizQuestions.id, { onDelete: "cascade" }),
    selectedOption: integer("selected_option").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("lesson_quiz_answers_attempt_question_unique").on(
      table.attemptId,
      table.questionId
    )
  ]
);

export const lessonQuizWatchProgress = pgTable(
  "lesson_quiz_watch_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    watchedSecondsTotal: integer("watched_seconds_total").default(0).notNull(),
    lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("lesson_quiz_watch_progress_user_lesson_unique").on(
      table.userId,
      table.lessonId
    )
  ]
);

export const quizzes = pgTable("quizzes", {
  id: uuid("id").defaultRandom().primaryKey(),
  courseId: uuid("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  passingPercent: integer("passing_percent").default(70).notNull(),
  position: integer("position").notNull(),
  isPublished: boolean("is_published").default(false).notNull()
});

export const quizQuestions = pgTable("quiz_questions", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: jsonb("options").notNull(),
  correctOption: integer("correct_option").notNull(),
  explanation: text("explanation"),
  position: integer("position").notNull()
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: uuid("id").defaultRandom().primaryKey(),
  quizId: uuid("quiz_id")
    .notNull()
    .references(() => quizzes.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  answers: jsonb("answers").notNull(),
  scorePercent: integer("score_percent").notNull(),
  passed: boolean("passed").notNull(),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    certificateCode: text("certificate_code").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id),
    objectKey: text("object_key"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("certificates_code_unique").on(table.certificateCode),
    uniqueIndex("certificates_user_course_unique").on(
      table.userId,
      table.courseId
    )
  ]
);

export const coupons = pgTable(
  "coupons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    discountType: discountTypeEnum("discount_type").notNull(),
    discountValue: numeric("discount_value", {
      precision: 12,
      scale: 2
    }).notNull(),
    courseId: uuid("course_id").references(() => courses.id),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maxUses: integer("max_uses"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("coupons_code_unique").on(table.code)]
);

export const paymentReferenceIds = pgTable(
  "payment_reference_ids",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("payment_reference_ids_code_unique").on(table.code)]
);

export const ccoMainPayIds = pgTable("cco_main_pay_ids", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull(),
  intendedName: text("intended_name").notNull(),
  intendedEmail: text("intended_email").notNull(),
  intendedPhone: text("intended_phone").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).default("5000").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("cco_main_pay_ids_code_unique").on(table.code)
]);

export const ccoMainApplications = pgTable("cco_main_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  payIdId: uuid("pay_id_id").notNull().references(() => ccoMainPayIds.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  accountId: uuid("account_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nicOrPassport: text("nic_or_passport").notNull(),
  addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"),
  province: text("province").notNull(),
  district: text("district").notNull(),
  city: text("city").notNull(),
  transactionReference: text("transaction_reference").notNull(),
  proofObjectKey: text("proof_object_key"),
  proofMimeType: text("proof_mime_type"),
  status: text("status").default("AWAITING_PROOF").notNull(),
  registrationTokenHash: text("registration_token_hash"),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [
  uniqueIndex("cco_main_applications_pay_id_unique").on(table.payIdId),
  uniqueIndex("cco_main_applications_user_unique").on(table.userId),
  uniqueIndex("cco_main_applications_account_unique").on(table.accountId)
]);

export const paymentRequests = pgTable(
  "payment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentCode: text("payment_code").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    courseId: uuid("course_id").references(() => courses.id),
    method: text("method").notNull(),
    totalAmount: numeric("total_amount", {
      precision: 12,
      scale: 2
    }).notNull(),
    paidAmount: numeric("paid_amount", {
      precision: 12,
      scale: 2
    }).notNull(),
    status: paymentStatusEnum("status").default("PENDING").notNull(),
    proofObjectKey: text("proof_object_key"),
    proofMimeType: text("proof_mime_type"),
    transactionReference: text("transaction_reference"),
    payIdId: uuid("pay_id_id").references(() => paymentReferenceIds.id),
    couponId: uuid("coupon_id").references(() => coupons.id),
    receivingAccountId: uuid("receiving_account_id"),
    requestedParentAccountId: uuid("requested_parent_account_id"),
    requestedSide: accountSideEnum("requested_side"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    registrationTokenHash: text("registration_token_hash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("payment_requests_payment_code_unique").on(table.paymentCode)
  ]
);

export const balancePaymentRequests = pgTable(
  "balance_payment_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    originalPaymentId: uuid("original_payment_id").notNull().references(() => paymentRequests.id),
    userId: uuid("user_id").notNull().references(() => users.id),
    courseId: uuid("course_id").notNull().references(() => courses.id),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    transactionReference: text("transaction_reference").notNull(),
    proofObjectKey: text("proof_object_key"),
    proofMimeType: text("proof_mime_type"),
    status: paymentStatusEnum("status").default("PENDING").notNull(),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("balance_payment_transaction_unique").on(table.transactionReference)
  ]
);

export const emailVerificationCodes = pgTable("email_verification_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  attempts: integer("attempts").default(0).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const couponUses = pgTable(
  "coupon_uses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    couponId: uuid("coupon_id")
      .notNull()
      .references(() => coupons.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    paymentRequestId: uuid("payment_request_id")
      .notNull()
      .references(() => paymentRequests.id),
    usedAt: timestamp("used_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("coupon_uses_payment_unique").on(table.paymentRequestId)
  ]
);

export const consultantApplications = pgTable("consultant_applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  motivation: text("motivation"),
  status: applicationStatusEnum("status").default("PENDING").notNull(),
  interviewNote: text("interview_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const accountNumberSequence = pgTable("account_number_sequence", {
  id: integer("id").primaryKey(),
  nextNumber: integer("next_number").default(527694).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const networkAccounts = pgTable(
  "network_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id),
    prefix: accountTypeEnum("prefix").notNull(),
    numericPart: integer("numeric_part").notNull(),
    status: accountStatusEnum("status").default("RESERVED").notNull(),
    isMainAccount: boolean("is_main_account").default(false).notNull(),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("network_accounts_number_unique").on(
      table.prefix,
      table.numericPart
    )
  ]
);

export const consultantStudentRegistrations = pgTable("consultant_student_registrations", {
  id: uuid("id").defaultRandom().primaryKey(),
  consultantUserId: uuid("consultant_user_id").references(() => users.id),
  parentAccountId: uuid("parent_account_id").references(() => networkAccounts.id),
  payIdId: uuid("pay_id_id").notNull().references(() => paymentReferenceIds.id),
  courseId: uuid("course_id").notNull().references(() => courses.id),
  paymentPlan: text("payment_plan").default("FULL").notNull(),
  expectedPaymentAmount: numeric("expected_payment_amount", { precision: 12, scale: 2 }).notNull(),
  firstName: text("first_name").notNull(), lastName: text("last_name").notNull(),
  email: text("email").notNull(), phone: text("phone").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  nicOrPassport: text("nic_or_passport"), addressLine1: text("address_line_1").notNull(),
  addressLine2: text("address_line_2"), province: text("province").notNull(),
  district: text("district").notNull(), city: text("city").notNull(),
  side: accountSideEnum("side"),
  registrationSource: text("registration_source").default("CONSULTANT").notNull(),
  status: text("status").default("AWAITING_PAYMENT").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("consultant_student_registrations_pay_id_unique").on(table.payIdId)]);

export const ccoActivationRequests = pgTable("cco_activation_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  consultantUserId: uuid("consultant_user_id").notNull().references(() => users.id),
  slotPosition: integer("slot_position").notNull(),
  requestedNumericPart: integer("requested_numeric_part").notNull(),
  parentAccountId: uuid("parent_account_id").notNull().references(() => networkAccounts.id),
  side: accountSideEnum("side").notNull(),
  activationMode: text("activation_mode").default("FULL").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  transactionReference: text("transaction_reference").notNull(),
  seniorConsultantName: text("senior_consultant_name"),
  proofObjectKey: text("proof_object_key"),
  proofMimeType: text("proof_mime_type"),
  status: text("status").default("PENDING").notNull(),
  reviewNote: text("review_note"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  activatedAccountId: uuid("activated_account_id").references(() => networkAccounts.id),
  trialExpiresAt: timestamp("trial_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
});

export const networkPlacements = pgTable(
  "network_placements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => networkAccounts.id),
    parentAccountId: uuid("parent_account_id")
      .notNull()
      .references(() => networkAccounts.id),
    side: accountSideEnum("side").notNull(),
    placementKind: text("placement_kind").default("STUDENT").notNull(),
    placedByUserId: uuid("placed_by_user_id")
      .notNull()
      .references(() => users.id),
    activatedAt: timestamp("activated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("network_placements_account_unique").on(table.accountId),
    uniqueIndex("network_parent_side_kind_unique").on(
      table.parentAccountId,
      table.side,
      table.placementKind
    )
  ]
);

export const pointEvents = pgTable(
  "point_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    sourcePaymentId: uuid("source_payment_id")
      .notNull()
      .references(() => paymentRequests.id),
    beneficiaryAccountId: uuid("beneficiary_account_id")
      .notNull()
      .references(() => networkAccounts.id),
    side: accountSideEnum("side").notNull(),
    points: integer("points").notNull(),
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("point_events_idempotency_unique").on(table.idempotencyKey)
  ]
);

export const commissionCycles = pgTable(
  "commission_cycles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cycleKey: text("cycle_key").notNull(),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    status: text("status").default("DRAFT").notNull(),
    calculatedAt: timestamp("calculated_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true })
  },
  (table) => [
    uniqueIndex("commission_cycles_cycle_key_unique").on(table.cycleKey)
  ]
);

export const commissionEntries = pgTable(
  "commission_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    cycleId: uuid("cycle_id")
      .notNull()
      .references(() => commissionCycles.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => networkAccounts.id),
    stage: text("stage").notNull(),
    matchedPairs: integer("matched_pairs").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("commission_cycle_account_stage_unique").on(
      table.cycleId,
      table.accountId,
      table.stage
    )
  ]
);

export const accountPointBalances = pgTable(
  "account_point_balances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => networkAccounts.id),
    leftAvailable: integer("left_available").default(0).notNull(),
    rightAvailable: integer("right_available").default(0).notNull(),
    lifetimeLeft: integer("lifetime_left").default(0).notNull(),
    lifetimeRight: integer("lifetime_right").default(0).notNull(),
    stageOneAchieved: boolean("stage_one_achieved").default(false).notNull(),
    stageTwoAchieved: boolean("stage_two_achieved").default(false).notNull(),
    lastQualifiedActivityAt: timestamp("last_qualified_activity_at", {
      withTimezone: true
    }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("account_point_balances_account_unique").on(table.accountId)
  ]
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    availableBalance: numeric("available_balance", {
      precision: 14,
      scale: 2
    })
      .default("0")
      .notNull(),
    pendingBalance: numeric("pending_balance", {
      precision: 14,
      scale: 2
    })
      .default("0")
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [uniqueIndex("wallets_user_unique").on(table.userId)]
);

export const consultantBankDetails = pgTable("consultant_bank_details", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bankName: text("bank_name").notNull(),
  branchName: text("branch_name").notNull(),
  accountHolderName: text("account_holder_name").notNull(),
  accountNumberEncrypted: text("account_number_encrypted").notNull(),
  accountNumberLast4: text("account_number_last4").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("consultant_bank_details_user_unique").on(table.userId)]);

export const walletLedger = pgTable(
  "wallet_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    idempotencyKey: text("idempotency_key").notNull(),
    entryType: text("entry_type").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    referenceType: text("reference_type").notNull(),
    referenceId: text("reference_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull()
  },
  (table) => [
    uniqueIndex("wallet_ledger_idempotency_unique").on(table.idempotencyKey)
  ]
);

export const payoutRequests = pgTable("payout_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: payoutStatusEnum("status").default("PENDING").notNull(),
  payoutMethod: text("payout_method").notNull(),
  payoutDetails: jsonb("payout_details").notNull(),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const inactivityResets = pgTable("inactivity_resets", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id")
    .notNull()
    .references(() => networkAccounts.id),
  leftPointsReset: integer("left_points_reset").notNull(),
  rightPointsReset: integer("right_points_reset").notNull(),
  inactivityDays: integer("inactivity_days").default(90).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  priority: text("priority").default("NORMAL").notNull(),
  status: text("status").default("OPEN").notNull(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  resolution: text("resolution"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});

// Live customer-care conversations. A random public token lets a visitor read
// only their own thread; staff assignment is always performed server-side.
export const supportConversations = pgTable("support_conversations", {
  id: uuid("id").defaultRandom().primaryKey(),
  publicTokenHash: text("public_token_hash").notNull(),
  channel: text("channel").default("FAQ").notNull(),
  status: text("status").default("OPEN").notNull(),
  visitorName: text("visitor_name"),
  visitorEmail: text("visitor_email"),
  visitorUserId: uuid("visitor_user_id").references(() => users.id, { onDelete: "set null" }),
  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull()
}, (table) => [uniqueIndex("support_conversations_token_unique").on(table.publicTokenHash)]);

export const supportMessages = pgTable("support_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  conversationId: uuid("conversation_id").notNull().references(() => supportConversations.id, { onDelete: "cascade" }),
  senderType: text("sender_type").notNull(),
  senderUserId: uuid("sender_user_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});

export const supportAgentPresence = pgTable("support_agent_presence", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull()
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id"),
  metadata: jsonb("metadata").default({}).notNull(),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
});
