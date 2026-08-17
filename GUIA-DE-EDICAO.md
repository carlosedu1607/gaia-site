# Guia rápido de edição

Este projeto foi organizado para que as respostas de Sara e Eve entrem sem reconstruir o site.

## Alterar uma informação

Abra `src/content/site.json`. Exemplos:

- WhatsApp e endereço: bloco `contact`.
- título principal e CTAs: bloco `hero`.
- serviços: bloco `services`.
- rotina de admissão: bloco `process`.
- dúvidas: bloco `faq`.

Textos mais longos das páginas ficam em `src/content/pages.json`.

## Trocar uma foto mantendo o mesmo espaço

1. Coloque as novas versões WebP em `public/media/site/`.
2. Gere preferencialmente duas larguras: `800` e `1600` pixels.
3. Atualize `src800`, `src1600`, `alt` e `caption` em `src/content/media.json`.
4. Mantenha `enabled: true` apenas nas imagens autorizadas.
5. Nunca publique uma foto com pessoas identificáveis sem autorização documentada.

Se quiser apenas substituir a foto sem editar JSON, preserve os nomes atuais.

## Aplicar as respostas de Sara e Eve

1. Atualize os dados confirmados em `site.json` e `pages.json`.
2. Remova expressões como “confirmar”, “validar” e “conteúdo preliminar”.
3. Ajuste o FAQ com as respostas aprovadas.
4. Inclua equipe e depoimentos somente com autorização.
5. Execute `npm run check` e `npm run build`.
6. Depois da aprovação final, configure `PUBLIC_REVIEW_MODE=false`.

## Itens que não devem ser improvisados

- Razão social, CNPJ, licenças e responsável legal.
- Capacidade, disponibilidade de vagas e valores.
- Profissionais, periodicidade e cobertura de cuidado.
- Horários de visitas, centro-dia e atendimento comercial.
- Condições de admissão e perfis que podem ou não ser atendidos.
- Política de retenção dos contatos e e-mail do titular de dados.

## Como atualizar o carrossel do Instagram

1. Salve as capas das publicações autorizadas em `public/media/instagram/`.
2. Adicione os registros em `src/content/instagram.json`.
3. Utilize os links permanentes das publicações (campo `permalink`).
4. Preencha os textos alternativos (`alt`) descrevendo a imagem com clareza.
5. Marque `authorized` como `true` somente após confirmação documentada de uso de imagem.
6. Marque `reviewStatus` como `"approved"` somente após revisão do conteúdo.
7. Ative a seção alterando `enabled` para `true` em `src/content/instagram.json`.
8. Mantenha no máximo seis publicações ativas ordenadas pela data mais recente.
9. Execute `npm run check` e `npm run build` antes da publicação para validar a integridade.
