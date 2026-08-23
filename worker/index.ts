interface Env {
  DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  LEAD_EMAIL_FROM?: string;
  LEAD_NOTIFICATION_EMAILS?: string;
  LEAD_TO_EMAILS?: string;
  LEAD_TO_EMAIL?: string;
  WEEKLY_REPORT_EMAIL?: string;
  LEAD_NOTIFICATION_WEBHOOK_URL?: string;
  LEAD_NOTIFICATION_WEBHOOK_SECRET?: string;
  IP_SALT?: string;
  SITE_URL?: string;
}

interface LeadPayload {
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

// Formata data e hora no fuso horário oficial de Brasília (America/Sao_Paulo)
function formatBrasiliaDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d);
}

function formatBrasiliaDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d);
}

// In-memory cache para deduplicação rápida de cliques (janela de 15 segundos)
const recentClicks = new Map<string, number>();

function isDuplicateClick(key: string, windowMs = 15000): boolean {
  const now = Date.now();
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

// Retorna a lista dos 3 destinatários oficiais dos avisos do formulário
function getLeadNotificationEmails(env: Env): string[] {
  const defaultEmails = [
    "contato@gaiaresidencia.com.br",
    "sara@gaiaresidencia.com.br",
    "eve@gaiaresidencia.com.br"
  ];
  const raw = env.LEAD_NOTIFICATION_EMAILS || env.LEAD_TO_EMAILS || env.LEAD_TO_EMAIL || "";
  const parsed = raw
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.length > 3 && e.includes("@") && !e.startsWith("DEFINIR_"));
  return parsed.length > 0 ? parsed : defaultEmails;
}

// Retorna o destinatário exclusivo do relatório semanal
function getWeeklyReportEmail(env: Env): string {
  return (env.WEEKLY_REPORT_EMAIL || "sara@gaiaresidencia.com.br").trim();
}

// Retorna o remetente oficial autorizado pelo domínio validado no Resend
function getLeadEmailFrom(env: Env): string {
  return env.LEAD_EMAIL_FROM || "Gaia Notificações <notificacoes@envios.gaiaresidencia.com.br>";
}

// Rótulos amigáveis para as posições dos botões de WhatsApp
function getButtonFriendlyName(buttonId: string): string {
  const map: Record<string, string> = {
    hero_whatsapp: "Banner principal (Hero)",
    floating_whatsapp: "Botão flutuante (WhatsApp)",
    services_whatsapp: "Seção de Serviços / Modalidades",
    support_whatsapp: "Seção de Apoio à Família",
    contact_whatsapp: "Página / Seção de Contato",
    contact_list_whatsapp: "Lista de Contatos",
    footer_whatsapp: "Rodapé (Ícone de Redes Sociais)"
  };
  return map[buttonId] || buttonId;
}

