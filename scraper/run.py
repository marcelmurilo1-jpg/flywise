#!/usr/bin/env python3
"""
run.py — Entry point do scraper FlyWise
Roda o scrape_passageiro.py e usa a tabela 'promocoes' do Supabase.

A tabela no Supabase já existe com a seguinte estrutura:
  id BIGSERIAL PRIMARY KEY
  titulo TEXT
  conteudo TEXT
  url TEXT UNIQUE
  fonte TEXT
  valid_until TIMESTAMPTZ
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

O scrape_passageiro.py usa a tabela com colunas legacy (title, content_text, etc.)
Este wrapper faz a ponte entre as duas.
"""
import os
import time
import json
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import Json

# Importa as funções do scraper original
import sys
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()
TZ = ZoneInfo("America/Sao_Paulo")
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL não encontrado no .env")

# Importa o scraper original como módulo
from scrape_passageiro import (
    posts_de_hoje,
    extrair_conteudo,
    delete_expired as _delete_expired_legacy,
)


def db_connect():
    return psycopg2.connect(DB_URL)


def delete_expired(conn):
    """Remove promoções expiradas da tabela Supabase."""
    cur = conn.cursor()
    now = datetime.now(TZ)
    cur.execute(
        "SELECT COUNT(*) FROM promocoes WHERE valid_until IS NOT NULL AND valid_until < %s",
        (now,)
    )
    count = cur.fetchone()[0]
    if count == 0:
        print("➡️  Sem promoções expiradas para remover.")
        return 0
    cur.execute(
        "DELETE FROM promocoes WHERE valid_until IS NOT NULL AND valid_until < %s RETURNING url",
        (now,)
    )
    removed = cur.fetchall()
    conn.commit()
    print(f"🗑️  Removidas {len(removed)} promoções expiradas.")
    return len(removed)


def upsert_promocao(conn, data: dict):
    """
    Insere ou atualiza uma promoção na tabela 'promocoes' do Supabase.
    Mapeia os campos do scraper para o schema do Supabase.
    """
    cur = conn.cursor()
    now = datetime.now(TZ)

    # Monta o conteúdo: usa content_text como principal
    conteudo = data.get("content_text") or data.get("content_html") or ""

    cur.execute(
        """
        INSERT INTO promocoes
            (titulo, conteudo, url, fonte, valid_until, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (url) DO UPDATE SET
            titulo     = EXCLUDED.titulo,
            conteudo   = EXCLUDED.conteudo,
            fonte      = EXCLUDED.fonte,
            valid_until = EXCLUDED.valid_until,
            updated_at = EXCLUDED.updated_at
        """,
        (
            data.get("title") or "Sem título",
            conteudo[:50000] if conteudo else None,   # limita tamanho
            data.get("url"),
            "passageirodeprimeira.com",
            data.get("valid_until"),
            now,
            now,
        ),
    )
    conn.commit()


def main():
    print("=" * 55)
    print("🛫  FlyWise Scraper — Passageiro de Primeira")
    print(f"⏰  {datetime.now(TZ).strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 55)

    conn = db_connect()
    print("✅  Conectado ao Supabase com sucesso.")

    # Remove promoções expiradas antes de coletar
    try:
        delete_expired(conn)
    except Exception as e:
        print(f"⚠️  Erro ao limpar expirados: {e}")

    # Busca posts de hoje no RSS
    items = posts_de_hoje()
    if not items:
        print("📭  Nenhum post de hoje encontrado no RSS.")
        conn.close()
        return

    print(f"\n📬  {len(items)} post(s) de hoje encontrados.\n")

    saved = 0
    for i, it in enumerate(items, start=1):
        print(f"[{i}/{len(items)}] ⏳ {it['link']}")
        try:
            data = extrair_conteudo(
                it["link"],
                feed_title=it.get("feed_title"),
                published_dt=it.get("published"),
            )
            upsert_promocao(conn, data)
            saved += 1
            titulo = (data.get("title") or "")[:60]
            print(f"   ✅ Salvo: {titulo}")
            if data.get("valid_until"):
                print(f"   ↳  Expira: {data['valid_until'].strftime('%d/%m/%Y %H:%M')}")
        except Exception as e:
            print(f"   ❌ Erro: {e}")
        time.sleep(1.5)

    conn.close()
    print(f"\n🏁  Concluído — {saved}/{len(items)} posts salvos no Supabase.")


if __name__ == "__main__":
    main()
