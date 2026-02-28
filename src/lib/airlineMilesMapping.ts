/**
 * airlineMilesMapping.ts
 *
 * Maps IATA airline codes → loyalty programs that allow redemption on that carrier.
 * Source: official partner agreements of each program (Feb 2026).
 *
 * Logic: if the user filters by "Smiles" they should see ALL airlines
 * where Smiles miles can be spent, not just GOL.
 */

export const PROGRAMS = [
    'Smiles',
    'LATAM Pass',
    'TudoAzul',
    'Livelo',
    'Aeroplan',
    'AAdvantage',
    'MileagePlus',
    'Flying Blue',
    'Lifemiles',
    'Miles&More',
    'Iberia Plus',
    'Miles&Go',
    'ConnectMiles',
    'ShebaMiles',
    'Miles&Smiles',
    'SkyMiles',
] as const

export type MilesProgram = typeof PROGRAMS[number]

/**
 * IATA code → list of programs that can redeem miles on that airline.
 * Add/adjust as partnerships change.
 */
export const AIRLINE_MILES_MAP: Record<string, MilesProgram[]> = {
    // ── Brazil ──────────────────────────────────────────────────────────────
    'LA': ['LATAM Pass', 'Smiles', 'Livelo'],          // LATAM Brasil
    'JJ': ['LATAM Pass', 'Smiles', 'Livelo'],          // LATAM Brasil (legacy)
    'G3': ['Smiles', 'Livelo'],                         // GOL
    'AD': ['TudoAzul', 'Livelo'],                       // Azul
    // ── North America ────────────────────────────────────────────────────────
    'AC': ['Smiles', 'Aeroplan', 'Livelo'],             // Air Canada
    'AA': ['Smiles', 'AAdvantage', 'Livelo'],           // American Airlines
    'UA': ['Smiles', 'MileagePlus', 'Livelo'],          // United Airlines
    'DL': ['Smiles', 'SkyMiles', 'Livelo'],             // Delta Air Lines
    'WS': ['Aeroplan', 'Smiles'],                       // WestJet
    // ── Europe ───────────────────────────────────────────────────────────────
    'TP': ['Miles&Go', 'Smiles', 'Livelo'],             // TAP Portugal
    'IB': ['Iberia Plus', 'Smiles', 'Livelo'],          // Iberia
    'AF': ['Flying Blue', 'Smiles', 'Livelo'],          // Air France
    'KL': ['Flying Blue', 'Smiles', 'Livelo'],          // KLM
    'LH': ['Miles&More', 'Smiles', 'Livelo'],           // Lufthansa
    'LX': ['Miles&More', 'Smiles', 'Livelo'],           // Swiss
    'OS': ['Miles&More', 'Smiles', 'Livelo'],           // Austrian
    'SN': ['Miles&More', 'Livelo'],                     // Brussels Airlines
    'BA': ['Smiles', 'Livelo'],                         // British Airways (via Avios partners)
    'SK': ['Smiles', 'Livelo'],                         // SAS
    'AZ': ['Smiles', 'Livelo'],                         // ITA Airways
    // ── Latam / Caribbean ────────────────────────────────────────────────────
    'AV': ['Lifemiles', 'Smiles', 'Livelo'],            // Avianca
    'CM': ['ConnectMiles', 'Smiles', 'Livelo'],         // Copa Airlines
    'AM': ['Smiles', 'Livelo'],                         // Aeromexico
    'AR': ['Smiles', 'Livelo'],                         // Aerolíneas Argentinas
    'UX': ['Smiles', 'Livelo'],                         // Air Europa
    // ── Africa / Middle East / Asia ──────────────────────────────────────────
    'ET': ['ShebaMiles', 'Smiles'],                    // Ethiopian Airlines
    'TK': ['Miles&Smiles', 'Smiles', 'Livelo'],        // Turkish Airlines
    'EK': ['Smiles', 'Livelo'],                         // Emirates
    'QR': ['Smiles', 'Livelo'],                         // Qatar Airways
    'SA': ['Smiles'],                                   // South African Airways
    'MH': ['Smiles', 'Livelo'],                         // Malaysia Airlines
    'SQ': ['Smiles', 'Livelo'],                         // Singapore Airlines
    'JL': ['Smiles', 'Livelo'],                         // Japan Airlines (JAL)
    'NH': ['Smiles', 'Livelo'],                         // ANA
    'CX': ['Smiles', 'Livelo'],                         // Cathay Pacific
}

/**
 * Returns all programs that can redeem miles on a given airline.
 * Falls back to Livelo (widely accepted) if not in map.
 */
export function getProgramsForAirline(iataCode: string): MilesProgram[] {
    return AIRLINE_MILES_MAP[iataCode?.toUpperCase()] ?? ['Livelo']
}

/**
 * Returns true if any of the selected programs can be used on the given airline.
 */
export function airlineMatchesPrograms(iataCode: string, selectedPrograms: string[]): boolean {
    if (!selectedPrograms.length) return true
    const programs = getProgramsForAirline(iataCode)
    return selectedPrograms.some(p => programs.includes(p as MilesProgram))
}

// Top programs to show as quick filters (most common in Brazil)
export const TOP_PROGRAMS: MilesProgram[] = [
    'Smiles',
    'LATAM Pass',
    'TudoAzul',
    'Livelo',
    'Aeroplan',
    'AAdvantage',
    'Flying Blue',
    'MileagePlus',
    'Lifemiles',
    'Miles&More',
]
