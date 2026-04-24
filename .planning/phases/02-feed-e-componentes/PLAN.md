# Phase 2: Feed Principal & Componentes Visuais - Plan

**Status:** Ready for Execution
**Context:** [02-CONTEXT.md](02-CONTEXT.md)

## Objective
Finalizar a conexão da interface principal (Feed) com a nova API (Express/SQLite) e garantir o funcionamento das interações básicas (Postagem e Curtidas), preenchendo as lacunas deixadas com os dados mockados temporários na Fase 1.

## Execution Steps

### 1. Finalização da Input Bar de Novos Posts
1.1. Adicionar classes visuais (Loading states) no botão de criar post enquanto a requisição à API é feita.
1.2. Refatorar `createPost()` no `script.js` para atualizar silenciosamente apenas a lista (ou injetar no DOM sem recarregar tudo), além de exibir erros em caso de falha de conexão.

### 2. Aperfeiçoamento da Renderização (Feed)
2.1. Implementar um esqueleto de carregamento (Skeleton loader) ou texto temporal na classe `feed-list` enquanto aguarda `fetchPosts()`.
2.2. Adaptar o template HTML (`#post-template`) para garantir que dados ausentes da API gerem fallbacks corretos no UI (ex: tempo relativo, caso não haja `image_url` a imagem não pode deixar um espaço branco quebrado).

### 3. Integração de 'Upvote / Downvote'
3.1. Capturar eventos de click nas setas `.upvote` e `.downvote` herdadas de cada cartão de post injetado.
3.2. Fazer uma chamada `POST /api/posts/:id/vote` e atualizar o elemento visual (`.vote-count`) localmente com base na resposta para evitar chamadas de fetch redundantes.
3.3. Marcar visualmente se o usuário curtiu com cor laranja (baseado na resposta futura persistente).

## Verification Strategy
- **Verificação Visual:** Inicializar `npm run dev` localmente, conectar via browser, e submeter 2 tipos de textos simulando os inputs de usuário.
- **Teste Reativo:** Clicar num upvote e verificar o debounce (se não falha em spam de cliques) e a persistência ao recarregar a tela (ainda rudimentar via SessionStorage caso o login real ainda não esteja lá).
