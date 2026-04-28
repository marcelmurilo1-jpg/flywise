# Para onde posso voar? Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Para onde posso voar?" tab in the Wallet page showing which destinations the user can reach with their current miles and active transfer promotions — divided into "Você pode voar agora" and "Quase lá" sections.

**Architecture:** Frontend-first classification — backend fetches Seats.aero availability (3 sample dates per month, pLimit(3) concurrency, 4h cache); the wallet data, card point balances, and transfer promo logic all run on the frontend. Destinations are a static curated list of ~150 IATAs grouped by region.

**Tech Stack:** React + TypeScript, Express, Seats.aero Partner API, Supabase (user_metadata for home airport + card points), existing `computeMiles` / `findPromotion` / `getClubTierBonus` from `transferData.ts`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/discoverDestinations.ts` | Create | Curated destination list + region helpers |
| `src/pages/Configuracoes.tsx` | Modify | Home airport field in "Viagem" section |
| `src/pages/Wallet.tsx` | Modify | Card point balances + 3rd tab |
| `src/pages/ParaOndeVoo.tsx` | Create | Filter bar, API call, classification, cards UI |
| `server.js` | Modify | `POST /api/discover-routes` endpoint |

---

## Task 1: Curated Destinations List

**Files:**
- Create: `src/lib/discoverDestinations.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/discoverDestinations.ts

export type Region =
    | 'nordeste'
    | 'sul_sudeste'
    | 'norte_co'
    | 'america_sul'
    | 'america_norte'
    | 'caribe'
    | 'europa'
    | 'oriente_medio'
    | 'asia_oceania'
    | 'africa'

export const REGION_LABELS: Record<Region, string> = {
    nordeste:       '🇧🇷 Nordeste',
    sul_sudeste:    '🇧🇷 Sul/Sudeste',
    norte_co:       '🇧🇷 Norte/Centro-Oeste',
    america_sul:    '🌎 América do Sul',
    america_norte:  '🌎 América do Norte',
    caribe:         '🏝️ Caribe',
    europa:         '🌍 Europa',
    oriente_medio:  '🌙 Oriente Médio',
    asia_oceania:   '🌏 Ásia/Oceania',
    africa:         '🌍 África',
}

export interface Destination {
    iata:   string
    name:   string
    city:   string   // displayed in card (e.g. "Salvador — BA")
    region: Region
    emoji:  string
}

