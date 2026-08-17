interface Env {
  DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  LEAD_EMAIL_FROM?: string;
  LEAD_NOTIFICATION_EMAILS?: string;
  LEAD_TO_EMAIL?: string;
  LEAD_NOTIFICATION_WEBHOOK_URL?: string;
  LEAD_NOTIFICATION_WEBHOOK_SECRET?: string;
  IP_SALT?: string;
}

interface LeadPayload {
  id: string;
  name: string;
  phone: string;
  email?: string;
  preferredContact: string;
  message?: string;
  sourcePage: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  createdAt: string;
}

interface WhatsAppClickPayload {
  id: string;
  buttonId: string;
  sourcePage: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  createdAt: string;
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

const textValue = (value: FormDataEntryValue | null | undefined, limit = 500) =>
  String(value ?? "").trim().slice(0, limit);

const hashIp = async (ip: string, salt: string) => {
  const bytes = new TextEncoder().encode(`${ip}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

// In-memory cache for WhatsApp click deduplication (15 seconds window)
const recentClicks = new Map<string, number>();

function isDuplicateClick(key: string, windowMs = 15000): boolean {
  const now = Date.now();
  // Cleanup old entries
  for (const [k, timestamp] of recentClicks.entries()) {
    if (now - timestamp > 60000) {
      recentClicks.delete(k);
    }
  }
  const lastTime = recentClicks.get(key);
  if (lastTime && now - lastTime < windowMs) {
    return true;
  }
  recentClicks.set(key, now);
  return false;
}

function getNotificationEmails(env: Env): string[] {
  const raw = env.LEAD_NOTIFICATION_EMAILS || env.LEAD_TO_EMAIL || "";
  return raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 3 && e.includes("@") && !e.startsWith("DEFINIR_"));
}

async function verifyTurnstile(token: string, ip: string, secret: string): Promise<boolean> {
  try {
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
  } catch {
    return false;
  }
}

async function sendResendEmail({
  apiKey,
  from,
  to,
  subject,
  html,
  text
}: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
}): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ from, to, subject, html, text })
    });
    return response.ok;
  } catch (err) {
    console.error("Erro ao enviar e-mail via Resend:", err);
    return false;
  }
}

async function notifyLead(env: Env, lead: LeadPayload) {
  const emails = getNotificationEmails(env);
  const from = env.LEAD_EMAIL_FROM || "Gaia Notificações <notificacoes@gaiaresidenciaparaidosos.com.br>";

  if (env.RESEND_API_KEY && emails.length > 0) {
    const subject = `[Gaia] Novo lead recebido pelo formulário`;
    const text = `
Novo contato recebido pelo formulário no site da Gaia:

ID: ${lead.id}
Data/Hora: ${lead.createdAt}
Nome: ${lead.name}
Telefone / WhatsApp: ${lead.phone}
E-mail: ${lead.email || "Não informado"}
Preferência de contato: ${lead.preferredContact}
Mensagem:
${lead.message || "Nenhuma mensagem adicional"}

Página de origem: ${lead.sourcePage}
Referrer: ${lead.referrer || "Direto"}
UTMs: ${[lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmContent].filter(Boolean).join(" / ") || "Nenhuma"}
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #163128;">
        <h2 style="color: #123f33; border-bottom: 2px solid #fdbd16; padding-bottom: 8px;">Novo Lead — Gaia Vida Ainda</h2>
        <p><strong>Data/Hora:</strong> ${lead.createdAt}</p>
        <p><strong>Nome:</strong> ${lead.name}</p>
        <p><strong>Telefone / WhatsApp:</strong> <a href="https://wa.me/55${lead.phone.replace(/\D/g, "")}">${lead.phone}</a></p>
        <p><strong>E-mail:</strong> ${lead.email ? `<a href="mailto:${lead.email}">${lead.email}</a>` : "Não informado"}</p>
        <p><strong>Preferência de retorno:</strong> ${lead.preferredContact}</p>
        <div style="background: #f7f3e8; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
          <strong>Mensagem informada:</strong><br />
          <p style="margin: 8px 0 0; white-space: pre-wrap;">${lead.message || "Sem mensagem adicional."}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #d9dfd9; margin: 20px 0;" />
        <p style="font-size: 12px; color: #495c56;">
          <strong>Página:</strong> ${lead.sourcePage} | <strong>Origem:</strong> ${lead.referrer || "Direto"}<br />
          <strong>UTMs:</strong> ${[lead.utmSource, lead.utmMedium, lead.utmCampaign, lead.utmContent].filter(Boolean).join(" / ") || "Nenhuma"}<br />
          <strong>ID do evento:</strong> ${lead.id}
        </p>
      </div>
    `;

    await sendResendEmail({
      apiKey: env.RESEND_API_KEY,
      from,
      to: emails,
      subject,
      html,
      text
    });
  }

  if (env.LEAD_NOTIFICATION_WEBHOOK_URL) {
    try {
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
          destination: emails,
          lead
        })
      });
    } catch (err) {
      console.error("Erro ao disparar webhook de lead:", err);
    }
  }
}

async function notifyWhatsAppClick(env: Env, click: WhatsAppClickPayload) {
  const emails = getNotificationEmails(env);
  const from = env.LEAD_EMAIL_FROM || "Gaia Notificações <notificacoes@gaiaresidenciaparaidosos.com.br>";

  if (env.RESEND_API_KEY && emails.length > 0) {
    const subject = `[Gaia] Interesse via WhatsApp — clique registrado no site`;
    const text = `
Interesse registrado via botão de WhatsApp no site da Gaia:

ID do Evento: ${click.id}
Data/Hora: ${click.createdAt}
Botão Clicado: ${click.buttonId}
Página de Origem: ${click.sourcePage}
Referrer: ${click.referrer || "Direto"}
UTMs: ${[click.utmSource, click.utmMedium, click.utmCampaign, click.utmContent].filter(Boolean).join(" / ") || "Nenhuma"}

Aviso: Este evento registra que um visitante clicou em um botão de WhatsApp no site. Isso indica interesse, mas não confirma que a mensagem foi enviada pelo aplicativo.
    `.trim();

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; color: #163128;">
        <h2 style="color: #128c7e; border-bottom: 2px solid #fdbd16; padding-bottom: 8px;">Interesse via WhatsApp — Gaia</h2>
        <p>Um visitante clicou em um canal de WhatsApp no site.</p>
        <p><strong>Botão / Posição:</strong> ${click.buttonId}</p>
        <p><strong>Página:</strong> ${click.sourcePage}</p>
        <p><strong>Data/Hora:</strong> ${click.createdAt}</p>
        <p><strong>Referrer:</strong> ${click.referrer || "Direto"}</p>
        <p><strong>UTMs:</strong> ${[click.utmSource, click.utmMedium, click.utmCampaign, click.utmContent].filter(Boolean).join(" / ") || "Nenhuma"}</p>
        <div style="background: #fff8e1; border-left: 4px solid #fdbd16; padding: 10px 14px; margin: 16px 0; font-size: 13px;">
          <em>Nota: Este aviso registra o clique no botão do site, indicando interesse do visitante. O envio efetivo da mensagem ocorre no próprio WhatsApp.</em>
        </div>
        <p style="font-size: 11px; color: #758a83;">ID do evento: ${click.id}</p>
      </div>
    `;

    await sendResendEmail({
      apiKey: env.RESEND_API_KEY,
      from,
      to: emails,
      subject,
      html,
      text
    });
  }

  if (env.LEAD_NOTIFICATION_WEBHOOK_URL) {
    try {
      await fetch(env.LEAD_NOTIFICATION_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.LEAD_NOTIFICATION_WEBHOOK_SECRET
            ? { authorization: `Bearer ${env.LEAD_NOTIFICATION_WEBHOOK_SECRET}` }
            : {})
        },
        body: JSON.stringify({
          event: "gaia.whatsapp.clicked",
          destination: emails,
          click
        })
      });
    } catch (err) {
      console.error("Erro ao disparar webhook de clique WhatsApp:", err);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, timestamp: new Date().toISOString() });
    }

    // 1. Endpoint para Notificação de Clique no WhatsApp
    if (url.pathname === "/api/whatsapp-click" && request.method === "POST") {
      try {
        let buttonId = "whatsapp_button";
        let sourcePage = "/";
        let referrer = "";
        let utmSource = "";
        let utmMedium = "";
        let utmCampaign = "";
        let utmContent = "";

        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const body = (await request.json()) as Record<string, unknown>;
          buttonId = textValue(String(body.buttonId || "whatsapp_button"), 100);
          sourcePage = textValue(String(body.sourcePage || "/"), 200);
          referrer = textValue(String(body.referrer || ""), 500);
          utmSource = textValue(String(body.utmSource || ""), 100);
          utmMedium = textValue(String(body.utmMedium || ""), 100);
          utmCampaign = textValue(String(body.utmCampaign || ""), 100);
          utmContent = textValue(String(body.utmContent || ""), 100);
        } else {
          const formData = await request.formData();
          buttonId = textValue(formData.get("buttonId"), 100) || "whatsapp_button";
          sourcePage = textValue(formData.get("sourcePage"), 200) || "/";
          referrer = textValue(formData.get("referrer"), 500);
          utmSource = textValue(formData.get("utm_source"), 100);
          utmMedium = textValue(formData.get("utm_medium"), 100);
          utmCampaign = textValue(formData.get("utm_campaign"), 100);
          utmContent = textValue(formData.get("utm_content"), 100);
        }

        const clientIp = request.headers.get("cf-connecting-ip") || "unknown";
        const ipSalt = env.IP_SALT || "gaia-default-salt";
        const ipHash = await hashIp(clientIp, ipSalt);

        // Deduplication: prevent repeated bursts within 15 seconds
        const dedupeKey = `${ipHash}:${buttonId}`;
        if (isDuplicateClick(dedupeKey, 15000)) {
          return json({ ok: true, deduped: true });
        }

        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();

        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT INTO whatsapp_events (
                id, created_at, button_id, source_page, referrer,
                utm_source, utm_medium, utm_campaign, utm_content, ip_hash, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              id,
              createdAt,
              buttonId,
              sourcePage,
              referrer || null,
              utmSource || null,
              utmMedium || null,
              utmCampaign || null,
              utmContent || null,
              ipHash,
              "novo"
            ).run();
          } catch (dbErr) {
            console.error("Erro ao persistir clique no D1:", dbErr);
          }
        }

        await notifyWhatsAppClick(env, {
          id,
          buttonId,
          sourcePage,
          referrer,
          utmSource,
          utmMedium,
          utmCampaign,
          utmContent,
          createdAt
        });

        return json({ ok: true });
      } catch {
        return json({ ok: true }); // Always return OK to not disrupt client navigation
      }
    }

    // 2. Endpoint para Envio de Formulário de Contato
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
          try {
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
          } catch (dbErr) {
            console.error("Erro ao persistir lead no D1:", dbErr);
          }
        }

        await notifyLead(env, {
          id,
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
          utmContent,
          createdAt
        });

        return json({ ok: true, redirect: "/obrigado/" }, 200);
      } catch {
        return json({ ok: false, message: "Erro ao processar envio. Tente pelo WhatsApp." }, 500);
      }
    }

    return json({ ok: false, message: "Endpoint não encontrado." }, 404);
  }
};
