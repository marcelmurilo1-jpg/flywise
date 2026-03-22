import { Document, Page, Text, View, StyleSheet, Link, pdf } from '@react-pdf/renderer'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Activity {
    horario: string
    atividade: string
    local: string
    dica: string
    lat?: number
    lng?: number
}

interface DayPeriod {
    atividades: Activity[]
}

interface ItineraryDay {
    dia: number
    tema: string
    manha: DayPeriod
    tarde: DayPeriod
    noite: DayPeriod
}

interface ItineraryResult {
    titulo: string
    resumo: string
    dias: ItineraryDay[]
    dicas_gerais: string[]
    orcamento_estimado: string
}

export interface RoteiroPDFProps {
    itinerary: ItineraryResult
    destination: string
    duration: number
    travelerType: string
    travelStyle: string[]
}

// ─── Constants ───────────────────────────────────────────────────────────────

const C = {
    navy: '#0E2A55',
    blue: '#4A90E2',
    blueVibrant: '#2A60C2',
    snow: '#F7F9FC',
    grayLight: '#EEF2F8',
    borderLight: '#E2EAF5',
    textDark: '#0E2A55',
    textBody: '#2C3E6B',
    textMuted: '#6B7A99',
    textFaint: '#A0AECB',
    white: '#FFFFFF',
    morning: '#F59E0B',
    afternoon: '#4A90E2',
    night: '#7C3AED',
}

const TRAVELER_LABELS: Record<string, string> = {
    solo: 'Solo',
    casal: 'Casal',
    familia: 'Família',
    amigos: 'Amigos',
}

