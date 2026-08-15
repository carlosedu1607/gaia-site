interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  SITE_URL: string;
  TURNSTILE_SECRET_KEY?: string;
  LEAD_HASH_SALT?: string;
  LEAD_TO_EMAIL?: string;
  LEAD_NOTIFICATION_WEBHOOK_URL?: string;
  LEAD_NOTIFICATION_WEBHOOK_SECRET?: string;
}

interface LeadInput {
  name: string;
  phone: string;
  email: string;
  preferredContact: string;
  message: string;
  consent: boolean;
  sourcePage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  turnstileToken: string;
  company: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {\n    status,\n    headers: {\n      \"content-type\": \"application/json; charset=utf-8\",\n      \"cache-control\": \"no-store\",\n      \"x-content-type-options\": \"nosniff\"\n    }\n  });

const textValue = (value: FormDataEntryValue | null, limit = 500) =>
  String(value ?? \"\").trim().slice(0, limit);

const hashIp = async (ip: string, salt: string) => {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest(\"SHA-256\", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, \"0\"))
    .join(\"\");
};

async function verifyTurnstile(token: string, ip: string, secret: string) {
  const response = await fetch(
    \"https://challenges.cloudflare.com/turnstile/v0/siteverify\",
    {
      method: \"POST\",
      headers: { \"content-type\": \"application/json\" },
      body: JSON.stringify({ secret, response: token, remoteip: ip })
    }
  );

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function notifyLead(env: Env, lead: LeadInput) {
  if (!env.LEAD_NOTIFICATION_WEBHOOK_URL) return;

  await fetch(env.LEAD_NOTIFICATION_WEBHOOK_URL, {\n    method: \"POST\",\n    headers: {\n      \"content-type\": \"application/json\",\n      ...(env.LEAD_NOTIFICATION_WEBHOOK_SECRET\n        ? { authorization: `Bearer ${env.LEAD_NOTIFICATION_WEBHOOK_SECRET}` }\n        : {})\n    },\n    body: JSON.stringify({\n      event: \"gaia.lead.created\",\n      destination: env.LEAD_TO_EMAIL,\n      lead: {\n        name: lead.name,\n        phone: lead.phone,\n        email: lead.email,\n        preferredContact: lead.preferredContact,\n        message: lead.message,\n        sourcePage: lead.sourcePage\n      }\n    })\n  });
}

async function handleLead(request: Request, env: Env, context: ExecutionContext) {
  const requestOrigin = request.headers.get(\"origin\");
  const allowedOrigin = new URL(env.SITE_URL).origin;

  if (requestOrigin && requestOrigin !== allowedOrigin) {
    return json({ ok: false, message: \"Origem não autorizada.\" }, 403);
  }

  if (!env.TURNSTILE_SECRET_KEY || !env.LEAD_HASH_SALT) {
    return json(
      { ok: false, message: \"O formulário ainda não está configurado.\" },
      503
    );
  }

  const form = await request.formData();
  const lead: LeadInput = {
    name: textValue(form.get(\"name\"), 100),
    phone: textValue(form.get(\"phone\"), 30),
    email: textValue(form.get(\"email\"), 160),
    preferredContact: textValue(form.get(\"preferredContact\"), 30),
    message: textValue(form.get(\"message\"), 1200),
    consent: form.get(\"consent\") === \"on\",
    sourcePage: textValue(form.get(\"sourcePage\"), 300),
    referrer: textValue(form.get(\"referrer\"), 500),
    utmSource: textValue(form.get(\"utm_source\"), 120),
    utmMedium: textValue(form.get(\"utm_medium\"), 120),
    utmCampaign: textValue(form.get(\"utm_campaign\"), 160),
    utmContent: textValue(form.get(\"utm_content\"), 160),
    turnstileToken: textValue(form.get(\"cf-turnstile-response\"), 2048),
    company: textValue(form.get(\"company\"), 120)
  };

  if (lead.company) return json({ ok: true });

  const phoneDigits = lead.phone.replace(/\\D/g, \"\");
  const emailIsValid = !lead.email || /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(lead.email);
  if (
    lead.name.length < 2 ||
    phoneDigits.length < 10 ||
    !emailIsValid ||
    !lead.consent ||
    !lead.turnstileToken
  ) {
    return json(
      { ok: false, message: \"Revise os campos obrigatórios e tente novamente.\" },
      400
    );
  }

  const ip = request.headers.get(\"CF-Connecting-IP\") || \"unknown\";
  const ipHash = await hashIp(ip, env.LEAD_HASH_SALT);
  const recent = await env.DB.prepare(
    \"SELECT COUNT(*) AS total FROM leads WHERE ip_hash = ? AND created_at >= datetime('now', '-15 minutes')\"\n  )\n    .bind(ipHash)\n    .first<{ total: number }>();

  if ((recent?.total ?? 0) >= 5) {
    return json(
      { ok: false, message: \"Muitas tentativas. Aguarde alguns minutos.\" },
      429
    );
  }

  const turnstileOk = await verifyTurnstile(
    lead.turnstileToken,
    ip,
    env.TURNSTILE_SECRET_KEY
  );
  if (!turnstileOk) {
    return json(
      { ok: false, message: \"Não foi possível validar o envio. Tente novamente.\" },
      400
    );
  }

  await env.DB.prepare(
    `INSERT INTO leads (
      name, phone, email, preferred_contact, message, consent,
      source_page, referrer, utm_source, utm_medium, utm_campaign,
      utm_content, ip_hash
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )\n    .bind(
      lead.name,
      lead.phone,
      lead.email || null,
      lead.preferredContact || \"whatsapp\",\n      lead.message || null,\n      lead.consent ? 1 : 0,\n      lead.sourcePage || null,\n      lead.referrer || null,\n      lead.utmSource || null,\n      lead.utmMedium || null,\n      lead.utmCampaign || null,\n      lead.utmContent || null,\n      ipHash\n    )\n    .run();

  context.waitUntil(notifyLead(env, lead).catch(() => undefined));
  return json({ ok: true, redirect: \"/obrigado/\" }, 201);
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === \"/api/lead\" && request.method === \"POST\") {
      return handleLead(request, env, context);
    }

    if (url.pathname.startsWith(\"/api/\")) {
      return json({ ok: false, message: \"Rota não encontrada.\" }, 404);
    }

    return env.ASSETS.fetch(request);
  }
} satisfies ExportedHandler<Env>;
