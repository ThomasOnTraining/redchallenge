# Phase 3: Navegação Interativa e Área de Desafios Base - Plan

**Status:** Completed
**Context:** [03-CONTEXT.md](03-CONTEXT.md)

## Objective
Estabelecer um motor de rotas de página única (Vanilla SPA) fluído, que permita a navegação entre as telas de 'Feed Principal', 'Desafios', etc. Implementar também o layout da nova aba específica de Desafios, incluindo a renderização filtrada apenas para posts do tipo desafio na comunicação com nosso backend.

## Execution Steps

### 1. Sistema de Rotas Client-Side (Vanilla SPA)
1.1. Modificar o `index.html` para envolver as seções em "views" distintas (ex: `<div id="view-feed" class="view active">`, `<div id="view-challenges" class="view hidden">`).
1.2. Criar lógica em `script.js` para escutar clicks nos links de navegação (`.mobile-nav-item`, `.sidebar-widget links`) e trocar a view ativa com uma transição suave controlada via CSS (`opacity` e `.hidden`/`.active` classes).
1.3. Ajustar os itens de navegação (botões, barra lateral/aba inferior) para mostrar estados `.active` da view correspondente.

### 2. Nova Aba: Desafios
2.1. Criar o container HTML para a área de Desafios que trará os cabeçalhos próprios e instruções de gamificação.
2.2. Implementar a rotina em `script.js` para, ao renderizar a view de Desafios, buscar os conteúdos específicos na API `GET /api/posts` e filtrar `type === 'challenge'`. *(Futuramente o backend terá um endpoint dedicado, mas faremos filter no client ou adaptaremos o backend se fácil)*.
2.3. Estilizar cartões de Desafio de maneira mais destacada no CSS do que os "Posts Normais", usando bordas gradientes ou um visual distinto.

### 3. Formulário de Submissão Expandido
3.1. Adaptar a função `createPost()` para suportar um "Select" sutil (apenas em caso de view Desafio) ou via botões de abas (Post Normal x Propor Desafio), para que usuários da view enviem o tipo correto para a Base de Dados de forma limpa, ao invés do random atual.

## Verification Strategy
- **Verificação Visual:** Trocar entre a Home (Home Icon) e a aba de Desafios (Swords Icon) na nav mobile. Deve haver transição de tela macia.
- **Teste de Estado:** Validar na base SQLite local recarregando os posts e testando se cards com flag "challenge" estão sendo visualizados corretamente na aba de desafios.
