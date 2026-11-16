ADIL ACADEMY — Student Registration Success Pay ID Popup v36

This patch is built against the exact AdminStudentRegistrationWorkspace and
/admin/student-registrations response structure supplied from the live project.

After Admin clicks:
Register Student & Send Pay ID

and registration succeeds, show a professional white modal containing:
✓ green success tick
Student Registration Successful!
Student Name
Pay ID
The student registration will expire if payment is not made by the student on or before:
Exact expiry date + time
Sri Lanka Time (Asia/Colombo)
OK button

Backend:
The generated Pay ID code is now included in the existing success response.
The existing 48-hour expiresAt logic is unchanged.

No database migration.
No intentional changes to payment approval, consultant commissions/points,
student login/OTP, course access, Daily Video, Q&A, or other LMS features.

Apply:
node apply-registration-success-v36.mjs
npm run build
