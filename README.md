# FlyWise

FlyWise é uma plataforma completa de viagens para o viajante brasileiro. Reúne busca de voos em tempo real (cash e milhas), carteira de milhas, simulador de transferências, promoções atualizadas, estratégias geradas por IA, roteiros inteligentes, mapa-múndi de viagens e um módulo de intercâmbio médico — tudo em um único lugar.

---

## Funcionalidades

### Busca de Voos
Busca de passagens em tempo real com suporte a viagens de ida, ida e volta e múltiplos passageiros. Integra duas fontes:
- **Google Flights (scraper)** — preços em dinheiro (BRL) via Playwright + Chromium no Railway, com pool de user-agents e cache em memória de 4 horas (LRU, máx. 300 entradas)
- **Seats.aero Partner API** — disponibilidade de assentos em milhas, com cache de 10 minutos no banco

### Estratégia com IA
Para qualquer voo selecionado, a IA (GPT-4o-mini via Edge Function) analisa o voo, o saldo de milhas do usuário e as promoções ativas para recomendar o melhor programa de fidelidade, estimar a economia versus preço cash e gerar um plano passo a passo para emissão. As estratégias podem ser salvas no histórico.

### Busca Avançada por Chat
Interface conversacional em linguagem natural para buscas mais complexas. O modelo extrai aeroportos, datas, cabine e preferências da conversa e retorna os parâmetros estruturados para consulta no Seats.aero. Histórico de conversas salvo por usuário.

### Carteira de Milhas
Painel para registrar e acompanhar saldos em 16+ programas de fidelidade brasileiros (Smiles, LATAM Pass, TudoAzul, Livelo, entre outros). O saldo é usado como contexto nas estratégias de IA.

### Simulador de Transferências *(Pro/Elite)*
Calcula o melhor caminho de transferência entre programas de pontos, compara CPM (custo por milha) e exibe os bônus de transferência ativos — incluindo tiers de clube (Diamante, Ouro, Prata) e parcerias com Livelo.

### Promoções em Tempo Real
Scraper que coleta promoções de passagens e milhas de sites especializados via RSS. As promoções são classificadas por categoria (`milhas` / `passagens`), subcategoria e programa, e ficam disponíveis na aba Promoções do app.

### Alertas por E-mail
Sistema de notificação que cruza as promoções com as preferências de cada usuário (categorias, programas favoritos) e envia e-mails personalizados via Resend. Garante que cada usuário receba apenas o que é relevante, sem repetições.

### Roteiro Inteligente
Geração de roteiros dia a dia com IA a partir do destino, tipo de viajante e estilo de viagem. O roteiro inclui atividades com horários, mapa interativo (Leaflet) com os pontos marcados, seção de "extras" (gastronomia, cultura, natureza, compras) e exportação em PDF.

### Mapa-Múndi de Viagens
Mapa interativo com todos os países do mundo. O usuário marca destinos como visitados ou na lista de desejos, acompanha estatísticas por continente e percentual global visitado.

### Planos e Assinatura
Quatro planos: Grátis, Essencial (R$19/mês), Pro (R$39/mês) e Elite (R$69/mês) com desconto anual. Pagamento via PIX com geração de QR code, polling de status e confirmação automática.

### Onboarding
Fluxo de 5 etapas para novos usuários com vídeos explicativos de cada funcionalidade.

### Módulo C1 — Intercâmbio Médico
Módulo dedicado para estudantes de medicina gerenciarem o processo de intercâmbio:
- **Explorar Destinos** — catálogo de especialidades médicas e hospitais por cidade
- **Meu Intercâmbio** — workflow em 4 etapas (Documentos → Emails/CRM → Onboarding → Pré-Partida) com checklist de CV/PS/LoR, gestão de contatos de médicos, rastreio de status de e-mails e agendamento de follow-ups

