# Phase 2: Feed Principal & Componentes Visuais - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Source:** ROADMAP.md & Recent SQLite setup

<domain>
## Phase Boundary
O objetivo desta fase é integrar o formulário principal do feed e a listagem de posts à base de dados SQLite recém-criada, focando em renderização de UI, manipulação do DOM e a reatividade dos botões de interação (Curtir e Comentar).
</domain>

<decisions>
## Implementation Decisions

### Frontend-Backend Integration
- Ao invés de usar mocks no front (plano original), agora os dados serão trazidos através de `fetch('/api/posts')` usando a API Node.js desenvolvida.
- O formulário central ("Criar Postagem/Desafio") deverá validar no frontend se o título não está em branco antes de submeter ao backend via fetch (`POST /api/posts`).

### Interactivity
- **Curtidas (Upvote/Downvote):** Ao clicar, o feed atualiza de forma assíncrona o contador (chamando o endpoint `POST /api/posts/:id/vote`).
- **Comentários:** Nesta fase, iremos preparar o layout básico para expansão da área de comentários e garantir o contador no card. O sub-fórum completo pode entrar em fases posteriores.

### UI Enhancements
- Adicionar tratamento de "Loading" para os dados enquanto a API estiver processando.
- Utilizar `lucide.createIcons()` em cada nova injeção de DOM para renderizar corretamente as setas, favoritos e compartilhamento dos novos cartões.
</decisions>
