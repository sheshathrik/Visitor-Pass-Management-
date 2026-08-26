const nodemailer = require("nodemailer");
const axios = require("axios");

let transporter = null;
const emailConfigured = Boolean(
  process.env.SMTP_HOST &&
  process.env.SMTP_USER &&
  process.env.SMTP_PASS &&
  process.env.EMAIL_FROM
);

if (emailConfigured) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// ---- SMS (Fast2SMS) ----
// Replaces the earlier Twilio integration. Fast2SMS's "Quick SMS" (route=q)
// route works for Indian numbers without requiring DLT template registration,
// which is what we want for this application's transactional notifications.
const smsConfigured = Boolean(process.env.FAST2SMS_API_KEY);

if (!smsConfigured) {
  console.warn(
    "FAST2SMS_API_KEY not set. SMS notifications will be skipped until configured."
  );
}

async function sendEmail({ to, subject, html, text }) {
  if (!to) return;
  if (!emailConfigured || !transporter) {
    console.log(`[notify:email skipped - not configured] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Visitor Pass" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || "",
      html,
    });
    console.log(`[notify:email] Dispatched successfully to ${to}`);
  } catch (err) {
    console.error("Email send failed:", err.message);
  }
}

// Fast2SMS's Quick SMS route expects a plain 10-digit Indian mobile number
// (no +91, no spaces, no dashes). This function normalizes whatever the
// visitor typed in the registration form (e.g. "+91 90801 57679",
// "9080157679", "091-9080157679") down to the 10 digits Fast2SMS needs.
function normalizeToTenDigits(rawNumber) {
  const digitsOnly = String(rawNumber || "").replace(/\D/g, "");
  // Strip a leading country code (91) if present, keeping the last 10 digits.
  return digitsOnly.length > 10 ? digitsOnly.slice(-10) : digitsOnly;
}

async function sendSMS({ to, body }) {
  if (!to) return;

  const numbers = normalizeToTenDigits(to);

  if (numbers.length !== 10) {
    console.warn(`[notify:sms skipped - invalid number] to=${to}`);
    return;
  }

  if (!smsConfigured) {
    console.log(`[notify:sms skipped - not configured] to=${numbers} body="${body}"`);
    return;
  }

  try {
    const response = await axios.get("https://www.fast2sms.com/dev/bulkV2", {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        route: "q",
        message: body,
        numbers,
      },
      headers: { "cache-control": "no-cache" },
    });

    if (response.data && response.data.return === true) {
      console.log(`[notify:sms] Dispatched successfully to ${numbers}`);
    } else {
      console.error(`[notify:sms] Fast2SMS responded with an error:`, response.data);
    }
  } catch (err) {
    console.error("SMS send failed:", err.response?.data || err.message);
  }
}

const formatDate = (d) => {
  if (!d) return "Scheduled Visit Date";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
};

const getDecisionEmailHtml = ({ visit, decision }) => {
  const isApproved = decision === "approved";
  const badgeColor = isApproved ? "#15803d" : "#b91c1c";
  const badgeBg = isApproved ? "#dcfce7" : "#fee2e2";
  const badgeText = isApproved ? "Request Approved" : "Request Declined";

  const messageText = isApproved
    ? "Your scheduled visit request has been approved by your host. Please review your pass details and security entry protocols before arrival."
    : "Your visitor request could not be approved at this time. Please contact your host if you need to reschedule your meeting.";

  const passId = visit && visit._id ? String(visit._id).slice(-8).toUpperCase() : "VP-REF";

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visitor Pass Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; }
    .wrapper { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
    .header-banner { background: #0f766e; color: #ffffff; padding: 32px 28px; text-align: center; }
    .header-banner h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
    .header-banner p { margin: 8px 0 0 0; font-size: 14px; color: #ccfbf1; }
    .content-body { padding: 32px 28px; }
    .badge { display: inline-block; background-color: ${badgeBg}; color: ${badgeColor}; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 20px; }
    .salutation { font-size: 16px; font-weight: 600; color: #111827; margin-bottom: 12px; }
    .summary-text { font-size: 14px; line-height: 1.6; color: #4b5563; margin-bottom: 24px; }
    .details-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; background-color: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #f3f4f6; }
    .details-table td { padding: 12px 16px; font-size: 13.5px; border-bottom: 1px solid #e5e7eb; }
    .details-table tr:last-child td { border-bottom: none; }
    .details-table .label { font-weight: 600; color: #6b7280; width: 38%; }
    .details-table .value { font-weight: 600; color: #111827; }
    .instructions-card { background-color: #f0fdfa; border-left: 4px solid #0f766e; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px; }
    .instructions-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #0f766e; font-weight: 700; }
    .instructions-card ul { margin: 0; padding-left: 18px; font-size: 13px; color: #374151; line-height: 1.6; }
    .instructions-card li { margin-bottom: 6px; }
    .support-note { font-size: 13px; color: #6b7280; line-height: 1.5; margin-top: 20px; }
    .footer { background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-banner">
      <h1>Visitor Pass Management</h1>
      <p>Secure Enterprise Workplace Access System</p>
    </div>

    <div class="content-body">
      <span class="badge">${badgeText}</span>
      <div class="salutation">Hello ${visit?.visitorName || "Guest"},</div>
      <p class="summary-text">${messageText}</p>

      <table class="details-table">
        <tr>
          <td class="label">Pass Reference ID</td>
          <td class="value">${passId}</td>
        </tr>
        <tr>
          <td class="label">Visit Date</td>
          <td class="value">${formatDate(visit?.visitDate)}</td>
        </tr>
        <tr>
          <td class="label">Expected Time</td>
          <td class="value">${visit?.expectedArrivalTime || "Scheduled Business Hours"}</td>
        </tr>
        <tr>
          <td class="label">Purpose of Visit</td>
          <td class="value">${visit?.purpose || "Official Business Meeting"}</td>
        </tr>
        ${
          visit?.remarks
            ? `<tr>
                 <td class="label">Host Remarks</td>
                 <td class="value">${visit.remarks}</td>
               </tr>`
            : ""
        }
      </table>

      ${
        isApproved
          ? `<div class="instructions-card">
              <h3>Building Security &amp; Access Protocol</h3>
              <ul>
                <li><strong>Identity Verification:</strong> Please bring a government-issued photo identity document (Passport, Driver's License, or National ID card) for verification at the reception counter.</li>
                <li><strong>Badge Issuance:</strong> Display your digital Pass Reference ID or registered phone number (${visit?.phone || "registered number"}) to front-desk staff to receive your physical visitor badge.</li>
                <li><strong>Premises Policy:</strong> Visitors must wear their visitor badge visibly at all times and remain within designated visitor and meeting zones under host escort.</li>
                <li><strong>Health &amp; Safety:</strong> Adhere to on-premise emergency evacuation directions, warning markers, and restricted area indicators.</li>
              </ul>
            </div>`
          : ""
      }

      <p class="support-note">
        If you need to reschedule or have questions prior to arrival, please notify your host or reach out to security reception.
      </p>
    </div>

    <div class="footer">
      <p>This is an automated system notification from Visitor Pass Management System.<br>Please do not reply directly to this email address.</p>
    </div>
  </div>
</body>
</html>
  `;
};

const getVisitCreatedEmailHtml = (visit, employeeUser) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Visitor Request</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f3f4f6; margin: 0; padding: 24px 12px; color: #1f2937; }
    .wrapper { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08); border: 1px solid #e5e7eb; }
    .header-banner { background: #0f766e; color: #ffffff; padding: 32px 28px; text-align: center; }
    .header-banner h1 { margin: 0; font-size: 24px; font-weight: 700; }
    .header-banner p { margin: 8px 0 0 0; font-size: 14px; color: #ccfbf1; }
    .content-body { padding: 32px 28px; }
    .table { width: 100%; border-collapse: collapse; margin: 20px 0; background-color: #f9fafb; border-radius: 8px; overflow: hidden; border: 1px solid #f3f4f6; }
    .table td { padding: 12px 16px; font-size: 13.5px; border-bottom: 1px solid #e5e7eb; }
    .table tr:last-child td { border-bottom: none; }
    .table .label { font-weight: 600; color: #6b7280; width: 38%; }
    .table .value { font-weight: 600; color: #111827; }
    .footer { background-color: #f9fafb; border-top: 1px solid #e5e7eb; padding: 20px; text-align: center; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header-banner">
      <h1>New Visitor Request</h1>
      <p>Awaiting Your Review &amp; Approval</p>
    </div>
    <div class="content-body">
      <p style="margin-top:0; font-size: 16px; font-weight: 600; color: #111827;">Hello ${employeeUser?.name || "Host"},</p>
      <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">A new visitor has been registered for your department and is currently pending your review:</p>

      <table class="table">
        <tr><td class="label">Visitor Name</td><td class="value">${visit?.visitorName || "Guest"}</td></tr>
        <tr><td class="label">Contact Number</td><td class="value">${visit?.phone || "Not provided"}</td></tr>
        <tr><td class="label">Email Address</td><td class="value">${visit?.email || "Not provided"}</td></tr>
        <tr><td class="label">Visit Date</td><td class="value">${formatDate(visit?.visitDate)}</td></tr>
        <tr><td class="label">Expected Arrival</td><td class="value">${visit?.expectedArrivalTime || "Business Hours"}</td></tr>
        <tr><td class="label">Purpose</td><td class="value">${visit?.purpose || "Official Meeting"}</td></tr>
      </table>

      <p style="font-size: 13.5px; color: #4b5563;">Please log in to your employee portal to approve or reject this request.</p>
    </div>
    <div class="footer">
      <p>This is an automated notification from Visitor Pass Management System.</p>
    </div>
  </div>
</body>
</html>
  `;
};

async function notifyVisitCreated(visit, employeeUser) {
  try {
    await sendEmail({
      to: employeeUser?.email,
      subject: `Action Required: New visitor request from ${visit?.visitorName || "Visitor"}`,
      html: getVisitCreatedEmailHtml(visit, employeeUser),
    });
  } catch (err) {
    console.error("notifyVisitCreated error:", err.message);
  }
}

// NEW: Sends a confirmation SMS to the VISITOR's own phone number
// (the one they/the receptionist typed into the Register Visitor form),
// immediately after their request is submitted.
async function notifyVisitorRegistered(visit) {
  try {
    if (!visit?.phone) return;

    await sendSMS({
      to: visit.phone,
      body: `Hi ${visit.visitorName || "Visitor"}, your visit request for ${formatDate(
        visit.visitDate
      )} has been received and is awaiting host approval. - Visitor Pass Management`,
    });
  } catch (err) {
    console.error("notifyVisitorRegistered error:", err.message);
  }
}

async function notifyVisitDecision(visit, decision) {
  try {
    const subject =
      decision === "approved"
        ? "Your Visitor Pass Request Has Been Approved"
        : "Update: Your Visitor Pass Request Status";

    if (visit?.email) {
      await sendEmail({
        to: visit.email,
        subject,
        html: getDecisionEmailHtml({ visit, decision }),
      });
    }

    if (visit?.phone) {
      await sendSMS({
        to: visit.phone,
        body: `Visitor Pass: Your visit request has been ${decision}.${
          decision === "approved" ? " Please arrive as scheduled." : ""
        }`,
      });
    }
  } catch (err) {
    console.error("notifyVisitDecision error:", err.message);
  }
}

async function notifyCheckIn(visit) {
  try {
    if (visit?.phone) {
      await sendSMS({
        to: visit.phone,
        body: `Visitor Pass: You have been checked in at ${new Date(
          visit?.checkInTime || Date.now()
        ).toLocaleTimeString()}. Welcome!`,
      });
    }
  } catch (err) {
    console.error("notifyCheckIn error:", err.message);
  }
}

async function notifyCheckOut(visit) {
  try {
    if (visit?.phone) {
      await sendSMS({
        to: visit.phone,
        body: `Visitor Pass: You have been checked out. Thank you for visiting!`,
      });
    }
  } catch (err) {
    console.error("notifyCheckOut error:", err.message);
  }
}

const notify = {
  sendEmail,
  sendSMS,
  notifyVisitCreated,
  notifyVisitorRegistered,
  notifyVisitDecision,
  notifyCheckIn,
  notifyCheckOut,
  email: sendEmail,
  sms: sendSMS,
};

module.exports = notify;
module.exports.default = notify;
module.exports.sendEmail = sendEmail;
module.exports.sendSMS = sendSMS;
module.exports.notifyVisitCreated = notifyVisitCreated;
module.exports.notifyVisitorRegistered = notifyVisitorRegistered;
module.exports.notifyVisitDecision = notifyVisitDecision;
module.exports.notifyCheckIn = notifyCheckIn;
module.exports.notifyCheckOut = notifyCheckOut;