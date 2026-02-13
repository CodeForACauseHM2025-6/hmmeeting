import { Resend } from "resend";

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
      <p style="margin: 5px 0;"><strong>Date:</strong> ${displayDate}</p>
      <p style="margin: 5px 0;"><strong>Time:</strong> ${displayTime}</p>
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
    subject: `Meeting requested with ${teacherName}`,
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Meeting Request Sent</h2>
      <p>Hi ${studentName},</p>
      <p>Your meeting request has been sent to <strong>${teacherName}</strong>. You'll receive an email when they respond.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${teacherName}</p>
      `)}
      ${emailFooter()}
    `),
  });

  const appUrl = getAppUrl();
  let actionButtonsHtml = "";
  if (emailToken) {
    const acceptUrl = `${appUrl}/api/email-action?token=${emailToken}&action=accept`;
    const declineUrl = `${appUrl}/api/email-action?token=${emailToken}&action=decline`;
    actionButtonsHtml = `
      <div style="margin: 25px 0; text-align: center;">
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 28px; background-color: #5b0d1f; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; margin-right: 12px;">
          Accept Meeting
        </a>
        <a href="${declineUrl}" style="display: inline-block; padding: 12px 28px; background-color: #ffffff; color: #5b0d1f; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; border: 2px solid #5b0d1f;">
          Decline Meeting
        </a>
      </div>
      <p style="color: #888; font-size: 12px; text-align: center;">
        You'll need to provide a room number to accept.
      </p>
      <p style="color: #888; font-size: 12px; text-align: center;">
        Or <a href="${appUrl}/dashboard" style="color: #5b0d1f;">log in to the app</a> to manage this meeting.
      </p>
    `;
  }

  const notification = await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(teacherEmail)],
    subject: `${studentName} requested a meeting`,
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">New Meeting Request</h2>
      <p>Hi ${teacherName},</p>
      <p><strong>${studentName}</strong> would like to meet with you.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>From:</strong> ${studentName}</p>
        ${studentNote ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${studentNote}</p>` : ""}
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
    subject: `Meeting confirmed with ${teacherName}`,
    html: emailWrapper(`
      <h2 style="color: #2e7d32;">Meeting Confirmed!</h2>
      <p>Hi ${studentName},</p>
      <p><strong>${teacherName}</strong> has accepted your meeting request.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${teacherName}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${room}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Teacher's note:</strong> ${teacherNote}</p>` : ""}
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
    subject: `Meeting declined by ${teacherName}`,
    html: emailWrapper(`
      <h2 style="color: #d32f2f;">Meeting Declined</h2>
      <p>Hi ${studentName},</p>
      <p><strong>${teacherName}</strong> has declined your meeting request.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${teacherName}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Teacher's note:</strong> ${teacherNote}</p>` : ""}
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
    subject: `Meeting cancelled by ${otherPartyName}`,
    html: emailWrapper(`
      <h2 style="color: #d32f2f;">Meeting Cancelled</h2>
      <p>Hi ${recipientName},</p>
      <p><strong>${otherPartyName}</strong> has cancelled the meeting.</p>
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
    subject: `Meeting confirmed with ${studentName}`,
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Meeting Confirmed!</h2>
      <p>Hi ${teacherName},</p>
      <p>You've accepted the meeting with <strong>${studentName}</strong>.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>Student:</strong> ${studentName}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${room}</p>
        ${teacherNote ? `<p style="margin: 5px 0;"><strong>Your note:</strong> ${teacherNote}</p>` : ""}
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
    subject: `${studentName} booked your office hours`,
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Office Hours Booking</h2>
      <p>Hi ${teacherName},</p>
      <p><strong>${studentName}</strong> has booked your office hours.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>Student:</strong> ${studentName}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${room}</p>
        ${studentNote ? `<p style="margin: 5px 0;"><strong>Note:</strong> ${studentNote}</p>` : ""}
      `)}
      <p>No action is required. The booking is auto-confirmed.</p>
      ${emailFooter()}
    `),
  });

  // Confirmation to student
  await resend.emails.send({
    from: FROM_ADDRESS,
    to: [resolveRecipient(studentEmail)],
    subject: `Office hours confirmed with ${teacherName}`,
    html: emailWrapper(`
      <h2 style="color: #5b0d1f;">Office Hours Confirmed!</h2>
      <p>Hi ${studentName},</p>
      <p>Your office hours visit with <strong>${teacherName}</strong> is confirmed.</p>
      ${meetingDetailsHtml(displayDate, displayTime, `
        <p style="margin: 5px 0;"><strong>With:</strong> ${teacherName}</p>
        <p style="margin: 5px 0;"><strong>Room:</strong> ${room}</p>
      `)}
      ${emailFooter()}
    `),
  });
}
