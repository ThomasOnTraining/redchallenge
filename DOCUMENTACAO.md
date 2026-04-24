# QuestIt - Documentação do Sistema

Este documento fornece um registro detalhado do processo de criação, os requisitos e a descrição das funcionalidades do sistema **Questly**

---

## 1. Equipe do Projeto
*   **Andriellyn**
*   **Giovana**
*   **Ruan**
*   **Gabriel**
*   **Thomas**

---

## 2. Registro do Processo de Criação

O desenvolvimento do QuestIt foi dividido em fases estratégicas para garantir a entrega de um protótipo funcional e esteticamente premium:

1.  **Fase de Concepção e Planejamento**: Identificação do problema (uso passivo de redes sociais) e definição da solução (plataforma de desafios interativos). Criação dos documentos iniciais de requisitos e roadmap.
2.  **Configuração e Fundação (Setup)**: Inicialização do ambiente Node.js, configuração do banco de dados SQLite e definição da estrutura básica do frontend.
3.  **Desenvolvimento do Feed e Componentes**: Criação da interface de postagens inspirada no Reddit, implementação de sistemas de votos (upvotes/downvotes) e comentários.
4.  **Sistema de Desafios e Gamificação**: Implementação da lógica de desafios pessoais, colaborativos e duelos 1v1 (Jogo da Velha). Adição do sistema de pontos (XP) e ranking global.
5.  **Autenticação e Segurança**: Implementação de registro/login com senhas criptografadas (bcrypt), tokens de sessão (JWT) e proteção contra ataques comuns (XSS, Rate Limiting).
6.  **Refinamento de UI/UX**: Polimento visual com CSS moderno, ícones dinâmicos (Lucide) e transições suaves entre visualizações.

---

## 3. Requisitos do Sistema

### 3.1 Requisitos Funcionais (RF)
*   **RF-01**: O sistema deve permitir que usuários criem contas e façam login de forma segura.
*   **RF-02**: O sistema deve exibir um feed principal com postagens e desafios.
*   **RF-03**: O sistema deve permitir a criação de postagens simples e de desafios.
*   **RF-04**: O sistema deve permitir interações como curtir (upvote), descurtir (downvote) e comentar em posts.
*   **RF-05**: O sistema deve oferecer três tipos de desafios: Pessoais, Colaborativos e Duelos 1v1.
*   **RF-06**: O sistema deve gerenciar um ranking global baseado na pontuação (XP) dos usuários.
*   **RF-07**: O sistema deve permitir que usuários criem e participem de comunidades temáticas.
*   **RF-08**: O sistema deve enviar notificações internas para interações (votos, comentários).
*   **RF-09**: O sistema deve permitir que o usuário gerencie seu perfil (avatar, nome de usuário, senha).

### 3.2 Requisitos Não Funcionais (RNF)
*   **RNF-01**: A interface deve ser moderna, organizada e seguir uma estética premium (Dark Mode, cores consistentes).
*   **RNF-02**: O sistema deve garantir a integridade dos dados através de transações atômicas no banco de dados.
*   **RNF-03**: O sistema deve ser protegido contra injeção de scripts maliciosos (Sanitização Anti-XSS).
*   **RNF-04**: O carregamento da página e dos elementos deve ser rápido e eficiente.
*   **RNF-05**: As senhas devem ser armazenadas utilizando hashes seguros.

---

## 4. Descrição das Funcionalidades

### 4.1 Feed de Conteúdo
O coração da plataforma, onde os usuários podem visualizar postagens da comunidade. Cada post exibe o autor, tempo de publicação, título, conteúdo e métricas de interação.

### 4.2 Sistema de Desafios
*   **Desafios Pessoais**: O usuário se inscreve e faz "check-ins" diários para progredir e ganhar XP.
*   **Desafios Colaborativos**: Uma meta global onde todos os usuários contribuem para um objetivo comum.
*   **Duelos 1v1**: Um sistema de desafio direto entre dois usuários. Atualmente implementado com um **Jogo da Velha (Tic-Tac-Toe)** funcional, onde o vencedor ganha 50 XP.

### 4.3 Gamificação (XP e Ranking)
Ações na plataforma geram pontos de experiência:
*   Check-in em desafio: +10 XP.
*   Vencer um duelo: +50 XP.
Os usuários mais ativos aparecem no **Ranking Global** disponível na barra lateral.

### 4.4 Comunidades
Os usuários podem navegar por comunidades específicas, ver posts filtrados por tema e criar suas próprias comunidades com ícones e cores personalizadas.

### 4.5 Autenticação e Perfil
Sistema completo de gestão de identidade, permitindo personalização de avatar (via DiceBear API) e segurança total dos dados do usuário.

---

## 5. Estrutura Técnica

*   **Frontend**: HTML5, CSS3 (Vanilla), JavaScript (ES6+).
*   **Ícones**: Lucide Icons.
*   **Backend**: Node.js com framework Express.
*   **Banco de Dados**: SQLite3 (armazenamento persistente).
*   **Segurança**: JWT (JSON Web Tokens), bcryptjs (hashing), XSS (sanitização), Express Rate Limit.

---

## 6. Estrutura de Pastas
```text
Questly/
├── css/            # Estilos visuais (CSS)
├── js/             # Lógica do frontend (script.js)
├── server/         # Lógica do backend e API
│   ├── db.js       # Configuração e esquemas do banco
│   └── index.js    # Rotas e lógica do servidor
├── database/       # Arquivos de dados (SQLite)
├── .planning/      # Documentação de planejamento (GSD)
├── index.html      # Página principal única (SPA)
└── package.json    # Dependências e scripts do projeto
```
