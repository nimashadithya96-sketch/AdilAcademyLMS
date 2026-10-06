import nodemailer from "nodemailer";

const senderEmail = process.env.EMAIL_FROM?.trim() || "adilacademy65@gmail.com";

export function emailConfigured() {
  return Boolean(process.env.EMAIL_APP_PASSWORD);
}

export async function sendVerificationCode(email: string, code: string) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: password }
  });

  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`,
    to: email,
    subject: "Adil Academy email verification code",
    text: `Your Adil Academy verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>Email verification</h2><p>ඔබගේ payment එක approve කර ඇත. Account එක activate කිරීමට පහත OTP code එක භාවිත කරන්න.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;margin:24px 0;color:#7cff4f">${code}</div><p style="color:#9aa59f">මෙම code එක විනාඩි 10කින් expire වේ. වෙනත් කෙනෙකුට ලබා නොදෙන්න.</p></div>`
  });
}

export async function sendApplicationReceived(email: string, name: string, paymentCode: string) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: password }
  });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`,
    to: email,
    subject: "Adil Academy application received",
    text: `Hello ${name}, we received your details and payment proof (${paymentCode}). We will review them. If the details are correct, an OTP code will be sent to this email within 24 hours.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>ඔබගේ details ලැබී ඇත</h2><p>ආයුබෝවන් ${name},</p><p>ඔබ submit කළ details සහ payment proof එක අපට ලැබී ඇත. ඒවා දැන් පරීක්ෂා කරනු ලැබේ.</p><div style="margin:22px 0;padding:16px;border:1px solid #254331;border-radius:10px"><strong>Payment ID:</strong> ${paymentCode}</div><p>ඔබගේ details නිවැරදි නම් <strong>පැය 24ක් ඇතුළත</strong> මෙම email ලිපිනයට OTP code එකක් එවනු ලැබේ.</p><p style="color:#9aa59f">OTP code එක ලැබෙන තුරු නැවත application එකක් submit කිරීම අවශ්‍ය නැත.</p></div>`
  });
}

export async function sendPayId(email: string, payId: string, expiresAt: Date) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: password }
  });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`,
    to: email,
    subject: "Your Adil Academy Pay ID",
    text: `Your Adil Academy Pay ID is ${payId}. Use this exact Pay ID as your bank payment reference and in the admission form. It expires at ${expiresAt.toISOString()} and can be used once.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>Your Pay ID</h2><p>Bank payment එකේ <strong>Reference</strong> ලෙස පහත Pay ID එක වෙනසක් නොකර භාවිත කරන්න.</p><div style="margin:24px 0;padding:20px;border:1px solid #315c40;border-radius:12px;color:#7cff4f;font-size:24px;font-weight:800;letter-spacing:2px;text-align:center">${payId}</div><p>Admission form එකේත් මෙම Pay ID එකම ඇතුළත් කරන්න.</p><ul><li>මෙය එක් payment එකකට පමණයි.</li><li>පැය 48කින් expire වේ.</li><li>Pay ID නැති payment එකක් approve කරන්නේ නැත.</li></ul><p style="color:#9aa59f">Expires: ${expiresAt.toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}</p></div>`
  });
}

export async function sendCcoMainPayId(email: string, name: string, payId: string, amount: number, expiresAt: Date) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: senderEmail, pass: password } });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`, to: email, subject: "Your CCO Main Account Pay ID",
    text: `Hello ${name}, your one-time CCO Main Pay ID is ${payId}. Amount: LKR ${amount}. It expires at ${expiresAt.toISOString()}.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY · CCO MAIN</p><h2>Special CCO Main Pay ID</h2><p>ආයුබෝවන් ${name}, course එකක් නොමැති CCO Main account application එක සඳහා මෙම Pay ID එක භාවිත කරන්න.</p><div style="margin:22px 0;padding:18px;border:1px solid #315c40;border-radius:12px;text-align:center"><strong style="font-size:24px;color:#7cff4f">${payId}</strong><br><span>LKR ${amount.toLocaleString()}</span></div><p>Bank transfer reference එකටත් CCO form එකටත් මෙම ID එකම යොදන්න. එක් වරක් පමණක් භාවිත කළ හැකි අතර පැය 48කින් expire වේ.</p></div>`
  });
}

export async function sendCcoMainApplicationReceived(email: string, name: string) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: senderEmail, pass: password } });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`, to: email, subject: "CCO Main application received",
    text: `Hello ${name}, your CCO Main application and payment slip were received. If approved, an OTP will be emailed within 24 hours.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY · CCO MAIN</p><h2>Application එක සාර්ථකයි</h2><p>ආයුබෝවන් ${name}, ඔබගේ details සහ bank slip එක ලැබී ඇත.</p><p>Admin විසින් payment slip එක පරීක්ෂා කර නිවැරදි නම් <strong>පැය 24ක් ඇතුළත</strong> මෙම email එකට OTP code එකක් එවනු ලැබේ.</p><p>OTP ලැබුණු පසු Login → Verify OTP වෙත ගොස් OTP එක සහ නව password එක ඇතුළත් කරන්න.</p></div>`
  });
}

export async function sendFridayPayoutReminder(email: string, totalAmount: number, consultantCount: number) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: senderEmail, pass: password }
  });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`,
    to: email,
    subject: "Friday consultant payouts are waiting",
    text: `${consultantCount} consultant payouts totalling LKR ${totalAmount.toLocaleString()} are waiting. Open Admin > Commissions, make each bank transfer, then mark it Paid & Clear Balance.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>Friday payout reminder</h2><p>Consultant payments manually complete කිරීමට කාලයයි.</p><div style="margin:22px 0;padding:18px;border:1px solid #315c40;border-radius:12px"><strong>${consultantCount} consultants</strong><br><span style="font-size:28px;color:#7cff4f;font-weight:800">LKR ${totalAmount.toLocaleString()}</span></div><p>Admin Panel → Commissions වෙත ගොස් bank transfer එක සිදුකර, සාර්ථක වූ පසු <strong>Paid &amp; Clear Balance</strong> කරන්න.</p></div>`
  });
}


// ADIL_FORGOT_PASSWORD_V57
export async function sendPasswordResetCode(email: string, name: string, code: string) {
  const password = process.env.EMAIL_APP_PASSWORD?.replaceAll(" ", "");
  if (!password) throw new Error("EMAIL_NOT_CONFIGURED");
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: senderEmail, pass: password } });
  await transporter.sendMail({
    from: `Adil Academy <${senderEmail}>`,
    to: email,
    subject: "Adil Academy password reset code",
    text: `Hello ${name}, your Adil Academy password reset code is ${code}. It expires in 10 minutes. Do not share this code. If you did not request a password reset, ignore this email.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:30px;background:#07110c;color:#fff;border-radius:16px"><p style="color:#7cff4f;font-weight:700;letter-spacing:2px">ADIL ACADEMY</p><h2>Password Reset</h2><p>ආයුබෝවන් ${name}, ඔබගේ Adil Academy password එක reset කිරීමට පහත code එක භාවිත කරන්න.</p><div style="font-size:34px;font-weight:800;letter-spacing:8px;margin:24px 0;color:#7cff4f">${code}</div><p style="color:#9aa59f">මෙම code එක විනාඩි 10කින් expire වේ. Code එක කිසිවෙකුට share කරන්න එපා.</p><p style="color:#9aa59f">ඔබ password reset එකක් request කළේ නැත්නම් මෙම email එක ignore කරන්න.</p></div>`
  });
}