### Painel Administrativo
Área restrita com listagem e busca de usuários, monitoramento de custos operacionais por serviço/categoria e controle de planos. Acesso controlado pela flag `is_admin` no perfil.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Estilização | Tailwind CSS v4 + Radix UI |
| Animações | Framer Motion |
| Mapas | React Leaflet + React Simple Maps + D3 Geo |
| Backend/BaaS | Supabase (auth, banco, storage, realtime) |
| API server | Node.js + Express 5 (Railway) |
| Edge Functions | Deno (Supabase Functions) |
| IA | OpenAI GPT-4o-mini |
| Voos (cash) | Google Flights (scraper via Playwright + Chromium) |
| Voos (milhas) | Seats.aero Partner API |
| Scraper | Python + Playwright + Railway cron |
| E-mail | Resend |
| Pagamentos | PIX via integração de billing |
| PDF | @react-pdf/renderer |

---

## Estrutura do Projeto

```
flywise/
├── src/
│   ├── pages/
│   │   ├── Home.tsx                  # Tela principal de busca
│   │   ├── Resultados.tsx            # Resultados de voos + painel de estratégia
│   │   ├── Promotions.tsx            # Galeria de promoções
│   │   ├── Wallet.tsx                # Carteira de milhas
│   │   ├── TransferSimulator.tsx     # Simulador de transferências
│   │   ├── ChatBuscaAvancada.tsx     # Busca avançada por chat com IA
│   │   ├── SearchWizard.tsx          # Wizard guiado de busca
│   │   ├── Roteiro.tsx               # Gerador de roteiros com mapa e PDF
│   │   ├── Mapa.tsx                  # Mapa-múndi de viagens visitadas
│   │   ├── SavedStrategies.tsx       # Histórico de estratégias e chats
│   │   ├── Configuracoes.tsx         # Configurações e preferências do usuário
│   │   ├── Planos.tsx                # Página de planos e assinatura
│   │   ├── Checkout.tsx              # Pagamento via PIX
│   │   ├── Onboarding.tsx            # Tutorial inicial para novos usuários
│   │   ├── Auth.tsx                  # Login e cadastro (email + Google OAuth)
│   │   ├── Landing.tsx               # Página pública de apresentação
│   │   ├── Admin.tsx                 # Painel administrativo
│   │   └── c1/
│   │       ├── ExploreDestinos.tsx   # Destinos de intercâmbio médico
│   │       └── MeuIntercambio.tsx    # Gestão pessoal do intercâmbio
│   ├── components/
│   │   ├── StrategyPanel.tsx         # Painel de estratégia de milhas com IA
│   │   ├── FlightResultsGrouped.tsx  # Lista de voos agrupados por preço/cabine
│   │   ├── PromotionsSection.tsx     # Grade de promoções com modal de detalhe
│   │   ├── Sidebar.tsx               # Filtros de voos (companhia, cabine, preço)
│   │   ├── AirportInput.tsx          # Input de aeroporto com autocomplete
│   │   ├── DateRangePicker.tsx       # Seletor de datas com calendário
│   │   ├── SearchBarTop.tsx          # Barra de busca persistente na tela de resultados
│   │   ├── SearchFormEnhanced.tsx    # Formulário de busca aprimorado
│   │   ├── Header.tsx                # Cabeçalho de navegação
│   │   ├── BottomNav.tsx             # Navegação inferior mobile
│   │   ├── RoteiroPDF.tsx            # Exportação de roteiro em PDF
│   │   ├── PlaneWindowLoader.tsx     # Loader animado com janela de avião
│   │   ├── AircraftReveal.tsx        # Hero animado com avião
│   │   ├── GlobeBackground.tsx       # Globo terrestre de fundo
│   │   ├── GlobeRoute.tsx            # Visualização de rota no globo
│   │   ├── NotificationSurvey.tsx    # Survey de opt-in de notificações
│   │   ├── SlidingNumber.tsx         # Número animado
│   │   └── ThemeToggle.tsx           # Alternador de tema claro/escuro
│   ├── contexts/
│   │   ├── AuthContext.tsx           # Autenticação (email/senha + Google OAuth)
│   │   ├── ThemeContext.tsx          # Tema claro/escuro
│   │   └── C1Context.tsx             # Estado do módulo de intercâmbio médico
│   ├── hooks/
│   │   ├── usePlan.ts                # Plano ativo, limites e contagem de uso
│   │   ├── useAdmin.ts               # Detecção de usuário admin
│   │   ├── useIsMobile.ts            # Detecção de dispositivo mobile
│   │   └── useNotificationSurvey.ts  # Controle de exibição do survey
│   └── lib/
│       ├── supabase.ts               # Client Supabase e tipos principais
│       ├── amadeus.ts                # Integração Amadeus API
│       ├── transferData.ts           # Dados de transferências entre programas
│       ├── airlineMilesMapping.ts    # Mapa companhia → programas aceitos
│       ├── mockFlights.ts            # Dados mock para desenvolvimento
│       └── llm/
│           ├── buildPrompt.ts        # Builder de prompt para estratégia
│           └── buildPromoContext.ts  # Builder de contexto de promoções para IA
├── supabase/
│   ├── functions/
│   │   ├── strategy/       # Gera estratégia de milhas com GPT-4o-mini
│   │   ├── chat-busca/     # Busca avançada por linguagem natural com IA
│   │   ├── itinerary/      # Gera roteiro de viagem com IA
│   │   └── refresh-extras/ # Regenera seção "extras" do roteiro
│   └── migrations/         # Schema SQL versionado (001→018)
├── scraper/
│   ├── run.py                        # Entry point — scraping + classificação
│   ├── scrape_passageiro.py          # Coleta promoções via RSS + Playwright
│   ├── notify.py                     # Envia alertas de e-mail via Resend
│   ├── migrate_db.py                 # Utilitário de migrations
│   ├── delete_expired_dryrun.py      # Preview de promoções expiradas
│   ├── delete_expired_with_backup.py # Deleta expiradas com backup
│   └── test_conn.py                  # Teste de conexão ao banco
└── server.js                         # API Express (Railway) — proxy de voos e scraping
```

