import { createContext, useContext, useReducer, type ReactNode } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChecklistItem {
    id: string
    label: string
    done: boolean
    optional?: boolean
}

export interface Hospital {
    id: string
    name: string
    shortName: string
    city: string
    state: string
    coverImage: string
    specialty: string[]
    rating: number
    reviewCount: number
    costOfLiving: 'low' | 'medium' | 'high'
    climate: string
    description: string
    shadowing: boolean
    handsOn: boolean
    highlights: string[]
    mentorAvailable: boolean
    rankingsBySpecialty: Record<string, number>
}

export interface Contact {
    id: string
    name: string
    title: string
    email: string
    hospital: string
    department: string
    status: 'not_sent' | 'sent_1' | 'followup_1' | 'followup_2' | 'accepted' | 'rejected'
    notes: string
    createdAt: string
}

export interface FollowUpItem {
    id: string
    label: string
    date: string
    done: boolean
}

export type DoctorStatus = 'idle' | 'standby' | 'not_sent' | 'sent_1' | 'followup' | 'accepted' | 'rejected'

export interface Doctor {
    id: string
    name: string
    title: string
    emails: string[]
    notes: string
    priority: number
    status: DoctorStatus
    followUps: FollowUpItem[]
    hospitalId: string
}

export interface HospitalTarget {
    id: string
    name: string
    doctors: Doctor[]
}

export interface Stage1State {
    cv: ChecklistItem[]
    ps: ChecklistItem[]
    lor: ChecklistItem[]
    completed: boolean
}

export interface Stage2State {
    contacts: Contact[]
    hospitalTargets: HospitalTarget[]
    completed: boolean
    setupDone: boolean
    selectedSpecialty: string
    targetHospitals: string[]
}

export type OnboardingItemStatus = 'pending' | 'in_hand' | 'sent'

export interface Stage3State {
    tasks: ChecklistItem[]
    completed: boolean
    onboardingNotes: Record<string, string>
    itemStatuses: Record<string, OnboardingItemStatus>
}

export interface Stage4State {
    packingList: ChecklistItem[]
    flightSearchDone: boolean
    completed: boolean
}

export interface Intercambio {
    id: string
    hospital: Hospital
    addedAt: string
    unlockedStages: [boolean, boolean, boolean, boolean]
    activeStage: 1 | 2 | 3 | 4
    stage1: Stage1State
    stage2: Stage2State
    stage3: Stage3State
    stage4: Stage4State
}

interface C1State {
    hospitals: Hospital[]
    intercambios: Intercambio[]
    activeIntercambioId: string | null
    selectedSpecialties: string[]
}

type C1Action =
    | { type: 'ADD_INTERCAMBIO'; hospital: Hospital }
    | { type: 'REMOVE_INTERCAMBIO'; id: string }
    | { type: 'SET_SELECTED_SPECIALTIES'; specialties: string[] }
    | { type: 'SET_ACTIVE_INTERCAMBIO'; id: string }
    | { type: 'SET_ACTIVE_STAGE'; intercambioId: string; stage: 1 | 2 | 3 | 4 }
    | { type: 'TOGGLE_ITEM'; intercambioId: string; doc: 'cv' | 'ps' | 'lor'; itemId: string }
    | { type: 'MARK_STAGE1_COMPLETE'; intercambioId: string }
    | { type: 'SETUP_STAGE2'; intercambioId: string; specialty: string; hospitals: string[] }
    | { type: 'ADD_DOCTOR_TO_HOSPITAL'; intercambioId: string; hospitalId: string; name: string; title: string; email?: string; notes?: string }
    | { type: 'UPDATE_DOCTOR'; intercambioId: string; hospitalId: string; doctorId: string; updates: Partial<Doctor> }
    | { type: 'MARK_STAGE2_ACCEPTED'; intercambioId: string }
    | { type: 'ADD_CONTACT'; intercambioId: string; contact: Omit<Contact, 'id' | 'createdAt'> }
    | { type: 'ADD_TARGET_HOSPITAL'; intercambioId: string; hospital: string }
    | { type: 'UPDATE_CONTACT'; intercambioId: string; contactId: string; updates: Partial<Contact> }
    | { type: 'REMOVE_CONTACT'; intercambioId: string; contactId: string }
    | { type: 'TOGGLE_TASK'; intercambioId: string; taskId: string }
    | { type: 'TOGGLE_PACKING'; intercambioId: string; itemId: string }
    | { type: 'REMOVE_HOSPITAL_TARGET'; intercambioId: string; hospitalId: string }
    | { type: 'UPDATE_ONBOARDING_NOTE'; intercambioId: string; hospitalId: string; note: string }
    | { type: 'SET_STAGE3_ITEM_STATUS'; intercambioId: string; itemId: string; status: OnboardingItemStatus }

// ─── Default checklists ───────────────────────────────────────────────────────

const CV: ChecklistItem[] = [
    { id: 'cv_d1', label: 'Draft 1', done: false },
    { id: 'cv_d2', label: 'Draft 2', done: false },
    { id: 'cv_d3', label: 'Draft 3', done: false },
    { id: 'cv_d4', label: 'Draft 4', done: false },
    { id: 'cv_d5', label: 'Draft 5', done: false },
    { id: 'cv_final', label: 'Draft Final', done: false },
]

