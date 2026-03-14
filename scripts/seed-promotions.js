#!/usr/bin/env node
// ─── scripts/seed-promotions.js ──────────────────────────────────────────────
// Popula a tabela `transfer_promotions` no Supabase com os dados oficiais
// de promoções de transferência de cartão → programa de milhas.
//
// Uso:
//   node scripts/seed-promotions.js           → insere se tabela vazia
//   node scripts/seed-promotions.js --force   → limpa e re-insere tudo
//
// Requisitos: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltam variáveis de ambiente: VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const force = process.argv.includes('--force');

// ─── Dados validados (mar/2026) ───────────────────────────────────────────────
// Fontes: Passageiro de Primeira, Melhores Destinos, páginas oficiais dos programas
// Ratios: todos 1:1 (padrão Brasil).
// Bônus Clube Smiles por plano: 1k=70%, 2k=80% (confirmado); 5k+: estimativa típica.
// Inter→TudoAzul: 80% base, 103% Clube Azul (qualquer plano), 130% 5+ anos (confirmado).
// Santander→Smiles: 20% permanente via Esfera (não requer campanha).

const PROMOTIONS = [
    {
        card_id: 'iupp_itau',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Itaú Iupp → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção ANTES de transferir — sem cadastro, sem bônus',
            'Sem clube: 30% de bônus',
            'Clube Smiles Plano 1.000 mi: 70% de bônus (confirmado)',
            'Clube Smiles Plano 2.000 mi: 80% de bônus (confirmado)',
            'Planos 5k, 10k, Diamante: bônus maior — confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF ou Conta Família',
            'Milhas bônus creditadas em até 15 dias após encerramento da campanha',
            'Validade das milhas bônus: 12 meses após creditação',
        ],
        active: true,
    },
    {
        card_id: 'nubank_ultravioleta',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Nubank → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção ANTES de transferir',
            'Sem cadastro prévio = sem bônus (sem exceções)',
            'Mínimo de 2.500 Pontos Nubank por transferência',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% de bônus',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
            'Validade das milhas bônus: 12 meses',
        ],
        active: true,
    },
    {
        card_id: 'c6_atomos',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — C6 Bank → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção antes de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% de bônus',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
            'Prazo de creditação: até 5 dias úteis para a transferência base',
        ],
        active: true,
    },
    {
        card_id: 'santander_esfera',
        program: 'Smiles',
        bonus_percent: 20,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Bônus de 20% permanente + campanhas periódicas para clube',
        description: '20% permanente para todos os clientes Santander (Esfera) + bônus Clube Smiles em campanhas',
        is_periodic: false,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://esfera.com.vc',
        rules: [
            'Bônus de 20% é PERMANENTE para todos os clientes Santander via Esfera (sem campanha)',
            'Clube Smiles ativo: bônus extra durante campanhas periódicas',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% (em campanhas)',
            'Para campanhas extras: cadastre-se na página da promoção antes',
            'Mínimo: 1.000 pontos Esfera por transferência',
            'Prazo de crédito: até 5 dias úteis',
        ],
        active: true,
    },
    {
        card_id: 'xp_visa',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — XP → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção antes de transferir',
            'Mínimo de 1.000 XP Pontos por transferência',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Limite: 300.000 milhas bônus por CPF',
        ],
        active: true,
    },
    {
        card_id: 'btg_pactual',
        program: 'LATAM Pass',
        bonus_percent: 25,
        club_bonus_percent: 25,
        club_tier_bonuses: {},
        club_required: null,
        valid_until: 'Campanha periódica (confirme em latampass.latam.com)',
        description: '25% de bônus + 1.000 milhas extras na primeira transferência — BTG → LATAM Pass',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://latampass.latam.com/pt_br/junte-milhas',
        rules: [
            '⚠️ Registre-se na página da promoção antes de transferir',
            'Bônus de 25% válido para todos os clientes BTG Pactual',
            '1.000 milhas extras na primeira transferência do período',
            'Milhas bônus creditadas em até 30 dias',
            'Validade das milhas bônus: 36 meses',
        ],
        active: true,
    },
    {
        card_id: 'inter_black',
        program: 'TudoAzul',
        bonus_percent: 80,
        club_bonus_percent: 130,
        club_tier_bonuses: { 'Plano 1.000 pts': 103, 'Plano 2.000 pts': 103, 'Plano 5.000 pts': 103, 'Plano 10.000 pts': 103, 'Plano 20.000 pts': 130 },
        club_required: 'azul_fidelidade_clube',
        valid_until: 'Campanha periódica (confirme em tudoazul.voeazul.com.br)',
        description: '80% para todos; Clube Azul (qualquer plano): 103%; 5+ anos de assinatura: 130% — Inter → TudoAzul',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.voeazul.com.br/inter-pontos',
        rules: [
            '⚠️ Cadastre-se na página da promoção antes de transferir',
            'Todos os clientes Inter: 80% de bônus',
            'Assinantes do Clube Azul Fidelidade (qualquer plano): 103% de bônus',
            'Assinantes há 5+ anos (Plano 20.000 pts): 130% de bônus',
            'Limite: 300.000 pontos bônus por CPF',
            'Creditação em até 15 dias úteis',
            'Validade dos pontos bônus: 6 meses',
        ],
        active: true,
    },
    {
        card_id: 'inter_black',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% (e mais) — Inter → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção ANTES de transferir — sem cadastro, sem bônus',
            'Sem clube: 30% de bônus',
            'Clube Smiles Plano 1.000 mi: 70% de bônus (confirmado)',
            'Clube Smiles Plano 2.000 mi: 80% de bônus (confirmado)',
            'Planos 5k, 10k, Diamante: bônus maior — confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
        ],
        active: true,
    },
    {
        card_id: 'bradesco_livelo',
        program: 'Livelo',
        bonus_percent: 0,
        club_bonus_percent: 0,
        club_tier_bonuses: {},
        club_required: null,
        valid_until: 'Transferência padrão (sem campanha ativa no momento)',
        description: 'Bradesco/BB → Livelo: transferência 1:1, sem bônus atualmente.',
        is_periodic: false,
        last_confirmed: 'Mar/2026',
        registration_url: null,
        rules: [
            'Transferência Bradesco/BB → Livelo: taxa 1:1',
            'Depois, Livelo → Smiles/LATAM/TudoAzul: também 1:1',
            'Mínimo de 2.500 pts por transferência Bradesco/BB → Livelo',
            'Mínimo de 15.000 pts por transferência Livelo → aérea',
            'Transferência imediata disponível para membros do Clube Livelo',
            'Sem bônus de campanha ativo no momento — aguarde promoções periódicas',
        ],
        active: true,
    },
    {
        card_id: 'caixa_uau',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — Caixa UAU → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se na promoção ANTES de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80% de bônus',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
        ],
        active: true,
    },
    {
        card_id: 'btg_pactual',
        program: 'Smiles',
        bonus_percent: 30,
        club_bonus_percent: 60,
        club_tier_bonuses: { 'Plano 1.000 mi': 70, 'Plano 2.000 mi': 80, 'Plano 5.000 mi': 100, 'Plano 10.000 mi': 120, 'Plano 20.000 mi / Diamante': 130 },
        club_required: 'smiles_club',
        valid_until: 'Campanha periódica (confirme em smiles.com.br)',
        description: 'Bônus de 30% para todos; por plano Clube Smiles: 1k=70%, 2k=80% — BTG → Smiles',
        is_periodic: true,
        last_confirmed: 'Mar/2026',
        registration_url: 'https://www.smiles.com.br/promocao-transferencia',
        rules: [
            '⚠️ Cadastre-se antes de transferir',
            'Plano 1.000 mi: 70%; Plano 2.000 mi: 80%',
            'Planos maiores: confirmar na campanha vigente',
            'Limite: 300.000 milhas bônus por CPF',
        ],
        active: true,
    },
];

