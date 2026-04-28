import { Resend } from "resend";

function escapeHtml(value: string | null | undefined): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Resend's `subject` is plain text, but services may render it; strip CR/LF
// to defeat header-injection attempts and trim length defensively.
function escapeSubject(value: string): string {
  return value.replace(/[\r\n]+/g, " ").slice(0, 200);
}

type MeetingEmailPayload = {
  studentName: string;
  studentEmail: string;
  teacherName: string;
  teacherEmail: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  emailToken?: string;
  studentNote?: string;
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = "Meeting Scheduler <onboarding@resend.dev>";

const DEV_FORWARD_EMAIL = "michaelt96099@gmail.com";
const DEV_EMAIL_DOMAINS = ["@horacemann.org"];

/**
 * In development, forward all dev account emails to the real developer email
 * so you can test the full email flow. The email content still shows the
 * original account name/email — only the delivery address changes.
 */
function resolveRecipient(email: string): string {
  if (process.env.NODE_ENV === "production") return email;
  if (DEV_EMAIL_DOMAINS.some((domain) => email.endsWith(domain))) {
    return DEV_FORWARD_EMAIL;
  }
  return email;
}

function getAppUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

function meetingDetailsHtml(displayDate: string, displayTime: string, extra?: string) {
  return `
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      ${extra || ""}
      <p style="margin: 5px 0;"><strong>Date:</strong> ${escapeHtml(displayDate)}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
    </div>
  `;
}

function emailFooter() {
  return `
    <p style="color: #666; font-size: 12px; margin-top: 30px;">
      This is an automated message from The Horace Mann Scheduler.
    </p>
  `;
}

function emailWrapper(content: string) {
  return `<div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">${content}</div>`;
}

export async function sendMeetingEmails(payload: MeetingEmailPayload) {
  if (!process.env.RESEND_API_KEY || !resend) {
    return { skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const { studentName, studentEmail, teacherName, teacherEmail, day, period, dateLabel, timeLabel, emailToken, studentNote } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  const confirmation = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(studentEmail)],
    subject: escapeSubject(`Meeting requested with ${teacherName}`),
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Meeting Request Sent</h2>
      <p>Hi ${escapeHtml(studentName)},</p>
      <p>Your meeting request has been sent to <strong>${escapeHtml(teacherName)}</strong>. You'll receive an email when they respond.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${escapeHtml(teacherName)}</p>
      `)}
      ${emailFooter()}
    `),
  });

  const appUrl = getAppUrl();
  let actionButtonsHtml = "";
  if (emailToken) {
    // emailToken is server-generated (crypto.randomUUID), but URL-encode defensively.
    const tokenParam = encodeURIComponent(emailToken);
    const acceptUrl = `${appUrl}/api/email-action?token=${tokenParam}&action=accept`;
    const declineUrl = `${appUrl}/api/email-action?token=${tokenParam}&action=decline`;
    actionButtonsHtml = `
      <div style="margin: 25px 0; text-align: center;">
        <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; padding: 12px 28px; background-color: #5b0d1f; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin-right: 12px;">
          Accept Meeting
        </a>
        <a href="${escapeHtml(declineUrl)}" style="display: inline-block; padding: 12px 28px; background-color: #ffffff; color: #5b0d1f; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; border: 2px solid #5b0d1f;">
          Decline Meeting
        </a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center;">
        You'll need to provide a room number to accept.
      </p>
      <p style="color: #888; font-size: 12px; text-align: center;">
        Or <a href="${escapeHtml(`${appUrl}/dashboard`)}" style="color: #5b0d1f;">log in to the app</a> to manage this meeting.
      </p>
    `;
  }

  const notification = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(teacherEmail)],
    subject: escapeSubject(`${studentName} requested a meeting`),
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">New Meeting Request</h2>
      <p>Hi ${escapeHtml(teacherName)},</p>
      <p><strong>${escapeHtml(studentName)}</strong> would like to meet with you.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>From:</strong> ${escapeHtml(studentName)}</p>
        ${studentNote ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${escapeHtml(studentNote)}</p>` : ""}
      `)}
      ${actionButtonsHtml}
      ${emailFooter()}
    `),
  });

  return { confirmation, notification };
}

export async function sendStudentConfirmationEmail(payload: {
  studentName: string;
  studentEmail: string;
  teacherName: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  room: string;
  teacherNote?: string | null;
}) {
  if (!process.env.RESEND_API_KEY || !resend) return;

  const { studentName, studentEmail, teacherName, day, period, dateLabel, timeLabel, room, teacherNote } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(studentEmail)],
    subject: escapeSubject(`Meeting confirmed with ${teacherName}`),
    html: emailWrapper(`
      <h2 style="color: #2e7d32;">Meeting Confirmed!</h2>
      <p>Hi ${escapeHtml(studentName)},</p>
      <p><strong>${escapeHtml(teacherName)}</strong> has accepted your meeting request.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${escapeHtml(teacherName)}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${escapeHtml(room)}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Teacher's note:</strong> ${escapeHtml(teacherNote)}</p>` : ""}
      `)}
      ${emailFooter()}
    `),
  });
}

