# Supabase Auth email templates

Paste each `.html` file into the matching template under Authentication > Emails > Templates in the Supabase dashboard
(needs custom SMTP, e.g. Resend), and set the subject line shown below.

| Template (Supabase name) | File | Subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Confirm your Capabilio AI email |
| Invite user | `invite-user.html` | You're invited to Capabilio AI |
| Magic link or OTP | `magic-link.html` | Your Capabilio AI sign-in link |
| Change email address | `change-email.html` | Confirm your new Capabilio AI email address |
| Reset password | `reset-password.html` | Reset your Capabilio AI password |
| Reauthentication | `reauthentication.html` | Your Capabilio AI verification code |

Variables used: `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .Email }}`, `{{ .NewEmail }}`. The logo loads from `https://capabilio.online/brand/capabilio-logo.png`.
Layout is table-based with inline styles so it renders in Gmail, Outlook and Apple Mail; the page itself is forced to light colours.
