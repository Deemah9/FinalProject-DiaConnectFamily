import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from dotenv import load_dotenv

load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://10.0.2.2:8000")


def send_password_reset_email(to_email: str, token: str) -> None:
    reset_link = f"{BACKEND_URL}/auth/reset-redirect?token={token}"

    html_body = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 40px;">
        <div style="max-width: 480px; margin: auto; background: #ffffff; border-radius: 12px; padding: 32px;">
          <h2 style="color: #1A6FA8; margin-bottom: 8px;">DiaConnect Family</h2>
          <p style="color: #333; font-size: 15px;">
            We received a request to reset your password.
            Click the button below to choose a new password.
            This link expires in <strong>1 hour</strong>.
          </p>
          <a href="{reset_link}"
             style="display: inline-block; margin-top: 20px; padding: 14px 28px;
                    background-color: #1A6FA8; color: #ffffff; text-decoration: none;
                    border-radius: 8px; font-size: 15px; font-weight: 600;">
            Reset Password
          </a>
          <p style="margin-top: 24px; color: #888; font-size: 12px;">
            If you didn't request this, you can safely ignore this email.
            Your password will not change.
          </p>
        </div>
      </body>
    </html>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "Reset your DiaConnect Family password"
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.ehlo()
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_USER, to_email, msg.as_string())