async function main() {
    console.log(`\n🚀 FlyWise — Seed de promoções de transferência`);
    console.log(`Modo: ${force ? '⚠️  FORCE (limpa e re-insere tudo)' : 'Safe (só insere se vazio)'}\n`);

    if (force) {
        console.log('Limpando tabela transfer_promotions...');
        const { error: delErr } = await supabase
            .from('transfer_promotions')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        if (delErr) { console.error('❌ Erro ao limpar:', delErr.message); process.exit(1); }
        console.log('✅ Tabela limpa\n');
    } else {
        const { count } = await supabase
            .from('transfer_promotions')
            .select('id', { count: 'exact', head: true })
            .eq('active', true);
        if (count > 0) {
            console.log(`ℹ️  Tabela já tem ${count} promoção(ões). Use --force para re-seed.\n`);
            process.exit(0);
        }
    }

    console.log(`Inserindo ${PROMOTIONS.length} promoções...`);
    const { error } = await supabase.from('transfer_promotions').insert(PROMOTIONS);
    if (error) {
        console.error('❌ Erro ao inserir:', error.message);
        console.error('Dica: verifique se a tabela transfer_promotions existe com as colunas corretas.');
        process.exit(1);
    }
    console.log(`✅ ${PROMOTIONS.length} promoções inseridas com sucesso!\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