const PERIOD_CONFIG = [
    { key: 'manha' as const, label: 'Manhã', color: C.morning },
    { key: 'tarde' as const, label: 'Tarde', color: C.afternoon },
    { key: 'noite' as const, label: 'Noite', color: C.night },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizePeriod(period: any): Activity[] {
    if (!period) return []
    if (Array.isArray(period.atividades)) return period.atividades
    const acts: Activity[] = []
    if (period.atividade || period.local) {
        acts.push({ horario: period.horario ?? '', atividade: period.atividade ?? '', local: period.local ?? '', dica: period.dica ?? '', lat: period.lat, lng: period.lng })
    }
    if (Array.isArray(period.extras_atividades)) {
        for (const e of period.extras_atividades) {
            acts.push({ horario: e.horario ?? '', atividade: e.atividade ?? '', local: e.local ?? '', dica: e.dica ?? '' })
        }
    }
    return acts
}

function mapsUrl(activity: Activity): string {
    if (activity.lat && activity.lng) {
        return `https://www.google.com/maps/search/?api=1&query=${activity.lat},${activity.lng}`
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.local)}`
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
    page: {
        fontFamily: 'Helvetica',
        backgroundColor: C.white,
        paddingBottom: 48,
    },

    // Header
    header: {
        backgroundColor: C.navy,
        padding: 36,
        paddingBottom: 28,
    },
    headerBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 22,
    },
    brandFly: {
        fontSize: 15,
        fontFamily: 'Helvetica-Bold',
        color: C.blue,
    },
    brandWise: {
        fontSize: 15,
        fontFamily: 'Helvetica-Bold',
        color: C.white,
    },
    brandDivider: {
        width: 1,
        height: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginHorizontal: 10,
    },
    brandTagline: {
        fontSize: 8,
        color: 'rgba(255,255,255,0.4)',
        letterSpacing: 1.2,
        textTransform: 'uppercase',
    },
    headerLabel: {
        fontSize: 8,
        color: 'rgba(255,255,255,0.45)',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        marginBottom: 7,
    },
    headerTitle: {
        fontSize: 22,
        fontFamily: 'Helvetica-Bold',
        color: C.white,
        marginBottom: 10,
        lineHeight: 1.3,
    },
    headerSummary: {
        fontSize: 10.5,
        color: 'rgba(255,255,255,0.72)',
        lineHeight: 1.65,
        marginBottom: 18,
    },
    badgesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginRight: 6,
        marginBottom: 4,
    },
    badgeText: {
        fontSize: 8.5,
        fontFamily: 'Helvetica-Bold',
        color: C.white,
    },

    // Body
    body: {
        paddingHorizontal: 32,
        paddingTop: 24,
    },
    sectionTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: C.textFaint,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
    },

    // Day card
    dayCard: {
        marginBottom: 14,
        borderWidth: 1,
        borderColor: C.borderLight,
        borderRadius: 10,
    },
    dayHeader: {
        backgroundColor: C.snow,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight,
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
    },
    dayBadge: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: C.grayLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        flexShrink: 0,
    },
    dayBadgeText: {
        fontSize: 10,
        fontFamily: 'Helvetica-Bold',
        color: C.blueVibrant,
    },
    dayMeta: {
        flex: 1,
    },
    dayLabel: {
        fontSize: 7.5,
        color: C.textFaint,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    dayTheme: {
        fontSize: 12,
        fontFamily: 'Helvetica-Bold',
        color: C.textDark,
    },

    // Period
    periodSection: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 4,
    },
    periodSectionBorder: {
        borderTopWidth: 1,
        borderTopColor: '#EFF3FA',
    },
    periodHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    periodDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    periodLabel: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    // Activity
    activity: {
        marginBottom: 9,
        paddingLeft: 10,
        borderLeftWidth: 2,
    },
    activityTopRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 3,
    },
    activityTime: {
        fontSize: 8,
        color: C.textFaint,
        width: 34,
        flexShrink: 0,
        marginTop: 1,
    },
    activityName: {
        fontSize: 10.5,
        fontFamily: 'Helvetica-Bold',
        color: C.textDark,
        flex: 1,
        lineHeight: 1.4,
    },
    activityDesc: {
        fontSize: 9,
        color: C.textBody,
        lineHeight: 1.55,
        marginBottom: 2,
        paddingLeft: 34,
    },
    activityTip: {
        fontSize: 8.5,
        color: C.textMuted,
        fontFamily: 'Helvetica-Oblique',
        lineHeight: 1.4,
        paddingLeft: 34,
        marginBottom: 3,
    },
    mapsLink: {
        paddingLeft: 34,
        marginBottom: 2,
    },
    mapsLinkText: {
        fontSize: 7.5,
        color: C.blueVibrant,
        textDecoration: 'underline',
    },

    // Tips & Budget
    tipsCard: {
        marginTop: 6,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: C.borderLight,
        borderRadius: 10,
        padding: 16,
    },
    tipsTitle: {
        fontSize: 11,
        fontFamily: 'Helvetica-Bold',
        color: C.textDark,
        marginBottom: 10,
    },
    tipRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    tipBullet: {
        fontSize: 9,
        color: C.blueVibrant,
        marginRight: 6,
        marginTop: 1,
        width: 8,
    },
    tipText: {
        fontSize: 9,
        color: C.textBody,
        lineHeight: 1.55,
        flex: 1,
    },
    budgetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
    },
    budgetLabel: {
        fontSize: 9.5,
        fontFamily: 'Helvetica-Bold',
        color: C.textDark,
        marginRight: 6,
    },
    budgetValue: {
        fontSize: 9.5,
        color: C.blueVibrant,
    },

    // Footer
    footer: {
        position: 'absolute',
        bottom: 16,
        left: 32,
        right: 32,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: C.borderLight,
        paddingTop: 8,
    },
    footerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    footerFly: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        color: C.blue,
    },
    footerWise: {
        fontSize: 7.5,
        fontFamily: 'Helvetica-Bold',
        color: C.textFaint,
    },
    footerSep: {
        fontSize: 7.5,
        color: C.textFaint,
        marginHorizontal: 6,
    },
    footerUrl: {
        fontSize: 7.5,
        color: C.textFaint,
    },
    footerPage: {
        fontSize: 7.5,
        color: C.textFaint,
    },
})

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActivityItem({ activity, periodColor }: { activity: Activity; periodColor: string }) {
    const url = mapsUrl(activity)
    return (
        <View style={[s.activity, { borderLeftColor: periodColor + '55' }]}>
            <View style={s.activityTopRow}>
                <Text style={s.activityTime}>{activity.horario || ''}</Text>
                <Text style={s.activityName}>{activity.local}</Text>
            </View>
            {!!activity.atividade && (
                <Text style={s.activityDesc}>{activity.atividade}</Text>
            )}
            {!!activity.dica && (
                <Text style={s.activityTip}>Dica: {activity.dica}</Text>
            )}
            <View style={s.mapsLink}>
                <Link src={url}>
                    <Text style={s.mapsLinkText}>Ver no Google Maps →</Text>
                </Link>
            </View>
        </View>
    )
}

function PeriodBlock({ period, day }: { period: typeof PERIOD_CONFIG[number]; day: ItineraryDay }) {
    const activities: Activity[] = normalizePeriod(day[period.key])
    if (activities.length === 0) return null
    return (
        <View style={s.periodSection}>
            <View style={s.periodHeader}>
                <View style={[s.periodDot, { backgroundColor: period.color }]} />
                <Text style={[s.periodLabel, { color: period.color }]}>{period.label}</Text>
            </View>
            {activities.map((act, i) => (
                <ActivityItem key={i} activity={act} periodColor={period.color} />
            ))}
        </View>
    )
}

function DayCard({ day, isLast }: { day: ItineraryDay; isLast: boolean }) {
    return (
        <View style={[s.dayCard, isLast ? {} : {}]}>
            <View style={s.dayHeader}>
                <View style={s.dayBadge}>
                    <Text style={s.dayBadgeText}>{day.dia}</Text>
                </View>
                <View style={s.dayMeta}>
                    <Text style={s.dayLabel}>Dia {day.dia}</Text>
                    <Text style={s.dayTheme}>{day.tema}</Text>
                </View>
            </View>
            {PERIOD_CONFIG.map((period, pIdx) => (
                <View key={period.key} style={pIdx > 0 ? s.periodSectionBorder : undefined}>
                    <PeriodBlock period={period} day={day} />
                </View>
            ))}
        </View>
    )
}

function PageFooter() {
    return (
        <View style={s.footer} fixed>
            <View style={s.footerLeft}>
                <Text style={s.footerFly}>Fly</Text>
                <Text style={s.footerWise}>Wise</Text>
                <Text style={s.footerSep}>·</Text>
                <Text style={s.footerUrl}>flywise.app</Text>
            </View>
            <Text
                style={s.footerPage}
                render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
            />
        </View>
    )
}

// ─── Main Document ────────────────────────────────────────────────────────────

export function RoteiroPDF({ itinerary, destination, duration, travelerType, travelStyle }: RoteiroPDFProps) {
    const travelerLabel = TRAVELER_LABELS[travelerType] ?? travelerType
    const durationLabel = `${duration} dia${duration > 1 ? 's' : ''}`
    const hasTips = itinerary.dicas_gerais?.length > 0
    const hasBudget = !!itinerary.orcamento_estimado

    return (
        <Document
            title={itinerary.titulo}
            author="FlyWise"
            subject={`Roteiro de viagem para ${destination}`}
            creator="FlyWise · flywise.app"
        >
            <Page size="A4" style={s.page}>

                {/* ── Header ─────────────────────────────────────── */}
                <View style={s.header}>
                    <View style={s.headerBrand}>
                        <Text style={s.brandFly}>Fly</Text>
                        <Text style={s.brandWise}>Wise</Text>
                        <View style={s.brandDivider} />
                        <Text style={s.brandTagline}>Roteiro de Viagem</Text>
                    </View>
                    <Text style={s.headerLabel}>Seu roteiro personalizado</Text>
                    <Text style={s.headerTitle}>{itinerary.titulo}</Text>
                    <Text style={s.headerSummary}>{itinerary.resumo}</Text>
                    <View style={s.badgesRow}>
                        <View style={s.badge}>
                            <Text style={s.badgeText}>{durationLabel}</Text>
                        </View>
                        <View style={s.badge}>
                            <Text style={s.badgeText}>{travelerLabel}</Text>
                        </View>
                        {travelStyle.map(style => (
                            <View key={style} style={s.badge}>
                                <Text style={s.badgeText}>{style}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* ── Body ───────────────────────────────────────── */}
                <View style={s.body}>
                    <Text style={s.sectionTitle}>Programação dia a dia</Text>

                    {itinerary.dias.map((day, i) => (
                        <DayCard key={day.dia} day={day} isLast={i === itinerary.dias.length - 1} />
                    ))}

                    {/* Tips & Budget */}
                    {(hasTips || hasBudget) && (
                        <View style={s.tipsCard}>
                            {hasTips && (
                                <>
                                    <Text style={s.tipsTitle}>Dicas Gerais</Text>
                                    {itinerary.dicas_gerais.map((tip, i) => (
                                        <View key={i} style={s.tipRow}>
                                            <Text style={s.tipBullet}>•</Text>
                                            <Text style={s.tipText}>{tip}</Text>
                                        </View>
                                    ))}
                                </>
                            )}
                            {hasBudget && (
                                <View style={s.budgetRow}>
                                    <Text style={s.budgetLabel}>Orcamento Estimado:</Text>
                                    <Text style={s.budgetValue}>{itinerary.orcamento_estimado}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </View>

                {/* ── Footer (every page) ────────────────────────── */}
                <PageFooter />

            </Page>
        </Document>
    )
}

// ─── Helper imperativo de geração de PDF ─────────────────────────────────────
// Importar @react-pdf/renderer aqui (estaticamente) evita o erro ESM de star
// exports quando feito via dynamic import direto do pacote no Vite.

export async function generateRoteiroPDF(props: RoteiroPDFProps): Promise<Blob> {
    const docElement = RoteiroPDF(props)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return pdf(docElement as any).toBlob()
}
