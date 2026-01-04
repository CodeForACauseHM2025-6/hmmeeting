import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { personName, personEmail, day, timeLabel, userEmail, userName } = await request.json();

    // Email 1: Confirmation to yourself
    const confirmationEmail = await resend.emails.send({
      from: 'Meeting Scheduler <onboarding@resend.dev>',
      to: [userEmail],
      subject: `Meeting Scheduled with ${personName}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #5b0d1f;">Meeting Scheduled! 📅</h2>
          
          <p>Hi ${userName},</p>
          
          <p>You have scheduled a meeting with <strong>${personName}</strong>.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>With:</strong> ${personName}</p>
            <p style="margin: 5px 0;"><strong>Day:</strong> Day ${day}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timeLabel}</p>
          </div>
          
          <p>A notification has been sent to ${personName}.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated message from your Meeting Scheduler app.
          </p>
        </div>
      `
    });

    // Email 2: Notification to the other person
    const notificationEmail = await resend.emails.send({
      from: 'Meeting Scheduler <onboarding@resend.dev>',
      to: [personEmail],
      subject: `${userName} would like to meet with you`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #5b0d1f;">Meeting Notification 📅</h2>
          
          <p>Hi ${personName},</p>
          
          <p><strong>${userName}</strong> would like to have a meeting with you.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>From:</strong> ${userName}</p>
            <p style="margin: 5px 0;"><strong>Day:</strong> Day ${day}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timeLabel}</p>
          </div>
          
          <p>Please reach out to ${userName} to confirm this meeting time.</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated message from your Meeting Scheduler app.
          </p>
        </div>
      `
    });

    return NextResponse.json({ 
      success: true, 
      confirmationEmail, 
      notificationEmail 
    });
  } catch (error) {
    console.error('Error sending emails:', error);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}