import { Resend } from "resend";

type MeetingEmailPayload = {
  studentName: string;
  studentEmail: string;
  teacherName: string;
  teacherEmail: string;
  day: number;
  period: string;
};

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendMeetingEmails(payload: MeetingEmailPayload) {
  if (!process.env.RESEND_API_KEY || !resend) {
    return { skipped: true, reason: "Missing RESEND_API_KEY" };
  }

  const { studentName, studentEmail, teacherName, teacherEmail, day, period } = payload;
  const timeLabel = `Period ${period}`;

  const confirmation = await resend.emails.send({
    from: "Meeting Scheduler <onboarding@resend.dev>",
    to: [studentEmail],
    subject: `Meeting requested with ${teacherName}`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #5b0d1f;">Meeting Request Sent</h2>
        <p>Hi ${studentName},</p>
        <p>Your meeting request has been sent to <strong>${teacherName}</strong>.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>With:</strong> ${teacherName}</p>
          <p style="margin: 5px 0;"><strong>Day:</strong> Day ${day}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${timeLabel}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated message from your Meeting Scheduler app.
        </p>
      </div>
    `,
  });

  const notification = await resend.emails.send({
    from: "Meeting Scheduler <onboarding@resend.dev>",
    to: [teacherEmail],
    subject: `${studentName} requested a meeting`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #5b0d1f;">New Meeting Request</h2>
        <p>Hi ${teacherName},</p>
        <p><strong>${studentName}</strong> would like to meet with you.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>From:</strong> ${studentName}</p>
          <p style="margin: 5px 0;"><strong>Day:</strong> Day ${day}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> ${timeLabel}</p>
        </div>
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          This is an automated message from your Meeting Scheduler app.
        </p>
      </div>
    `,
  });

  return { confirmation, notification };
}
