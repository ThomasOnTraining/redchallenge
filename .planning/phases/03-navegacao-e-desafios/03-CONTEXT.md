# Phase 3: Navegação Interativa e Área de Desafios Base - Context

**Gathered:** 2026-04-17
**Status:** Ready for planning
**Source:** ROADMAP.md & Requirements REQ-04, REQ-06, REQ-07

<domain>
## Phase Boundary
Esta fase implementa o sistema de navegação da aplicação (troca de views/abas sem recarregar a página física) e constrói a área principal focada nos "Desafios". Isso abrange a visualização gráfica dos diferentes tipos de desafios e formulários de resposta/quizzes básicos.
</domain>

<decisions>
## Implementation Decisions

### Navigation / Routing
- Não utilizaremos bibliotecas de roteamento pesadas (como React Router).  A navegação será feita trocando classes CSS (como `.hidden` ou `display: none`) nos containers principais (`main` feeds), agindo como uma Single Page Application simplificada (Vanilla SPA).
- As abas principais listadas na Bottom Navigation serão: Início (Feed), Desafios (Espadas cruzadas), e Perfil.

### Área de Desafios (DesafioHub)
- Os cards de desafios, diferentemente dos posts comuns, trarão um botão secundário robusto ("Participar") e terão o layout de cartão diferenciado (contorno neon ou cor em destaque baseada no tema).
- Será implementado um modal/overlay ou card expansivo específico para quando o usuário clicar em participar de um "Quiz rápido" ou "Pílula de Saber".

### Feedback Visual
- É mandatório ter transições de tela suaves (opacity fade-in/fade-out ou sliding sutil) ao trocar as abas.
</decisions>