const PS: ChecklistItem[] = [
    { id: 'ps_d1', label: 'Draft 1', done: false },
    { id: 'ps_d2', label: 'Draft 2', done: false },
    { id: 'ps_d3', label: 'Draft 3', done: false },
    { id: 'ps_d4', label: 'Draft 4', done: false },
    { id: 'ps_d5', label: 'Draft 5', done: false },
    { id: 'ps_final', label: 'Draft Final', done: false },
]

const LOR: ChecklistItem[] = [
    { id: 'lor_d1', label: 'Draft 1', done: false },
    { id: 'lor_d2', label: 'Draft 2', done: false },
    { id: 'lor_d3', label: 'Draft 3', done: false },
    { id: 'lor_d4', label: 'Draft 4', done: false },
    { id: 'lor_d5', label: 'Draft 5', done: false },
    { id: 'lor_final', label: 'Draft Final', done: false },
]

const STAGE3_TASKS: ChecklistItem[] = [
    { id: 't1', label: 'Formulário de aplicação do hospital preenchido e enviado', done: false },
    { id: 't2', label: 'Prova de vacinação completa (MMR, Varicela, Hepatite B, Influenza)', done: false },
    { id: 't3', label: 'PPD (Tuberculosis Skin Test) ou IGRA realizado e documentado', done: false },
    { id: 't4', label: 'Seguro Malpractice contratado (mín. USD 1M/3M de cobertura)', done: false },
    { id: 't5', label: 'Seguro saúde internacional ativo para todo o período', done: false },
    { id: 't6', label: 'USMLE Step 1 score enviado ao hospital (se exigido)', done: false, optional: true },
    { id: 't7', label: 'Passaporte válido por no mínimo 6 meses após o fim do estágio', done: false },
    { id: 't8', label: 'Visto americano (B-1/B-2 ou J-1) aprovado e em mãos', done: false },
    { id: 't9', label: 'Carta de confirmação de aceitação recebida do hospital', done: false },
    { id: 't10', label: 'Manual de orientações (dress code, horários, protocolos) lido', done: false },
]

const ONBOARDING_ITEM_IDS = ['ob_s1', 'ob_s2', 'ob_s3', 'ob_sg1', 'ob_sg2', 'ob_v1', 'ob_v2', 'ob_v3', 'ob_v4']

const PACKING: ChecklistItem[] = [
    { id: 'p1', label: 'Estetoscópio (recomendado: Littmann Cardiology IV)', done: false },
    { id: 'p2', label: 'Scrubs — mínimo 3 conjuntos (verificar cor exigida pelo hospital)', done: false },
    { id: 'p3', label: 'White coat com seu nome bordado', done: false },
    { id: 'p4', label: 'Sapatos fechados antiderrapantes (obrigatório em ambiente clínico)', done: false },
    { id: 'p5', label: 'Pocket Medicine ou app de referência clínica offline', done: false },
    { id: 'p6', label: 'Notepad médico + canetas + marcador permanente', done: false },
    { id: 'p7', label: 'Adaptador universal de tomadas (EUA usa plug tipo A/B)', done: false },
    { id: 'p8', label: 'Documentos originais: passaporte, visto, carta de aceitação', done: false },
    { id: 'p9', label: 'Seguro viagem impresso ou salvo offline no celular', done: false },
    { id: 'p10', label: 'Cartão de crédito internacional sem IOF (Nubank, C6, Wise)', done: false },
]

// ─── Hospital catalog — US News Best Hospitals 2023-2024 ─────────────────────
// Rankings: Cardiologia, Neurologia, Cirurgia, Medicina Interna, Oncologia,
//           Pediatria, Psiquiatria, Gastroenterologia, Transplante,
//           Endocrinologia, Neurociências

