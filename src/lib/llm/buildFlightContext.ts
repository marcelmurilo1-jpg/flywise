/**
 * buildFlightContext.ts
 *
 * Compresses a ResultadoVoo (raw DB row) into a compact FlightContext
 * for inclusion in LLM prompts. Target: ~150 tokens instead of ~2,000.
 */

import type { ResultadoVoo } from '@/lib/supabase'
import { getProgramsForAirline } from '@/lib/airlineMilesMapping'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export interface FlightContext {
    flightId: number
    route: string           // "GRU → JFK"
    airlineIata: string     // "AC"
    airlineName: string     // "Air Canada"
    programs: string[]      // ["Smiles", "Aeroplan", "Livelo"]
    priceBrl: number
    priceMilesEst: number   // rough estimate for prompt context
    stops: number
    durationH: number
    outbound: string        // "10:30 GRU → 23:45 JFK (12h30, 1 conexão: YYZ)"
    returnFlight?: string   // "09:15 JFK → 22:45 GRU (13h00, direto)"
    dateIso: string         // "2025-05-10"
    isRoundTrip: boolean
    cabinClass: string
}

/** Extract IATA 2-letter code from companhia field like "Air Canada (AC)" or just "AC" */
function extractIata(companhia?: string | null): string {
    if (!companhia) return ''
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    if (/^[A-Z]{2,3}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

function formatMins(mins?: number | null): string {
    if (!mins) return ''
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ''}`
}

function formatLeg(
    dep?: string, arr?: string, from?: string, to?: string,
    durationMin?: number | null, stops?: number | null, stopCodes?: string,
): string {
    const parts: string[] = []
    if (dep) parts.push(dep.slice(11, 16))
    if (from) parts.push(from)
    parts.push('→')
    if (arr) parts.push(arr.slice(11, 16))
    if (to) parts.push(to)
    const dur = formatMins(durationMin)
    const stopStr = stops === 0 ? 'direto' : `${stops} conexão${stopCodes ? ': ' + stopCodes : ''}`
    if (dur || stopStr) parts.push(`(${[dur, stopStr].filter(Boolean).join(', ')})`)
    return parts.join(' ')
}

export function buildFlightContext(flight: ResultadoVoo): FlightContext {
    const det = (flight.detalhes as any) ?? {}
    const segsOut: any[] = (flight.segmentos as any[]) ?? []
    const segsRet: any[] = (det.returnSegmentos as any[]) ?? []
    const iata = extractIata(flight.companhia)
    const stopCodes = segsOut.length > 1
        ? segsOut.slice(0, -1).map((s: any) => s.destino ?? '').filter(Boolean).join('·')
        : ''
    const retStopCodes = segsRet.length > 1
        ? segsRet.slice(0, -1).map((s: any) => s.destino ?? '').filter(Boolean).join('·')
        : ''

    const priceMilesEst = flight.preco_brl
        ? Math.round((flight.preco_brl * 55) / 1000) * 1000
        : 0

    const dateLabel = flight.partida
        ? format(parseISO(flight.partida), "dd/MM/yyyy", { locale: ptBR })
        : ''

    return {
        flightId: flight.id ?? 0,
        route: `${flight.origem ?? '?'} → ${flight.destino ?? '?'}`,
        airlineIata: iata,
        airlineName: flight.companhia ?? iata,
        programs: iata ? getProgramsForAirline(iata) : ['Livelo'],
        priceBrl: flight.preco_brl ?? 0,
        priceMilesEst,
        stops: det.paradas ?? 0,
        durationH: Math.round(((flight.duracao_min ?? 0) / 60) * 10) / 10,
        outbound: formatLeg(flight.partida, flight.chegada, flight.origem, flight.destino, flight.duracao_min, det.paradas, stopCodes),
        returnFlight: det.returnPartida
            ? formatLeg(det.returnPartida, det.returnChegada, det.returnOrigem, det.returnDestino, det.returnDuracaoMin, det.returnParadas, retStopCodes)
            : undefined,
        dateIso: dateLabel,
        isRoundTrip: !!det.returnPartida,
        cabinClass: flight.cabin_class ?? 'economy',
    }
}

/** Serialize to compact string for prompt inclusion — ~150 tokens */
export function flightContextToString(ctx: FlightContext): string {
    const lines = [
        `Rota: ${ctx.route} | ${ctx.airlineName} (${ctx.airlineIata})`,
        `Data: ${ctx.dateIso} | Cabine: ${ctx.cabinClass}`,
        `Preço cash: R$ ${ctx.priceBrl.toLocaleString('pt-BR')} | Milhas est.: ~${ctx.priceMilesEst.toLocaleString('pt-BR')} pts`,
        `Ida: ${ctx.outbound}`,
    ]
    if (ctx.returnFlight) lines.push(`Volta: ${ctx.returnFlight}`)
    lines.push(`Programas aceitos: ${ctx.programs.slice(0, 5).join(', ')}`)
    return lines.join('\n')
}
