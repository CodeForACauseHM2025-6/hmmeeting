import { prisma } from "@/src/server/db";
import { sendStudentConfirmationEmail, sendStudentDeclinedEmail, sendTeacherConfirmationEmail } from "@/src/server/email";
import {
  buildDayDateMap,
  formatMeetingDateTime,
  type PeriodValue,
} from "@/src/config/schedule";

const SETTINGS_ID = "global";

async function getScheduleSnapshot() {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID },
    update: {},
  });
  return {
    currentWeek: settings.currentWeek === "WEEK1" ? 1 as const : 2 as const,
    weekSetAt: settings.weekSetAt,
  };
}

function getMeetingInfo(
  appointment: { day: number; period: PeriodValue; createdAt: Date },
  scheduleSettings: { currentWeek: 1 | 2; weekSetAt: Date }
) {
  const { dayDates } = buildDayDateMap(scheduleSettings, appointment.createdAt, {
    preferFuture: true,
  });
  const dayDate = dayDates[appointment.day];
  if (!dayDate) return null;
  return formatMeetingDateTime(dayDate, appointment.period, appointment.day);
}

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Meeting Scheduler</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; background-color: #f8f8f8; color: #333; min-height: 100vh; display: flex; flex-direction: column; }
    .header { background-color: #5b0d1f; color: #fff; padding: 16px 24px; font-size: 18px; font-weight: 600; }
    .container { max-width: 520px; margin: 40px auto; padding: 0 20px; flex: 1; width: 100%; }
    .card { background: #fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .card h2 { margin-bottom: 20px; font-size: 22px; }
    .details { background-color: #f5f5f5; padding: 16px; border-radius: 8px; margin: 20px 0; }
    .details p { margin: 6px 0; font-size: 14px; }
    label { display: block; font-weight: 600; margin-top: 16px; margin-bottom: 6px; font-size: 14px; }
    input[type="text"], textarea { width: 100%; padding: 10px 12px; border: 1px solid #ccc; border-radius: 6px; font-size: 14px; font-family: inherit; }
    textarea { resize: vertical; min-height: 80px; }
    .btn { display: inline-block; padding: 12px 28px; border: none; border-radius: 6px; font-size: 15px; font-weight: 600; cursor: pointer; text-decoration: none; margin-top: 20px; color: #fff; }
    .btn-accept { background-color: #5b0d1f; }
    .btn-accept:hover { background-color: #4a0a19; }
    .btn-decline { background-color: #ffffff; color: #5b0d1f !important; border: 2px solid #5b0d1f; }
    .btn-decline:hover { background-color: #f5f0f1; }
    .btn-back { background: none; color: #666; font-size: 13px; margin-left: 12px; padding: 12px 16px; }
    .success { color: #5b0d1f; }
    .error { color: #d32f2f; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    .required { color: #d32f2f; }
  </style>
</head>
<body>
  <div class="header">Meeting Scheduler</div>
  <div class="container">
    <div class="card">
      ${body}
    </div>
  </div>
  <div class="footer">Meeting Scheduler App</div>
</body>
</html>`;
}

function meetingDetailsBlock(
  studentName: string,
  displayDate: string,
  displayTime: string,
  studentNote?: string | null
) {
  return `
    <div class="details">
      <p><strong>Student:</strong> ${escapeHtml(studentName)}</p>
      <p><strong>Date:</strong> ${escapeHtml(displayDate)}</p>
      <p><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
      ${studentNote ? `<p><strong>Reason:</strong> ${escapeHtml(studentNote)}</p>` : ""}
    </div>
  `;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  if (!token || !action || !["accept", "decline"].includes(action)) {
    return new Response(
      htmlPage("Invalid Link", `
        <h2 class="error">Invalid Link</h2>
        <p>This link is missing required information.</p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { emailToken: token },
    include: { student: true, teacher: { include: { user: true } } },
  });

  if (!appointment) {
    return new Response(
      htmlPage("Link Expired", `
        <h2 class="error">Link Expired or Invalid</h2>
        <p>This link is no longer valid. The meeting may have already been addressed from the app.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
  if (Date.now() - appointment.createdAt.getTime() > TOKEN_EXPIRY_MS) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { emailToken: null },
    });
    return new Response(
      htmlPage("Link Expired", `
        <h2 class="error">Link Expired</h2>
        <p>This link has expired. Please respond to the meeting request from the app dashboard.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (appointment.status !== "PENDING") {
    return new Response(
      htmlPage("Already Handled", `
        <h2>Already Handled</h2>
        <p>This meeting has already been <strong>${appointment.status.toLowerCase()}</strong>.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const scheduleSettings = await getScheduleSnapshot();
  const meetingInfo = getMeetingInfo(
    { day: appointment.day, period: appointment.period as PeriodValue, createdAt: appointment.createdAt },
    scheduleSettings
  );
  const displayDate = meetingInfo?.dateLabel ?? `Day ${appointment.day}`;
  const displayTime = meetingInfo?.timeLabel ?? `Period ${appointment.period}`;

  if (action === "accept") {
    return new Response(
      htmlPage("Accept Meeting", `
        <h2 class="success">Accept Meeting</h2>
        <p>You're about to accept this meeting request.</p>
        ${meetingDetailsBlock(appointment.student.fullName, displayDate, displayTime, appointment.studentNote)}
        <form method="POST" action="/api/email-action">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <input type="hidden" name="action" value="accept">
          <label for="room">Room <span class="required">*</span></label>
          <input type="text" id="room" name="room" required placeholder="e.g. 315L">
          <label for="note">Note to student (optional)</label>
          <textarea id="note" name="note" placeholder="Any message for the student..."></textarea>
          <div style="margin-top: 24px;">
            <button type="submit" class="btn btn-accept">Accept Meeting</button>
            <a href="javascript:history.back()" class="btn btn-back">Cancel</a>
          </div>
        </form>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // action === "decline"
  return new Response(
    htmlPage("Decline Meeting", `
      <h2 class="error">Decline Meeting</h2>
      <p>You're about to decline this meeting request.</p>
      ${meetingDetailsBlock(appointment.student.fullName, displayDate, displayTime, appointment.studentNote)}
      <form method="POST" action="/api/email-action">
        <input type="hidden" name="token" value="${escapeHtml(token)}">
        <input type="hidden" name="action" value="decline">
        <label for="note">Note to student (optional)</label>
        <textarea id="note" name="note" placeholder="Reason for declining..."></textarea>
        <div style="margin-top: 24px;">
          <button type="submit" class="btn btn-decline">Decline Meeting</button>
          <a href="javascript:history.back()" class="btn btn-back">Cancel</a>
        </div>
      </form>
    `),
    { headers: { "Content-Type": "text/html" } }
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  let token: string | null = null;
  let action: string | null = null;
  let room = "";
  let note = "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    token = formData.get("token") as string | null;
    action = formData.get("action") as string | null;
    room = ((formData.get("room") as string) || "").trim().slice(0, 100);
    note = ((formData.get("note") as string) || "").trim().slice(0, 1000);
  } else {
    const body = await request.json().catch(() => null);
    token = body?.token ?? null;
    action = body?.action ?? null;
    room = (body?.room ?? "").trim().slice(0, 100);
    note = (body?.note ?? "").trim().slice(0, 1000);
  }

  if (!token || !action || !["accept", "decline"].includes(action)) {
    return new Response(
      htmlPage("Error", `
        <h2 class="error">Invalid Request</h2>
        <p>This request is missing required information.</p>
      `),
      { headers: { "Content-Type": "text/html" }, status: 400 }
    );
  }

  const appointment = await prisma.appointment.findUnique({
    where: { emailToken: token },
    include: { student: true, teacher: { include: { user: true } } },
  });

  if (!appointment) {
    return new Response(
      htmlPage("Link Expired", `
        <h2 class="error">Link Expired or Invalid</h2>
        <p>This link is no longer valid. The meeting may have already been addressed.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const TOKEN_EXPIRY_MS = 48 * 60 * 60 * 1000; // 48 hours
  if (Date.now() - appointment.createdAt.getTime() > TOKEN_EXPIRY_MS) {
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { emailToken: null },
    });
    return new Response(
      htmlPage("Link Expired", `
        <h2 class="error">Link Expired</h2>
        <p>This link has expired. Please respond to the meeting request from the app dashboard.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (appointment.status !== "PENDING") {
    return new Response(
      htmlPage("Already Handled", `
        <h2>Already Handled</h2>
        <p>This meeting has already been <strong>${appointment.status.toLowerCase()}</strong>.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-back" style="margin-left: 0;">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  const scheduleSettings = await getScheduleSnapshot();
  const meetingInfo = getMeetingInfo(
    { day: appointment.day, period: appointment.period as PeriodValue, createdAt: appointment.createdAt },
    scheduleSettings
  );
  const displayDate = meetingInfo?.dateLabel ?? `Day ${appointment.day}`;
  const displayTime = meetingInfo?.timeLabel ?? `Period ${appointment.period}`;

  if (action === "accept") {
    if (!room) {
      return new Response(
        htmlPage("Room Required", `
          <h2 class="error">Room is Required</h2>
          <p>You didn't enter a room. A room is required to accept the meeting.</p>
          <p style="margin-top: 16px;">
            <a href="${process.env.APP_URL || "http://localhost:3000"}/api/email-action?token=${escapeHtml(token)}&action=accept" class="btn btn-accept">Go Back</a>
          </p>
        `),
        { headers: { "Content-Type": "text/html" }, status: 400 }
      );
    }

    await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CONFIRMED",
        room,
        teacherNote: note || null,
        emailToken: null,
      },
    });

    try {
      await sendStudentConfirmationEmail({
        studentName: appointment.student.fullName,
        studentEmail: appointment.student.email,
        teacherName: appointment.teacher.user.fullName,
        day: appointment.day,
        period: appointment.period,
        dateLabel: displayDate,
        timeLabel: displayTime,
        room,
        teacherNote: note || null,
      });
    } catch (err) {
      console.error("Failed to send student confirmation email:", err);
    }

    try {
      await sendTeacherConfirmationEmail({
        teacherName: appointment.teacher.user.fullName,
        teacherEmail: appointment.teacher.user.email,
        studentName: appointment.student.fullName,
        day: appointment.day,
        period: appointment.period,
        dateLabel: displayDate,
        timeLabel: displayTime,
        room,
        teacherNote: note || null,
      });
    } catch (err) {
      console.error("Failed to send teacher confirmation email:", err);
    }

    return new Response(
      htmlPage("Meeting Accepted", `
        <h2 class="success">Meeting Accepted!</h2>
        <p>You've accepted the meeting with <strong>${escapeHtml(appointment.student.fullName)}</strong>.</p>
        <div class="details">
          <p><strong>Date:</strong> ${escapeHtml(displayDate)}</p>
          <p><strong>Time:</strong> ${escapeHtml(displayTime)}</p>
          <p><strong>Room:</strong> ${escapeHtml(room)}</p>
        </div>
        <p>The student has been notified via email.</p>
        <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-accept">Go to Dashboard</a></p>
      `),
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // action === "decline"
  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: "CANCELLED",
      teacherNote: note || null,
      room: null,
      studentCancelled: false,
      emailToken: null,
    },
  });

  try {
    await sendStudentDeclinedEmail({
      studentName: appointment.student.fullName,
      studentEmail: appointment.student.email,
      teacherName: appointment.teacher.user.fullName,
      day: appointment.day,
      period: appointment.period,
      dateLabel: displayDate,
      timeLabel: displayTime,
      teacherNote: note || null,
    });
  } catch (err) {
    console.error("Failed to send student declined email:", err);
  }

  return new Response(
    htmlPage("Meeting Declined", `
      <h2 class="error">Meeting Declined</h2>
      <p>You've declined the meeting with <strong>${escapeHtml(appointment.student.fullName)}</strong>.</p>
      <p>The student has been notified via email.</p>
      <p style="margin-top: 16px;"><a href="${process.env.APP_URL || "http://localhost:3000"}/dashboard" class="btn btn-decline">Go to Dashboard</a></p>
    `),
    { headers: { "Content-Type": "text/html" } }
  );
}