export async function sendStudentDeclinedEmail(payload: {
  studentName: string;
  studentEmail: string;
  teacherName: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  teacherNote?: string | null;
}) {
  if (!process.env.RESEND_API_KEY || !resend) return;

  const { studentName, studentEmail, teacherName, day, period, dateLabel, timeLabel, teacherNote } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(studentEmail)],
    subject: escapeSubject(`Meeting declined by ${teacherName}`),
    html: emailWrapper(`
      <h2 style="color: #d32f2f;">Meeting Declined</h2>
      <p>Hi ${escapeHtml(studentName)},</p>
      <p><strong>${escapeHtml(teacherName)}</strong> has declined your meeting request.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${escapeHtml(teacherName)}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Teacher's note:</strong> ${escapeHtml(teacherNote)}</p>` : ""}
      `)}
      <p>You can try requesting a different time slot.</p>
      ${emailFooter()}
    `),
  });
}

export async function sendCancellationEmail(payload: {
  recipientName: string;
  recipientEmail: string;
  otherPartyName: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  cancelledByStudent: boolean;
}) {
  if (!process.env.RESEND_API_KEY || !resend) return;

  const { recipientName, recipientEmail, otherPartyName, day, period, dateLabel, timeLabel } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(recipientEmail)],
    subject: escapeSubject(`Meeting cancelled by ${otherPartyName}`),
    html: emailWrapper(`
      <h2 style="color: #d32f2f;">Meeting Cancelled</h2>
      <p>Hi ${escapeHtml(recipientName)},</p>
      <p><strong>${escapeHtml(otherPartyName)}</strong> has cancelled the meeting.</p>
      ${meetingDetailsHtml(displayDate, displayTime)}
      ${emailFooter()}
    `),
  });
}

export async function sendTeacherConfirmationEmail(payload: {
  teacherName: string;
  teacherEmail: string;
  studentName: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  room: string;
  teacherNote?: string | null;
}) {
  if (!process.env.RESEND_API_KEY || !resend) return;

  const { teacherName, teacherEmail, studentName, day, period, dateLabel, timeLabel, room, teacherNote } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(teacherEmail)],
    subject: escapeSubject(`Meeting confirmed with ${studentName}`),
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Meeting Confirmed!</h2>
      <p>Hi ${escapeHtml(teacherName)},</p>
      <p>You've accepted the meeting with <strong>${escapeHtml(studentName)}</strong>.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>Student:</strong> ${escapeHtml(studentName)}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${escapeHtml(room)}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Your note:</strong> ${escapeHtml(teacherNote)}</p>` : ""}
      `)}
      ${emailFooter()}
    `),
  });
}

export async function sendOfficeHoursNotificationEmail(payload: {
  studentName: string;
  studentEmail: string;
  teacherName: string;
  teacherEmail: string;
  day: number;
  period: string;
  dateLabel?: string | null;
  timeLabel?: string | null;
  room: string;
  studentNote?: string | null;
}) {
  if (!process.env.RESEND_API_KEY || !resend) return;

  const { studentName, studentEmail, teacherName, teacherEmail, day, period, dateLabel, timeLabel, room, studentNote } = payload;
  const displayDate = dateLabel ? dateLabel : `Day ${day}`;
  const displayTime = timeLabel ? timeLabel : `Period ${period}`;

  // Notification to teacher
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(teacherEmail)],
    subject: escapeSubject(`${studentName} booked your office hours`),
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Office Hours Booking</h2>
      <p>Hi ${escapeHtml(teacherName)},</p>
      <p><strong>${escapeHtml(studentName)}</strong> has booked your office hours.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>Student:</strong> ${escapeHtml(studentName)}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${escapeHtml(room)}</p>
        ${studentNote ? `<p style="margin: 5px 0;"><strong>Note:</strong> ${escapeHtml(studentNote)}</p>` : ""}
      `)}
      <p>No action is required. The booking is auto-confirmed.</p>
      ${emailFooter()}
    `),
  });

  // Confirmation to student
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(studentEmail)],
    subject: escapeSubject(`Office hours confirmed with ${teacherName}`),
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Office Hours Confirmed!</h2>
      <p>Hi ${escapeHtml(studentName)},</p>
      <p>Your office hours visit with <strong>${escapeHtml(teacherName)}</strong> is confirmed.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${escapeHtml(teacherName)}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${escapeHtml(room)}</p>
      `)}
      ${emailFooter()}
    `),
  });
}
