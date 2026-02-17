export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Sadece /api/contact endpointi
    if (url.pathname !== "/api/contact") {
      return new Response("Not Found", { status: 404 });
    }

    // CORS
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin === "*" ? origin : allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON" }, 400, corsHeaders);
    }

    const name = clean(body.name, 80);
    const email = clean(body.email, 120);
    const message = clean(body.message, 2000);
    const lang = (body.lang === "tr" || body.lang === "en") ? body.lang : "en";

    if (!name || !email || !message) {
      return json({ ok: false, error: lang === "tr" ? "Lütfen tüm alanları doldurun." : "Please fill in all fields." }, 400, corsHeaders);
    }
    if (!isEmail(email)) {
      return json({ ok: false, error: lang === "tr" ? "Geçerli bir email girin." : "Please enter a valid email." }, 400, corsHeaders);
    }

    // (Opsiyonel) Turnstile doğrulaması eklemek istersen:
    // body.turnstileToken ile gönderip burada verify ederiz. Şimdilik kapalı.

    // MailChannels ile email gönder
    const subject = `New message from ErkanKoyun.com: ${name}`;
    const contentText =
`Name: ${name}
Email: ${email}

Message:
${message}
`;

    const mailPayload = {
      personalizations: [
        { to: [{ email: env.TO_EMAIL }] }
      ],
      from: {
        email: env.FROM_EMAIL,
        name: env.FROM_NAME
      },
      reply_to: {
        email,
        name
      },
      subject,
      content: [
        { type: "text/plain", value: contentText }
      ]
    };

    const resp = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(mailPayload)
    });

    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      return json({ ok: false, error: "Email send failed", detail: t.slice(0, 300) }, 502, corsHeaders);
    }

    return json({ ok: true }, 200, corsHeaders);
  }
};

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers }
  });
}

function clean(v, max) {
  if (typeof v !== "string") return "";
  v = v.trim();
  if (v.length > max) v = v.slice(0, max);
  return v;
}

function isEmail(v) {
  // basit email kontrolü
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
