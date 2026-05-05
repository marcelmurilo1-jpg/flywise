import { Router } from 'express';
import { supabase } from '../lib/supabase.js';
import { requireSyncSecret } from '../middleware/auth.js';

const router = Router();

let promotionsCache = null;
let promotionsCacheAt = 0;
const PROMOTIONS_CACHE_TTL = 12 * 60 * 60 * 1000; // 12h

export const DEFAULT_PROMOTIONS_SEED = [
    { card_id: 'iupp_itau', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Itaú → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir — sem cadastro, sem bônus', 'Sem clube: 30%', 'Plano 1.000 mi: 70%', 'Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF', 'Milhas bônus creditadas em até 15 dias'], active: true },
    { card_id: 'nubank_ultravioleta', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Nubank → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Sem cadastro prévio = sem bônus', 'Mínimo de 2.500 Pontos Nubank por transferência', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'c6_atomos', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — C6 Bank → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'santander_esfera', program: 'Smiles', bonus_percent: 20, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Bônus de 20% permanente + campanhas periódicas para clube', description: '20% permanente para todos (Esfera) + por plano Clube Smiles em campanhas', is_periodic: false, last_confirmed: 'Mar/2026', registration_url: 'https://esfera.com.vc', rules: ['Bônus de 20% é permanente para todos os clientes Santander via Esfera', 'Clube Smiles ativo: bônus extra durante campanhas periódicas', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% (em campanhas)', 'Para campanhas extras: cadastre-se antes', 'Mínimo: 1.000 pontos Esfera', 'Prazo de crédito: até 5 dias úteis'], active: true },
    { card_id: 'xp_visa', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — XP → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se antes de transferir', 'Mínimo de 1.000 pts XP', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'btg_pactual', program: 'LATAM Pass', bonus_percent: 25, club_bonus_percent: 25, club_tier_bonuses: {}, club_required: null, valid_until: 'Campanha periódica (confirme em latampass.latam.com)', description: '25% de bônus + 1.000 milhas extras na primeira transferência BTG → LATAM Pass', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://latampass.latam.com/pt_br/junte-milhas', rules: ['⚠️ Registre-se na página da promoção antes de transferir', 'Bônus de 25% para todos os clientes BTG', '1.000 milhas extras na primeira transferência do período', 'Milhas bônus creditadas em até 30 dias', 'Validade das milhas bônus: 36 meses'], active: true },
    { card_id: 'inter_black', program: 'TudoAzul', bonus_percent: 80, club_bonus_percent: 130, club_tier_bonuses: { 'Plano 1.000 pts': 103, 'Plano 2.000 pts': 103, 'Plano 5.000 pts': 103, 'Plano 10.000 pts': 103, 'Plano 20.000 pts': 130 }, club_required: 'azul_fidelidade_clube', valid_until: 'Campanha periódica (confirme em tudoazul.voeazul.com.br)', description: '80% para todos; Clube Azul: 103%; 5+ anos assinatura: 130% — Inter → TudoAzul', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.voeazul.com.br/inter-pontos', rules: ['⚠️ Cadastre-se antes de transferir', 'Todos os clientes Inter: 80% de bônus', 'Assinantes do Clube Azul (qualquer plano): 103%', 'Assinantes há 5+ anos (Plano 20.000 pts): 130%', 'Limite: 300.000 pontos bônus por CPF', 'Creditação em até 15 dias úteis', 'Validade dos pontos bônus: 6 meses'], active: true },
    { card_id: 'inter_black', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Inter → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir — sem cadastro, sem bônus', 'Sem clube: 30%', 'Plano 1.000 mi: 70%', 'Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'bradesco_livelo', program: 'Livelo', bonus_percent: 0, club_bonus_percent: 0, club_tier_bonuses: {}, club_required: null, valid_until: 'Transferência padrão (sem campanha ativa no momento)', description: 'Bradesco/BB → Livelo: transferência 1:1, sem bônus atualmente.', is_periodic: false, last_confirmed: 'Mar/2026', registration_url: null, rules: ['Transferência Bradesco/BB → Livelo: taxa 1:1', 'Livelo → Smiles/LATAM/TudoAzul: também 1:1', 'Mínimo de 2.500 pts Bradesco/BB → Livelo', 'Mínimo de 15.000 pts Livelo → aérea', 'Transferência imediata: membros do Clube Livelo', 'Sem bônus de campanha ativo agora — aguarde promoções'], active: true },
    { card_id: 'caixa_uau', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — Caixa → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se ANTES de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
    { card_id: 'btg_pactual', program: 'Smiles', bonus_percent: 30, club_bonus_percent: 60, club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 }, club_required: 'smiles_club', valid_until: 'Campanha periódica (confirme em smiles.com.br)', description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — BTG → Smiles', is_periodic: true, last_confirmed: 'Mar/2026', registration_url: 'https://www.smiles.com.br/promocao-transferencia', rules: ['⚠️ Cadastre-se antes de transferir', 'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%', 'Planos maiores: confirmar na campanha vigente', 'Limite: 300.000 milhas bônus por CPF'], active: true },
];

async function seedPromotionsIfEmpty() {
    if (!supabase) return;
    try {
        const { count } = await supabase
            .from('transfer_promotions')
            .select('id', { count: 'exact', head: true })
            .eq('active', true);
        if (count > 0) {
            console.log(`[Promotions] Supabase já tem ${count} promoções — seed ignorado`);
            return;
        }
        console.log('[Promotions] Supabase vazio — inserindo dados default...');
        const { error } = await supabase
            .from('transfer_promotions')
            .upsert(DEFAULT_PROMOTIONS_SEED, { onConflict: 'card_id,program' });
        if (error) throw error;
        console.log(`[Promotions] Seed concluído: ${DEFAULT_PROMOTIONS_SEED.length} promoções inseridas`);
    } catch (err) {
        console.error('[Promotions] Erro no seed automático:', err.message);
    }
}

export async function refreshPromotionsCache() {
    if (!supabase) return;
    try {
        const { data, error } = await supabase
            .from('transfer_promotions')
            .select('*')
            .eq('active', true);
        if (error) throw error;
        if (data && data.length > 0) {
            promotionsCache = data.map(row => ({
                id: row.id,
                cardId: row.card_id,
                program: row.program,
                bonusPercent: row.bonus_percent ?? 0,
                clubBonusPercent: row.club_bonus_percent ?? 0,
                clubTierBonuses: row.club_tier_bonuses ?? {},
                clubRequired: row.club_required ?? null,
                validUntil: row.valid_until ?? '',
                description: row.description ?? '',
                isPeriodic: row.is_periodic ?? true,
                lastConfirmed: row.last_confirmed ?? '',
                rules: row.rules ?? [],
                registrationUrl: row.registration_url ?? undefined,
            }));
            promotionsCacheAt = Date.now();
            console.log(`[Promotions] Cache atualizado: ${promotionsCache.length} promoções`);
        } else {
            await seedPromotionsIfEmpty();
            const { data: seeded } = await supabase
                .from('transfer_promotions')
                .select('*')
                .eq('active', true);
            if (seeded && seeded.length > 0) {
                promotionsCache = seeded.map(row => ({
                    id: row.id,
                    cardId: row.card_id,
                    program: row.program,
                    bonusPercent: row.bonus_percent ?? 0,
                    clubBonusPercent: row.club_bonus_percent ?? 0,
                    clubTierBonuses: row.club_tier_bonuses ?? {},
                    clubRequired: row.club_required ?? null,
                    validUntil: row.valid_until ?? '',
                    description: row.description ?? '',
                    isPeriodic: row.is_periodic ?? true,
                    lastConfirmed: row.last_confirmed ?? '',
                    rules: row.rules ?? [],
                    registrationUrl: row.registration_url ?? undefined,
                }));
                promotionsCacheAt = Date.now();
                console.log(`[Promotions] Cache após seed: ${promotionsCache.length} promoções`);
            }
        }
    } catch (err) {
        console.error('[Promotions] Erro ao atualizar cache:', err.message);
    }
}

export function getPromotionsCache() { return promotionsCache; }
export function resetPromotionsCacheAt() { promotionsCacheAt = 0; }

// GET /api/transfer-promotions
router.get('/api/transfer-promotions', async (req, res) => {
    const stale = Date.now() - promotionsCacheAt > PROMOTIONS_CACHE_TTL;
    if (!promotionsCache || stale) {
        await refreshPromotionsCache();
    }
    res.json({
        promotions: promotionsCache ?? [],
        cachedAt: promotionsCacheAt ? new Date(promotionsCacheAt).toISOString() : null,
    });
});

// POST /api/transfer-promotions/update
router.post('/api/transfer-promotions/update', requireSyncSecret, async (req, res) => {
    await refreshPromotionsCache();
    res.json({ message: 'Cache de promoções atualizado', count: promotionsCache?.length ?? 0 });
});

// POST /api/admin/sync-promotions
router.post('/api/admin/sync-promotions', requireSyncSecret, async (req, res) => {
    const force = req.query.force === 'true' || req.body?.force === true;
    if (force && supabase) {
        await supabase.from('transfer_promotions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('transfer_promotions').insert(DEFAULT_PROMOTIONS_SEED);
        console.log('[Admin] Re-seed forçado concluído');
    } else {
        await seedPromotionsIfEmpty();
    }
    await refreshPromotionsCache();
    res.json({ message: force ? 'Re-seed forçado + cache atualizado' : 'Seed (se vazio) + cache atualizado', count: promotionsCache?.length ?? 0 });
});

export default router;
