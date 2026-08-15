# Prompt inicial para o Antigravity

Cole o texto abaixo depois de abrir esta pasta como projeto:

---

Você está trabalhando no novo site da Gaia Vida Ainda. Antes de alterar qualquer arquivo, leia integralmente `README.md`, `ANTIGRAVITY.md`, `GUIA-DE-EDICAO.md` e `CHECKLIST-PUBLICACAO.md`.

Este repositório já é uma primeira versão funcional em Astro + TypeScript + Tailwind, preparada para Cloudflare Workers, Static Assets, D1 e Turnstile. As fotografias em uso foram extraídas do site atual; o acervo original está separado em `media-library/`. O conteúdo editável está centralizado em `src/content/` para que as respostas futuras de Sara e Eve possam ser aplicadas sem reconstruir componentes.

Sua primeira tarefa é:

1. instalar as dependências;
2. executar `npm run check` e `npm run build`;
3. abrir a prévia e revisar desktop, tablet e celular;
4. preservar o conceito visual do croqui em `docs/croqui-referencia.png`;
5. melhorar a implementação somente onde necessário, mantendo conteúdo e mídia desacoplados;
6. listar tudo que ainda depende das respostas de Sara e Eve;
7. não publicar, criar domínio, configurar cobrança, conectar e-mail ou usar imagens com pessoas sem autorização expressa.

Regras críticas:

- Não copie o site Arte & Cuidar. Ele foi apenas referência conceitual de galeria, vídeo, prova social e conversão.
- Não invente fatos, equipe, rotina, capacidade, preços, licenças, depoimentos, horários ou promessas.
- Mantenha `PUBLIC_REVIEW_MODE=true` até aprovação final.
- Não substitua a stack nem adicione serviços pagos sem aprovação.
- Preserve Turnstile no servidor, honeypot, rate limit, coleta mínima e leads no D1.
- Não publique dados médicos no formulário e não grave IP bruto.
- Não remova redirecionamentos, SEO, acessibilidade ou a preparação para troca de domínio.

Ao terminar a primeira análise, apresente: alterações propostas, riscos, itens que dependem de decisão e a ordem segura de execução. Só então prossiga com mudanças que estejam dentro dessas regras.

---
