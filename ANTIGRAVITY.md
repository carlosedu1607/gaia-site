# Instruções obrigatórias para o Antigravity

## Objetivo

Evoluir o projeto do novo site da Gaia Vida Ainda a partir desta base. O design precisa ser original da Gaia. O site Arte & Cuidar foi apenas referência de estratégia — galeria, vídeo, prova social e conversão — e não pode ter layout, texto, imagem, código ou identidade copiados.

## Stack já decidida

- Astro 7 + TypeScript estrito.
- Tailwind CSS 4, preservando os tokens visuais existentes.
- Saída majoritariamente estática.
- Cloudflare Workers + Static Assets.
- D1 apenas para leads e necessidades realmente dinâmicas.
- Turnstile obrigatório no formulário, com validação no servidor.
- Repositório privado no GitHub.
- Cloudflare Web Analytics e eventos próprios, sem cookies desnecessários.
- Serviço profissional de e-mail ainda será escolhido; manter a integração desacoplada.

Não introduzir WordPress, Elementor, banco de dados pesado, CMS pago, biblioteca de carrossel desnecessária, chat invasivo, autoplay com som ou dependência paga sem autorização expressa.

## Modelo de conteúdo e mídia

- Toda informação editável deve permanecer em `src/content/*.json`.
- Não espalhar telefone, endereço, horários ou textos comerciais nos componentes.
- Fotografias publicadas ficam em `public/media/site/`; originais ficam fora da pasta pública.
- Não editar destrutivamente os originais.
- Imagens com pessoas só podem ser habilitadas após autorização documentada.
- Usar WebP/AVIF responsivo, dimensões explícitas, `alt` descritivo e lazy loading fora da primeira tela.
- O hero não deve usar carrossel automático.
- A galeria deve ser manual, acessível por teclado e respeitar `prefers-reduced-motion`.
- Vídeo deve usar capa leve e carregar o player somente após clique.

## Conteúdo: regra de não invenção

Não inventar nem assumir como confirmado:

- rotina e horários;
- capacidade, vagas, preços e inclusões;
- equipe, cargos, escalas ou presença 24 horas;
- licenças, certificações ou promessas médicas;
- perfis/graus de dependência atendidos;
- depoimentos, avaliações ou autorizações;
- razão social, CNPJ e novo e-mail.

O conteúdo atual é rascunho extraído do site existente. Manter o modo de revisão até a validação de Sara e Eve.

## Formulário, LGPD e segurança

- Coletar somente nome, contato, preferência de retorno e mensagem curta.
- Não solicitar dados médicos ou documentos no primeiro contato.
- Turnstile deve ser validado no servidor; nunca confiar apenas no widget.
- Manter honeypot, limite de tentativas e validação no servidor.
- Não armazenar IP bruto; manter somente hash com salt secreto.
- D1 é a fonte de verdade. Falha de notificação por e-mail não pode apagar o lead.
- Segredos nunca entram no Git; usar `wrangler secret`/variáveis seguras.
- Definir retenção, exportação e exclusão de leads antes do lançamento.
- Política de privacidade precisa de revisão jurídica e dados do controlador.

## Limites da camada gratuita — fotografia de 15/08/2026

- Workers Free: até 100.000 requisições dinâmicas por dia; o site deve servir arquivos estaticamente sempre que possível.
- Static Assets: até 20.000 arquivos por versão e 25 MiB por arquivo no plano gratuito.
- D1 Free: até 10 bancos, 500 MB por banco, 5 GB por conta e recuperação de 7 dias.
- Worker Free: 50 subrequisições externas por execução; não criar cadeias de integrações.
- GitHub Free em repositório privado: 2.000 minutos de Actions/mês e 500 MB de artefatos; usar build/deploy enxuto e configurar orçamento para impedir cobrança inesperada.

Fontes oficiais para conferir novamente antes do deploy:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions

## SEO, migração e medição

- Preservar domínio atual até a migração terminar.
- Manter redirecionamentos 301 página a página.
- Validar DNS, MX, SPF, DKIM e DMARC antes da virada do domínio.
- Manter titles, descriptions, canonical, sitemap, robots e dados estruturados.
- Até confirmação do enquadramento, usar `LocalBusiness`; não declarar tipo clínico ou médico.
- Medir cliques de WhatsApp, formulário, agendamento, origem e UTMs.
- Não publicar o site final sem checklist de acessibilidade, celular, links, formulário, SEO, redirects e restauração de backup.

## Critérios de aceite

1. `npm run check` sem erros.
2. `npm run build` sem erros.
3. Lighthouse em celular com foco em desempenho, acessibilidade, boas práticas e SEO.
4. Navegação completa por teclado.
5. Formulário validado em ambiente Cloudflare, incluindo erro, sucesso, rate limit e Turnstile.
6. Nenhum conteúdo provisório publicado como fato confirmado.
7. Nenhuma foto sem autorização ou metadado sensível.