---

## Banco de Dados

Migrations em `supabase/migrations/`, aplicadas em ordem numérica.

| Tabela | Descrição |
|---|---|
| `buscas` | Buscas realizadas pelos usuários (origem, destino, datas, passageiros, saldo de milhas) |
| `resultados_voos` | Voos retornados pelas APIs (Amadeus e Seats.aero) por busca |
| `strategies` | Estratégias de milhas geradas pela IA com texto e metadados |
| `itineraries` | Roteiros de viagem gerados pela IA em JSONB |
| `promocoes` | Promoções coletadas pelo scraper com categoria, subcategoria e tags de programas |
| `notification_preferences` | Preferências de alerta por usuário (categorias, programas, alertas) |
| `user_profiles` | Perfil estendido: plano, preferências, notificações, flag de admin |
| `user_promotion_log` | Registro de promoções já enviadas por usuário (evita duplicatas) |
| `seatsaero_searches` | Cache de buscas no Seats.aero (TTL de 10 minutos) |
| `chat_conversations` | Histórico de conversas da busca avançada por chat |
| `world_map_visits` | Países visitados e lista de desejos por usuário |
| `transfer_partners` | Dados de parceiros de transferência de milhas |
| `admin_costs` | Custos operacionais por serviço/categoria para o painel admin |

---

## Configuração Local

### Frontend

```bash
npm install
npm run dev
```

Crie `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SERVER_URL=...  # URL do servidor Express no Railway
```

### API Server (Express)

```bash
node server.js
# ou rode tudo junto:
npm run dev:all
```

Variáveis de ambiente necessárias no Railway:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SEATS_AERO_API_KEY=...
SYNC_SECRET=...
```

### Scraper (Python)

```bash
cd scraper
pip install -r requirements.txt
cp .env.example .env   # preencha DATABASE_URL, RESEND_API_KEY, FROM_EMAIL
python run.py          # execução manual do scraper
python notify.py       # envio manual de notificações
```

### Edge Functions

```bash
supabase functions deploy strategy
supabase functions deploy chat-busca
supabase functions deploy itinerary
supabase functions deploy refresh-extras
```

Secret necessário no Supabase Dashboard:

```
OPENAI_API_KEY
SEATS_AERO_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

---

## Deploy

| Serviço | Plataforma |
|---|---|
| Frontend | Vercel |
| API Server + Scraper | Railway |
| Banco de dados | Supabase Cloud |
| Edge Functions | Supabase Functions (Deno) |
| E-mail | Resend |

O scraper roda automaticamente via cron no Railway com schedule diário. As notificações de e-mail são disparadas em seguida pelo `notify.py`.
