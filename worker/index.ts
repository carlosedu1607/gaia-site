interface Env {
  DB: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  LEAD_NOTIFICATION_WEBHOOK_URL?: string;
  LEAD_NOTIFICATION_WEBHOOK_SECRET?: string;
  LEAD_TO_EMAIL?: string;
  IP_SALT?: string;
}

interface LeadPayload {
  name: string;
  phone: string;
  email: string;
  preferredContact: string;
  message: string;
  sourcePage: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff"
    }
  });

const textValue = (value: FormDataEntryValue | null, limit = 500) =>
  String(value ?? "").trim().slice(0, limit);

const hashIp = async (ip: string, salt: string) => {
  const bytes = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

async function verifyTurnstile(token: string, ip: string, secret: string) {
  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret, response: token, remoteip: ip })
    }
  );
  const data = (await response.json()) as { success: boolean };
  return data.success;
}

async function sendNotification(env: Env, lead: LeadPayload) {
  if (!env.LEAD_NOTIFICATION_WEBHOOK_URL) return;
  await fetch(env.LEAD_NOTIFICATION_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(env.LEAD_NOTIFICATION_WEBHOOK_SECRET
        ? { authorization: `Bearer ${env.LEAD_NOTIFICATION_WEBHOOK_SECRET}` }
        : {})
    },
    body: JSON.stringify({
      event: "gaia.lead.created",
      destination: env.LEAD_TO_EMAIL,
      lead: {
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        preferredContact: lead.preferredContact,
        message: lead.message,
        sourcePage: lead.sourcePage
      }
    })
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, timestamp: new Date().toISOString() });
    }

    if (url.pathname === "/api/lead" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const honeypot = textValue(formData.get("company"), 100);
        if (honeypot) {
          return json({ ok: true, message: "Recebido." }, 200);
        }

        const name = textValue(formData.get("name"), 100);
        const phone = textValue(formData.get("phone"), 30);
        const email = textValue(formData.get("email"), 160);
        const preferredContact = textValue(formData.get("preferredContact"), 20) || "whatsapp";
        const message = textValue(formData.get("message"), 1200);
        const consent = textValue(formData.get("consent"), 10);
        const sourcePage = textValue(formData.get("sourcePage"), 200) || "/";
        const referrer = textValue(formData.get("referrer"), 500);
        const utmSource = textValue(formData.get("utm_source"), 100);
        const utmMedium = textValue(formData.get("utm_medium"), 100);
        const utmCampaign = textValue(formData.get("utm_campaign"), 100);
        const utmContent = textValue(formData.get("utm_content"), 100);
        const turnstileToken = textValue(formData.get("cf-turnstile-response"), 2048);

        if (!name || name.length < 2) {
          return json({ ok: false, message: "Informe seu nome completo." }, 400);
        }
        if (!phone || phone.length < 8) {
          return json({ ok: false, message: "Informe um telefone/WhatsApp válido." }, 400);
        }
        if (!consent) {
          return json({ ok: false, message: "É necessário concordar com os termos de privacidade." }, 400);
        }

        const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
        if (env.TURNSTILE_SECRET_KEY) {
          if (!turnstileToken) {
            return json({ ok: false, message: "Confirmação de segurança ausente." }, 400);
          }
          const validToken = await verifyTurnstile(turnstileToken, clientIp, env.TURNSTILE_SECRET_KEY);
          if (!validToken) {
            return json({ ok: false, message: "Validação de segurança não aprovada. Tente novamente." }, 400);
          }
        }

        const ipSalt = env.IP_SALT || "gaia-default-salt";
        const ipHash = await hashIp(clientIp, ipSalt);
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        if (env.DB) {
          await env.DB.prepare(
            `INSERT INTO leads (
              id, created_at, name, phone, email, preferred_contact, message,
              source_page, referrer, utm_source, utm_medium, utm_campaign, utm_content,
              ip_hash, user_agent, turnstile_verified
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            createdAt,
            name,
            phone,
            email || null,
            preferredContact,
            message || null,
            sourcePage,
            referrer || null,
            utmSource || null,
            utmMedium || null,
            utmCampaign || null,
            utmContent || null,
            ipHash,
            request.headers.get("user-agent") || "unknown",
            env.TURNSTILE_SECRET_KEY ? 1 : 0
          ).run();
        }

        await sendNotification(env, {
          name,
          phone,
          email,
          preferredContact,
          message,
          sourcePage,
          referrer,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent
        });

        return json({ ok: true, redirect: "/obrigado/" }, 200);
      } catch (err) {
        return json({ ok: false, message: "Erro ao processar envio. Tente pelo WhatsApp." }, 500);
      }
    }

    return json({ ok: false, message: "Endpoint não encontrado." }, 404);
  }
};
