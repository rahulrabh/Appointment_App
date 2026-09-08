import nodemailer from "nodemailer";

let transporter;
async function mailer() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS)
    throw new Error(
      "SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS must be configured.",
    );
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.verify();
  return transporter;
}
const stamp = (date) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const calendarEvent = (appointment, method) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Luma//Appointments//EN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:${appointment.id}@luma.local`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(appointment.startsAt)}`,
    `DTEND:${stamp(appointment.endsAt)}`,
    `SUMMARY:Luma appointment`,
    `STATUS:${method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
export async function notify(appointment, type = "confirmation") {
  const cancelled = type === "cancellation";
  const subject = cancelled
    ? "Your Luma appointment was cancelled"
    : "Your Luma appointment is confirmed";
  const date = new Date(appointment.startsAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "full",
    timeStyle: "short",
  });
  const text = cancelled
    ? `Hi ${appointment.attendeeName}, your appointment on ${date} has been cancelled.`
    : `Hi ${appointment.attendeeName}, your appointment is confirmed for ${date}. A calendar invite is attached.`;
  const service = await mailer();
  await service.sendMail({
    from:
      process.env.MAIL_FROM || `Luma Appointments <${process.env.SMTP_USER}>`,
    to: appointment.attendeeEmail,
    subject,
    text,
    html: `<h2>${cancelled ? "Appointment cancelled" : "Appointment confirmed"}</h2><p>Hi ${appointment.attendeeName},</p><p>Your appointment for <strong>${date}</strong> has been ${cancelled ? "cancelled" : "confirmed"}.</p>`,
    icalEvent: {
      method: cancelled ? "CANCEL" : "REQUEST",
      content: calendarEvent(appointment, cancelled ? "CANCEL" : "REQUEST"),
    },
  });
  return null;
}
