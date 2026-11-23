// Vercel serverless function: POST /api/contact
// 1) saves the submission as a Supabase row (RLS on, insert-only policy)
// 2) emails the site owner
// 3) sends an automatic acknowledgement to the visitor
const nodemailer = require('nodemailer');

const ROLES = ['student', 'parent', 'mentor', 'other'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_ANON_KEY, GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  const OWNER_EMAIL = process.env.OWNER_EMAIL || GMAIL_USER;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !GMAIL_USER || !GMAIL_APP_PASSWORD) {
    const missing = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'].filter((k) => !process.env[k]);
    return res.status(500).json({ error: 'Missing settings: ' + missing.join(', ') });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  body = body || {};

  // Honeypot: real people never fill the hidden "website" field
  if (body.website) return res.status(200).json({ ok: true });

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const role = String(body.role || '').trim();
  const message = String(body.message || '').trim();

  if (!name || name.length > 100) return res.status(400).json({ error: 'Please enter your name.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email.' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Please choose who you are.' });
  if (!message || message.length > 2000) return res.status(400).json({ error: 'Please write a message (max 2000 characters).' });

  // 1) Save to Supabase through the REST API using the public key → runs as the "anon" role, so RLS applies
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal', // anon has no SELECT permission, so don't ask for the row back
  };
  if (SUPABASE_ANON_KEY.startsWith('eyJ')) headers.Authorization = `Bearer ${SUPABASE_ANON_KEY}`; // legacy anon JWT

  const dbRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/contact_submissions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, email, role, message }),
  });
  if (!dbRes.ok) {
    console.error('Supabase insert failed', dbRes.status, await dbRes.text());
    return res.status(502).json({ error: 'Could not save your message. Please try again.' });
  }

  // 2) + 3) Emails via Gmail SMTP with an app password
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  const roleLabel = role[0].toUpperCase() + role.slice(1);
  try {
    await Promise.all([
      transporter.sendMail({
        from: `"Been There website" <${GMAIL_USER}>`,
        to: OWNER_EMAIL,
        replyTo: email,
        subject: `New Been There enquiry from ${name} (${roleLabel})`,
        text: `Name: ${name}\nEmail: ${email}\nI am a: ${roleLabel}\n\n${message}`,
        html: `<h2>New enquiry on Been There</h2>
               <p><b>Name:</b> ${escapeHtml(name)}<br><b>Email:</b> ${escapeHtml(email)}<br><b>I am a:</b> ${roleLabel}</p>
               <p style="white-space:pre-wrap;border-left:3px solid #f2a541;padding-left:12px">${escapeHtml(message)}</p>
               <p style="color:#888">Saved in Supabase → contact_submissions. Hit reply to answer them directly.</p>`,
      }),
      transporter.sendMail({
        from: `"Been There" <${GMAIL_USER}>`,
        to: email,
        subject: 'We got your message — Been There',
        text: `Hi ${name},\n\nThanks for reaching out to Been There. We've received your message and will get back to you within 48 hours.\n\nYour message:\n"${message}"\n\n— Team Been There\nCareer guidance from people who've been there.`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px">
                 <h2 style="color:#1d2b4f">Hi ${escapeHtml(name)}, thanks for reaching out!</h2>
                 <p>We've received your message and will get back to you within <b>48 hours</b>.</p>
                 <p style="white-space:pre-wrap;background:#fff6e8;padding:12px;border-radius:8px">${escapeHtml(message)}</p>
                 <p>— Team Been There<br><span style="color:#888">Career guidance from people who've been there.</span></p>
               </div>`,
      }),
    ]);
  } catch (err) {
    console.error('Email failed', err);
    // The row is already saved, so tell the visitor it went through
    return res.status(200).json({ ok: true, emailSent: false });
  }

  return res.status(200).json({ ok: true, emailSent: true });
};
