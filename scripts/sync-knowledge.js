#!/usr/bin/env node
/**
 * ─── Sync Obsidian → Supabase knowledge_base ──────────────────────────────────
 *
 * Lê todos os arquivos .md do vault Obsidian e faz upsert na tabela knowledge_base.
 * Notas sem frontmatter válido (title + programs + topics) são ignoradas.
 * Notas que sumiram do vault são marcadas como active = false (soft delete).
 *
 * Uso:
 *   OBSIDIAN_VAULT_PATH=./knowledge \
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... \
 *   node scripts/sync-knowledge.js
 *
 * Ou com dotenv:
 *   node -r dotenv/config scripts/sync-knowledge.js dotenv_config_path=.env.local
 */

import { createClient } from '@supabase/supabase-js'
import matter from 'gray-matter'
import fs from 'fs'
import path from 'path'

const VAULT  = process.env.OBSIDIAN_VAULT_PATH
const URL    = process.env.SUPABASE_URL
const KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!VAULT || !URL || !KEY) {
    console.error('Variáveis obrigatórias: OBSIDIAN_VAULT_PATH, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
}

const sb = createClient(URL, KEY)

// ─── Coleta todos os .md recursivamente ───────────────────────────────────────
function coletarArquivos(dir, lista = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) coletarArquivos(full, lista)
        else if (entry.name.endsWith('.md')) lista.push(full)
    }
    return lista
}

// ─── Converte nome de arquivo em slug ─────────────────────────────────────────
function toSlug(filePath) {
    return path.basename(filePath, '.md')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')   // remove acentos
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function run() {
    const arquivos = coletarArquivos(VAULT)
    console.log(`\n📚 ${arquivos.length} arquivos encontrados em ${VAULT}\n`)

    const slugsVistos = new Set()
    let ok = 0, ignorados = 0, erros = 0

    for (const filePath of arquivos) {
        const raw = fs.readFileSync(filePath, 'utf8')
        const { data: fm, content } = matter(raw)

        if (!fm.title || !fm.programs || !fm.topics) {
            console.warn(`  IGNORADO (sem frontmatter): ${path.relative(VAULT, filePath)}`)
            ignorados++
            continue
        }

        const slug = toSlug(filePath)
        slugsVistos.add(slug)

        const row = {
            slug,
            title:      String(fm.title),
            content:    content.trim(),
            programs:   Array.isArray(fm.programs) ? fm.programs : [fm.programs],
            topics:     Array.isArray(fm.topics)   ? fm.topics   : [fm.topics],
            routes:     Array.isArray(fm.routes)   ? fm.routes   : (fm.routes ? [fm.routes] : []),
            updated_at: new Date().toISOString(),
            active:     true,
        }

        const { error } = await sb.from('knowledge_base').upsert(row, { onConflict: 'slug' })

        if (error) {
            console.error(`  ERRO ${slug}:`, error.message)
            erros++
        } else {
            console.log(`  ✓ ${slug}`)
            ok++
        }
    }

    // Soft-delete: desativa notas que não estão mais no vault
    if (slugsVistos.size > 0) {
        const slugsList = [...slugsVistos].map(s => `'${s}'`).join(',')
        const { error } = await sb
            .from('knowledge_base')
            .update({ active: false })
            .not('slug', 'in', `(${slugsList})`)
            .eq('active', true)
        if (error) console.warn('  AVISO soft-delete:', error.message)
    }

    console.log(`\nConcluído: ${ok} sincronizados, ${ignorados} ignorados, ${erros} erros\n`)
}

run().catch(err => {
    console.error('Erro fatal:', err)
    process.exit(1)
})
