import { type CSSProperties, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Eye,
  GraduationCap,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  UserRound,
  Wallet
} from "lucide-react";
import "./half-payment-students.css";

type HalfStudent = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  nicOrPassport: string | null;
  address: string | null;
  dateOfBirth: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  passwordSetAt: string | null;
  createdAt: string;
  account: { number: string; status: string } | null;
  enrollment: { status: string; enrolledAt: string } | null;
  course: {
    id: string;
    title: string;
    price: string;
    halfPaymentLessonLimit: number;
  };
  payment: {
    id: string;
    paymentCode: string;
    method: string;
    status: string;
    paidAmount: string;
    totalAmount: string;
    outstandingAmount: number;
    transactionReference: string | null;
    createdAt: string;
    reviewedAt: string | null;
  };
  latestBalanceRequest: null | {
    id: string;
    amount: string;
    transactionReference: string;
    status: string;
    createdAt: string;
    reviewedAt: string | null;
  };
};

type HalfStudentDetail = {
  student: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    nicOrPassport: string | null;
    address: string | null;
    dateOfBirth: string | null;
    isActive: boolean;
    emailVerifiedAt: string | null;
    passwordSetAt: string | null;
    createdAt: string;
  };
  account: null | {
    number: string;
    status: string;
    isMainAccount: boolean;
    activatedAt: string | null;
  };
  enrollment: null | {
    id: string;
    status: string;
    enrolledAt: string;
    completedAt: string | null;
  };
  course: {
    id: string;
    title: string;
    price: string;
    currency: string;
    halfPaymentLessonLimit: number;
  };
  currentPayment: {
    id: string;
    paymentCode: string;
    method: string;
    paidAmount: string;
    totalAmount: string;
    status: string;
    transactionReference: string | null;
    createdAt: string;
    reviewedAt: string | null;
    outstandingAmount: number;
  };
  access: {
    paymentAccess: "HALF";
    totalLessons: number;
    accessibleLessons: number;
    lockedByPayment: number;
    unlockAllOverride: boolean;
  };
  learning: {
    completedLessons: number;
    inProgressLessons: number;
    untouchedLessons: number;
    averageProgress: number;
    totalQuizLessons: number;
    passedQuizLessons: number;
  };
  paymentHistory: Array<{
    id: string;
    paymentCode: string;
    paidAmount: string;
    totalAmount: string;
    status: string;
    method: string;
    transactionReference: string | null;
    createdAt: string;
  }>;
  balanceHistory: Array<{
    id: string;
    amount: string;
    status: string;
    transactionReference: string;
    createdAt: string;
  }>;
};

function money(value: string | number | null | undefined) {
  return `Rs. ${Number(value ?? 0).toLocaleString("en-LK")}`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-LK", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function statusClass(status: string) {
  const normalized = status.toUpperCase();
  if (["APPROVED", "ACTIVE", "COMPLETED"].includes(normalized)) return "success";
  if (["PARTIAL", "PENDING", "UNDER_REVIEW"].includes(normalized)) return "warning";
  if (["REJECTED", "SUSPENDED"].includes(normalized)) return "danger";
  return "";
}