export const DESTINATIONS: Destination[] = [
    // ── Nordeste ──────────────────────────────────────────────────────────────
    { iata:'SSA', name:'Salvador',      city:'Salvador — BA',       region:'nordeste',    emoji:'🌴' },
    { iata:'REC', name:'Recife',        city:'Recife — PE',         region:'nordeste',    emoji:'🌊' },
    { iata:'FOR', name:'Fortaleza',     city:'Fortaleza — CE',      region:'nordeste',    emoji:'🏖️' },
    { iata:'NAT', name:'Natal',         city:'Natal — RN',          region:'nordeste',    emoji:'🌅' },
    { iata:'MCZ', name:'Maceió',        city:'Maceió — AL',         region:'nordeste',    emoji:'🏝️' },
    { iata:'JPA', name:'João Pessoa',   city:'João Pessoa — PB',    region:'nordeste',    emoji:'🌴' },
    { iata:'AJU', name:'Aracaju',       city:'Aracaju — SE',        region:'nordeste',    emoji:'🌊' },
    { iata:'SLZ', name:'São Luís',      city:'São Luís — MA',       region:'nordeste',    emoji:'🏛️' },
    { iata:'THE', name:'Teresina',      city:'Teresina — PI',       region:'nordeste',    emoji:'🌵' },
    { iata:'IMP', name:'Imperatriz',    city:'Imperatriz — MA',     region:'nordeste',    emoji:'🌿' },
    { iata:'STM', name:'Santarém',      city:'Santarém — PA',       region:'nordeste',    emoji:'🌊' },
    { iata:'MCP', name:'Macapá',        city:'Macapá — AP',         region:'nordeste',    emoji:'🌿' },
    // ── Sul/Sudeste ───────────────────────────────────────────────────────────
    { iata:'GRU', name:'Guarulhos',       city:'São Paulo — SP',       region:'sul_sudeste', emoji:'🏙️' },
    { iata:'GIG', name:'Galeão',          city:'Rio de Janeiro — RJ',  region:'sul_sudeste', emoji:'🏖️' },
    { iata:'SDU', name:'Santos Dumont',   city:'Rio (centro) — RJ',    region:'sul_sudeste', emoji:'✈️' },
    { iata:'CNF', name:'Confins',         city:'Belo Horizonte — MG',  region:'sul_sudeste', emoji:'⛰️' },
    { iata:'VCP', name:'Viracopos',       city:'Campinas — SP',         region:'sul_sudeste', emoji:'✈️' },
    { iata:'VIX', name:'Eurico de Aguiar',city:'Vitória — ES',          region:'sul_sudeste', emoji:'🌊' },
    { iata:'POA', name:'Salgado Filho',   city:'Porto Alegre — RS',     region:'sul_sudeste', emoji:'🍷' },
    { iata:'CWB', name:'Afonso Pena',     city:'Curitiba — PR',         region:'sul_sudeste', emoji:'🌲' },
    { iata:'FLN', name:'Hercílio Luz',    city:'Florianópolis — SC',    region:'sul_sudeste', emoji:'🏖️' },
    { iata:'IGU', name:'Cataratas',       city:'Foz do Iguaçu — PR',   region:'sul_sudeste', emoji:'💧' },
    { iata:'LDB', name:'Londrina',        city:'Londrina — PR',         region:'sul_sudeste', emoji:'🌾' },
    { iata:'MGF', name:'Maringá',         city:'Maringá — PR',          region:'sul_sudeste', emoji:'🌾' },
    { iata:'JOI', name:'Joinville',       city:'Joinville — SC',        region:'sul_sudeste', emoji:'🌿' },
    { iata:'NVT', name:'Navegantes',      city:'Navegantes — SC',       region:'sul_sudeste', emoji:'🌊' },
    { iata:'UDI', name:'Uberlândia',      city:'Uberlândia — MG',       region:'sul_sudeste', emoji:'🌾' },
    { iata:'RAO', name:'Ribeirão Preto',  city:'Ribeirão Preto — SP',   region:'sul_sudeste', emoji:'🌾' },
    // ── Norte/Centro-Oeste ────────────────────────────────────────────────────
    { iata:'BSB', name:'Brasília',        city:'Brasília — DF',         region:'norte_co', emoji:'🏛️' },
    { iata:'GYN', name:'Santa Genoveva',  city:'Goiânia — GO',          region:'norte_co', emoji:'🌾' },
    { iata:'MAN', name:'Eduardo Gomes',   city:'Manaus — AM',            region:'norte_co', emoji:'🌿' },
    { iata:'BEL', name:'Val de Cans',     city:'Belém — PA',             region:'norte_co', emoji:'🌿' },
    { iata:'CGB', name:'Marechal Rondon', city:'Cuiabá — MT',            region:'norte_co', emoji:'🌾' },
    { iata:'CGR', name:'Campo Grande',    city:'Campo Grande — MS',      region:'norte_co', emoji:'🌾' },
    { iata:'PMW', name:'Palmas',          city:'Palmas — TO',            region:'norte_co', emoji:'🌿' },
    { iata:'PVH', name:'Belmonte',        city:'Porto Velho — RO',       region:'norte_co', emoji:'🌿' },
    { iata:'RBR', name:'Plácido de Castro',city:'Rio Branco — AC',       region:'norte_co', emoji:'🌿' },
    { iata:'BVB', name:'Atlas Brasil',    city:'Boa Vista — RR',         region:'norte_co', emoji:'🌿' },
    { iata:'CZS', name:'Cruzeiro do Sul', city:'Cruzeiro do Sul — AC',  region:'norte_co', emoji:'🌿' },
    { iata:'MAB', name:'Marabá',          city:'Marabá — PA',            region:'norte_co', emoji:'🌿' },
    // ── América do Sul ────────────────────────────────────────────────────────
    { iata:'EZE', name:'Ezeiza',           city:'Buenos Aires — AR', region:'america_sul', emoji:'🥩' },
    { iata:'SCL', name:'Arturo Merino',    city:'Santiago — CL',      region:'america_sul', emoji:'⛰️' },
    { iata:'LIM', name:'Jorge Chávez',     city:'Lima — PE',           region:'america_sul', emoji:'🏛️' },
    { iata:'BOG', name:'El Dorado',        city:'Bogotá — CO',         region:'america_sul', emoji:'🌸' },
    { iata:'MDE', name:'Olaya Herrera',    city:'Medellín — CO',       region:'america_sul', emoji:'🌸' },
    { iata:'CTG', name:'Rafael Núñez',     city:'Cartagena — CO',      region:'america_sul', emoji:'🏖️' },
    { iata:'CLO', name:'Alfonso Bonilla',  city:'Cali — CO',           region:'america_sul', emoji:'🌿' },
    { iata:'UIO', name:'Mariscal Sucre',   city:'Quito — EC',          region:'america_sul', emoji:'🌋' },
    { iata:'GYE', name:'José J. de Olmedo',city:'Guayaquil — EC',      region:'america_sul', emoji:'🌊' },
    { iata:'MVD', name:'Carrasco',         city:'Montevidéu — UY',     region:'america_sul', emoji:'🏙️' },
    { iata:'ASU', name:'Silvio Pettirossi',city:'Assunção — PY',       region:'america_sul', emoji:'🌿' },
    { iata:'CCS', name:'Simón Bolívar',    city:'Caracas — VE',        region:'america_sul', emoji:'🌴' },
    { iata:'LPB', name:'El Alto',          city:'La Paz — BO',         region:'america_sul', emoji:'⛰️' },
    { iata:'VVI', name:'Viru Viru',        city:'Santa Cruz — BO',     region:'america_sul', emoji:'🌿' },
    { iata:'CBB', name:'Jorge Wilstermann',city:'Cochabamba — BO',     region:'america_sul', emoji:'⛰️' },
    // ── América do Norte ──────────────────────────────────────────────────────
    { iata:'MIA', name:'Miami',            city:'Miami — EUA',          region:'america_norte', emoji:'🌴' },
    { iata:'JFK', name:'John F. Kennedy',  city:'Nova York — EUA',      region:'america_norte', emoji:'🗽' },
    { iata:'LAX', name:'Los Angeles',      city:'Los Angeles — EUA',    region:'america_norte', emoji:'🎬' },
    { iata:'MCO', name:'Orlando',          city:'Orlando — EUA',        region:'america_norte', emoji:'🎢' },
    { iata:'ORD', name:"O'Hare",           city:'Chicago — EUA',        region:'america_norte', emoji:'🏙️' },
    { iata:'IAH', name:'George Bush',      city:'Houston — EUA',        region:'america_norte', emoji:'🤠' },
    { iata:'ATL', name:'Hartsfield-Jackson',city:'Atlanta — EUA',       region:'america_norte', emoji:'✈️' },
    { iata:'BOS', name:'Logan',            city:'Boston — EUA',         region:'america_norte', emoji:'🦞' },
    { iata:'SFO', name:'San Francisco',    city:'San Francisco — EUA',  region:'america_norte', emoji:'🌉' },
    { iata:'LAS', name:'Harry Reid',       city:'Las Vegas — EUA',      region:'america_norte', emoji:'🎰' },
    { iata:'DFW', name:'Dallas Fort Worth',city:'Dallas — EUA',         region:'america_norte', emoji:'🤠' },
    { iata:'DEN', name:'Denver',           city:'Denver — EUA',         region:'america_norte', emoji:'⛰️' },
    { iata:'SEA', name:'Seattle-Tacoma',   city:'Seattle — EUA',        region:'america_norte', emoji:'☁️' },
    { iata:'PHX', name:'Phoenix',          city:'Phoenix — EUA',        region:'america_norte', emoji:'🌵' },
    { iata:'EWR', name:'Newark',           city:'Newark — EUA',         region:'america_norte', emoji:'🗽' },
    { iata:'DTW', name:'Detroit',          city:'Detroit — EUA',        region:'america_norte', emoji:'🚗' },
    { iata:'MSP', name:'Minneapolis',      city:'Minneapolis — EUA',    region:'america_norte', emoji:'❄️' },
    { iata:'CUN', name:'Cancún',           city:'Cancún — MX',          region:'america_norte', emoji:'🌮' },
    { iata:'MEX', name:'Benito Juárez',    city:'Cidade do México — MX',region:'america_norte', emoji:'🌮' },
    { iata:'GDL', name:'Don Miguel Hidalgo',city:'Guadalajara — MX',   region:'america_norte', emoji:'🌵' },
    { iata:'MTY', name:'Mariano Escobedo', city:'Monterrey — MX',       region:'america_norte', emoji:'🏙️' },
    { iata:'YYZ', name:'Pearson',          city:'Toronto — CA',         region:'america_norte', emoji:'🍁' },
    { iata:'YVR', name:'Vancouver',        city:'Vancouver — CA',       region:'america_norte', emoji:'🍁' },
    { iata:'YUL', name:'Trudeau',          city:'Montreal — CA',        region:'america_norte', emoji:'🍁' },
    // ── Caribe ────────────────────────────────────────────────────────────────
    { iata:'PUJ', name:'Punta Cana',      city:'Punta Cana — RD',  region:'caribe', emoji:'🏖️' },
    { iata:'HAV', name:'José Martí',      city:'Havana — CU',       region:'caribe', emoji:'🎺' },
    { iata:'NAS', name:'Lynden Pindling', city:'Nassau — BS',       region:'caribe', emoji:'🏝️' },
    { iata:'SJU', name:'Luis Muñoz Marín',city:'San Juan — PR',     region:'caribe', emoji:'🌴' },
    { iata:'AUA', name:'Reina Beatrix',   city:'Aruba — AW',        region:'caribe', emoji:'🏝️' },
    { iata:'CUR', name:'Hato',            city:'Curaçao — CW',      region:'caribe', emoji:'🏝️' },
    { iata:'BGI', name:'Grantley Adams',  city:'Bridgetown — BB',   region:'caribe', emoji:'🏖️' },
    { iata:'MBJ', name:'Sangster',        city:'Montego Bay — JM',  region:'caribe', emoji:'🎵' },
    { iata:'KIN', name:'Norman Manley',   city:'Kingston — JM',     region:'caribe', emoji:'🎵' },
    { iata:'GCM', name:'Owen Roberts',    city:'Grand Cayman — KY', region:'caribe', emoji:'🏝️' },
    { iata:'CZM', name:'Cozumel',         city:'Cozumel — MX',      region:'caribe', emoji:'🐠' },
    { iata:'STT', name:'Cyril E. King',   city:'St. Thomas — VI',   region:'caribe', emoji:'🌊' },
    { iata:'BDA', name:'L.F. Wade',       city:'Bermuda — BM',      region:'caribe', emoji:'🏝️' },
    // ── Europa ────────────────────────────────────────────────────────────────
    { iata:'LIS', name:'Humberto Delgado',city:'Lisboa — PT',       region:'europa', emoji:'🗼' },
    { iata:'MAD', name:'Barajas',          city:'Madrid — ES',       region:'europa', emoji:'🥘' },
    { iata:'CDG', name:'Charles de Gaulle',city:'Paris — FR',        region:'europa', emoji:'🗼' },
    { iata:'FCO', name:'Fiumicino',        city:'Roma — IT',         region:'europa', emoji:'🍕' },
    { iata:'LHR', name:'Heathrow',         city:'Londres — GB',      region:'europa', emoji:'💂' },
    { iata:'FRA', name:'Frankfurt',        city:'Frankfurt — DE',    region:'europa', emoji:'🍺' },
    { iata:'AMS', name:'Schiphol',         city:'Amsterdam — NL',    region:'europa', emoji:'🌷' },
    { iata:'BCN', name:'El Prat',          city:'Barcelona — ES',    region:'europa', emoji:'🎨' },
    { iata:'ZRH', name:'Zürich',           city:'Zurique — CH',      region:'europa', emoji:'🏔️' },
    { iata:'MUC', name:'Franz Josef Strauss',city:'Munique — DE',   region:'europa', emoji:'🍺' },
    { iata:'VIE', name:'Wien',             city:'Viena — AT',        region:'europa', emoji:'🎻' },
    { iata:'DUB', name:'Dublin',           city:'Dublin — IE',       region:'europa', emoji:'🍀' },
    { iata:'CPH', name:'Kastrup',          city:'Copenhague — DK',   region:'europa', emoji:'🧜' },
    { iata:'ARN', name:'Arlanda',          city:'Estocolmo — SE',    region:'europa', emoji:'🎯' },
    { iata:'OSL', name:'Gardermoen',       city:'Oslo — NO',         region:'europa', emoji:'🌄' },
    { iata:'HEL', name:'Helsinki-Vantaa', city:'Helsinque — FI',    region:'europa', emoji:'🦌' },
    { iata:'WAW', name:'Chopin',           city:'Varsóvia — PL',     region:'europa', emoji:'🥟' },
    { iata:'BUD', name:'Ferihegy',         city:'Budapeste — HU',    region:'europa', emoji:'🏰' },
    { iata:'PRG', name:'Václav Havel',     city:'Praga — CZ',        region:'europa', emoji:'🏰' },
    { iata:'MXP', name:'Malpensa',         city:'Milão — IT',        region:'europa', emoji:'👗' },
    { iata:'NCE', name:"Côte d'Azur",     city:'Nice — FR',         region:'europa', emoji:'🌊' },
    { iata:'ATH', name:'Eleftherios Venizelos',city:'Atenas — GR',  region:'europa', emoji:'🏛️' },
    { iata:'IST', name:'İstanbul',         city:'Istambul — TR',     region:'europa', emoji:'🕌' },
    { iata:'BER', name:'Brandenburg',      city:'Berlim — DE',       region:'europa', emoji:'🐻' },
    { iata:'BRU', name:'Zaventem',         city:'Bruxelas — BE',     region:'europa', emoji:'🍫' },
    { iata:'GVA', name:'Genebra',          city:'Genebra — CH',      region:'europa', emoji:'🕊️' },
    { iata:'EDI', name:'Edinburgh',        city:'Edimburgo — GB',    region:'europa', emoji:'🏴' },
    { iata:'LYS', name:'Saint-Exupéry',   city:'Lyon — FR',         region:'europa', emoji:'🍷' },
    { iata:'OTP', name:'Henri Coandă',     city:'Bucareste — RO',    region:'europa', emoji:'🏰' },
    { iata:'BEG', name:'Nikola Tesla',     city:'Belgrado — RS',     region:'europa', emoji:'⚡' },
    { iata:'KEF', name:'Keflavík',         city:'Reiquiavique — IS', region:'europa', emoji:'🌋' },
    { iata:'MLA', name:'Malta',            city:'Malta — MT',        region:'europa', emoji:'🏝️' },
    { iata:'TLL', name:'Lennart Meri',     city:'Tallinn — EE',      region:'europa', emoji:'🏰' },
    { iata:'RIX', name:'Riga',             city:'Riga — LV',         region:'europa', emoji:'🏰' },
    { iata:'VNO', name:'Vilnius',          city:'Vilnius — LT',      region:'europa', emoji:'🏰' },
    { iata:'LJU', name:'Jože Pučnik',      city:'Ljubljana — SI',    region:'europa', emoji:'🐉' },
    { iata:'BTS', name:'Milan R. Štefánik',city:'Bratislava — SK',  region:'europa', emoji:'🏰' },
    { iata:'LUX', name:'Luxembourg',       city:'Luxemburgo — LU',   region:'europa', emoji:'💎' },
    { iata:'TIA', name:'Nënë Tereza',      city:'Tirana — AL',       region:'europa', emoji:'🦅' },
    // ── Oriente Médio ─────────────────────────────────────────────────────────
    { iata:'DXB', name:'Dubai',        city:'Dubai — AE',       region:'oriente_medio', emoji:'🏙️' },
    { iata:'DOH', name:'Hamad',        city:'Doha — QA',        region:'oriente_medio', emoji:'🏟️' },
    { iata:'AUH', name:'Abu Dhabi',    city:'Abu Dhabi — AE',   region:'oriente_medio', emoji:'🏙️' },
    { iata:'RUH', name:'King Khalid',  city:'Riade — SA',       region:'oriente_medio', emoji:'🕌' },
    { iata:'AMM', name:'Queen Alia',   city:'Amã — JO',         region:'oriente_medio', emoji:'🏛️' },
    { iata:'BEY', name:'Rafic Hariri', city:'Beirute — LB',     region:'oriente_medio', emoji:'🌲' },
    { iata:'CAI', name:'Cairo',        city:'Cairo — EG',       region:'oriente_medio', emoji:'🏛️' },
    { iata:'TLV', name:'Ben Gurion',   city:'Tel Aviv — IL',    region:'oriente_medio', emoji:'✡️' },
    { iata:'MCT', name:'Muscat',       city:'Mascate — OM',     region:'oriente_medio', emoji:'🏰' },
    { iata:'KWI', name:'Kuwait',       city:'Kuwait City — KW', region:'oriente_medio', emoji:'🛢️' },
    // ── Ásia/Oceania ──────────────────────────────────────────────────────────
    { iata:'NRT', name:'Narita',             city:'Tóquio — JP',        region:'asia_oceania', emoji:'🗾' },
    { iata:'HND', name:'Haneda',             city:'Tóquio (centro) — JP',region:'asia_oceania',emoji:'🗾' },
    { iata:'KIX', name:'Kansai',             city:'Osaka — JP',          region:'asia_oceania', emoji:'⛩️' },
    { iata:'ICN', name:'Incheon',            city:'Seul — KR',           region:'asia_oceania', emoji:'🎎' },
    { iata:'SIN', name:'Changi',             city:'Singapura — SG',      region:'asia_oceania', emoji:'🦁' },
    { iata:'BKK', name:'Suvarnabhumi',       city:'Bangkok — TH',        region:'asia_oceania', emoji:'🐘' },
    { iata:'HKG', name:'Chek Lap Kok',       city:'Hong Kong — HK',      region:'asia_oceania', emoji:'🏙️' },
    { iata:'PEK', name:'Capital',            city:'Pequim — CN',         region:'asia_oceania', emoji:'🏯' },
    { iata:'PVG', name:'Pudong',             city:'Xangai — CN',         region:'asia_oceania', emoji:'🏙️' },
    { iata:'TPE', name:'Taoyuan',            city:'Taipei — TW',         region:'asia_oceania', emoji:'🏮' },
    { iata:'KUL', name:'KLIA',               city:'Kuala Lumpur — MY',   region:'asia_oceania', emoji:'🏙️' },
    { iata:'MNL', name:'Ninoy Aquino',       city:'Manila — PH',         region:'asia_oceania', emoji:'🌺' },
    { iata:'DEL', name:'Indira Gandhi',      city:'Nova Délhi — IN',     region:'asia_oceania', emoji:'🕌' },
    { iata:'BOM', name:'Chhatrapati Shivaji',city:'Mumbai — IN',         region:'asia_oceania', emoji:'🎬' },
    { iata:'SYD', name:'Kingsford Smith',    city:'Sydney — AU',         region:'asia_oceania', emoji:'🦘' },
    { iata:'MEL', name:'Melbourne',          city:'Melbourne — AU',      region:'asia_oceania', emoji:'🦘' },
    { iata:'AKL', name:'Auckland',           city:'Auckland — NZ',       region:'asia_oceania', emoji:'🥝' },
    { iata:'CGK', name:'Soekarno-Hatta',     city:'Jakarta — ID',        region:'asia_oceania', emoji:'🏝️' },
    { iata:'DPS', name:'Ngurah Rai',         city:'Bali — ID',           region:'asia_oceania', emoji:'🌺' },
    { iata:'HAN', name:'Nội Bài',            city:'Hanói — VN',          region:'asia_oceania', emoji:'🍜' },
    { iata:'SGN', name:'Tân Sơn Nhất',       city:'Ho Chi Minh — VN',    region:'asia_oceania', emoji:'🍜' },
    { iata:'CMB', name:'Bandaranaike',        city:'Colombo — LK',        region:'asia_oceania', emoji:'🍵' },
    { iata:'PNH', name:'Phnom Penh',          city:'Phnom Penh — KH',     region:'asia_oceania', emoji:'🏛️' },
    { iata:'KTM', name:'Tribhuvan',           city:'Catmandu — NP',       region:'asia_oceania', emoji:'🏔️' },
    { iata:'PER', name:'Perth',               city:'Perth — AU',          region:'asia_oceania', emoji:'🦘' },
    { iata:'BNE', name:'Brisbane',            city:'Brisbane — AU',       region:'asia_oceania', emoji:'🦘' },
    // ── África ────────────────────────────────────────────────────────────────
    { iata:'JNB', name:'O.R. Tambo',            city:'Joanesburgo — ZA', region:'africa', emoji:'🦁' },
    { iata:'CPT', name:'Cape Town',              city:'Cidade do Cabo — ZA',region:'africa',emoji:'🏔️' },
    { iata:'ADD', name:'Bole',                   city:'Adis Abeba — ET',  region:'africa', emoji:'🦒' },
    { iata:'NBO', name:'Jomo Kenyatta',          city:'Nairóbi — KE',     region:'africa', emoji:'🦒' },
    { iata:'LOS', name:'Murtala Muhammed',       city:'Lagos — NG',       region:'africa', emoji:'🌍' },
    { iata:'ABV', name:'Nnamdi Azikiwe',         city:'Abuja — NG',       region:'africa', emoji:'🌍' },
    { iata:'CMN', name:'Mohammed V',             city:'Casablanca — MA',  region:'africa', emoji:'🕌' },
    { iata:'DKR', name:'Léopold Sédar Senghor', city:'Dacar — SN',       region:'africa', emoji:'🌍' },
    { iata:'ACC', name:'Kotoka',                 city:'Acra — GH',        region:'africa', emoji:'🌍' },
    { iata:'MPM', name:'Maputo',                 city:'Maputo — MZ',      region:'africa', emoji:'🌍' },
    { iata:'LAD', name:'Quatro de Fevereiro',    city:'Luanda — AO',      region:'africa', emoji:'🌍' },
    { iata:'TUN', name:'Tunis-Carthage',         city:'Tunis — TN',       region:'africa', emoji:'🏛️' },
    { iata:'ALG', name:'Houari Boumediene',      city:'Argel — DZ',       region:'africa', emoji:'🏛️' },
    { iata:'DAR', name:'Julius Nyerere',         city:'Dar es Salaam — TZ',region:'africa',emoji:'🦒' },
    { iata:'LUN', name:'Kenneth Kaunda',         city:'Lusaca — ZM',      region:'africa', emoji:'🌍' },
]