export const HOSPITAL_CATALOG: Hospital[] = [

    // ── #1 Cardiology · #2 Overall ───────────────────────────────────────
    {
        id: 'cleveland',
        name: 'Cleveland Clinic',
        shortName: 'Cleveland',
        city: 'Cleveland', state: 'OH',
        coverImage: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=600&q=80',
        specialty: ['Cardiologia', 'Gastroenterologia', 'Endocrinologia', 'Medicina Interna', 'Cirurgia', 'Oncologia', 'Neurologia'],
        rating: 4.9, reviewCount: 127,
        costOfLiving: 'medium',
        climate: 'Frio — invernos rigorosos com neve, verão agradável',
        description: '#1 em Cardiologia nos EUA há mais de 25 anos consecutivos. Referência mundial em cirurgia cardíaca e #2 no ranking geral US News Best Hospitals 2024.',
        shadowing: true, handsOn: true,
        highlights: ['#1 em Cardiologia (US News 2024)', '#2 em Gastroenterologia e Endocrinologia', 'Programa estruturado para IMGs internacionais'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Cardiologia': 1, 'Gastroenterologia': 2, 'Endocrinologia': 2,
            'Medicina Interna': 2, 'Cirurgia': 2, 'Oncologia': 5, 'Neurologia': 10,
        },
    },

    // ── #1 Overall · Top 3 in 11 specialties ─────────────────────────────
    {
        id: 'mayo',
        name: 'Mayo Clinic',
        shortName: 'Mayo',
        city: 'Rochester', state: 'MN',
        coverImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
        specialty: ['Medicina Interna', 'Oncologia', 'Endocrinologia', 'Gastroenterologia', 'Neurologia', 'Cardiologia', 'Psiquiatria', 'Cirurgia', 'Transplante', 'Neurociências'],
        rating: 4.9, reviewCount: 98,
        costOfLiving: 'low',
        climate: 'Inverno rigoroso (até −20 °C), verão suave e ensolarado',
        description: '#1 hospital dos EUA pelo US News por múltiplos anos. Modelo de medicina integrada, cidade universitária segura e custo de vida muito baixo — ideal para IMGs.',
        shadowing: true, handsOn: false,
        highlights: ['#1 US News Best Hospitals 2024', 'Top 3 em Medicina Interna, Gastro e Endocrinologia', 'Rochester, MN — custo de vida baixo'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Medicina Interna': 1, 'Oncologia': 3, 'Endocrinologia': 1,
            'Gastroenterologia': 1, 'Neurologia': 1, 'Cardiologia': 2,
            'Psiquiatria': 3, 'Cirurgia': 1, 'Transplante': 1, 'Neurociências': 1,
        },
    },

    // ── #3 Overall · #2 Neurology · #2 Psychiatry ────────────────────────
    {
        id: 'jhopkins',
        name: 'Johns Hopkins Hospital',
        shortName: 'Hopkins',
        city: 'Baltimore', state: 'MD',
        coverImage: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80',
        specialty: ['Neurologia', 'Psiquiatria', 'Oncologia', 'Gastroenterologia', 'Medicina Interna', 'Cirurgia', 'Endocrinologia', 'Neurociências', 'Pediatria'],
        rating: 4.8, reviewCount: 112,
        costOfLiving: 'medium',
        climate: 'Quatro estações — verões quentes e úmidos, invernos frios',
        description: '#3 no ranking geral US News. Pioneiro em inovação médica há 130+ anos, afiliado à Johns Hopkins University — referência em neurocirurgia, psiquiatria e oncologia.',
        shadowing: true, handsOn: true,
        highlights: ['#3 US News Best Hospitals 2024', '#2 em Neurologia e Psiquiatria', 'Baltimore — próximo a Washington D.C.'],
        mentorAvailable: false,
        rankingsBySpecialty: {
            'Neurologia': 2, 'Psiquiatria': 2, 'Oncologia': 6,
            'Gastroenterologia': 3, 'Medicina Interna': 3, 'Cirurgia': 3,
            'Endocrinologia': 4, 'Neurociências': 3, 'Pediatria': 10,
        },
    },

    // ── #5 Overall · #1 Psychiatry ───────────────────────────────────────
    {
        id: 'mgh',
        name: 'Mass General Hospital',
        shortName: 'MGH',
        city: 'Boston', state: 'MA',
        coverImage: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80',
        specialty: ['Psiquiatria', 'Neurologia', 'Cardiologia', 'Gastroenterologia', 'Medicina Interna', 'Endocrinologia', 'Oncologia', 'Neurociências'],
        rating: 4.7, reviewCount: 89,
        costOfLiving: 'high',
        climate: 'Inverno frio com neve, primavera e verão agradáveis',
        description: '#5 US News e maior hospital de ensino dos EUA. Afiliado à Harvard Medical School, é o #1 em Psiquiatria e referência em pesquisa neurológica e oncológica.',
        shadowing: true, handsOn: true,
        highlights: ['#1 em Psiquiatria (US News 2024)', 'Afiliado à Harvard Medical School', 'Boston — maior cluster de biotech do mundo'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Psiquiatria': 1, 'Neurologia': 7, 'Cardiologia': 9,
            'Gastroenterologia': 4, 'Medicina Interna': 4, 'Endocrinologia': 3,
            'Oncologia': 9, 'Neurociências': 4,
        },
    },

    // ── #7 Overall · Dupla afiliação Ivy League ───────────────────────────
    {
        id: 'nyp',
        name: 'NewYork-Presbyterian',
        shortName: 'NYP',
        city: 'New York', state: 'NY',
        coverImage: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80',
        specialty: ['Neurologia', 'Cirurgia', 'Medicina Interna', 'Transplante', 'Psiquiatria', 'Gastroenterologia'],
        rating: 4.6, reviewCount: 143,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos frios com neve, verões quentes',
        description: '#7 US News. Maior hospital de NYC com dupla afiliação Ivy League — Columbia University e Weill Cornell Medicine. Volume cirúrgico entre os maiores dos EUA.',
        shadowing: true, handsOn: true,
        highlights: ['#7 US News Best Hospitals 2024', 'Dupla afiliação Ivy League', 'Nova York — maior metrópole do hemisfério'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Neurologia': 4, 'Cirurgia': 5, 'Medicina Interna': 8,
            'Transplante': 5, 'Psiquiatria': 7, 'Gastroenterologia': 6,
        },
    },

    // ── #8 Overall · #2 Neurosciences ────────────────────────────────────
    {
        id: 'ucsf',
        name: 'UCSF Medical Center',
        shortName: 'UCSF',
        city: 'San Francisco', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&q=80',
        specialty: ['Neurociências', 'Neurologia', 'Oncologia', 'Transplante', 'Psiquiatria', 'Gastroenterologia', 'Endocrinologia'],
        rating: 4.7, reviewCount: 76,
        costOfLiving: 'high',
        climate: 'Mediterrâneo — ameno o ano todo (15–22 °C), neblina pela manhã',
        description: '#8 US News. Único campus UC dedicado exclusivamente à saúde, referência em neurociências, oncologia e medicina de precisão. Muito próximo ao Silicon Valley.',
        shadowing: true, handsOn: false,
        highlights: ['#2 em Neurociências (US News 2024)', '#3 em Neurologia', 'San Francisco — hub de biotech e inovação'],
        mentorAvailable: false,
        rankingsBySpecialty: {
            'Neurociências': 2, 'Neurologia': 3, 'Oncologia': 9,
            'Transplante': 8, 'Psiquiatria': 6, 'Gastroenterologia': 5, 'Endocrinologia': 5,
        },
    },

    // ── #1 Oncology — 20+ anos consecutivos ──────────────────────────────
    {
        id: 'mdanderson',
        name: 'MD Anderson Cancer Center',
        shortName: 'MDA',
        city: 'Houston', state: 'TX',
        coverImage: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&q=80',
        specialty: ['Oncologia'],
        rating: 4.9, reviewCount: 156,
        costOfLiving: 'medium',
        climate: 'Quente e úmido o ano todo, verões intensos com alta umidade',
        description: '#1 em Oncologia pelo US News por mais de 20 anos consecutivos. O maior centro de pesquisa e tratamento oncológico do mundo — mais de 8.000 ensaios clínicos ativos.',
        shadowing: true, handsOn: true,
        highlights: ['#1 em Oncologia há 20+ anos (US News)', '8.000+ ensaios clínicos ativos', 'Houston — grande comunidade brasileira'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Oncologia': 1 },
    },

    // ── #2 Oncology ───────────────────────────────────────────────────────
    {
        id: 'msk',
        name: 'Memorial Sloan Kettering',
        shortName: 'MSK',
        city: 'New York', state: 'NY',
        coverImage: 'https://images.unsplash.com/photo-1576671081837-49000212a370?w=600&q=80',
        specialty: ['Oncologia', 'Transplante'],
        rating: 4.8, reviewCount: 134,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos frios com neve, verões quentes e úmidos',
        description: '#2 em Oncologia (US News). Centro de referência mundial em oncologia clínica, cirurgia oncológica de alta complexidade e transplante de células-tronco.',
        shadowing: true, handsOn: true,
        highlights: ['#2 em Oncologia (US News 2024)', 'Líder em transplante de células-tronco', 'Nova York — acesso global'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Oncologia': 2, 'Transplante': 6 },
    },

    // ── #3 Cardiology · Stanford University ──────────────────────────────
    {
        id: 'cedars',
        name: 'Cedars-Sinai Medical Center',
        shortName: 'Cedars-Sinai',
        city: 'Los Angeles', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80',
        specialty: ['Cardiologia', 'Oncologia', 'Medicina Interna', 'Cirurgia', 'Neurologia'],
        rating: 4.7, reviewCount: 119,
        costOfLiving: 'high',
        climate: 'Mediterrâneo — ensolarado o ano todo, sem invernos rigorosos',
        description: '#4 no ranking geral US News e o maior hospital sem fins lucrativos da Costa Oeste dos EUA. Referência nacional em cardiologia e oncologia em Los Angeles.',
        shadowing: true, handsOn: true,
        highlights: ['#3 em Cardiologia (US News 2024)', '#4 US News Best Hospitals', 'Los Angeles — clima perfeito o ano todo'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Cardiologia': 3, 'Oncologia': 8, 'Medicina Interna': 7, 'Cirurgia': 4, 'Neurologia': 12,
        },
    },

    // ── #4 Cardiology · #6 Overall ────────────────────────────────────────
    {
        id: 'nyulangone',
        name: 'NYU Langone Health',
        shortName: 'NYU Langone',
        city: 'New York', state: 'NY',
        coverImage: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Oncologia', 'Medicina Interna', 'Psiquiatria', 'Neurociências'],
        rating: 4.7, reviewCount: 103,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos frios, verões quentes e úmidos',
        description: '#6 no ranking geral US News. Afiliado à NYU Grossman School of Medicine, com força em cardiologia, neurologia e oncologia em Manhattan.',
        shadowing: true, handsOn: true,
        highlights: ['#4 em Cardiologia (US News 2024)', '#6 US News Best Hospitals', 'Manhattan — maior hub médico dos EUA'],
        mentorAvailable: false,
        rankingsBySpecialty: {
            'Cardiologia': 4, 'Neurologia': 6, 'Oncologia': 7,
            'Medicina Interna': 5, 'Psiquiatria': 5, 'Neurociências': 6,
        },
    },

    // ── #5 Cardiology · Silicon Valley ───────────────────────────────────
    {
        id: 'stanford',
        name: 'Stanford Health Care',
        shortName: 'Stanford',
        city: 'Palo Alto', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1582719366942-5b63ad459e23?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Cirurgia', 'Transplante', 'Endocrinologia', 'Neurociências'],
        rating: 4.8, reviewCount: 108,
        costOfLiving: 'high',
        climate: 'Mediterrâneo — verões secos e quentes, invernos amenos e chuvosos',
        description: 'Afiliado à Stanford University, referência em medicina de precisão, cirurgia robótica e transplante no coração do Silicon Valley.',
        shadowing: true, handsOn: true,
        highlights: ['#5 em Cardiologia (US News 2024)', 'Afiliado à Stanford University', 'Palo Alto — epicentro do Silicon Valley'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Cardiologia': 5, 'Neurologia': 9, 'Cirurgia': 8,
            'Transplante': 7, 'Endocrinologia': 6, 'Neurociências': 5,
        },
    },

    // ── #6 Cardiology · #10 Overall ──────────────────────────────────────
    {
        id: 'northwestern',
        name: 'Northwestern Memorial',
        shortName: 'Northwestern',
        city: 'Chicago', state: 'IL',
        coverImage: 'https://images.unsplash.com/photo-1504813184591-01572f98c85f?w=600&q=80',
        specialty: ['Cardiologia', 'Transplante', 'Neurologia', 'Gastroenterologia', 'Psiquiatria', 'Endocrinologia'],
        rating: 4.6, reviewCount: 91,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos muito frios com neve, verões quentes',
        description: '#10 no ranking geral US News. Principal hospital de Chicago, afiliado à Northwestern University Feinberg School of Medicine.',
        shadowing: true, handsOn: true,
        highlights: ['#10 US News Best Hospitals 2024', '#6 em Cardiologia e Transplante', 'Chicago — 3ª maior cidade dos EUA'],
        mentorAvailable: false,
        rankingsBySpecialty: {
            'Cardiologia': 6, 'Transplante': 4, 'Neurologia': 8,
            'Gastroenterologia': 8, 'Psiquiatria': 9, 'Endocrinologia': 8,
        },
    },

    // ── #7 Cardiology · #9 Overall ────────────────────────────────────────
    {
        id: 'barnesjewish',
        name: 'Barnes-Jewish Hospital',
        shortName: 'Barnes-Jewish',
        city: 'St. Louis', state: 'MO',
        coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Medicina Interna', 'Cirurgia', 'Psiquiatria', 'Gastroenterologia', 'Endocrinologia', 'Transplante'],
        rating: 4.5, reviewCount: 74,
        costOfLiving: 'low',
        climate: 'Quatro estações — invernos frios, verões muito quentes e úmidos',
        description: '#9 no ranking geral US News. Afiliado à Washington University School of Medicine, um dos programas acadêmicos mais fortes dos EUA com custo de vida mínimo.',
        shadowing: true, handsOn: true,
        highlights: ['#9 US News Best Hospitals 2024', '#7 em Cardiologia', 'St. Louis — custo de vida muito baixo'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Cardiologia': 7, 'Neurologia': 11, 'Medicina Interna': 9,
            'Cirurgia': 6, 'Psiquiatria': 8, 'Gastroenterologia': 9,
            'Endocrinologia': 10, 'Transplante': 10,
        },
    },

    // ── #8 Oncology · #10 Cardiology ─────────────────────────────────────
    {
        id: 'umichigan',
        name: 'Univ. of Michigan Health',
        shortName: 'U-Michigan',
        city: 'Ann Arbor', state: 'MI',
        coverImage: 'https://images.unsplash.com/photo-1516737488945-78d5a7c1bcb4?w=600&q=80',
        specialty: ['Cardiologia', 'Oncologia', 'Medicina Interna', 'Pediatria', 'Gastroenterologia', 'Neurociências'],
        rating: 4.6, reviewCount: 82,
        costOfLiving: 'low',
        climate: 'Inverno rigoroso com neve, primavera e verão agradáveis',
        description: 'Hospital afiliado à University of Michigan. #8 em Oncologia e reconhecido pela qualidade de ensino multidisciplinar em Ann Arbor.',
        shadowing: true, handsOn: true,
        highlights: ['#8 em Oncologia (US News 2024)', '#10 em Cardiologia', 'Ann Arbor — cidade universitária e acolhedora'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Cardiologia': 10, 'Oncologia': 10, 'Medicina Interna': 6,
            'Pediatria': 8, 'Gastroenterologia': 7, 'Neurociências': 10,
        },
    },

    // ── #4 Oncology · Afiliado à Harvard ─────────────────────────────────
    {
        id: 'danafar',
        name: 'Dana-Farber Cancer Institute',
        shortName: 'Dana-Farber',
        city: 'Boston', state: 'MA',
        coverImage: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=600&q=80',
        specialty: ['Oncologia', 'Transplante', 'Pediatria'],
        rating: 4.8, reviewCount: 88,
        costOfLiving: 'high',
        climate: 'Inverno frio com neve, primavera e verão agradáveis',
        description: '#4 em Oncologia (US News). Afiliado à Harvard Medical School, especializado em oncologia clínica, pesquisa translacional e transplante de medula óssea.',
        shadowing: true, handsOn: true,
        highlights: ['#4 em Oncologia (US News 2024)', 'Afiliado à Harvard Medical School', 'Líder mundial em ensaios clínicos oncológicos'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Oncologia': 4, 'Transplante': 3, 'Pediatria': 6 },
    },

    // ── #3 Transplant · #8 Oncology ──────────────────────────────────────
    {
        id: 'ucla',
        name: 'UCLA Medical Center',
        shortName: 'UCLA',
        city: 'Los Angeles', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?w=600&q=80',
        specialty: ['Oncologia', 'Transplante', 'Psiquiatria', 'Neurologia', 'Medicina Interna'],
        rating: 4.6, reviewCount: 97,
        costOfLiving: 'high',
        climate: 'Mediterrâneo — ensolarado e ameno o ano todo',
        description: 'Afiliado à UCLA David Geffen School of Medicine. Referência em transplante hepático, oncologia e saúde mental com um dos maiores volumes de transplantes dos EUA.',
        shadowing: true, handsOn: true,
        highlights: ['#3 em Transplante (UNOS/US News)', '#8 em Oncologia (US News 2024)', 'Los Angeles — diversidade e sol o ano todo'],
        mentorAvailable: false,
        rankingsBySpecialty: {
            'Oncologia': 8, 'Transplante': 3, 'Psiquiatria': 4, 'Neurologia': 13, 'Medicina Interna': 10,
        },
    },

    // ── #9 Neurology · Research Triangle ─────────────────────────────────
    {
        id: 'duke',
        name: 'Duke University Hospital',
        shortName: 'Duke',
        city: 'Durham', state: 'NC',
        coverImage: 'https://images.unsplash.com/photo-1530893609608-32a9af3aa95c?w=600&q=80',
        specialty: ['Neurologia', 'Gastroenterologia', 'Oncologia', 'Cirurgia', 'Medicina Interna'],
        rating: 4.6, reviewCount: 71,
        costOfLiving: 'low',
        climate: 'Quatro estações suaves — verões quentes, invernos brandos',
        description: 'Afiliado à Duke University School of Medicine, referência em neurociências, gastroenterologia e pesquisa translacional no Research Triangle — NC.',
        shadowing: true, handsOn: true,
        highlights: ['#9 em Neurologia (US News 2024)', '#10 em Gastroenterologia', 'Durham — custo de vida baixo e clima agradável'],
        mentorAvailable: true,
        rankingsBySpecialty: {
            'Neurologia': 9, 'Gastroenterologia': 10, 'Oncologia': 11, 'Cirurgia': 9, 'Medicina Interna': 11,
        },
    },

    // ── #1 Pediatrics ─────────────────────────────────────────────────────
    {
        id: 'bostonchildrens',
        name: "Boston Children's Hospital",
        shortName: "Boston Children's",
        city: 'Boston', state: 'MA',
        coverImage: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=600&q=80',
        specialty: ['Pediatria'],
        rating: 4.9, reviewCount: 145,
        costOfLiving: 'high',
        climate: 'Inverno frio com neve, primavera e verão agradáveis',
        description: '#1 em Pediatria pelo US News por múltiplos anos consecutivos. Maior hospital pediátrico da Nova Inglaterra, afiliado à Harvard Medical School.',
        shadowing: true, handsOn: true,
        highlights: ['#1 em Pediatria (US News 2024)', 'Afiliado à Harvard Medical School', 'Boston — maior polo de pesquisa pediátrica do mundo'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Pediatria': 1 },
    },

    // ── #2 Pediatrics ─────────────────────────────────────────────────────
    {
        id: 'chop',
        name: "Children's Hosp. of Philadelphia",
        shortName: 'CHOP',
        city: 'Philadelphia', state: 'PA',
        coverImage: 'https://images.unsplash.com/photo-1555252333-9f8e92e65df9?w=600&q=80',
        specialty: ['Pediatria'],
        rating: 4.9, reviewCount: 132,
        costOfLiving: 'medium',
        climate: 'Quatro estações — verões quentes, invernos com neve',
        description: '#2 em Pediatria (US News). Primeiro hospital pediátrico dos EUA (fundado em 1855). Referência em cirurgia pediátrica, oncologia infantil e cardiologia congênita.',
        shadowing: true, handsOn: true,
        highlights: ['#2 em Pediatria (US News 2024)', 'Primeiro hospital pediátrico dos EUA (1855)', 'Filadélfia — cidade histórica e acessível'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Pediatria': 2 },
    },

    // ── #3 Pediatrics ─────────────────────────────────────────────────────
    {
        id: 'texaschildrens',
        name: "Texas Children's Hospital",
        shortName: "Texas Children's",
        city: 'Houston', state: 'TX',
        coverImage: 'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=600&q=80',
        specialty: ['Pediatria'],
        rating: 4.8, reviewCount: 118,
        costOfLiving: 'medium',
        climate: 'Quente e úmido, sem invernos rigorosos',
        description: '#3 em Pediatria (US News). O maior hospital pediátrico dos EUA por volume de pacientes, localizado em Houston — a cidade mais diversa dos Estados Unidos.',
        shadowing: true, handsOn: true,
        highlights: ['#3 em Pediatria (US News 2024)', 'Maior hospital pediátrico dos EUA por volume', 'Houston — maior comunidade brasileira do Sul dos EUA'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Pediatria': 3 },
    },
]

// ─── Factory ──────────────────────────────────────────────────────────────────

function createIntercambio(hospital: Hospital): Intercambio {
    return {
        id: crypto.randomUUID(),
        hospital,
        addedAt: new Date().toISOString(),
        unlockedStages: [true, false, false, false],
        activeStage: 1,
        stage1: { cv: CV.map(i => ({ ...i })), ps: PS.map(i => ({ ...i })), lor: LOR.map(i => ({ ...i })), completed: false },
        stage2: { contacts: [], hospitalTargets: [], completed: false, setupDone: false, selectedSpecialty: '', targetHospitals: [] },
        stage3: { tasks: STAGE3_TASKS.map(i => ({ ...i })), completed: false, onboardingNotes: {}, itemStatuses: {} },
        stage4: { packingList: PACKING.map(i => ({ ...i })), flightSearchDone: false, completed: false },
    }
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function c1Reducer(state: C1State, action: C1Action): C1State {
    switch (action.type) {

        case 'ADD_INTERCAMBIO': {
            const exists = state.intercambios.find(i => i.hospital.id === action.hospital.id)
            if (exists) return { ...state, activeIntercambioId: exists.id }
            const next = createIntercambio(action.hospital)
            return { ...state, intercambios: [...state.intercambios, next], activeIntercambioId: next.id }
        }

        case 'REMOVE_INTERCAMBIO': {
            const remaining = state.intercambios.filter(i => i.id !== action.id)
            return { ...state, intercambios: remaining, activeIntercambioId: remaining[0]?.id ?? null }
        }

        case 'SET_SELECTED_SPECIALTIES':
            return { ...state, selectedSpecialties: action.specialties }

        case 'SET_ACTIVE_INTERCAMBIO':
            return { ...state, activeIntercambioId: action.id }

        case 'SET_ACTIVE_STAGE':
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id === action.intercambioId ? { ...i, activeStage: action.stage } : i
                ),
            }

        case 'TOGGLE_ITEM': {
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const isFinal = action.itemId.endsWith('_final')
                    const currentItem = i.stage1[action.doc].find(x => x.id === action.itemId)
                    const togglingOn = currentItem ? !currentItem.done : false
                    const updated = i.stage1[action.doc].map(item => {
                        if (item.id === action.itemId) return { ...item, done: !item.done }
                        // marking Draft Final ON → check all other drafts too
                        if (isFinal && togglingOn) return { ...item, done: true }
                        return item
                    })
                    const newS1 = { ...i.stage1, [action.doc]: updated }
                    const allDone = [...newS1.cv, ...newS1.ps, ...newS1.lor].every(x => x.done)
                    return { ...i, stage1: { ...newS1, completed: allDone } }
                }),
            }
        }

        case 'MARK_STAGE1_COMPLETE': {
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const unlocked = [...i.unlockedStages] as [boolean, boolean, boolean, boolean]
                    unlocked[1] = true
                    return { ...i, stage1: { ...i.stage1, completed: true }, unlockedStages: unlocked }
                }),
            }
        }

        case 'SETUP_STAGE2': {
            const MOCK_NAMES = [
                { name: 'Dr. James Anderson', title: 'Program Director' },
                { name: 'Dr. Sarah Mitchell', title: 'Chief of Observerships' },
                { name: 'Dr. Robert Chen', title: 'Clinical Coordinator' },
            ]
            const hospitalTargets: HospitalTarget[] = action.hospitals.map(name => {
                const htId = crypto.randomUUID()
                return {
                    id: htId,
                    name,
                    doctors: MOCK_NAMES.map((d, idx) => ({
                        id: crypto.randomUUID(),
                        hospitalId: htId,
                        name: d.name,
                        title: d.title,
                        emails: [],
                        notes: '',
                        priority: idx + 1,
                        status: 'idle' as DoctorStatus,
                        followUps: [],
                    })),
                }
            })
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id !== action.intercambioId ? i : {
                        ...i,
                        stage2: {
                            ...i.stage2,
                            setupDone: true,
                            selectedSpecialty: action.specialty,
                            targetHospitals: action.hospitals,
                            hospitalTargets,
                        },
                    }
                ),
            }
        }

        case 'ADD_DOCTOR_TO_HOSPITAL': {
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const targets = i.stage2.hospitalTargets.map(ht => {
                        if (ht.id !== action.hospitalId) return ht
                        const doctor: Doctor = {
                            id: crypto.randomUUID(),
                            hospitalId: ht.id,
                            name: action.name,
                            title: action.title,
                            emails: action.email ? [action.email] : [],
                            notes: action.notes ?? '',
                            priority: ht.doctors.length + 1,
                            status: 'idle',
                            followUps: [],
                        }
                        return { ...ht, doctors: [...ht.doctors, doctor] }
                    })
                    return { ...i, stage2: { ...i.stage2, hospitalTargets: targets } }
                }),
            }
        }

        case 'UPDATE_DOCTOR': {
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const targets = i.stage2.hospitalTargets.map(ht => {
                        if (ht.id !== action.hospitalId) return ht
                        const doctors = ht.doctors.map(d => {
                            if (d.id !== action.doctorId) return d
                            const updated = { ...d, ...action.updates }
                            // auto-generate follow-ups when moved to followup status
                            if (action.updates.status === 'followup' && d.status !== 'followup' && updated.followUps.length === 0) {
                                const base = updated.followUps[0]?.date ?? new Date().toISOString().split('T')[0]
                                const addDays = (from: string, n: number) => {
                                    const dt = new Date(from); dt.setDate(dt.getDate() + n)
                                    return dt.toISOString().split('T')[0]
                                }
                                const d1 = base
                                const d2 = addDays(d1, 7)
                                const d3 = addDays(d2, 5)
                                const d4 = addDays(d3, 3)
                                const d5 = addDays(d4, 2)
                                updated.followUps = [
                                    { id: crypto.randomUUID(), label: '1º Follow-up', date: d1, done: false },
                                    { id: crypto.randomUUID(), label: '2º Follow-up', date: d2, done: false },
                                    { id: crypto.randomUUID(), label: '3º Follow-up', date: d3, done: false },
                                    { id: crypto.randomUUID(), label: '4º Follow-up', date: d4, done: false },
                                    { id: crypto.randomUUID(), label: '5º Follow-up Final', date: d5, done: false },
                                ]
                            }
                            return updated
                        })
                        return { ...ht, doctors }
                    })
                    // unlock stage 3 if any doctor is now accepted
                    const anyAccepted = targets.flatMap(ht => ht.doctors).some(d => d.status === 'accepted')
                    const unlocked = anyAccepted
                        ? ([true, true, true, i.unlockedStages[3]] as [boolean, boolean, boolean, boolean])
                        : i.unlockedStages
                    return { ...i, stage2: { ...i.stage2, hospitalTargets: targets }, unlockedStages: unlocked }
                }),
            }
        }

        case 'MARK_STAGE2_ACCEPTED':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const unlocked = [true, true, true, i.unlockedStages[3]] as [boolean, boolean, boolean, boolean]
                    return { ...i, unlockedStages: unlocked }
                }),
            }

        case 'ADD_TARGET_HOSPITAL': {
            const htId = crypto.randomUUID()
            const newTarget: HospitalTarget = { id: htId, name: action.hospital, doctors: [] }
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id !== action.intercambioId ? i : {
                        ...i,
                        stage2: {
                            ...i.stage2,
                            targetHospitals: [...i.stage2.targetHospitals, action.hospital],
                            hospitalTargets: [...i.stage2.hospitalTargets, newTarget],
                        },
                    }
                ),
            }
        }

        case 'ADD_CONTACT': {
            const contact: Contact = { ...action.contact, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id !== action.intercambioId ? i : {
                        ...i,
                        stage2: { ...i.stage2, contacts: [...i.stage2.contacts, contact] },
                    }
                ),
            }
        }

        case 'UPDATE_CONTACT':
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id !== action.intercambioId ? i : {
                        ...i,
                        stage2: {
                            ...i.stage2,
                            contacts: i.stage2.contacts.map(c =>
                                c.id === action.contactId ? { ...c, ...action.updates } : c
                            ),
                        },
                    }
                ),
            }

        case 'REMOVE_CONTACT':
            return {
                ...state,
                intercambios: state.intercambios.map(i =>
                    i.id !== action.intercambioId ? i : {
                        ...i,
                        stage2: { ...i.stage2, contacts: i.stage2.contacts.filter(c => c.id !== action.contactId) },
                    }
                ),
            }

        case 'TOGGLE_TASK':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const tasks = i.stage3.tasks.map(t => t.id === action.taskId ? { ...t, done: !t.done } : t)
                    const unlocked = [...i.unlockedStages] as [boolean, boolean, boolean, boolean]
                    if (tasks.every(t => t.done)) unlocked[3] = true
                    return { ...i, stage3: { ...i.stage3, tasks, completed: tasks.every(t => t.done) }, unlockedStages: unlocked }
                }),
            }

        case 'TOGGLE_PACKING':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const packingList = i.stage4.packingList.map(p => p.id === action.itemId ? { ...p, done: !p.done } : p)
                    return { ...i, stage4: { ...i.stage4, packingList } }
                }),
            }

        case 'SET_STAGE3_ITEM_STATUS':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const itemStatuses = { ...i.stage3.itemStatuses, [action.itemId]: action.status }
                    const allSent = ONBOARDING_ITEM_IDS.every(id => itemStatuses[id] === 'sent')
                    const unlocked = [...i.unlockedStages] as [boolean, boolean, boolean, boolean]
                    if (allSent) unlocked[3] = true
                    return {
                        ...i,
                        stage3: { ...i.stage3, itemStatuses, completed: allSent },
                        unlockedStages: unlocked,
                    }
                }),
            }

        case 'REMOVE_HOSPITAL_TARGET':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    const removed = i.stage2.hospitalTargets.find(ht => ht.id === action.hospitalId)
                    return {
                        ...i,
                        stage2: {
                            ...i.stage2,
                            hospitalTargets: i.stage2.hospitalTargets.filter(ht => ht.id !== action.hospitalId),
                            targetHospitals: removed
                                ? i.stage2.targetHospitals.filter(h => h !== removed.name)
                                : i.stage2.targetHospitals,
                        },
                    }
                }),
            }

        case 'UPDATE_ONBOARDING_NOTE':
            return {
                ...state,
                intercambios: state.intercambios.map(i => {
                    if (i.id !== action.intercambioId) return i
                    return {
                        ...i,
                        stage3: {
                            ...i.stage3,
                            onboardingNotes: { ...i.stage3.onboardingNotes, [action.hospitalId]: action.note },
                        },
                    }
                }),
            }

        default:
            return state
    }
}

// ─── Context ─────────────────────────────────────────────────────────────────

interface C1ContextValue {
    state: C1State
    dispatch: React.Dispatch<C1Action>
    activeIntercambio: Intercambio | null
}

const C1Context = createContext<C1ContextValue | null>(null)

export function C1Provider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(c1Reducer, {
        hospitals: HOSPITAL_CATALOG,
        intercambios: [],
        activeIntercambioId: null,
        selectedSpecialties: [],
    })
    const activeIntercambio = state.intercambios.find(i => i.id === state.activeIntercambioId) ?? null

    return (
        <C1Context.Provider value={{ state, dispatch, activeIntercambio }}>
            {children}
        </C1Context.Provider>
    )
}

export function useC1() {
    const ctx = useContext(C1Context)
    if (!ctx) throw new Error('useC1 must be used within C1Provider')
    return ctx
}
