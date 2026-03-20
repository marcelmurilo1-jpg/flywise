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
}

type C1Action =
    | { type: 'ADD_INTERCAMBIO'; hospital: Hospital }
    | { type: 'REMOVE_INTERCAMBIO'; id: string }
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

// ─── Hospital catalog ─────────────────────────────────────────────────────────

export const HOSPITAL_CATALOG: Hospital[] = [
    {
        id: 'cleveland',
        name: 'Cleveland Clinic',
        shortName: 'Cleveland',
        city: 'Cleveland', state: 'OH',
        coverImage: 'https://images.unsplash.com/photo-1551076805-e1869033e561?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Cirurgia'],
        rating: 4.9, reviewCount: 127,
        costOfLiving: 'medium',
        climate: 'Frio — invernos rigorosos, verão agradável',
        description: 'Referência mundial em cardiologia, consistentemente #2 nos EUA. Ambiente altamente estruturado para IMGs internacionais.',
        shadowing: true, handsOn: true,
        highlights: ['#2 em Cardiologia (US News)', 'Programa estruturado p/ IMGs', 'Ambiente multicultural'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Cardiologia': 2, 'Neurologia': 12, 'Cirurgia': 5 },
    },
    {
        id: 'mayo',
        name: 'Mayo Clinic',
        shortName: 'Mayo',
        city: 'Rochester', state: 'MN',
        coverImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
        specialty: ['Medicina Interna', 'Oncologia', 'Endocrinologia'],
        rating: 4.9, reviewCount: 98,
        costOfLiving: 'low',
        climate: 'Muito frio no inverno (-20°C), verão suave',
        description: 'O hospital mais bem avaliado dos EUA por múltiplos rankings. Modelo de cuidado centrado no paciente reconhecido mundialmente.',
        shadowing: true, handsOn: false,
        highlights: ['#1 US News 2024', 'Cidade universitária segura', 'Custo de vida baixo'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Medicina Interna': 1, 'Oncologia': 3, 'Endocrinologia': 1, 'Gastroenterologia': 1, 'Neurologia': 1 },
    },
    {
        id: 'jhopkins',
        name: 'Johns Hopkins Hospital',
        shortName: 'Hopkins',
        city: 'Baltimore', state: 'MD',
        coverImage: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=600&q=80',
        specialty: ['Oncologia', 'Neurologia', 'Pediatria'],
        rating: 4.8, reviewCount: 112,
        costOfLiving: 'medium',
        climate: 'Quatro estações — verões quentes e úmidos',
        description: 'Pioneiro em inovação médica e pesquisa clínica. Um dos centros de pesquisa mais influentes do mundo, afiliado à Johns Hopkins University.',
        shadowing: true, handsOn: true,
        highlights: ['Top 3 em pesquisa nos EUA', 'Forte cultura acadêmica', 'Próximo a Washington D.C.'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Oncologia': 7, 'Neurologia': 3, 'Pediatria': 4 },
    },
    {
        id: 'mgh',
        name: 'Mass General Hospital',
        shortName: 'MGH',
        city: 'Boston', state: 'MA',
        coverImage: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&q=80',
        specialty: ['Cardiologia', 'Psiquiatria', 'Gastroenterologia'],
        rating: 4.7, reviewCount: 89,
        costOfLiving: 'high',
        climate: 'Inverno frio com neve, verão agradável',
        description: 'Hospital afiliado à Harvard Medical School. Um dos mais antigos e prestigiosos dos EUA com enorme volume de pesquisa clínica de ponta.',
        shadowing: true, handsOn: true,
        highlights: ['Afiliado à Harvard Medical School', 'Forte rede de alumni IMGs', 'Boston — cidade universitária vibrante'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Cardiologia': 4, 'Psiquiatria': 1, 'Gastroenterologia': 4 },
    },
    {
        id: 'nyp',
        name: 'NewYork-Presbyterian',
        shortName: 'NYP',
        city: 'New York', state: 'NY',
        coverImage: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=80',
        specialty: ['Transplante', 'Cirurgia', 'Neurologia'],
        rating: 4.6, reviewCount: 143,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos frios, verões quentes',
        description: 'O maior hospital de Nova York e um dos mais movimentados dos EUA. Dupla afiliação com Columbia e Weill Cornell Medicine (ambas Ivy League).',
        shadowing: true, handsOn: true,
        highlights: ['Nova York — experiência única', 'Volume altíssimo de casos', 'Dupla afiliação Ivy League'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Transplante': 5, 'Cirurgia': 10, 'Neurologia': 6 },
    },
    {
        id: 'ucsf',
        name: 'UCSF Medical Center',
        shortName: 'UCSF',
        city: 'San Francisco', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=600&q=80',
        specialty: ['Oncologia', 'Neurociências', 'Transplante'],
        rating: 4.7, reviewCount: 76,
        costOfLiving: 'high',
        climate: 'Ameno o ano todo (15–22°C) com neblina frequente',
        description: 'Único campus UC dedicado exclusivamente à área da saúde. Referência mundial em pesquisa oncológica, neurociências e medicina de precisão.',
        shadowing: true, handsOn: false,
        highlights: ['Top 5 em pesquisa biomédica', 'Silicon Valley próximo', 'Clima único em SF'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Oncologia': 6, 'Neurociências': 2, 'Transplante': 4 },
    },
    {
        id: 'mdanderson',
        name: 'MD Anderson Cancer Center',
        shortName: 'MDA',
        city: 'Houston', state: 'TX',
        coverImage: 'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=600&q=80',
        specialty: ['Oncologia'],
        rating: 4.9, reviewCount: 156,
        costOfLiving: 'medium',
        climate: 'Quente e úmido o ano todo, verões intensos',
        description: '#1 em oncologia por 20+ anos consecutivos. Centro dedicado exclusivamente ao câncer com o maior volume de pesquisa oncológica do mundo.',
        shadowing: true, handsOn: true,
        highlights: ['#1 em Oncologia há 20+ anos', 'Maior centro de pesquisa em câncer', 'Houston — cidade diversa e acessível'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Oncologia': 1 },
    },
    {
        id: 'msk',
        name: 'Memorial Sloan Kettering',
        shortName: 'MSK',
        city: 'New York', state: 'NY',
        coverImage: 'https://images.unsplash.com/photo-1576671081837-49000212a370?w=600&q=80',
        specialty: ['Oncologia', 'Transplante'],
        rating: 4.8, reviewCount: 134,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos frios, verões quentes',
        description: 'Centro de referência mundial em oncologia clínica e pesquisa translacional. Um dos maiores centros de tratamento de câncer dos EUA.',
        shadowing: true, handsOn: true,
        highlights: ['#2 em Oncologia (US News)', 'Pesquisa translacional de ponta', 'Nova York — maior hub médico do país'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Oncologia': 2, 'Transplante': 6 },
    },
    {
        id: 'stanford',
        name: 'Stanford Health Care',
        shortName: 'Stanford',
        city: 'Palo Alto', state: 'CA',
        coverImage: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Cirurgia', 'Transplante'],
        rating: 4.8, reviewCount: 108,
        costOfLiving: 'high',
        climate: 'Mediterrâneo — verões secos, invernos amenos',
        description: 'Afiliado à Stanford University, referência mundial em medicina de precisão e inovação médica no coração do Silicon Valley.',
        shadowing: true, handsOn: true,
        highlights: ['Afiliado à Stanford University', 'Medicina de precisão e inovação', 'Silicon Valley — ecosystem único'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Cardiologia': 5, 'Neurologia': 6, 'Cirurgia': 7, 'Transplante': 3 },
    },
    {
        id: 'northwestern',
        name: 'Northwestern Memorial',
        shortName: 'Northwestern',
        city: 'Chicago', state: 'IL',
        coverImage: 'https://images.unsplash.com/photo-1504813184591-01572f98c85f?w=600&q=80',
        specialty: ['Cardiologia', 'Transplante', 'Neurologia'],
        rating: 4.6, reviewCount: 91,
        costOfLiving: 'high',
        climate: 'Quatro estações — invernos muito frios, verões quentes',
        description: 'Principal hospital de Chicago, afiliado à Northwestern University Feinberg School of Medicine. Referência em transplante e cardiologia.',
        shadowing: true, handsOn: true,
        highlights: ['Afiliado à Northwestern University', 'Chicago — cidade vibrante', 'Top 3 em Transplante'],
        mentorAvailable: false,
        rankingsBySpecialty: { 'Cardiologia': 10, 'Transplante': 3, 'Neurologia': 9 },
    },
    {
        id: 'barnesjewish',
        name: 'Barnes-Jewish Hospital',
        shortName: 'Barnes-Jewish',
        city: 'St. Louis', state: 'MO',
        coverImage: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&q=80',
        specialty: ['Cardiologia', 'Neurologia', 'Medicina Interna', 'Cirurgia'],
        rating: 4.5, reviewCount: 74,
        costOfLiving: 'low',
        climate: 'Quatro estações — invernos frios, verões muito quentes',
        description: 'Afiliado à Washington University School of Medicine, um dos mais fortes programas acadêmicos dos EUA. Excelente custo-benefício para IMGs.',
        shadowing: true, handsOn: true,
        highlights: ['Afiliado à Washington University', 'Custo de vida muito baixo', 'Forte programa acadêmico'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Cardiologia': 7, 'Neurologia': 8, 'Medicina Interna': 5, 'Cirurgia': 6 },
    },
    {
        id: 'umichigan',
        name: 'Univ. of Michigan Health',
        shortName: 'U-Michigan',
        city: 'Ann Arbor', state: 'MI',
        coverImage: 'https://images.unsplash.com/photo-1516737488945-78d5a7c1bcb4?w=600&q=80',
        specialty: ['Cardiologia', 'Oncologia', 'Medicina Interna', 'Pediatria'],
        rating: 4.6, reviewCount: 82,
        costOfLiving: 'low',
        climate: 'Inverno rigoroso com neve, verão agradável',
        description: 'Hospital universitário de referência nacional, afiliado à University of Michigan. Reconhecido pela qualidade de ensino e pesquisa clínica multidisciplinar.',
        shadowing: true, handsOn: true,
        highlights: ['Afiliado à University of Michigan', 'Ann Arbor — cidade universitária acolhedora', 'Custo de vida baixo'],
        mentorAvailable: true,
        rankingsBySpecialty: { 'Cardiologia': 8, 'Oncologia': 8, 'Medicina Interna': 6, 'Pediatria': 7 },
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
                    return {
                        ...i,
                        stage3: {
                            ...i.stage3,
                            itemStatuses: { ...i.stage3.itemStatuses, [action.itemId]: action.status },
                        },
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
