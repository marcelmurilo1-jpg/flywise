import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase.js';

export const WATCHLIST_PLAN_LIMITS = { free: 0, essencial: 3, pro: 10, elite: 999, admin: 999 };

export async function getWatchlistLimit(userId) {
    if (!supabase) return 0;
    const { data } = await supabase.from('user_profiles').select('plan').eq('id', userId).single();
    const plan = (data?.plan ?? 'free').toLowerCase();
    return WATCHLIST_PLAN_LIMITS[plan] ?? 0;
}

export function requireSyncSecret(req, res, next) {
    if (process.env.NODE_ENV !== 'production') return next();
    const secret = req.headers['x-sync-secret'] ?? '';
    if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
}

export async function requireUserJWT(req, res, next) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Token inválido' });
    req.userId = user.id;
    next();
}

export async function requireAdminJWT(req, res, next) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token não fornecido' });
    if (!supabase) return res.status(503).json({ error: 'Supabase indisponível' });

    let userId;
    let user;

    const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && authUser) {
        userId = authUser.id;
        user = authUser;
    } else {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error('JWT malformado');
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            if (!payload.sub) throw new Error('JWT sem sub');
            if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
                return res.status(401).json({ error: 'Sessão expirada' });
            }
            userId = payload.sub;
        } catch {
            return res.status(401).json({ error: 'Token inválido' });
        }
    }

    const queryClient = user ? supabase : createClient(
        process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }
    );

    const { data: profile, error: profileErr } = await queryClient
        .from('user_profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();

    console.log('[AdminAuth] userId:', userId, '| profile:', JSON.stringify(profile), '| err:', profileErr?.message);

    if (!profile?.is_admin) return res.status(403).json({ error: 'Acesso negado' });
    req.adminUserId = userId;
    next();
}