// Rótulos amigáveis para as páginas
function getPageFriendlyName(sourcePage: string): string {
  const map: Record<string, string> = {
    "/": "Página Inicial (Home)",
    "/a-gaia/": "A Gaia (Nossa história)",
    "/servicos/": "Modalidades de cuidado",
    "/servicos/longa-permanencia/": "Longa permanência",
    "/servicos/moradia-temporaria/": "Moradia temporária",
    "/servicos/centro-dia/": "Centro-dia",
    "/servicos/pos-operatorio/": "Pós-operatório",
    "/estrutura/": "Estrutura e acomodações",
    "/duvidas/": "Dúvidas frequentes",
    "/contato/": "Entre em contato",
    "/privacidade/": "Política de privacidade"
  };
  return map[sourcePage] || sourcePage;
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

// Disparo seguro de e-mails transacionais via API oficial do Resend
async function sendResendEmail({
  apiKey,
  from,
  to,
  replyTo,
  subject,
  html,
  text
}: {
  apiKey: string;
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: Record<string, unknown> = {
      from,
      to,
      subject,
      html,
      text
    };

    if (replyTo && replyTo.includes("@")) {
      payload.reply_to = replyTo;
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Erro na API do Resend:", response.status, errText);
      return { ok: false, error: `Resend status ${response.status}: ${errText.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Erro ao conectar com Resend:", message);
    return { ok: false, error: message };
  }
}

// 1. Notificação Imediata do Formulário de Contato
async function notifyLead(env: Env, lead: LeadPayload) {
  const emails = getLeadNotificationEmails(env);
  const from = getLeadEmailFrom(env);
  const formattedDate = formatBrasiliaDateTime(lead.createdAt);

  if (env.RESEND_API_KEY && emails.length > 0) {
    const subject = "Novo contato recebido pelo site da Gaia";

    // Constrói campos apenas se preenchidos pelo visitante
    const textLines: string[] = [
      "Novo contato recebido pelo formulário do site da Gaia:",
      "",
      `Data e horário: ${formattedDate} (horário de Brasília)`,
      `Nome: ${lead.name}`,
      `Telefone: ${lead.phone}`
    ];

    if (lead.email) {
      textLines.push(`E-mail: ${lead.email}`);
    }
    if (lead.preferredContact) {
      const prefMap: Record<string, string> = {
        whatsapp: "WhatsApp",
        telefone: "Ligação telefônica",
        email: "E-mail"
      };
      textLines.push(`Preferência de retorno: ${prefMap[lead.preferredContact] || lead.preferredContact}`);
    }
    if (lead.message) {
      textLines.push("", "Mensagem informada:", lead.message);
    }

    const text = textLines.join("\n");

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Novo contato recebido pelo site da Gaia</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f3e8; margin: 0; padding: 24px 12px; color: #163128;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(18, 63, 51, 0.08); border: 1px solid #e7dfcc;">
          <div style="background-color: #123f33; padding: 24px; text-align: left; border-bottom: 4px solid #fdbd16;">
            <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3;">Novo contato recebido pelo site</h1>
            <p style="color: #ffd466; margin: 6px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Gaia Residência para Idosos</p>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 16px; font-size: 14px; color: #495c56;">
              <strong>Recebido em:</strong> ${formattedDate} <span style="font-size: 12px; color: #738a83;">(horário de Brasília)</span>
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; width: 140px; font-size: 14px; color: #495c56; font-weight: 600;">Nome:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 15px; color: #163128; font-weight: 700;">${lead.name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 14px; color: #495c56; font-weight: 600;">Telefone:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 15px; color: #163128; font-weight: 700;">${lead.phone}</td>
              </tr>
              ${
                lead.email
                  ? `
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 14px; color: #495c56; font-weight: 600;">E-mail:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 15px; color: #163128;">${lead.email}</td>
              </tr>
              `
                  : ""
              }
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 14px; color: #495c56; font-weight: 600;">Preferência de contato:</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f0ebe1; font-size: 15px; color: #163128; text-transform: capitalize;">
                  ${lead.preferredContact === "whatsapp" ? "WhatsApp" : lead.preferredContact === "telefone" ? "Ligação telefônica" : "E-mail"}
                </td>
              </tr>
            </table>

            ${
              lead.message
                ? `
            <div style="margin-top: 20px; padding: 14px 16px; background-color: #f7f3e8; border-radius: 8px; border-left: 3px solid #fdbd16;">
              <strong style="font-size: 13px; color: #123f33; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 6px;">Mensagem:</strong>
              <p style="margin: 0; font-size: 14px; line-height: 1.5; color: #163128; white-space: pre-wrap;">${lead.message}</p>
            </div>
            `
                : ""
            }
          </div>
        </div>
      </body>
      </html>
    `.trim();

    await sendResendEmail({
      apiKey: env.RESEND_API_KEY,
      from,
      to: emails,
      replyTo: lead.email || undefined,
      subject,
      html,
      text
    });
  }

  // Webhook opcional de integração
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

// 2. Relatório Semanal de Cliques no WhatsApp (Disparado via Cron Trigger às sextas 9h Brasília)
export async function handleWeeklyWhatsAppReport(env: Env): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY ausente. Relatório semanal não enviado.");
    return;
  }

  const now = new Date();
  // Período dos últimos 7 dias
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const periodStartIso = periodStart.toISOString();
  const periodEndIso = periodEnd.toISOString();

  // Período imediatamente anterior (7 a 14 dias atrás) para comparação
  const prevPeriodStartIso = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const prevPeriodEndIso = periodStartIso;

  // Proteção contra envio duplicado para o mesmo período
  if (env.DB) {
    try {
      const existing = await env.DB.prepare(
        `SELECT id FROM weekly_whatsapp_reports WHERE period_start = ? AND period_end = ? AND status = 'enviado' LIMIT 1`
      ).bind(periodStartIso, periodEndIso).first();

      if (existing) {
        console.log("Relatório semanal já enviado anteriormente para este período.");
        return;
      }
    } catch (checkErr) {
      console.warn("Tabela de relatórios ainda não criada ou consulta falhou:", checkErr);
    }
  }

  let totalClicks = 0;
  let prevTotalClicks = 0;
  let clicksByDay: Array<{ day: string; count: number }> = [];
  let clicksByButton: Array<{ button_id: string; count: number }> = [];
  let clicksByPage: Array<{ source_page: string; count: number }> = [];

  if (env.DB) {
    try {
      // 1. Total no período
      const currentRes = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM whatsapp_events WHERE created_at >= ? AND created_at <= ?`
      ).bind(periodStartIso, periodEndIso).first<{ total: number }>();
      totalClicks = currentRes?.total || 0;

      // 2. Total no período anterior
      const prevRes = await env.DB.prepare(
        `SELECT COUNT(*) as total FROM whatsapp_events WHERE created_at >= ? AND created_at < ?`
      ).bind(prevPeriodStartIso, prevPeriodEndIso).first<{ total: number }>();
      prevTotalClicks = prevRes?.total || 0;

      // 3. Cliques por dia
      const daysRes = await env.DB.prepare(
        `SELECT substr(created_at, 1, 10) as day, COUNT(*) as count FROM whatsapp_events WHERE created_at >= ? AND created_at <= ? GROUP BY day ORDER BY day ASC`
      ).bind(periodStartIso, periodEndIso).all<{ day: string; count: number }>();
      clicksByDay = daysRes.results || [];

      // 4. Cliques por botão / posição
      const buttonsRes = await env.DB.prepare(
        `SELECT button_id, COUNT(*) as count FROM whatsapp_events WHERE created_at >= ? AND created_at <= ? GROUP BY button_id ORDER BY count DESC`
      ).bind(periodStartIso, periodEndIso).all<{ button_id: string; count: number }>();
      clicksByButton = buttonsRes.results || [];

      // 5. Cliques por página de origem
      const pagesRes = await env.DB.prepare(
        `SELECT source_page, COUNT(*) as count FROM whatsapp_events WHERE created_at >= ? AND created_at <= ? GROUP BY source_page ORDER BY count DESC`
      ).bind(periodStartIso, periodEndIso).all<{ source_page: string; count: number }>();
      clicksByPage = pagesRes.results || [];
    } catch (queryErr) {
      console.error("Erro ao consultar métricas de cliques no D1:", queryErr);
    }
  }

  const recipient = getWeeklyReportEmail(env);
  const from = getLeadEmailFrom(env);
  const subject = "Panorama semanal de cliques no WhatsApp — Gaia";

  const formattedStart = formatBrasiliaDateTime(periodStart);
  const formattedEnd = formatBrasiliaDateTime(periodEnd);

  // Cálculo da variação percentual
  let comparisonText = "";
  if (prevTotalClicks > 0) {
    const diff = totalClicks - prevTotalClicks;
    const pct = ((diff / prevTotalClicks) * 100).toFixed(1);
    const sign = diff >= 0 ? "+" : "";
    comparisonText = `(Período anterior: ${prevTotalClicks} cliques | Variação: ${sign}${pct}%)`;
  } else if (totalClicks > 0) {
    comparisonText = "(Período anterior: 0 cliques)";
  } else {
    comparisonText = "(Período anterior: 0 cliques)";
  }

  // Geração do e-mail em texto puro
  const textLines: string[] = [
    "Panorama semanal de cliques no WhatsApp — Gaia Residência para Idosos",
    "",
    `Período analisado: ${formattedStart} até ${formattedEnd} (horário de Brasília)`,
    `Destinatário: ${recipient}`,
    "",
    `Total de cliques nos últimos 7 dias: ${totalClicks} ${comparisonText}`,
    ""
  ];

  if (totalClicks === 0) {
    textLines.push("Nenhum clique nos botões de WhatsApp foi registrado nos últimos 7 dias.");
  } else {
    textLines.push("--- Cliques por dia ---");
    for (const d of clicksByDay) {
      textLines.push(`• ${formatBrasiliaDate(d.day + "T12:00:00Z")}: ${d.count} clique(s)`);
    }

    textLines.push("", "--- Cliques por posição do botão ---");
    for (const b of clicksByButton) {
      textLines.push(`• ${getButtonFriendlyName(b.button_id)}: ${b.count} clique(s)`);
    }

    textLines.push("", "--- Cliques por página de origem ---");
    for (const p of clicksByPage) {
      textLines.push(`• ${getPageFriendlyName(p.source_page || "/")}: ${p.count} clique(s)`);
    }
  }

  textLines.push(
    "",
    "Observação: Este relatório quantifica os cliques nos botões de WhatsApp do site da Gaia.",
    "O início da conversa e o envio efetivo da mensagem acontecem diretamente no aplicativo do WhatsApp."
  );

  const text = textLines.join("\n");

  // Geração do e-mail em HTML
  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Panorama semanal de cliques no WhatsApp — Gaia</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f3e8; margin: 0; padding: 24px 12px; color: #163128;">
      <div style="max-width: 620px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(18, 63, 51, 0.08); border: 1px solid #e7dfcc;">
        <div style="background-color: #123f33; padding: 24px; text-align: left; border-bottom: 4px solid #fdbd16;">
          <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 700; line-height: 1.3;">Panorama semanal de cliques no WhatsApp</h1>
          <p style="color: #ffd466; margin: 6px 0 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Gaia Residência para Idosos</p>
        </div>

        <div style="padding: 24px;">
          <div style="background-color: #fbf9f4; border: 1px solid #ede7d9; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 13px; color: #495c56;">
              <strong>Período analisado:</strong> ${formattedStart} às ${formattedEnd}<br />
              <span style="font-size: 12px; color: #758a83;">Fuso horário oficial: Brasília (America/Sao_Paulo)</span>
            </p>
          </div>

          <div style="background-color: #123f33; color: #ffffff; border-radius: 10px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #ffd466; font-weight: 700; display: block; margin-bottom: 4px;">Total de cliques nos últimos 7 dias</span>
            <strong style="font-size: 38px; line-height: 1.1; font-weight: 900; color: #ffffff;">${totalClicks}</strong>
            <span style="font-size: 13px; color: rgba(255, 255, 255, 0.85); display: block; margin-top: 6px;">${comparisonText}</span>
          </div>

          ${
            totalClicks === 0
              ? `
          <div style="background-color: #fff9e6; border-left: 4px solid #fdbd16; padding: 14px 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 0; font-size: 14px; color: #6b5100;">
              Nenhum clique nos botões de WhatsApp foi registrado no período de 7 dias analisado.
            </p>
          </div>
          `
              : `
          <h2 style="font-size: 15px; color: #123f33; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #f0ebe1; text-transform: uppercase; letter-spacing: 0.04em;">
            Cliques por dia
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #fbf9f4; text-align: left;">
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9;">Data</th>
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9; text-align: right;">Cliques</th>
              </tr>
            </thead>
            <tbody>
              ${clicksByDay
                .map(
                  (d) => `
              <tr>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; color: #163128;">${formatBrasiliaDate(d.day + "T12:00:00Z")}</td>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; text-align: right; font-weight: 700; color: #128c7e;">${d.count}</td>
              </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <h2 style="font-size: 15px; color: #123f33; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #f0ebe1; text-transform: uppercase; letter-spacing: 0.04em;">
            Cliques por posição do botão
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <thead>
              <tr style="background-color: #fbf9f4; text-align: left;">
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9;">Posição / Botão</th>
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9; text-align: right;">Cliques</th>
              </tr>
            </thead>
            <tbody>
              ${clicksByButton
                .map(
                  (b) => `
              <tr>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; color: #163128;">${getButtonFriendlyName(b.button_id)}</td>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; text-align: right; font-weight: 700; color: #128c7e;">${b.count}</td>
              </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <h2 style="font-size: 15px; color: #123f33; margin: 24px 0 12px; padding-bottom: 6px; border-bottom: 2px solid #f0ebe1; text-transform: uppercase; letter-spacing: 0.04em;">
            Cliques por página de origem
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <thead>
              <tr style="background-color: #fbf9f4; text-align: left;">
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9;">Página</th>
                <th style="padding: 8px 12px; font-size: 13px; color: #495c56; border-bottom: 1px solid #ede7d9; text-align: right;">Cliques</th>
              </tr>
            </thead>
            <tbody>
              ${clicksByPage
                .map(
                  (p) => `
              <tr>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; color: #163128;">${getPageFriendlyName(p.source_page || "/")}</td>
                <td style="padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #f5f1e8; text-align: right; font-weight: 700; color: #128c7e;">${p.count}</td>
              </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
          `
          }

          <div style="margin-top: 24px; padding: 12px 16px; background-color: #fbf9f4; border-radius: 8px; font-size: 12px; color: #758a83; line-height: 1.5;">
            <em>Nota informativa: Este relatório semanal consolida as interações de interesse de contato registradas no site da Gaia. O envio das mensagens e o atendimento ocorrem diretamente no WhatsApp.</em>
          </div>
        </div>

        <div style="background-color: #fbf9f4; padding: 14px 24px; text-align: center; border-top: 1px solid #ede7d9;">
          <p style="margin: 0; font-size: 12px; color: #758a83;">
            Relatório gerado automaticamente por Cloudflare Cron Trigger para <strong>${recipient}</strong>
          </p>
        </div>
      </div>
    </body>
    </html>
  `.trim();

  const sendResult = await sendResendEmail({
    apiKey: env.RESEND_API_KEY,
    from,
    to: [recipient],
    subject,
    html,
    text
  });

  // Registra a execução no banco D1 para evitar reenvios no mesmo período
  if (env.DB) {
    try {
      const reportId = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO weekly_whatsapp_reports (
          id, period_start, period_end, clicks_count, sent_at, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        reportId,
        periodStartIso,
        periodEndIso,
        totalClicks,
        new Date().toISOString(),
        sendResult.ok ? "enviado" : "erro",
        sendResult.error || null
      ).run();
    } catch (saveErr) {
      console.error("Erro ao registrar relatório semanal no D1:", saveErr);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return json({ ok: true, timestamp: new Date().toISOString() });
    }

    // 1. Endpoint para Registro de Clique no WhatsApp (Salva no D1, sem e-mail imediato)
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

        // Deduplicação em memória para rajadas repetidas em 15 segundos
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

        // Disparo opcional de webhook externo se configurado
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
                click: {
                  id,
                  buttonId,
                  sourcePage,
                  referrer,
                  utmSource,
                  utmMedium,
                  utmCampaign,
                  utmContent,
                  createdAt
                }
              })
            });
          } catch (webhookErr) {
            console.error("Erro ao disparar webhook de clique WhatsApp:", webhookErr);
          }
        }

        return json({ ok: true });
      } catch {
        return json({ ok: true }); // Sempre retorna OK para não travar a navegação do visitante
      }
    }

    // 2. Endpoint para Envio de Formulário de Contato (Salva no D1 e notifica os 3 destinatários)
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
        const createdAt = new Date().toISOString();

        if (env.DB) {
          try {
            await env.DB.prepare(
              `INSERT INTO leads (
                created_at, name, phone, email, preferred_contact, message, consent,
                source_page, referrer, utm_source, utm_medium, utm_campaign, utm_content,
                ip_hash, status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
              createdAt,
              name,
              phone,
              email || null,
              preferredContact,
              message || null,
              consent ? 1 : 0,
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
            console.error("Erro ao persistir lead no D1:", dbErr);
          }
        }

        // Dispara o e-mail de notificação imediata
        await notifyLead(env, {
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
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleWeeklyWhatsAppReport(env));
  }
};
