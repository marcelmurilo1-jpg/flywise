# FlyWise

FlyWise é um assistente inteligente de viagens para o viajante brasileiro. A plataforma reúne busca de voos, gerenciamento de milhas, monitoramento de promoções, estratégias geradas por IA e planejamento de roteiros — tudo em um único lugar.

## Servicos

### Busca de Voos
Busca de passagens aéreas em tempo real via Amadeus API. Suporta voos de ida, ida e volta, filtros por cabine, número de escalas e datas. Os resultados são salvos por busca, permitindo comparação histórica.

### Estratégia com IA
Para qualquer voo encontrado, o usuário pode acionar uma análise gerada por GPT-4o-mini. A IA considera o voo selecionado, as promoções ativas no banco e o saldo de milhas do usuário para recomendar o melhor programa de fidelidade, estimar a economia em relação ao preço cash e gerar um plano passo a passo para emissão do bilhete. As estratégias geradas podem ser salvas no histórico.

### Carteira de Milhas
Painel para o usuário registrar e visualizar seus saldos nos principais programas de fidelidade brasileiros: Smiles, LATAM Pass, TudoAzul, Livelo, entre outros. O saldo é usado como contexto pela IA ao gerar estratégias.

### Promoções em Tempo Real
Scraper diário que coleta promoções de passagens e milhas de sites especializados (ex: Passageiro de Primeira). As promoções são classificadas por programa, categoria e validade, e ficam disponíveis na aba de promoções do app.

### Alertas por E-mail
Sistema de notificação que cruza as promoções novas com as preferências de cada usuário (categorias de interesse, programas favoritos) e envia e-mails personalizados via Resend. Cada usuário recebe apenas o que é relevante para ele.

### Roteiro Inteligente
Geração de roteiros de viagem via IA com base no destino e nas preferências do usuário. O roteiro é salvo e pode ser consultado posteriormente.

### Busca Avancada
Wizard de busca com controles mais detalhados para usuários que querem refinar origem, destino, datas e preferências antes de iniciar a pesquisa.

### Planos e Assinatura
Pagina de planos com diferentes níveis de acesso à plataforma, com fluxo de checkout integrado.

### Onboarding
Fluxo de configuração inicial para novos usuários, coletando preferências de programas de fidelidade e tipo de viagem para personalizar a experiência desde o primeiro acesso.

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Animacoes | Framer Motion |
| Backend/BaaS | Supabase (auth, banco, storage) |
| Edge Functions | Deno (Supabase Functions) |
| IA | OpenAI GPT-4o-mini |
| Voos | Amadeus Self-Service API |
| Scraper | Python + Railway (cron diario) |
| E-mail | Resend |

## Estrutura do projeto

```
flywise/
├── src/
│   ├── pages/          # Landing, Auth, Home, Resultados, Promotions,
│   │                   # Wallet, SavedStrategies, Roteiro, Configuracoes,
│   │                   # SearchWizard, Planos, Checkout, Onboarding
│   ├── components/     # StrategyPanel, FlightResultsGrouped, BottomNav, ...
│   ├── lib/
│   │   ├── amadeus.ts              # Busca de voos
│   │   ├── supabase.ts             # Client e tipos
│   │   ├── airlineMilesMapping.ts  # Mapa companhia -> programas aceitos
│   │   └── llm/                   # Builders de contexto para prompts de IA
│   └── contexts/       # AuthContext, ThemeContext
├── supabase/
│   ├── functions/
│   │   ├── strategy/       # Gera estrategia de milhas com GPT-4o-mini
│   │   ├── itinerary/      # Gera roteiro de viagem com IA
│   │   └── refresh-extras/ # Atualiza dados auxiliares
│   └── migrations/         # Schema SQL versionado
└── scraper/
    ├── scrape_passageiro.py        # Coleta promocoes de sites especializados
    ├── notify.py                   # Envia alertas de email via Resend
    ├── run.py                      # Entry point do scraper
    ├── migrate_db.py               # Migrations do banco do scraper
    ├── delete_expired_dryrun.py    # Lista promocoes expiradas (dry-run)
    ├── delete_expired_with_backup.py
    └── backend/                    # FastAPI hospedado no Railway
```

## Configuracao local

### Frontend

```bash
npm install
npm run dev
```

Crie `.env.local`:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_AMADEUS_CLIENT_ID=...
VITE_AMADEUS_CLIENT_SECRET=...
```

### Scraper

```bash
cd scraper
pip install -r requirements.txt
cp .env.example .env   # preencha DATABASE_URL, RESEND_API_KEY, FROM_EMAIL
python run.py          # scraper manual
python notify.py       # notificacoes manual
```

### Edge Functions

```bash
supabase functions deploy strategy
supabase functions deploy itinerary
supabase functions deploy refresh-extras
```

Secret necessario no Supabase Dashboard:

```
OPENAI_API_KEY
```

## Banco de dados

Migrations em `supabase/migrations/`, aplicadas em ordem.

| Tabela | Descricao |
|---|---|
| `buscas` | Buscas realizadas pelos usuarios |
| `resultados_voos` | Voos retornados pela Amadeus |
| `strategies` | Estrategias de milhas geradas pela IA |
| `promocoes` | Promocoes coletadas pelo scraper |
| `notification_preferences` | Preferencias de alerta por usuario |
| `user_profiles` | Perfil e plano do usuario |

## CI/CD

O scraper roda automaticamente via GitHub Actions com schedule diario, hospedado no Railway.
