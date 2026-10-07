# Pulse calls

One-to-one voice and video between two people whose conversation is **accepted** and who haven't blocked each other.

## How it works
- The caller opens the camera/microphone first (so a permission prompt never happens mid-ring), then `POST /api/pulse/calls` creates a `calls` row (`ringing`) and rings the callee over their private Realtime channel (`user:<id>`).
- The callee accepts (`/respond`). The server tells the caller, who creates the WebRTC offer. Offer, answer and ICE candidates are relayed by `/signal`, which only passes them to the other person in an accepted call.
- Media flows peer to peer, or through the TURN relay when a network blocks that.
- Either side hangs up (`/end`); a ring the caller abandons is cancelled. A call that is never ended (closed tab, dropped connection) is closed by the server the next time either person starts a call, so nobody stays "busy". The caller's ring gives up after 45 s.
- Each finished call leaves a line in the conversation ("Voice call · 4:32", "Missed video call", "Declined voice call").

## Configuration (required for production)
Calls need HTTPS (browsers only allow the camera and microphone on a secure origin) and a TURN relay. See `.env.local.example`:
- **Cloudflare Calls TURN:** `CLOUDFLARE_TURN_KEY_ID` + `CLOUDFLARE_TURN_KEY_API_TOKEN`. Short-lived credentials are minted per call.
- **Static TURN (Metered, coturn, ...):** `TURN_URLS` (comma separated) + `TURN_USERNAME` + `TURN_CREDENTIAL`.
- With neither, the server logs `No TURN relay configured` and falls back to public STUN. Roughly one in five connections will fail behind strict NATs and campus firewalls.

## Limits
- One-to-one only; no group calls, screen sharing or recording.
- A person with several tabs open rings in all of them; the first to answer wins and the others stop ringing.
- A reload mid-call ends the call.