export default function HalfPaymentStudentsWorkspace() {
  const [students, setStudents] = useState<HalfStudent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<HalfStudentDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadStudents() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/half-payment-students");
      const data = (await response.json().catch(() => ({}))) as {
        students?: HalfStudent[];
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Half Payment Students could not be loaded.");
      setStudents(data.students ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Half Payment Students could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  async function openStudent(studentId: string) {
    setSelectedId(studentId);
    setDetail(null);
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/half-payment-students/${studentId}`);
      const data = (await response.json().catch(() => ({}))) as HalfStudentDetail & {
        message?: string;
      };
      if (!response.ok) throw new Error(data.message ?? "Student details could not be loaded.");
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Student details could not be loaded.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function backToList() {
    setSelectedId(null);
    setDetail(null);
    setError("");
    await loadStudents();
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase().replaceAll(" ", "");
    if (!normalized) return students;
    return students.filter((student) =>
      [
        student.name,
        student.email,
        student.phone,
        student.nicOrPassport,
        student.account?.number,
        student.course.title,
        student.payment.paymentCode
      ].some((value) =>
        String(value ?? "").toLowerCase().replaceAll(" ", "").includes(normalized)
      )
    );
  }, [students, query]);

  if (selectedId) {
    return (
      <section className="dash-card workspace-card hp-detail-page">
        <div className="hp-detail-topbar">
          <button type="button" className="hp-back-button" onClick={() => void backToList()}>
            <ArrowLeft size={18} />
            Back to Half Payment Students
          </button>
          <span className="hp-live-filter">CURRENT HALF PAYMENT PROFILE</span>
        </div>

        {error && <p className="form-error">{error}</p>}

        {detailLoading && (
          <div className="hp-loading-card">
            <div className="hp-spinner" />
            <strong>Student details loading...</strong>
          </div>
        )}

        {!detailLoading && detail && (
          <>
            <div className="hp-profile-hero">
              <div className="hp-avatar"><UserRound /></div>
              <div className="hp-profile-title">
                <span className="eyebrow">HALF PAYMENT STUDENT</span>
                <h2>{detail.student.name}</h2>
                <p>{detail.course.title}</p>
                <div className="hp-badges">
                  <span className="hp-badge half">HALF PAYMENT</span>
                  <span className={`hp-badge ${detail.student.isActive ? "active" : "inactive"}`}>
                    {detail.student.isActive ? "ACTIVE ACCOUNT" : "INACTIVE ACCOUNT"}
                  </span>
                  <span className="hp-badge">{detail.account?.number ?? "SR PENDING"}</span>
                </div>
              </div>
              <div className="hp-profile-balance">
                <small>Outstanding balance</small>
                <strong>{money(detail.currentPayment.outstandingAmount)}</strong>
                <span>{money(detail.currentPayment.paidAmount)} paid</span>
              </div>
            </div>

            <div className="hp-metric-grid">
              <article>
                <span><Wallet /></span>
                <small>Paid</small>
                <strong>{money(detail.currentPayment.paidAmount)}</strong>
                <em>of {money(detail.currentPayment.totalAmount)}</em>
              </article>
              <article>
                <span><BookOpen /></span>
                <small>Lesson Access</small>
                <strong>{detail.access.accessibleLessons} / {detail.access.totalLessons}</strong>
                <em>{detail.access.lockedByPayment} locked by balance</em>
              </article>
              <article>
                <span><GraduationCap /></span>
                <small>Course Progress</small>
                <strong>{detail.learning.averageProgress}%</strong>
                <em>{detail.learning.completedLessons} completed</em>
              </article>
              <article>
                <span><CheckCircle2 /></span>
                <small>Q&A Passed</small>
                <strong>{detail.learning.passedQuizLessons} / {detail.learning.totalQuizLessons}</strong>
                <em>lesson assessments</em>
              </article>
            </div>

            {detail.access.unlockAllOverride && (
              <div className="hp-warning-banner">
                <ShieldCheck />
                <div>
                  <strong>Admin video override is active</strong>
                  <span>This student has an Unlock All Videos override. Review this permission if Half Payment limits must remain strict.</span>
                </div>
              </div>
            )}

            <div className="hp-detail-grid">
              <article className="hp-info-card">
                <div className="hp-card-title"><UserRound /><div><span>STUDENT INFORMATION</span><h3>Personal Details</h3></div></div>
                <dl>
                  <div><dt><Mail /> Email</dt><dd>{detail.student.email}</dd></div>
                  <div><dt><Phone /> Phone</dt><dd>{detail.student.phone ?? "Not added"}</dd></div>
                  <div><dt><CreditCard /> NIC / Passport</dt><dd>{detail.student.nicOrPassport ?? "Not added"}</dd></div>
                  <div><dt><CalendarDays /> Date of birth</dt><dd>{detail.student.dateOfBirth ?? "Not added"}</dd></div>
                  <div><dt><MapPin /> Address</dt><dd>{detail.student.address ?? "Not added"}</dd></div>
                  <div><dt><CalendarDays /> Registered</dt><dd>{dateTime(detail.student.createdAt)}</dd></div>
                </dl>
              </article>

              <article className="hp-info-card">
                <div className="hp-card-title"><CircleDollarSign /><div><span>PAYMENT INFORMATION</span><h3>Current Half Payment</h3></div></div>
                <dl>
                  <div><dt>Pay ID / Code</dt><dd>{detail.currentPayment.paymentCode}</dd></div>
                  <div><dt>Status</dt><dd><span className={`hp-inline-status ${statusClass(detail.currentPayment.status)}`}>{detail.currentPayment.status}</span></dd></div>
                  <div><dt>Payment method</dt><dd>{detail.currentPayment.method.replaceAll("_", " ")}</dd></div>
                  <div><dt>Transaction reference</dt><dd>{detail.currentPayment.transactionReference ?? "—"}</dd></div>
                  <div><dt>Paid amount</dt><dd>{money(detail.currentPayment.paidAmount)}</dd></div>
                  <div><dt>Remaining balance</dt><dd className="hp-balance-text">{money(detail.currentPayment.outstandingAmount)}</dd></div>
                  <div><dt>Payment submitted</dt><dd>{dateTime(detail.currentPayment.createdAt)}</dd></div>
                  <div><dt>Half payment approved</dt><dd>{dateTime(detail.currentPayment.reviewedAt)}</dd></div>
                </dl>
              </article>

              <article className="hp-info-card">
                <div className="hp-card-title"><LockKeyhole /><div><span>COURSE ACCESS</span><h3>Half Payment Access</h3></div></div>
                <dl>
                  <div><dt>Course</dt><dd>{detail.course.title}</dd></div>
                  <div><dt>Payment access</dt><dd><span className="hp-inline-status warning">HALF</span></dd></div>
                  <div><dt>Half-payment limit</dt><dd>{detail.course.halfPaymentLessonLimit} lessons</dd></div>
                  <div><dt>Currently accessible</dt><dd>{detail.access.accessibleLessons} lessons</dd></div>
                  <div><dt>Locked by payment</dt><dd>{detail.access.lockedByPayment} lessons</dd></div>
                  <div><dt>Enrollment status</dt><dd>{detail.enrollment?.status ?? "No enrollment"}</dd></div>
                  <div><dt>SR account</dt><dd>{detail.account?.number ?? "Pending"}</dd></div>
                  <div><dt>SR status</dt><dd>{detail.account?.status ?? "Pending"}</dd></div>
                </dl>
              </article>

              <article className="hp-info-card">
                <div className="hp-card-title"><BookOpen /><div><span>LEARNING PROGRESS</span><h3>Course Activity</h3></div></div>
                <div className="hp-progress-ring-row">
                  <div className="hp-progress-ring" style={{ "--hp-progress": `${detail.learning.averageProgress * 3.6}deg` } as CSSProperties}>
                    <strong>{detail.learning.averageProgress}%</strong>
                    <span>overall</span>
                  </div>
                  <div className="hp-progress-stats">
                    <p><strong>{detail.learning.completedLessons}</strong><span>Completed lessons</span></p>
                    <p><strong>{detail.learning.inProgressLessons}</strong><span>In progress</span></p>
                    <p><strong>{detail.learning.untouchedLessons}</strong><span>Not started</span></p>
                  </div>
                </div>
              </article>
            </div>

            <div className="hp-history-grid">
              <article className="hp-history-card">
                <div className="hp-card-title"><CreditCard /><div><span>PAYMENT HISTORY</span><h3>Course Payments</h3></div></div>
                <div className="hp-history-list">
                  {detail.paymentHistory.map((item) => (
                    <div key={item.id}>
                      <strong>{item.paymentCode}</strong>
                      <span>{money(item.paidAmount)} / {money(item.totalAmount)}</span>
                      <span className={`hp-inline-status ${statusClass(item.status)}`}>{item.status}</span>
                      <small>{dateTime(item.createdAt)}</small>
                    </div>
                  ))}
                  {!detail.paymentHistory.length && <p>No payment history.</p>}
                </div>
              </article>

              <article className="hp-history-card">
                <div className="hp-card-title"><Wallet /><div><span>BALANCE PAYMENT</span><h3>Balance Requests</h3></div></div>
                <div className="hp-history-list">
                  {detail.balanceHistory.map((item) => (
                    <div key={item.id}>
                      <strong>{money(item.amount)}</strong>
                      <span>{item.transactionReference}</span>
                      <span className={`hp-inline-status ${statusClass(item.status)}`}>{item.status.replaceAll("_", " ")}</span>
                      <small>{dateTime(item.createdAt)}</small>
                    </div>
                  ))}
                  {!detail.balanceHistory.length && <div className="hp-empty-history">
                    <LockKeyhole />
                    <p>No balance payment request submitted yet.</p>
                  </div>}
                </div>
              </article>
            </div>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="dash-card workspace-card hp-list-page">
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">CURRENT PAYMENT ACCESS FILTER</span>
          <h2>Half Payment Students</h2>
          <p>
            Students who currently have an outstanding course balance. They remain visible everywhere else in the LMS.
          </p>
        </div>
        <div className="hp-count-card">
          <span>CURRENT HALF SET</span>
          <strong>{students.length}</strong>
          <small>students</small>
        </div>
      </div>

      <div className="hp-search-wrap">
        <Search size={18} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SR number, email, phone, course or Pay ID"
        />
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && <div className="hp-list-loading"><div className="hp-spinner" />Loading Half Payment Students...</div>}

      {!loading && (
        <div className="hp-student-list">
          <div className="hp-student-list-head">
            <span>STUDENT</span>
            <span>COURSE / ACCESS</span>
            <span>PAYMENT</span>
            <span>BALANCE</span>
            <span>PROFILE</span>
          </div>

          {filtered.map((student) => (
            <button
              type="button"
              className="hp-student-row"
              key={`${student.id}-${student.course.id}`}
              onClick={() => void openStudent(student.id)}
            >
              <span className="hp-student-person">
                <i><UserRound /></i>
                <b>{student.name}<small>{student.email}<br />{student.phone ?? "No phone"}</small></b>
              </span>
              <span>
                <b>{student.course.title}</b>
                <small>{student.account?.number ?? "SR pending"} • First {student.course.halfPaymentLessonLimit} lessons</small>
              </span>
              <span>
                <b>{money(student.payment.paidAmount)}</b>
                <small>of {money(student.payment.totalAmount)} • {student.payment.status}</small>
              </span>
              <span>
                <b className="hp-row-balance">{money(student.payment.outstandingAmount)}</b>
                <small>{student.latestBalanceRequest ? `Balance request: ${student.latestBalanceRequest.status.replaceAll("_", " ")}` : "No balance request yet"}</small>
              </span>
              <span className="hp-view-profile"><Eye /><small>View Details</small></span>
            </button>
          ))}

          {!filtered.length && (
            <div className="hp-empty-list">
              <CheckCircle2 />
              <h3>No current Half Payment Students</h3>
              <p>
                When a student's balance payment is approved, the student is automatically removed from this filtered view.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