export function getDestinationsByRegions(regions: Region[]): Destination[] {
    if (regions.length === 0) return DESTINATIONS
    return DESTINATIONS.filter(d => regions.includes(d.region))
}

export function getDestinationByIata(iata: string): Destination | undefined {
    return DESTINATIONS.find(d => d.iata === iata)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/discoverDestinations.ts
git commit -m "feat(discover): add curated destination list with 150 destinations across 10 regions"
```

---

## Task 2: Home Airport in Settings

**Files:**
- Modify: `src/pages/Configuracoes.tsx`

Read the current "viagem" section in Configurações.tsx to find the insertion point, then add the home airport field after the existing `preferred_currency` field.

- [ ] **Step 1: Add home airport state + save logic**

In `Configuracoes.tsx`, find where `UserProfile` is defined and add `home_airport` and `home_airport_label` to it, then add state and save logic. Find the `SectionId` type definition area and make the following additions:

In the `UserProfile` interface (after `preferred_currency: string`):
```typescript
    home_airport: string        // IATA code e.g. "GRU"
    home_airport_label: string  // display e.g. "Guarulhos, São Paulo"
    home_airport_lock: boolean  // true = always use this airport
```

In the component, add alongside the other profile state loading (inside the `useEffect` that loads user data):
```typescript
home_airport:       (user.user_metadata?.home_airport as string)       ?? '',
home_airport_label: (user.user_metadata?.home_airport_label as string) ?? '',
home_airport_lock:  (user.user_metadata?.home_airport_lock as boolean) ?? true,
```

In the save function (where it calls `supabase.auth.updateUser`), add to the `data.user_metadata` object:
```typescript
home_airport:       profile.home_airport,
home_airport_label: profile.home_airport_label,
home_airport_lock:  profile.home_airport_lock,
```

- [ ] **Step 2: Add airport UI in the "viagem" section**

Find the section with `id === 'viagem'` in the JSX and add below the existing currency field:

```tsx
{/* ── Aeroporto de origem padrão ── */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
        Aeroporto de origem padrão
    </label>
    <AirportInput
        value={profile.home_airport_label}
        onChange={(label, iata) => setProfile(p => ({
            ...p,
            home_airport: iata,
            home_airport_label: label,
        }))}
        placeholder="Ex: GRU — Guarulhos, São Paulo"
    />
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#64748B' }}>
        <input
            type="checkbox"
            checked={profile.home_airport_lock}
            onChange={e => setProfile(p => ({ ...p, home_airport_lock: e.target.checked }))}
        />
        Usar sempre este aeroporto (pode alterar na busca)
    </label>
</div>
```

Add the import at the top of Configuracoes.tsx (alongside other imports):
```typescript
import { AirportInput } from '@/components/AirportInput'
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Configuracoes.tsx
git commit -m "feat(settings): add home airport configuration with lock toggle"
```

---

## Task 3: Card Point Balances in Wallet

**Files:**
- Modify: `src/pages/Wallet.tsx`

The Wallet already tracks `activeCards: string[]` (which cards the user has). We add `cardPoints: Record<string, number>` (point balance per card) stored in `user_metadata.card_points`.

- [ ] **Step 1: Add cardPoints state**

In `Wallet.tsx`, find where `activeCards` state is declared and add alongside it:
```typescript
const [cardPoints, setCardPoints] = useState<Record<string, number>>({})
```

In the `useEffect` that reads `user.user_metadata`, add:
```typescript
const pts: Record<string, number> = (user.user_metadata?.card_points as Record<string, number>) ?? {}
setCardPoints(pts)
```

- [ ] **Step 2: Add save function for card points**

After the existing `saveMiles` function, add:
```typescript
const saveCardPoints = async (updated: Record<string, number>) => {
    setCardPoints(updated)
    await supabase.auth.updateUser({
        data: { ...user!.user_metadata, card_points: updated },
    })
}
```

- [ ] **Step 3: Add card points UI in the cards section**

In the Wallet JSX, find the section that renders `activeCards` (inside `cardsExpanded`). After each active card's display, add an inline points balance input:

```tsx
{activeCards.map(cardId => {
    const card = CREDIT_CARDS.find(c => c.id === cardId)
    if (!card) return null
    return (
        <div key={cardId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2EAF5' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#0E2A55' }}>{card.name}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                    type="number"
                    min={0}
                    placeholder="Pontos"
                    value={cardPoints[cardId] ?? ''}
                    onChange={e => {
                        const val = parseInt(e.target.value) || 0
                        saveCardPoints({ ...cardPoints, [cardId]: val })
                    }}
                    style={{
                        width: 110, padding: '6px 10px', borderRadius: 8,
                        border: '1.5px solid #D1E0F5', fontSize: 13,
                        color: '#0E2A55', fontFamily: 'inherit', textAlign: 'right',
                    }}
                />
                <span style={{ fontSize: 12, color: '#64748B' }}>pts</span>
            </div>
        </div>
    )
})}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Wallet.tsx
git commit -m "feat(wallet): add card point balance tracking per active card"
```

---

## Task 4: Backend — `POST /api/discover-routes`

**Files:**
- Modify: `server.js`

Add this endpoint after the existing `/api/search-flights` endpoint (around line 315).

- [ ] **Step 1: Add the endpoint**

```javascript
// ─── Discover Routes — "Para onde posso voar?" ───────────────────────────────
// POST /api/discover-routes
// Body: { origin: string, destinations: string[], months: string[], cabin: 'economy'|'business' }
// Returns: { routes: RouteResult[] }
// RouteResult: { destination, results_by_program: ProgramResult[] }
// ProgramResult: { source, programName, economy_miles, business_miles, economy_direct, business_direct, sampleDate }
app.post('/api/discover-routes', async (req, res) => {
    const { origin, destinations, months, cabin = 'economy' } = req.body ?? {};

    if (!SEATS_AERO_API_KEY) {
        return res.status(200).json({ error: 'SEATS_AERO_API_KEY não configurada.', routes: [] });
    }
    if (!origin || !Array.isArray(destinations) || destinations.length === 0 || !Array.isArray(months) || months.length === 0) {
        return res.status(400).json({ error: 'origin, destinations[] e months[] são obrigatórios' });
    }

    const DISCOVER_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

    // Generate 3 sample dates per month: day 5, 15, 25
    function getSampleDates(months) {
        const dates = [];
        for (const m of months) {
            // m is "YYYY-MM"
            dates.push(`${m}-05`, `${m}-15`, `${m}-25`);
        }
        return dates;
    }

    const sampleDates = getSampleDates(months);
    const discoverLimit = pLimit(3); // reuse existing pLimit import

    const tasks = destinations.map(destination => discoverLimit(async () => {
        const byProgram = {}; // source → ProgramResult

        for (const date of sampleDates) {
            // 1. Check cache (4h TTL)
            let items = null;
            if (supabase) {
                const ttlLimit = new Date(Date.now() - DISCOVER_TTL_MS).toISOString();
                const { data: cached } = await supabase
                    .from('seatsaero_searches')
                    .select('dados')
                    .eq('origem', origin.toUpperCase())
                    .eq('destino', destination.toUpperCase())
                    .eq('data_ida', date)
                    .gte('criado_em', ttlLimit)
                    .order('criado_em', { ascending: false })
                    .limit(1)
                    .single();
                if (cached?.dados) items = cached.dados;
            }

            // 2. Fetch from Seats.aero on cache miss
            if (!items) {
                try {
                    const raw = await fetchSeatsAeroAPI(origin.toUpperCase(), destination.toUpperCase(), date);
                    items = raw.map(i => mapSeatsAeroItem(i, 'ida'));
                    // Save to cache
                    if (supabase && items.length > 0) {
                        await supabase.from('seatsaero_searches').insert([{
                            origem: origin.toUpperCase(),
                            destino: destination.toUpperCase(),
                            data_ida: date,
                            dados: items,
                        }]).then(({ error }) => {
                            if (error && error.code !== '23505') // ignore unique constraint violations
                                console.warn(`[Discover] Cache write error ${origin}→${destination}:`, error.message);
                        });
                    }
                } catch (e) {
                    console.warn(`[Discover] ${origin}→${destination} ${date}:`, e.message);
                    continue;
                }
            }

            // 3. Group by program, keep best (lowest) miles per cabin
            for (const item of (items ?? [])) {
                const src = (item.source ?? 'unknown').toLowerCase();
                if (!byProgram[src]) {
                    byProgram[src] = {
                        source: item.source ?? '',
                        programName: item.programName ?? item.source ?? '',
                        economy_miles: null,
                        business_miles: null,
                        economy_direct: false,
                        business_direct: false,
                        sampleDate: date,
                    };
                }
                const p = byProgram[src];
                if (item.economy != null && (p.economy_miles === null || item.economy < p.economy_miles)) {
                    p.economy_miles = item.economy;
                    p.economy_direct = item.paradas === 0;
                    p.sampleDate = date;
                }
                if (item.business != null && (p.business_miles === null || item.business < p.business_miles)) {
                    p.business_miles = item.business;
                    p.business_direct = item.paradas === 0;
                }
            }
        }

        // Filter: only include programs that have data for requested cabin
        const results = Object.values(byProgram).filter(p =>
            cabin === 'business' ? p.business_miles != null : p.economy_miles != null
        );

        return results.length > 0 ? { destination, results_by_program: results } : null;
    }));

    const settled = await Promise.all(tasks);
    const routes = settled.filter(Boolean);
    res.json({ routes });
});
```

- [ ] **Step 2: Test the endpoint manually**

Start the server locally and run:
```bash
curl -s -X POST http://localhost:3001/api/discover-routes \
  -H "Content-Type: application/json" \
  -d '{"origin":"GRU","destinations":["SSA","FOR"],"months":["2026-10"],"cabin":"economy"}' \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const r=JSON.parse(d); console.log('routes:', r.routes?.length, JSON.stringify(r.routes?.[0], null, 2).slice(0,400))"
```

Expected: JSON with `routes` array, each entry having `destination` and `results_by_program`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): add POST /api/discover-routes with 3-date sampling and 4h cache"
```

---

## Task 5: `ParaOndeVoo.tsx` — Core Component

**Files:**
- Create: `src/pages/ParaOndeVoo.tsx`

- [ ] **Step 1: Create the component with types and classification logic**

```tsx
// src/pages/ParaOndeVoo.tsx
import { useState, useEffect, useMemo } from 'react'
import { Loader2, MapPin, Plane, Zap, AlertCircle, Lock, ChevronDown } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import {
    DESTINATIONS, REGION_LABELS, getDestinationsByRegions,
    type Region, type Destination,
} from '@/lib/discoverDestinations'
import {
    CREDIT_CARDS, ACTIVE_PROMOTIONS,
    computeMiles, findPromotion, getClubTierBonus,
    type TransferPromotion,
} from '@/lib/transferData'
import { PROGRAMS } from '@/lib/airlineMilesMapping'

// ─── Types ─────────────────────────────────────────────────────────────────────

type MilesMap = Record<string, number>
type CardPoints = Record<string, number>

interface ProgramResult {
    source: string
    programName: string
    economy_miles: number | null
    business_miles: number | null
    economy_direct: boolean
    business_direct: boolean
    sampleDate: string
}

interface RouteResult {
    destination: string
    results_by_program: ProgramResult[]
}

type ClassifyStatus =
    | { kind: 'direct';   programName: string; miles: number; isDirect: boolean }
    | { kind: 'transfer'; programName: string; miles: number; cardName: string; pointsNeeded: number; bonusPct: number; isDirect: boolean }
    | { kind: 'almost';   programName: string; miles: number; cardName: string | null; pointsNeeded: number | null; userHas: number | null; deficit: number; bonusPct: number | null }
    | { kind: 'far' }

interface ClassifiedRoute {
    destination: Destination
    status: ClassifyStatus
}

// ─── Classification Logic ──────────────────────────────────────────────────────

function classifyProgram(
    miles: number,
    programName: string,
    isDirect: boolean,
    wallet: { milesMap: MilesMap; cardPoints: CardPoints; activeCards: string[]; activeClubs: string[]; activeClubTiers: Record<string, string> },
    promos: TransferPromotion[],
): ClassifyStatus {
    // 1. Direct check
    const directBalance = wallet.milesMap[programName] ?? 0
    if (directBalance >= miles) {
        return { kind: 'direct', programName, miles, isDirect }
    }

    // 2. Transfer check — best available card with a path to this program
    let bestAlmost: Extract<ClassifyStatus, { kind: 'almost' }> | null = null

    for (const cardId of wallet.activeCards) {
        const card = CREDIT_CARDS.find(c => c.id === cardId)
        if (!card) continue
        const partner = card.partners.find(p => p.program === programName)
        if (!partner) continue

        // Find best tier the user qualifies for (tiers are best-first)
        const bestTier = partner.tiers.find(t => t.clubId === null || wallet.activeClubs.includes(t.clubId))
            ?? partner.tiers[partner.tiers.length - 1]

        const promo = findPromotion(cardId, programName, promos)
        const tierName = bestTier.clubId ? (wallet.activeClubTiers[bestTier.clubId] ?? null) : null
        const effectiveBonus = promo ? getClubTierBonus(promo, tierName) : bestTier.bonusPercent

        const userPts = wallet.cardPoints[cardId] ?? 0
        const milesFromUserPts = computeMiles(userPts, bestTier.ratio, effectiveBonus)

        if (milesFromUserPts >= miles) {
            // pointsNeeded: smallest integer where computeMiles >= miles
            const pointsNeeded = Math.ceil(miles * bestTier.ratio / (1 + effectiveBonus / 100))
            return { kind: 'transfer', programName, miles, cardName: card.name, pointsNeeded, bonusPct: effectiveBonus, isDirect }
        }

        // Almost: how far are they?
        const pointsNeeded = Math.ceil(miles * bestTier.ratio / (1 + effectiveBonus / 100))
        const deficit = pointsNeeded - userPts
        const deficitRatio = pointsNeeded > 0 ? deficit / pointsNeeded : 1

        if (deficitRatio <= 0.40) {
            const candidate: Extract<ClassifyStatus, { kind: 'almost' }> = {
                kind: 'almost', programName, miles, cardName: card.name,
                pointsNeeded, userHas: userPts, deficit, bonusPct: effectiveBonus,
            }
            if (!bestAlmost || deficit < (bestAlmost.deficit ?? Infinity)) bestAlmost = candidate
        }
    }

    // 3. Direct "almost there" (no transfer path works, but user is close on direct miles)
    if (directBalance > 0) {
        const deficit = miles - directBalance
        if (deficit / miles <= 0.40) {
            const candidate: Extract<ClassifyStatus, { kind: 'almost' }> = {
                kind: 'almost', programName, miles,
                cardName: null, pointsNeeded: null, userHas: directBalance, deficit, bonusPct: null,
            }
            if (!bestAlmost || deficit < (bestAlmost.deficit ?? Infinity)) bestAlmost = candidate
        }
    }

    return bestAlmost ?? { kind: 'far' }
}

// Classify a full route: find the best status across all programs
function classifyRoute(
    route: RouteResult,
    cabin: 'economy' | 'business',
    dest: Destination,
    wallet: { milesMap: MilesMap; cardPoints: CardPoints; activeCards: string[]; activeClubs: string[]; activeClubTiers: Record<string, string> },
    promos: TransferPromotion[],
): ClassifiedRoute | null {
    let best: ClassifyStatus = { kind: 'far' }
    const priority = { direct: 0, transfer: 1, almost: 2, far: 3 }

    for (const prog of route.results_by_program) {
        const miles = cabin === 'business' ? prog.business_miles : prog.economy_miles
        if (!miles) continue
        const isDirect = cabin === 'business' ? prog.business_direct : prog.economy_direct
        const status = classifyProgram(miles, prog.programName, isDirect, wallet, promos)
        if (priority[status.kind] < priority[best.kind]) best = status
    }

    if (best.kind === 'far') return null
    return { destination: dest, status: best }
}
```

- [ ] **Step 2: Add the component body with filters and API call**

Append to `ParaOndeVoo.tsx`:

```tsx
// ─── Component ─────────────────────────────────────────────────────────────────

interface Props {
    milesMap: MilesMap
    cardPoints: CardPoints
    activeCards: string[]
    activeClubs: string[]
    activeClubTiers: Record<string, string>
}

export default function ParaOndeVoo({ milesMap, cardPoints, activeCards, activeClubs, activeClubTiers }: Props) {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { plan } = usePlan()
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''

    // Home airport from user metadata
    const homeIata: string = (user?.user_metadata?.home_airport as string) ?? ''
    const homeLabel: string = (user?.user_metadata?.home_airport_label as string) ?? ''
    const homeLock: boolean = (user?.user_metadata?.home_airport_lock as boolean) ?? true

    const [originIata, setOriginIata] = useState(homeIata)
    const [originLabel, setOriginLabel] = useState(homeLabel)

    // Filters
    const [selectedMonths, setSelectedMonths] = useState<string[]>([])
    const [selectedRegions, setSelectedRegions] = useState<Region[]>([])
    const [cabin, setCabin] = useState<'economy' | 'business'>('economy')

    // Results
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [rawRoutes, setRawRoutes] = useState<RouteResult[]>([])

    // Live promos (same fetch as TransferSimulator)
    const [livePromos, setLivePromos] = useState<TransferPromotion[]>(ACTIVE_PROMOTIONS)
    useEffect(() => {
        fetch(`${apiBase}/api/transfer-promotions`)
            .then(r => r.json())
            .then(d => { if (Array.isArray(d.promotions) && d.promotions.length > 0) setLivePromos(d.promotions) })
            .catch(() => {})
    }, [])

    // Build month options for next 12 months
    const monthOptions = useMemo(() => {
        const now = new Date()
        return Array.from({ length: 12 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1)
            const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
            const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            return { value, label }
        })
    }, [])

    const toggleMonth = (m: string) =>
        setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])

    const toggleRegion = (r: Region) =>
        setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])

    // Classify routes using wallet + promos
    const wallet = { milesMap, cardPoints, activeCards, activeClubs, activeClubTiers }

    const classified = useMemo<ClassifiedRoute[]>(() => {
        return rawRoutes.flatMap(route => {
            const dest = DESTINATIONS.find(d => d.iata === route.destination)
            if (!dest) return []
            const result = classifyRoute(route, cabin, dest, wallet, livePromos)
            return result ? [result] : []
        })
    }, [rawRoutes, cabin, milesMap, cardPoints, activeCards, activeClubs, activeClubTiers, livePromos])

    const canFly = classified.filter(r => r.status.kind === 'direct' || r.status.kind === 'transfer')
    const almostThere = classified.filter(r => r.status.kind === 'almost')

    // Free plan: show only 5 total results
    const isFree = plan === 'free'
    const canFlyShow = isFree ? canFly.slice(0, 3) : canFly
    const almostShow = isFree ? almostThere.slice(0, Math.max(0, 5 - canFly.length)) : almostThere

    // Fetch from API
    async function search() {
        if (!originIata) { setError('Defina seu aeroporto de origem nas Configurações.'); return }
        if (selectedMonths.length === 0) { setError('Selecione pelo menos um mês.'); return }
        setError('')
        setLoading(true)
        setRawRoutes([])

        const destinations = getDestinationsByRegions(selectedRegions)
            .map(d => d.iata)
            .filter(iata => iata !== originIata)

        if (destinations.length === 0) { setLoading(false); setError('Selecione uma região.'); return }

        try {
            const res = await fetch(`${apiBase}/api/discover-routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: originIata, destinations, months: selectedMonths, cabin }),
            })
            if (!res.ok) throw new Error(`Erro ${res.status}`)
            const data = await res.json()
            setRawRoutes(data.routes ?? [])
        } catch (e: any) {
            setError(e.message ?? 'Erro ao buscar destinos.')
        } finally {
            setLoading(false)
        }
    }

    // No home airport configured
    if (!homeIata) {
        return (
            <div style={{ padding: '32px 0', textAlign: 'center', color: '#64748B' }}>
                <MapPin size={32} style={{ margin: '0 auto 12px', display: 'block', color: '#94A3B8' }} />
                <p style={{ fontWeight: 600, color: '#0E2A55', marginBottom: 8 }}>Aeroporto de origem não configurado</p>
                <p style={{ fontSize: 14, marginBottom: 16 }}>Defina seu aeroporto padrão nas Configurações para usar esta feature.</p>
                <button
                    onClick={() => navigate('/configuracoes')}
                    style={{ background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
                >
                    Ir para Configurações →
                </button>
            </div>
        )
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── Filter bar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: '#F8FAFC', borderRadius: 14, padding: 16, border: '1px solid #E2EAF5' }}>
                {/* Origin */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, color: '#64748B', minWidth: 60 }}>De:</span>
                    <span style={{ fontWeight: 700, color: '#0E2A55', fontSize: 14 }}>{originLabel || originIata}</span>
                    {!homeLock && (
                        <button style={{ marginLeft: 'auto', fontSize: 12, color: '#2A60C2', background: 'none', border: 'none', cursor: 'pointer' }}>
                            Alterar
                        </button>
                    )}
                </div>

                {/* Months */}
                <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Quando?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {monthOptions.map(m => (
                            <button
                                key={m.value}
                                onClick={() => toggleMonth(m.value)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                    background: selectedMonths.includes(m.value) ? '#2A60C2' : '#EEF2F8',
                                    color: selectedMonths.includes(m.value) ? '#fff' : '#0E2A55',
                                }}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Regions */}
                <div>
                    <div style={{ fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: 600 }}>Para onde?</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {(Object.keys(REGION_LABELS) as Region[]).map(r => (
                            <button
                                key={r}
                                onClick={() => toggleRegion(r)}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                    background: selectedRegions.includes(r) ? '#0E2A55' : '#EEF2F8',
                                    color: selectedRegions.includes(r) ? '#fff' : '#0E2A55',
                                }}
                            >
                                {REGION_LABELS[r]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Cabin */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Cabine:</span>
                    {(['economy', 'business'] as const).map(c => (
                        <button
                            key={c}
                            onClick={() => setCabin(c)}
                            style={{
                                padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                                background: cabin === c ? '#7C3AED' : '#EEF2F8',
                                color: cabin === c ? '#fff' : '#0E2A55',
                            }}
                        >
                            {c === 'economy' ? 'Economy' : 'Business'}
                        </button>
                    ))}
                </div>

                {/* Search button */}
                <button
                    onClick={search}
                    disabled={loading}
                    style={{
                        background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 12,
                        padding: '12px 0', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                >
                    {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Buscando...</> : '🔍 Buscar destinos'}
                </button>
            </div>

            {/* ── Error ── */}
            {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#EF4444', fontSize: 13 }}>
                    <AlertCircle size={16} /> {error}
                </div>
            )}

            {/* ── Results ── */}
            {!loading && rawRoutes.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {/* Você pode voar agora */}
                    {canFlyShow.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16 }}>✅</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>Você pode voar agora</span>
                                <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                    {canFly.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {canFlyShow.map(r => (
                                    <DiscoverCard key={r.destination.iata} route={r} cabin={cabin} onStrategy={() => navigate(`/resultados?orig=${originIata}&dest=${r.destination.iata}&date=${(r.status as any).sampleDate ?? ''}`)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Quase lá */}
                    {almostShow.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 16 }}>🔜</span>
                                <span style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>Quase lá</span>
                                <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                                    {almostThere.length}
                                </span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {almostShow.map(r => (
                                    <DiscoverCard key={r.destination.iata} route={r} cabin={cabin} onStrategy={() => navigate(`/resultados?orig=${originIata}&dest=${r.destination.iata}&date=${''}`)} />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Free plan teaser */}
                    {isFree && (canFly.length > canFlyShow.length || almostThere.length > almostShow.length) && (
                        <div style={{ textAlign: 'center', padding: '20px 16px', background: '#F8FAFC', borderRadius: 14, border: '1.5px dashed #D1E0F5' }}>
                            <Lock size={20} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                            <p style={{ fontWeight: 700, color: '#0E2A55', marginBottom: 4 }}>
                                +{(canFly.length - canFlyShow.length) + (almostThere.length - almostShow.length)} destinos encontrados
                            </p>
                            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>Desbloqueie todos os destinos com o plano Essencial</p>
                            <button onClick={() => navigate('/planos')} style={{ background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
                                Ver planos
                            </button>
                        </div>
                    )}

                    {canFly.length === 0 && almostThere.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 24, color: '#64748B', fontSize: 14 }}>
                            Nenhum destino alcançável com o saldo atual. Tente adicionar mais milhas ou pontos de cartão na sua carteira.
                        </div>
                    )}
                </div>
            )}

            {!loading && rawRoutes.length === 0 && !error && (
                <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8', fontSize: 14 }}>
                    Selecione os filtros e clique em buscar para ver seus destinos.
                </div>
            )}
        </div>
    )
}
```

- [ ] **Step 3: Add the DiscoverCard component**

Append to `ParaOndeVoo.tsx`:

```tsx
// ─── DiscoverCard ──────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('pt-BR') }

function DiscoverCard({ route, cabin, onStrategy }: { route: ClassifiedRoute; cabin: string; onStrategy: () => void }) {
    const { destination: dest, status } = route
    const miles = 'miles' in status ? status.miles : 0

    return (
        <div style={{
            background: '#fff', borderRadius: 14, padding: '14px 16px',
            border: '1.5px solid #E2EAF5', boxShadow: '0 2px 8px rgba(14,42,85,0.06)',
            display: 'flex', flexDirection: 'column', gap: 10,
        }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 24 }}>{dest.emoji}</span>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: 15, color: '#0E2A55' }}>{dest.city}</div>
                        <div style={{ fontSize: 12, color: '#64748B' }}>
                            {'programName' in status ? status.programName : ''} · {cabin === 'economy' ? 'Economy' : 'Business'}
                            {'isDirect' in status && status.isDirect ? ' · Direto' : ''}
                        </div>
                    </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: '#0E2A55' }}>{fmt(miles)}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>milhas</div>
                </div>
            </div>

            {/* Status line */}
            {status.kind === 'direct' && (
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                    ✅ Você tem {fmt(miles)} milhas direto em {status.programName}
                </div>
            )}

            {status.kind === 'transfer' && (
                <div style={{ fontSize: 13, color: '#16A34A', fontWeight: 600 }}>
                    💡 Via {status.cardName} (bônus {status.bonusPct}%) → {fmt(status.pointsNeeded).toLocaleString()} pts = {fmt(miles)} milhas
                </div>
            )}

            {status.kind === 'almost' && status.cardName && status.pointsNeeded && status.userHas !== null && (
                <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                    🔜 Faltam {fmt(status.deficit)} pts de {status.cardName} (bônus {status.bonusPct ?? 0}%)
                </div>
            )}

            {status.kind === 'almost' && !status.cardName && status.userHas !== null && (
                <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>
                    🔜 Faltam {fmt(status.deficit)} milhas em {'programName' in status ? status.programName : ''}
                </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {status.kind === 'almost' && (
                    <button
                        onClick={() => window.open('/wallet', '_self')}
                        style={{ fontSize: 13, color: '#7C3AED', background: '#F5F3FF', border: 'none', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontWeight: 600 }}
                    >
                        Ver promoções
                    </button>
                )}
                <button
                    onClick={onStrategy}
                    style={{ fontSize: 13, color: '#fff', background: '#2A60C2', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontWeight: 600 }}
                >
                    Ver estratégia →
                </button>
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/ParaOndeVoo.tsx
git commit -m "feat(discover): add ParaOndeVoo component with filters, classification logic, and route cards"
```

---

## Task 6: Integrate Tab in Wallet

**Files:**
- Modify: `src/pages/Wallet.tsx`

- [ ] **Step 1: Add the import**

At the top of `Wallet.tsx`, add:
```typescript
import ParaOndeVoo from '@/pages/ParaOndeVoo'
```

- [ ] **Step 2: Add the new tab type**

Find `type Tab = 'carteira' | 'simulador'` and change to:
```typescript
type Tab = 'carteira' | 'simulador' | 'para_onde'
```

- [ ] **Step 3: Add the tab button**

Find the tab buttons JSX (the ones for `[Carteira]` and `[Simulador]`) and add after the Simulador button:
```tsx
<button
    onClick={() => setActiveTab('para_onde')}
    style={{
        padding: '10px 18px',
        borderRadius: 10,
        border: 'none',
        cursor: 'pointer',
        fontWeight: 700,
        fontSize: 14,
        background: activeTab === 'para_onde' ? '#0E2A55' : 'transparent',
        color: activeTab === 'para_onde' ? '#fff' : '#64748B',
        transition: 'all 0.15s',
    }}
>
    Para onde posso voar?
</button>
```

- [ ] **Step 4: Add the tab content**

Find where `activeTab === 'simulador'` renders `<TransferSimulator>` and add after it:
```tsx
{activeTab === 'para_onde' && (
    <ParaOndeVoo
        milesMap={miles}
        cardPoints={cardPoints}
        activeCards={activeCards}
        activeClubs={activeClubs}
        activeClubTiers={activeClubTiers}
    />
)}
```

- [ ] **Step 5: Verify the page loads without errors**

Open `/wallet` in the browser. Click "Para onde posso voar?" tab. Verify the filter bar appears and no console errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Wallet.tsx
git commit -m "feat(wallet): add 'Para onde posso voar?' tab integrating ParaOndeVoo component"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| ~150 curated destinations per region | Task 1 ✅ |
| Home airport in Configurações + lock toggle | Task 2 ✅ |
| Card point balances in Wallet | Task 3 ✅ |
| Backend `POST /api/discover-routes` with 3-date sampling (5, 15, 25) | Task 4 ✅ |
| `pLimit(3)` concurrency | Task 4 ✅ |
| 4h cache (reuses seatsaero_searches) | Task 4 ✅ |
| "Para onde posso voar?" tab in Wallet | Task 6 ✅ |
| Filter: months, regions, cabin | Task 5 ✅ |
| Classification: direct / via transfer with bonus / almost | Task 5 ✅ |
| "Você pode voar agora" + "Quase lá" sections | Task 5 ✅ |
| `computeMiles` / `findPromotion` / `getClubTierBonus` from transferData | Task 5 ✅ |
| Free plan teaser (5 results) | Task 5 ✅ |
| "Ver estratégia" button navigates to results | Task 5 ✅ |
| Transfer bonus example: 20k miles + 100% bonus = 10k pts | Logic in Task 5 ✅ |

**Placeholder scan:** No TBDs, no "implement later", all code is complete. ✅

**Type consistency:** `ClassifyStatus` defined in Task 5 Step 1, used in `DiscoverCard` in Step 3. `ClassifiedRoute` consistent throughout. `Props` interface matches what Wallet passes in Task 6. ✅
