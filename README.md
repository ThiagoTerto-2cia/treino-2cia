# Treino 2ª CIA — versão 3

Versão gratuita e instalável (PWA) do app da academia da 2ª CIA / 4º BBM — Currais Novos.

## Avanços desta versão
- 69 exercícios já cadastrados
- Ilustrações provisórias de posição inicial e final em todos os exercícios
- Estrutura pronta para substituir as ilustrações pelas imagens finais
- Treinos A/B/C/D
- Cargas, repetições e histórico
- Cronômetro de descanso
- Painel de evolução e recordes
- Backup/importação do histórico
- 69 QR Codes gerados
- Página `qrcodes.html` pronta para impressão
- Funcionamento offline como PWA
- Custo de software/hospedagem inicial: pode ser R$ 0

## IMPORTANTE SOBRE OS QR CODES
Os QR Codes desta pasta apontam para `https://SEU-ENDERECO-AQUI/?exercise=ID`.
Eles são apenas uma prévia. Depois de publicar o app gratuitamente no GitHub Pages ou Cloudflare Pages, gere novamente os QR Codes usando o endereço real antes de imprimir e colar nos aparelhos.

## Teste local
Na pasta do projeto:
`python -m http.server 8000`

Depois abra `http://localhost:8000`.

## Próxima etapa
Substituir gradualmente os SVGs em `assets/exercises/` pelas imagens finais de cada movimento. O nome dos arquivos deve permanecer:
`ID-inicio.svg/png/jpg` e `ID-fim.svg/png/jpg`.
