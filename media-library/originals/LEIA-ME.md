# Novas fotos da fachada da Gaia — 2026

Estas cinco fotografias são cópias dos arquivos originais. Nesta entrega, somente os nomes foram alterados. Não houve recorte, redimensionamento, conversão, recompressão ou tratamento de imagem.

## Onde salvar no projeto

Extraia os cinco arquivos JPEG para:

`C:\Antigravity\Gaia\gaia-site-antigravity\media-library\originals\novas-fachadas-2026\`

Mantenha este diretório como acervo original. O Antigravity deverá criar versões otimizadas separadamente em `public/media/site/`, sem modificar estes arquivos.

## Mapa de uso recomendado

1. `01-fachada-principal-hero.jpeg`
   - Foto horizontal da fachada completa.
   - Uso principal: banner inicial estático.
   - Substituir somente a imagem do banner, preservando conteúdo, botões, dimensões e comportamento já existentes.

2. `02-fachada-ipe-amarelo.jpeg`
   - Foto vertical com o ipê amarelo florido.
   - Uso principal: seção “Cuidado que respeita cada história”.
   - Deve substituir a repetição atual da fotografia da sala.
   - Eventuais fios devem ser evitados apenas pelo enquadramento; não apagar ou reconstruir elementos com IA.

3. `03-entrada-gaia-numero-101.jpeg`
   - Foto vertical da entrada com placa e número 101.
   - Uso principal: galeria e futura área de localização/contato.

4. `04-fachada-lateral-jardim.jpeg`
   - Foto vertical em ângulo lateral com jardim e céu.
   - Uso principal: galeria “Conheça a Gaia”.

5. `05-fachada-frontal-jardim.jpeg`
   - Foto vertical frontal da fachada e jardim.
   - Uso principal: galeria “Conheça a Gaia”.

## Regras de segurança para a implementação

- Criar um novo ponto de restauração antes da alteração.
- Não excluir fotografias existentes; manter as antigas no acervo.
- Não alterar logo, textos, menus, botões, formulário, WhatsApp, rotas ou configurações do projeto.
- Não criar carrossel automático no banner.
- Não adicionar bibliotecas ou dependências.
- Gerar derivados otimizados sem sobrescrever os originais.
- Validar `npm run check` e `npm run build` antes e depois da alteração.
- Conferir desktop, tablet e celular, especialmente carregamento, recorte e legibilidade do banner.
- Não publicar o site nesta etapa.
