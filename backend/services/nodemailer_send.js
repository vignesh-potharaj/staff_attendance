let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  process.stderr.write(`FATAL: Failed to load nodemailer: ${err?.message || String(err)}\n`);
  process.exit(1);
}

async function main() {
  const {
    GMAIL_USER,
    GMAIL_APP_PASSWORD,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    MAIL_FROM,
    SMTP_USE_TLS,
  } = process.env;

  const payload = JSON.parse(process.argv[2] || '{}');
  let transporter;
  let fromAddress = MAIL_FROM;

  if (GMAIL_USER && GMAIL_APP_PASSWORD) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD,
      },
    });
    fromAddress = fromAddress || GMAIL_USER;
  } else {
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USERNAME || !SMTP_PASSWORD || !MAIL_FROM) {
      throw new Error('Missing SMTP configuration for Nodemailer');
    }

    const secure = String(SMTP_USE_TLS || 'true').toLowerCase() === 'true' && String(SMTP_PORT) === '465';
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT),
      secure,
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
    });
  }

  await transporter.sendMail({
    from: fromAddress,
    to: payload.recipient,
    subject: payload.subject,
    text: payload.plain_text,
  });

  process.stdout.write('sent');
}

main().catch((error) => {
  const errorMsg = error?.stack || String(error);
  process.stderr.write(`ERROR: ${errorMsg}\n`);
  process.exit(1);
});
