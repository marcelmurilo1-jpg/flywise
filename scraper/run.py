#!/usr/bin/env python3
"""
run.py — Entry point do scraper FlyWise
Roda o scrape_passageiro.py e usa a tabela 'promocoes' do Supabase.

Schema da tabela 'promocoes':
  id BIGSERIAL PRIMARY KEY
  titulo TEXT
  conteudo TEXT
  url TEXT UNIQUE
  fonte TEXT
  valid_until TIMESTAMPTZ
  categoria TEXT          -- 'passagens' | 'milhas' (classificado automaticamente)
  programas_tags TEXT[]   -- ['Smiles','TudoAzul', ...]
  notificado_em TIMESTAMPTZ  -- NULL = ainda não notificado
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
"""
import os
import re
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from dotenv import load_dotenv
import psycopg2

# Importa as funções do scraper original
import sys
sys.path.insert(0, os.path.dirname(__file__))

load_dotenv()
TZ = ZoneInfo("America/Sao_Paulo")
DB_URL = (os.getenv("DATABASE_URL") or "").strip()
if not DB_URL:
    raise RuntimeError("DATABASE_URL não encontrado no .env")

# Importa o scraper original como módulo
from scrape_passageiro import (
    posts_de_hoje,
    extrair_conteudo,
    delete_expired as _delete_expired_legacy,
)
from scrape_melhores_destinos import (
    posts_de_hoje as md_posts_de_hoje,
    extrair_conteudo as md_extrair_conteudo,
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


# ─── Classifier ───────────────────────────────────────────────────────────────

_PROGRAMAS_KEYWORDS: dict[str, list[str]] = {
    "Smiles":      ["smiles", "gol"],
    "TudoAzul":    ["tudoazul", "tudo azul", "azul"],
    "LATAM Pass":  ["latam pass", "latam"],
    "Livelo":      ["livelo"],
    "Esfera":      ["esfera", "santander"],
    "Flying Blue": ["flying blue", "air france", "klm"],
    "AAdvantage":  ["aadvantage", "american airlines", "aa miles"],
    "MileagePlus": ["mileageplus", "united"],
}

_MILHAS_KEYWORDS = [
    "milhas", "pontos", "transferência", "transferencia", "bônus", "bonus",
    "clube", "assinatura", "award", "resgate", "acúmulo", "acumulo",
    "programa de fidelidade", "cartão de crédito", "cartao de credito",
] + [kw for kws in _PROGRAMAS_KEYWORDS.values() for kw in kws]

_PASSAGENS_KEYWORDS = [
    "passagem", "passagens", "voo", "voos", "flight", "tarifa", "tarifas",
    "bilhete", "bilhetes", "promoção aérea", "promocao aerea",
    "viagem", "destino", "ida e volta", "só ida", "so ida",
]

# Sub-categorias dentro de milhas
_TRANSFERENCIA_KEYWORDS = [
    "transferência", "transferencia", "bônus de transferência", "bonus de transferencia",
    "bônus transferência", "bonus transferencia", "transfer bonus",
    "bônus de pontos", "bonus de pontos", "promoção de transferência",
    "promocao de transferencia", "pontos extras",
]

_CLUBE_KEYWORDS = [
    "clube", "club smiles", "club latam", "club azul",
    "tudoazul família", "tudoazul familia", "tudoazul club",
    "assinatura", "mensalidade", "clube de assinatura", "plano clube",
]


def classificar(titulo: str, conteudo: str) -> tuple[str | None, str | None, list[str]]:
    """Retorna (categoria, subcategoria, programas_tags) a partir do texto da promoção."""
    texto = (titulo + " " + (conteudo or "")).lower()

    programas_tags = [
        prog for prog, kws in _PROGRAMAS_KEYWORDS.items()
        if any(kw in texto for kw in kws)
    ]

    milhas_score = sum(1 for kw in _MILHAS_KEYWORDS if kw in texto)
    passagens_score = sum(1 for kw in _PASSAGENS_KEYWORDS if kw in texto)

    if milhas_score == 0 and passagens_score == 0:
        return None, None, []
    elif milhas_score >= passagens_score:
        categoria = "milhas"
        trans_score = sum(1 for kw in _TRANSFERENCIA_KEYWORDS if kw in texto)
        clube_score = sum(1 for kw in _CLUBE_KEYWORDS if kw in texto)
        if trans_score > clube_score:
            subcategoria = "transferencia"
        elif clube_score > trans_score:
            subcategoria = "clube"
        else:
            subcategoria = None
        return categoria, subcategoria, programas_tags
    else:
        return "passagens", None, []


# ─── Extração de dados de clube ───────────────────────────────────────────────

# Padrões: "R$ 34,90/mês" | "R$ 34.90 por mês" | "R$34,90 mensais" | "R$ 34,90 ao mês"
_PRECO_CLUBE_RE = re.compile(
    r'r\$\s*(\d{1,3}(?:[.,]\d{2,3})?)\s*(?:/\s*m[eê]s|por\s+m[eê]s|mensais?|ao\s+m[eê]s)',
    re.IGNORECASE,
)

# Padrões: "20% de desconto na compra" | "20% OFF na compra de milhas" | "desconto de 20%"
# Exclui padrões de transferência/bônus de acúmulo para não confundir
_BONUS_COMPRA_RE = re.compile(
    r'(\d{1,3})\s*%\s*(?:de\s+)?(?:desconto|off)\s+(?:na\s+)?compra|'
    r'desconto\s+de\s+(\d{1,3})\s*%\s+(?:na\s+)?compra',
    re.IGNORECASE,
)


def _extrair_preco_clube(texto: str) -> float | None:
    """Extrai o preço mensal do clube em reais. Ex: 'R$ 34,90/mês' → 34.90"""
    m = _PRECO_CLUBE_RE.search(texto)
    if not m:
        return None
    valor = m.group(1).replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except ValueError:
        return None


def _extrair_bonus_compra_pct(texto: str) -> int | None:
    """Extrai o desconto na compra de milhas do clube. Ex: '20% de desconto na compra' → 20"""
    m = _BONUS_COMPRA_RE.search(texto)
    if not m:
        return None
    raw = m.group(1) or m.group(2)
    try:
        v = int(raw)
        return v if 5 <= v <= 60 else None  # desconto razoável: 5–60%
    except (ValueError, TypeError):
        return None


# ─── Upsert ───────────────────────────────────────────────────────────────────

def upsert_promocao(conn, data: dict, fonte: str = "passageirodeprimeira.com"):
    """
    Insere ou atualiza uma promoção na tabela 'promocoes' do Supabase.
    Mapeia os campos do scraper para o schema do Supabase e classifica automaticamente.
    """
    cur = conn.cursor()
    now = datetime.now(TZ)

    conteudo = data.get("content_html") or data.get("content_text") or ""
    texto_plano = data.get("content_text") or ""

    titulo = data.get("title") or "Sem título"
    categoria, subcategoria, programas_tags = classificar(titulo, conteudo)

    # Para promos de clube: extrai preço mensal e desconto na compra de milhas
    preco_clube: float | None = None
    bonus_pct: int | None = None
    if subcategoria == "clube":
        preco_clube = _extrair_preco_clube(titulo + " " + texto_plano)
        bonus_pct = _extrair_bonus_compra_pct(titulo + " " + texto_plano)

    cur.execute(
        """
        INSERT INTO promocoes
            (titulo, conteudo, url, fonte, valid_until, categoria, subcategoria,
             programas_tags, bonus_pct, preco_clube, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (url) DO UPDATE SET
            titulo         = EXCLUDED.titulo,
            conteudo       = EXCLUDED.conteudo,
            fonte          = EXCLUDED.fonte,
            valid_until    = EXCLUDED.valid_until,
            categoria      = EXCLUDED.categoria,
            subcategoria   = EXCLUDED.subcategoria,
            programas_tags = EXCLUDED.programas_tags,
            bonus_pct      = EXCLUDED.bonus_pct,
            preco_clube    = EXCLUDED.preco_clube,
            updated_at     = EXCLUDED.updated_at
        """,
        (
            titulo,
            conteudo[:50000] if conteudo else None,
            data.get("url"),
            fonte,
            data.get("valid_until"),
            categoria,
            subcategoria,
            programas_tags if programas_tags else None,
            bonus_pct,
            preco_clube,
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
            cat, sub, tags = classificar(titulo, data.get("content_text") or "")
            print(f"   ✅ Salvo: {titulo}")
            print(f"   ↳  Categoria: {cat or '?'}  |  Sub: {sub or '—'}  |  Tags: {tags or '—'}")
            if data.get("valid_until"):
                print(f"   ↳  Expira: {data['valid_until'].strftime('%d/%m/%Y %H:%M')}")
        except Exception as e:
            print(f"   ❌ Erro: {e}")
        time.sleep(1.5)

    conn.close()
    print(f"\n🏁  Concluído — {saved}/{len(items)} posts salvos no Supabase.")


def main_melhores_destinos():
    print("=" * 55)
    print("✈️   FlyWise Scraper — Melhores Destinos")
    print(f"⏰  {datetime.now(TZ).strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 55)

    conn = db_connect()
    print("✅  Conectado ao Supabase com sucesso.")

    items = md_posts_de_hoje()
    if not items:
        print("📭  Nenhum post de hoje encontrado no RSS do Melhores Destinos.")
        conn.close()
        return

    print(f"\n📬  {len(items)} post(s) de hoje encontrados.\n")

    saved = 0
    for i, it in enumerate(items, start=1):
        print(f"[{i}/{len(items)}] ⏳ {it['link']}")
        try:
            data = md_extrair_conteudo(
                it["link"],
                feed_title=it.get("feed_title"),
                published_dt=it.get("published"),
            )
            upsert_promocao(conn, data, fonte="melhoresdestinos.com.br")
            saved += 1
            titulo = (data.get("title") or "")[:60]
            cat, sub, tags = classificar(titulo, data.get("content_text") or "")
            print(f"   ✅ Salvo: {titulo}")
            print(f"   ↳  Categoria: {cat or '?'}  |  Sub: {sub or '—'}  |  Tags: {tags or '—'}")
            if data.get("valid_until"):
                print(f"   ↳  Expira: {data['valid_until'].strftime('%d/%m/%Y %H:%M')}")
        except Exception as e:
            print(f"   ❌ Erro: {e}")
        time.sleep(1.5)

    conn.close()
    print(f"\n🏁  Concluído — {saved}/{len(items)} posts salvos no Supabase.")


if __name__ == "__main__":
    import signal

    # GitHub Actions define GITHUB_ACTIONS=true automaticamente
    # Nesse caso roda uma vez e sai (o agendamento é feito pelo workflow)
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print("📋  Modo GitHub Actions — execução única")
        main()
        main_melhores_destinos()
    else:
        # Railway / servidor local — loop eterno, roda a cada hora
        INTERVAL_SECONDS = 3600

        def handle_signal(sig, frame):
            print("\n⛔  Sinal recebido, encerrando...")
            raise SystemExit(0)

        signal.signal(signal.SIGTERM, handle_signal)
        signal.signal(signal.SIGINT, handle_signal)

        print(f"🔄  Modo loop ativo — rodará a cada {INTERVAL_SECONDS // 60} minutos")
        while True:
            try:
                main()
                main_melhores_destinos()
            except Exception as e:
                print(f"❌  Erro em main(): {e}")
            print(f"\n⏳  Próxima execução em {INTERVAL_SECONDS // 60} minutos...\n")
            time.sleep(INTERVAL_SECONDS)

