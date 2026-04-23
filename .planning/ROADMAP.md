# Project Roadmap

## Phase 1: Setup e Fundações
**Goal:** Criar as estruturas de arquivos, o layout principal base da página inicial, e a arquitetura de estilização fundamental (HTML/CSS global).
**Requirements:** REQ-01, REQ-05
**State:** Completed

## Phase 2: Feed Principal & Componentes Visuais
**Goal:** Implementar o formulário principal do feed, mock de dados dinâmico de posts em JavaScript (se necessário), cards de posts e botões de interação (curtir e comentar).
**Depends on:** Phase 1
**Requirements:** REQ-02, REQ-03
**State:** Completed

## Phase 3: Navegação Interativa e Área de Desafios Base
**Goal:** Implementar as áreas ativas de interatividade e a aba explícita dos desafios padrão (Pílulas de Saber e Quizzes rápidos).
**Depends on:** Phase 2
**Requirements:** REQ-04, REQ-06, REQ-07
**State:** Completed

## Phase 4: Gamificação Avançada
**Goal:** Projetar as mecânicas finais introduzidas: lógica visual do Duelo (1 vs 1) e da Barra de Progresso Colaborativa para os Desafios Sociais, integrando aos cards.
**Depends on:** Phase 3
**Requirements:** REQ-08
**State:** Completed

## Phase 5: Backend & System Integration (Security)
**Goal:** Implantar todo o controle do lado do servidor (Server-side) atômico, de submissão de posts, validações rígidas dos resultados de minigames/votações e proteção central contra XSS.
**Depends on:** Phase 4
**Requirements:** REQ-09, REQ-10, REQ-11
**State:** Completed
