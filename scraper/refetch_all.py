#!/usr/bin/env python3
"""
refetch_all.py — Re-extrai conteúdo de todos os posts já salvos na tabela 'promocoes'.

Útil quando os seletores do scraper mudam e queremos reprocessar a base existente
sem esperar o RSS publicar tudo de novo.

Uso:
    python refetch_all.py                          # reprocessa tudo (ambas fontes)
    python refetch_all.py --fonte passageirodeprimeira.com
    python refetch_all.py --fonte melhoresdestinos.com.br
    python refetch_all.py --limit 50               # processa só 50 posts
    python refetch_all.py --min-conteudo 1000      # só re-busca posts com conteudo < 1000 chars
    python refetch_all.py --dry-run                # apenas reporta, não escreve

Variável de ambiente exigida: DATABASE_URL
"""
import argparse
import os
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2
from dotenv import load_dotenv

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_passageiro import extrair_conteudo as pp_extrair_conteudo
from scrape_melhores_destinos import extrair_conteudo as md_extrair_conteudo
from run import classificar, _extrair_preco_clube, _extrair_bonus_compra_pct

load_dotenv()
TZ = ZoneInfo("America/Sao_Paulo")

EXTRACTORS = {
    "passageirodeprimeira.com": pp_extrair_conteudo,
    "melhoresdestinos.com.br":  md_extrair_conteudo,
}


def db_connect():
    url = (os.getenv("DATABASE_URL") or "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL não encontrado.")
    return psycopg2.connect(url)


def fetch_targets(conn, fonte: str | None, min_conteudo: int | None, limit: int | None):
    cur = conn.cursor()
    sql = "SELECT id, url, fonte, created_at, COALESCE(LENGTH(conteudo), 0) AS clen FROM promocoes WHERE 1=1"
    params: list = []
    if fonte:
        sql += " AND fonte = %s"
        params.append(fonte)
    if min_conteudo is not None:
        sql += " AND COALESCE(LENGTH(conteudo), 0) < %s"
        params.append(min_conteudo)
    sql += " ORDER BY created_at DESC"
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    cur.execute(sql, params)
    return cur.fetchall()


def update_post(conn, id_: int, url: str, fonte: str, data: dict, dry_run: bool):
    conteudo = data.get("content_html") or data.get("content_text") or ""
    texto_plano = data.get("content_text") or ""
    titulo = data.get("title") or "Sem título"
    valid_until = data.get("valid_until")
    categoria, subcategoria, programas_tags = classificar(titulo, conteudo)

    if categoria in ("noticias", "compras"):
        valid_until = None

    preco_clube = bonus_pct = None
    if subcategoria == "clube":
        preco_clube = _extrair_preco_clube(titulo + " " + texto_plano)
        bonus_pct = _extrair_bonus_compra_pct(titulo + " " + texto_plano)

    if dry_run:
        return len(conteudo)

    cur = conn.cursor()
    cur.execute(
        """
        UPDATE promocoes SET
            titulo         = %s,
            conteudo       = %s,
            fonte          = %s,
            valid_until    = %s,
            categoria      = %s,
            subcategoria   = %s,
            programas_tags = %s,
            bonus_pct      = %s,
            preco_clube    = %s,
            updated_at     = %s
        WHERE id = %s
        """,
        (
            titulo,
            conteudo[:50000] if conteudo else None,
            fonte,
            valid_until,
            categoria,
            subcategoria,
            programas_tags if programas_tags else None,
            bonus_pct,
            preco_clube,
            datetime.now(TZ),
            id_,
        ),
    )
    conn.commit()
    return len(conteudo)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fonte", choices=list(EXTRACTORS.keys()))
    ap.add_argument("--limit", type=int)
    ap.add_argument("--min-conteudo", type=int, dest="min_conteudo",
                    help="Re-busca apenas posts cujo conteudo atual tenha menos que N chars.")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rate", type=float, default=1.5, help="segundos entre requests")
    args = ap.parse_args()

    print("=" * 60)
    print("🔁 FlyWise — Refetch de posts existentes")
    print(f"⏰ {datetime.now(TZ).strftime('%d/%m/%Y %H:%M:%S')}")
    if args.fonte:        print(f"   fonte: {args.fonte}")
    if args.min_conteudo: print(f"   só posts com conteudo < {args.min_conteudo} chars")
    if args.limit:        print(f"   limit: {args.limit}")
    if args.dry_run:      print(f"   DRY-RUN — nada será escrito")
    print("=" * 60)

    conn = db_connect()
    targets = fetch_targets(conn, args.fonte, args.min_conteudo, args.limit)
    print(f"📋 {len(targets)} post(s) a reprocessar.\n")
    if not targets:
        return

    ok = fail = 0
    sizes_before: list[int] = []
    sizes_after: list[int] = []

    for i, (id_, url, fonte, _created, clen) in enumerate(targets, start=1):
        extractor = EXTRACTORS.get(fonte)
        if not extractor:
            print(f"[{i}/{len(targets)}] ⏭  fonte desconhecida: {fonte} — pulando")
            continue
        try:
            data = extractor(url)
            new_len = update_post(conn, id_, url, fonte, data, args.dry_run)
            sizes_before.append(clen)
            sizes_after.append(new_len)
            ok += 1
            delta = new_len - clen
            arrow = "↑" if delta > 0 else ("↓" if delta < 0 else "·")
            print(f"[{i}/{len(targets)}] ✅ id={id_} {clen}→{new_len} chars ({arrow}{abs(delta)})  {url[-60:]}")
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(targets)}] ❌ id={id_} {e}")
        time.sleep(args.rate)

    conn.close()

    if sizes_before:
        avg_before = sum(sizes_before) / len(sizes_before)
        avg_after  = sum(sizes_after)  / len(sizes_after)
        print()
        print(f"🏁 Resumo: {ok} ok, {fail} falhas")
        print(f"   tamanho médio antes: {int(avg_before)} chars")
        print(f"   tamanho médio depois:{int(avg_after)} chars")
        if avg_before > 0:
            print(f"   ganho médio: +{int((avg_after / avg_before - 1) * 100)}%")


if __name__ == "__main__":
    main()
