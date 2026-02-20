import { addHours, addMinutes, format } from 'date-fns'

export interface MockFlight {
    provider: string
    companhia: string
    preco_brl: number | null
    preco_milhas: number | null
    taxas_brl: number
    cpm: number | null
    partida: string
    chegada: string
    origem: string
    destino: string
    duracao_min: number
    cabin_class: string
    flight_key: string
    estrategia_disponivel: boolean
    moeda: string
    segmentos: unknown
    detalhes: unknown
}

export function generateMockFlights(
    origem: string,
    destino: string,
    dataIda: string,
    passageiros: number = 1,
    userMiles: Record<string, number> = {}
): MockFlight[] {
    const baseDate = new Date(dataIda + 'T06:00:00')
    const totalSmiles = userMiles.smiles ?? 0
    const totalLatam = userMiles.latam ?? 0
    const totalAzul = userMiles.azul ?? 0

    const airlines = [
        {
            companhia: 'LATAM',
            cor: '#D42B2B',
            preco_brl: Math.round((1800 + Math.random() * 800) * passageiros),
            milhas: 55000,
            taxas: 380,
            duracaoMin: 175,
            departureOffsetH: 6,
            hasMiles: totalLatam > 0,
        },
        {
            companhia: 'GOL',
            cor: '#F97316',
            preco_brl: Math.round((1500 + Math.random() * 600) * passageiros),
            milhas: 42000,
            taxas: 290,
            duracaoMin: 165,
            departureOffsetH: 10,
            hasMiles: totalSmiles > 0,
        },
        {
            companhia: 'Azul',
            cor: '#1D4ED8',
            preco_brl: Math.round((2100 + Math.random() * 900) * passageiros),
            milhas: 65000,
            taxas: 420,
            duracaoMin: 185,
            departureOffsetH: 14,
            hasMiles: totalAzul > 0,
        },
    ]

    const flights: MockFlight[] = []

    airlines.forEach((airline, idx) => {
        const departureTime = addHours(baseDate, airline.departureOffsetH)
        const arrivalTimeCash = addMinutes(departureTime, airline.duracaoMin)
        const cpm = airline.taxas > 0 ? (airline.taxas / (airline.milhas / 1000)) : null

        // Cash flight
        flights.push({
            provider: 'mock',
            companhia: airline.companhia,
            preco_brl: airline.preco_brl,
            preco_milhas: null,
            taxas_brl: 0,
            cpm: null,
            partida: format(departureTime, "yyyy-MM-dd'T'HH:mm:ssxxx"),
            chegada: format(arrivalTimeCash, "yyyy-MM-dd'T'HH:mm:ssxxx"),
            origem,
            destino,
            duracao_min: airline.duracaoMin,
            cabin_class: 'economy',
            flight_key: `${airline.companhia.toLowerCase()}-cash-${idx}`,
            estrategia_disponivel: idx < 2,
            moeda: 'BRL',
            segmentos: [{ origem, destino, companhia: airline.companhia }],
            detalhes: { tipo: 'cash', cor: airline.cor },
        })

        // Miles flight
        flights.push({
            provider: 'mock',
            companhia: airline.companhia,
            preco_brl: null,
            preco_milhas: Math.round(airline.milhas * passageiros),
            taxas_brl: airline.taxas,
            cpm: cpm ? Math.round(cpm * 100) / 100 : null,
            partida: format(addMinutes(departureTime, 45), "yyyy-MM-dd'T'HH:mm:ssxxx"),
            chegada: format(addMinutes(arrivalTimeCash, 45), "yyyy-MM-dd'T'HH:mm:ssxxx"),
            origem,
            destino,
            duracao_min: airline.duracaoMin,
            cabin_class: 'economy',
            flight_key: `${airline.companhia.toLowerCase()}-miles-${idx}`,
            estrategia_disponivel: idx < 2,
            moeda: 'BRL',
            segmentos: [{ origem, destino, companhia: airline.companhia }],
            detalhes: { tipo: 'milhas', cor: airline.cor, programa: airline.companhia === 'GOL' ? 'Smiles' : airline.companhia === 'LATAM' ? 'LATAM Pass' : 'TudoAzul' },
        })
    })

    return flights
}
