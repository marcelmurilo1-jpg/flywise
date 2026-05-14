import { supabase } from './supabase.js';

export const SEATS_AERO_API_KEY = process.env.SEATS_AERO_API_KEY;
export const SEATS_AERO_BASE = 'https://seats.aero/partnerapi';

export async function fetchSeatsAeroAPI(origin, destination, startDate, endDate, userId = null) {
    // Log every real API call for quota monitoring (1000/day limit)
    if (supabase) {
        const logRow = {
            origin: (origin ?? '').toUpperCase(),
            destination: (destination ?? '').toUpperCase(),
            route: 'availability',
        };
        if (userId) logRow.user_id = userId;
        supabase.from('seatsaero_api_log').insert(logRow).then(() => {}).catch(() => {});
    }
    if (!SEATS_AERO_API_KEY) {
        throw new Error('SEATS_AERO_API_KEY não configurada. Adicione ao .env.local');
    }
    const params = new URLSearchParams({
        origin_airport: origin.toUpperCase(),
        destination_airport: destination.toUpperCase(),
        start_date: startDate,
        end_date: endDate ?? startDate,
        take: '50',
    });
    const res = await fetch(`${SEATS_AERO_BASE}/search?${params}`, {
        headers: {
            'Partner-Authorization': SEATS_AERO_API_KEY,
            'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(20000),
    });
    if (res.status === 429) throw new Error('Rate limit da API Seats.aero atingido. Aguarde alguns segundos.');
    if (res.status === 401) throw new Error('API Key do Seats.aero inválida ou sem permissão.');
    if (!res.ok) throw new Error(`Seats.aero API respondeu com status ${res.status}`);
    const data = await res.json();
    return data.data ?? [];
}

export const SOURCE_TO_PROGRAM = {
    smiles: 'Smiles', delta: 'SkyMiles', american: 'AAdvantage',
    united: 'MileagePlus', aeroplan: 'Aeroplan', flyingblue: 'Flying Blue',
    lifemiles: 'Lifemiles', virginatlantic: 'Virgin Points', alaska: 'Mileage Plan',
    latam: 'LATAM Pass', azul: 'TudoAzul', emirates: 'Skywards',
    turkish: 'Miles&Smiles', jetblue: 'TrueBlue', iberia: 'Iberia Plus',
    singapore: 'KrisFlyer', qatar: 'Avios (Qatar)', british: 'Avios (BA)',
    avianca: 'Lifemiles', aircanada: 'Aeroplan',
};

export function normalizeSourceKey(raw) {
    return (raw ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mapSeatsAeroItem(item, tipo = 'ida') {
    const origin = item.Route?.OriginAirport ?? '';
    const dest   = item.Route?.DestinationAirport ?? '';

    const parseMiles = (v) => {
        if (!v || v === '' || v === '0') return null;
        const n = parseInt(String(v).replace(/,/g, ''), 10);
        return isNaN(n) || n === 0 ? null : n;
    };

    const economy      = item.YAvailable ? parseMiles(item.YMileageCost) : null;
    const premEconomy  = item.WAvailable ? parseMiles(item.WMileageCost) : null;
    const business     = item.JAvailable ? parseMiles(item.JMileageCost) : null;
    const first        = item.FAvailable ? parseMiles(item.FMileageCost) : null;

    const bestMiles = economy ?? premEconomy ?? business ?? first;
    const bestCabin = economy != null ? 'Economy'
        : premEconomy != null ? 'Premium Economy'
        : business    != null ? 'Business' : 'First';

    const mainAirline = [item.YAirlines, item.WAirlines, item.JAirlines, item.FAirlines]
        .filter(Boolean)[0]?.split(',')[0]?.trim() ?? item.Source ?? '';

    const isDirect = item.YDirect || item.WDirect || item.JDirect || item.FDirect;

    let partida = null, chegada = null, duracaoMin = null, escalas = [];
    const trips = item.AvailabilityTrips ?? [];
    if (trips.length > 0) {
        const segs = trips[0]?.Segments ?? [];
        if (segs.length > 0) {
            partida  = segs[0]?.DepartureDateTime ?? segs[0]?.departure_datetime ?? null;
            chegada  = segs[segs.length - 1]?.ArrivalDateTime ?? segs[segs.length - 1]?.arrival_datetime ?? null;
            escalas  = segs.slice(0, -1).map(s => s.DestinationAirport ?? s.destination ?? '').filter(Boolean);
            if (partida && chegada) {
                const diffMs = new Date(chegada) - new Date(partida);
                if (diffMs > 0) duracaoMin = Math.round(diffMs / 60000);
            }
        }
    }

    return {
        availabilityId: item.ID ?? item.Id ?? null,
        companhiaAerea: mainAirline,
        rota: `${origin} → ${dest}`,
        origem: origin,
        destino: dest,
        paradas: isDirect ? 0 : Math.max(escalas.length, 1),
        escalas,
        dataVoo: item.Date ?? '',
        partida,
        chegada,
        duracaoMin,
        precoMilhas: bestMiles,
        cabineEncontrada: bestMiles != null ? bestCabin : null,
        economy,
        premiumEconomy: premEconomy,
        business,
        first,
        taxas: (() => {
            const amt = item.TaxAmount ?? item.Taxes ?? null;
            const cur = item.TaxCurrency ?? 'USD';
            if (amt && Number(amt) > 0) return `${cur} ${Number(amt) % 1 === 0 ? Number(amt) : Number(amt).toFixed(2)}`;
            const trip = (item.AvailabilityTrips ?? [])[0];
            if (trip?.TaxAmount && Number(trip.TaxAmount) > 0) return `${trip.TaxCurrency ?? 'USD'} ${Number(trip.TaxAmount).toFixed(2)}`;
            return '0';
        })(),
        tipo,
        source: item.Source ?? '',
        programName: SOURCE_TO_PROGRAM[normalizeSourceKey(item.Source ?? '')] ?? item.Source ?? '',
        remainingSeats: {
            economy:        item.YRemainingSeats ?? 0,
            premiumEconomy: item.WRemainingSeats ?? 0,
            business:       item.JRemainingSeats ?? 0,
            first:          item.FRemainingSeats ?? 0,
        },
    };
}
