#!/usr/bin/env python3
# scrape_passageiro.py
# Coletor do Passageiro de Primeira com detecção de valid_until melhorada
# e remoção automática de posts expirados antes da coleta.

import time
import json
import os
import re
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urljoin, urlparse
from typing import Optional, List

import feedparser
import requests
from bs4 import BeautifulSoup
from dateutil import parser as dateparser
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import Json

# -------- CONFIG --------
DEBUG = False   # <-- ative True para debugar posts específicos
SITE = "https://passageirodeprimeira.com"
RSS_URL = SITE + "/feed/"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120 Safari/537.36"
)
TZ = ZoneInfo("America/Sao_Paulo")
RATE_SECONDS = 1.5
REQUEST_TIMEOUT = 20
# ------------------------

# -------- DB CONFIG --------
load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise RuntimeError("DATABASE_URL não encontrado no .env")


def db_connect():
    return psycopg2.connect(DB_URL)


def init_db():
    conn = db_connect()
    cur = conn.cursor()
    cur.execute(
        """
    CREATE TABLE IF NOT EXISTS promocoes (
        id SERIAL PRIMARY KEY,
        url TEXT UNIQUE,
        title TEXT,
        date_published DATE,
        author TEXT,
        content_text TEXT,
        content_html TEXT,
        images_json JSONB,
        links_json JSONB,
        scraped_at TIMESTAMPTZ,
        valid_until TIMESTAMPTZ
    )
    """
    )
    conn.commit()
    return conn


def delete_expired(conn):
    """
    Remove da tabela 'promocoes' todas as linhas com valid_until não nulo e menor que o agora.
    Retorna número de registros removidos.
    """
    cur = conn.cursor()
    try:
        now_tz = datetime.now(TZ)
        # contar antes
        cur.execute(
            "SELECT COUNT(*) FROM promocoes WHERE valid_until IS NOT NULL AND valid_until < %s",
            (now_tz,),
        )
        count = cur.fetchone()[0]
        if count == 0:
            print("➡️  Sem posts expirados para remover.")
            return 0
        # remover e retornar URLs removidas para log
        cur.execute(
            "DELETE FROM promocoes WHERE valid_until IS NOT NULL AND valid_until < %s RETURNING url",
            (now_tz,),
        )
        removed = cur.fetchall()
        conn.commit()
        print(f"🗑️  Removidos {len(removed)} post(s) expirados.")
        # opcional: listar urls removidas (limitado)
        for r in removed[:50]:
            print("   -", r[0])
        if len(removed) > 50:
            print(f"   ... e mais {len(removed)-50} urls.")
        return len(removed)
    except Exception as e:
        conn.rollback()
        print("❌ Erro ao remover expirados:", e)
        return 0


def upsert_post(conn, data: dict):
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO promocoes
            (url, title, date_published, author, content_text, content_html, images_json, links_json, scraped_at, valid_until)
        VALUES
            (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON CONFLICT (url) DO UPDATE SET
            title = EXCLUDED.title,
            date_published = EXCLUDED.date_published,
            author = EXCLUDED.author,
            content_text = EXCLUDED.content_text,
            content_html = EXCLUDED.content_html,
            images_json = EXCLUDED.images_json,
            links_json = EXCLUDED.links_json,
            scraped_at = EXCLUDED.scraped_at,
            valid_until = EXCLUDED.valid_until
    """,
        (
            data.get("url"),
            data.get("title"),
            data.get("date_published"),
            data.get("author"),
            data.get("content_text"),
            data.get("content_html"),
            Json(data.get("images", [])),
            Json(data.get("links", [])),
            datetime.now(TZ),
            data.get("valid_until"),
        ),
    )
    conn.commit()


def safe_get_text(el):
    return el.get_text(strip=True) if el else None


def extract_jsonld(soup):
    objs = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            txt = script.string
            if not txt:
                continue
            parsed = json.loads(txt)
            objs.append(parsed)
        except Exception:
            continue
    return objs


def _collect_text_from_container(container):
    fragments = []
    allowed = set(
        [
            "p",
            "li",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "blockquote",
            "pre",
            "td",
            "th",
            "caption",
            "figcaption",
            "div",
            "section",
            "article",
            "strong",
            "em",
        ]
    )
    for descendant in container.descendants:
        if getattr(descendant, "name", None):
            name = descendant.name.lower()
            if name in allowed:
                text = descendant.get_text(" ", strip=True)
                if text:
                    fragments.append(text)
    cleaned = []
    prev = None
    for f in fragments:
        if f != prev:
            cleaned.append(f)
        prev = f
    return "\n\n".join(cleaned)


# --------- DETECTOR DE VALIDADE (MELHORADO) ---------
PT_MONTHS = {
    "janeiro": 1,
    "fevereiro": 2,
    "março": 3,
    "marco": 3,
    "abril": 4,
    "maio": 5,
    "junho": 6,
    "julho": 7,
    "agosto": 8,
    "setembro": 9,
    "outubro": 10,
    "novembro": 11,
    "dezembro": 12,
}
PT_WEEKDAYS = {
    "segunda": 0,
    "segunda-feira": 0,
    "terça": 1,
    "terca": 1,
    "terça-feira": 1,
    "terca-feira": 1,
    "quarta": 2,
    "quarta-feira": 2,
    "quinta": 3,
    "quinta-feira": 3,
    "sexta": 4,
    "sexta-feira": 4,
    "sábado": 5,
    "sabado": 5,
    "domingo": 6,
}

# palavras que tipicamente aparecem perto da validade
PROMO_KEYWORDS = [
    "promo",
    "promoção",
    "promoções",
    "válida",
    "válido",
    "válidos",
    "mecânica",
    "oferta",
    "campanha",
    "últimas horas",
    "últimas",
    "só até",
    "até amanhã",
    "até hoje",
    "somente até",
    "período de compra",
    "período de emissão",
    "oferta válida",
    "reservas",
    "período de compra:",
]

HIGH_PRIORITY_PHRASES = [
    "oferta válida",
    "promoção válida",
    "período de compra",
    "período de emissão",
    "reserva",
    "reservas",
    "período de compra:",
    "oferta válida até",
    "oferta válida até",
]


def _to_int(s, kind="generic", default=None):
    try:
        if s is None:
            return default
        v = int(str(s).strip())
        if kind == "hour":
            if v < 0 or v > 23:
                return default
        elif kind == "minute":
            if v < 0 or v > 59:
                return default
        return v
    except Exception:
        return default


def _mk_dt(base_date: datetime, day=None, month=None, year=None, hour=None, minute=None, second=0):
    y = year if year else base_date.year
    m = month if month else base_date.month
    d = day if day else base_date.day

    # sanitização de hora/minuto
    h = 23 if hour is None else hour
    mi = 59 if minute is None else minute
    if h < 0 or h > 23:
        h = 23
    if mi < 0 or mi > 59:
        mi = 59

    s = 59 if (hour is None and minute is None and second == 0) else (second or 0)
    return datetime(y, m, d, h, mi, s, tzinfo=TZ)


def _next_weekday_on_or_after(base_date: datetime, target_wd: int):
    delta = (target_wd - base_date.weekday()) % 7
    return base_date if delta == 0 else (base_date + timedelta(days=delta))


def _candidate_paragraphs(content_text: str) -> List[str]:
    """Retorna parágrafos candidatos, priorizando parágrafos com frases de alta prioridade."""
    paras = [p.strip() for p in content_text.split("\n\n") if p.strip()]
    priority = []
    normal = []
    for p in paras:
        low = p.lower()
        if any(phrase in low for phrase in HIGH_PRIORITY_PHRASES):
            priority.append(p)
        elif "até" in low and any(k in low for k in PROMO_KEYWORDS):
            normal.append(p)
        elif any(k in low for k in PROMO_KEYWORDS):
            normal.append(p)
    if priority:
        return priority + normal
    if normal:
        return normal
    # fallback: primeiros 8 parágrafos (para não perder nada)
    return paras[:8]


def _parse_date_from_text_snippet(txt: str, base_date: datetime) -> Optional[datetime]:
    """
    Tenta extrair uma data/hora de um snippet. Trata também UTC offsets se presentes.
    Retorna datetime timezone-aware em TZ.
    """
    txt_low = txt.lower()
    txt_low = re.sub(r"\s+", " ", txt_low).strip()

    def to_int(s):
        try:
            return int(s)
        except Exception:
            return None

    # detect tz in snippet like "utc+3" or "utc+03:00"
    tz_match = re.search(r"utc\s*([+-]\d{1,2})(?::?(\d{2}))?", txt_low)
    tz_offset_hours = None
    if tz_match:
        try:
            tz_offset_hours = int(tz_match.group(1))
        except Exception:
            tz_offset_hours = None

    # 1) patterns like "até amanhã (7)" or "até amanhã" with optional time
    m = re.search(
        r"até\s+amanh[ãa]\s*(?:\((\d{1,2})\))?(?:.*?(?:às|a)\s*(\d{1,2})(?::(\d{2}))?)?",
        txt_low,
    )
    if m:
        paren_day = to_int(m.group(1))
        hh = _to_int(m.group(2), kind="hour")
        mm = _to_int(m.group(3), kind="minute")
        if paren_day:
            try:
                dt = datetime(base_date.year, base_date.month, paren_day, 0, 0, 0, tzinfo=TZ)
            except Exception:
                dt = _mk_dt(base_date + timedelta(days=1), hour=hh if hh is not None else None, minute=mm if mm is not None else None, second=0)
        else:
            dt = _mk_dt(base_date + timedelta(days=1), hour=hh if hh is not None else None, minute=mm if mm is not None else None, second=0)
        if tz_offset_hours is not None:
            dt = dt.replace(tzinfo=timezone(timedelta(hours=tz_offset_hours))).astimezone(TZ)
        return dt

    # 2) patterns like "até hoje [às HH[:MM]]"
    m = re.search(r"até\s+hoje\b(?:.*?(?:às|a)\s*(\d{1,2})(?::(\d{2}))?)?", txt_low)
    if m:
        hh = _to_int(m.group(1), kind="hour")
        mm = _to_int(m.group(2), kind="minute")
        dt = _mk_dt(base_date, hour=hh if hh is not None else None, minute=mm if mm is not None else None, second=0)
        if tz_offset_hours is not None:
            dt = dt.replace(tzinfo=timezone(timedelta(hours=tz_offset_hours))).astimezone(TZ)
        return dt

    # 3) explicit dd/mm[/yyyy] optionally with time
    m = re.search(
        r"(\d{1,2})/(\d{1,2})(?:/(\d{2,4}))?(?:.*?(?:às|a)\s*(\d{1,2})(?::(\d{2}))?)?",
        txt_low,
    )
    if m:
        d = _to_int(m.group(1))
        mo = _to_int(m.group(2))
        y = _to_int(m.group(3))
        if y and y < 100:
            y += 2000
        y = y or base_date.year
        hh = _to_int(m.group(4), kind="hour")
        mm = _to_int(m.group(5), kind="minute")
        if 1 <= (d or 0) <= 31 and 1 <= (mo or 0) <= 12:
            hh_val = hh if hh is not None else 23
            mm_val = mm if mm is not None else 59
            dt = datetime(y, mo, d, hh_val, mm_val, 0, tzinfo=TZ)
            if tz_offset_hours is not None:
                dt_offset = datetime(y, mo, d, hh_val, mm_val, 0, tzinfo=timezone(timedelta(hours=tz_offset_hours)))
                dt = dt_offset.astimezone(TZ)
            return dt

    # 4) "até dia 17 de setembro [de 2025] [às HH:MM]" or "válida até dia 17 de setembro"
    m = re.search(
        r"(?:v[aá]lid[ao]s?\s*)?até\s+(?:o\s+)?(?:dia\s+)?(\d{1,2})(?:\s+de\s+([a-zçãéôíóú]+)(?:\s+de\s+(\d{4}))?)?(?:.*?(?:às|a)\s*(\d{1,2})(?::(\d{2}))?)?",
        txt_low,
    )
    if m:
        d = _to_int(m.group(1))
        mon_name = (m.group(2) or "").lower()
        mo = PT_MONTHS.get(mon_name) if mon_name else base_date.month
        y = _to_int(m.group(3)) or base_date.year
        hh = _to_int(m.group(4), kind="hour")
        mm = _to_int(m.group(5), kind="minute")
        if d and 1 <= d <= 31 and 1 <= mo <= 12:
            hh_val = hh if hh is not None else 23
            mm_val = mm if mm is not None else 59
            try:
                dt = datetime(y, mo, d, hh_val, mm_val, 0, tzinfo=TZ)
            except Exception:
                return None
            if tz_offset_hours is not None:
                dt = dt.replace(tzinfo=timezone(timedelta(hours=tz_offset_hours))).astimezone(TZ)
            return dt

    # 5) "até domingo (7)" or "até o domingo (7)" or "até domingo"
    m = re.search(r"até\s+(?:o\s+|deste\s+)?([a-zçãéôíóú]+)(?:\s*\((\d{1,2})\))?", txt_low)
    if m:
        wd_name = (m.group(1) or "").lower()
        paren_day = _to_int(m.group(2))
        if wd_name in PT_WEEKDAYS:
            if paren_day:
                try:
                    dt = datetime(base_date.year, base_date.month, paren_day, 23, 59, 0, tzinfo=TZ)
                except Exception:
                    target = _next_weekday_on_or_after(base_date, PT_WEEKDAYS[wd_name])
                    dt = _mk_dt(target, hour=None, minute=None, second=59)
            else:
                target = _next_weekday_on_or_after(base_date, PT_WEEKDAYS[wd_name])
                dt = _mk_dt(target, hour=None, minute=None, second=59)
            if tz_offset_hours is not None:
                dt = dt.replace(tzinfo=timezone(timedelta(hours=tz_offset_hours))).astimezone(TZ)
            return dt

    # 6) catch "até HH:MM deste domingo (7)" or "até as 23h59 deste domingo (7)"
    m = re.search(
        r"até\s+as?\s*(\d{1,2})(?::(\d{2}))?\s*(?:h)?\s*(?:deste|do|de|do dia)?\s*([a-zçãéôíóú]+)?(?:\s*\((\d{1,2})\))?",
        txt_low,
    )
    if m:
        hh = _to_int(m.group(1), kind="hour")
        mm = _to_int(m.group(2), kind="minute")
        wd_name = (m.group(3) or "").lower()
        paren_day = _to_int(m.group(4))
        if wd_name in PT_WEEKDAYS:
            if paren_day:
                try:
                    hh_val = hh if hh is not None else 23
                    mm_val = mm if mm is not None else 59
                    dt = datetime(base_date.year, base_date.month, paren_day, hh_val, mm_val, 0, tzinfo=TZ)
                except Exception:
                    target = _next_weekday_on_or_after(base_date, PT_WEEKDAYS[wd_name])
                    dt = _mk_dt(target, hour=hh if hh is not None else None, minute=mm if mm is not None else None, second=0)
            else:
                target = _next_weekday_on_or_after(base_date, PT_WEEKDAYS[wd_name])
                dt = _mk_dt(target, hour=hh if hh is not None else None, minute=mm if mm is not None else None, second=0)
            if tz_offset_hours is not None:
                dt = dt.replace(tzinfo=timezone(timedelta(hours=tz_offset_hours))).astimezone(TZ)
            return dt

    # 7) fallback: tentar usar dateparser no snippet inteiro, com RELATIVE_BASE = base_date
    try:
        dp = dateparser.parse(txt, settings={"RELATIVE_BASE": base_date, "PREFER_DAY_OF_MONTH": "first"})
        if dp:
            if dp.tzinfo:
                return dp.astimezone(TZ)
            else:
                return dp.replace(tzinfo=TZ)
    except Exception:
        pass

    return None


def detect_valid_until(content_text: str, published_dt: Optional[datetime]) -> Optional[datetime]:
    """
    Lógica:
    - extrai parágrafos candidatos (prioriza frases tipo 'Oferta válida / Período de compra')
    - tenta parse em cada snippet
    - aplica sanity checks e escolhe a data mais próxima >= published_dt
    """
    if not content_text or not published_dt:
        return None

    # ensure tz-aware published_dt
    published_dt = published_dt if published_dt.tzinfo else published_dt.replace(tzinfo=TZ)

    candidates = _candidate_paragraphs(content_text)
    parsed_dates: List[datetime] = []

    for c in candidates:
        dt = _parse_date_from_text_snippet(c, published_dt)
        if dt:
            # sanity: dt not too far in the past relative to published_dt (allow small negative drift)
            if dt < (published_dt - timedelta(days=3)):
                continue
            # sanity: dt not ridiculously far in the future (e.g., > 2 years)
            if dt > (published_dt + timedelta(days=730)):
                continue
            parsed_dates.append(dt)

    if DEBUG:
        print("DEBUG candidates:", len(candidates))
        for i, c in enumerate(candidates[:6]):
            print(f"DEBUG cand[{i}]:", c[:200])
        print("DEBUG parsed_dates:", parsed_dates)

    if not parsed_dates:
        return None

    # choose most appropriate: smallest dt >= published_dt; else smallest dt
    ge = [d for d in parsed_dates if d >= published_dt]
    if ge:
        return min(ge)
    return min(parsed_dates)


# ---------------------------------------


def extrair_conteudo(url, feed_title=None, published_dt: Optional[datetime] = None):
    headers = {"User-Agent": USER_AGENT, "Referer": SITE}
    resp = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    # título
    titulo_tag = soup.find("h1") or soup.find("h2")
    title = safe_get_text(titulo_tag) if titulo_tag else None
    if not title:
        og = soup.find("meta", property="og:title")
        if og and og.get("content"):
            title = og.get("content").strip()
    if not title and feed_title:
        title = feed_title
    if not title:
        title = "Sem título"

    # published_dt (prioridade: parâmetro > meta tag)
    if not published_dt:
        meta_pub = soup.find("meta", {"property": "article:published_time"})
        if meta_pub and meta_pub.get("content"):
            try:
                dt = dateparser.parse(meta_pub["content"])
                if dt.tzinfo:
                    published_dt = dt.astimezone(TZ)
                else:
                    published_dt = dt.replace(tzinfo=TZ)
            except Exception:
                published_dt = None

    date_published = published_dt.date() if published_dt else None

    # autor
    author_tag = soup.find(attrs={"rel": "author"}) or soup.find(class_="author") or soup.find(class_="byline")
    author = safe_get_text(author_tag)

    # conteúdo
    content_selectors = [
        "div.td-post-content",
        "div.entry-content",
        "div.post-content",
        "article .entry-content",
        "article",
        "main",
        "div.content",
        "section",
    ]
    content_soup = None
    for sel in content_selectors:
        el = soup.select_one(sel)
        if el:
            content_soup = el
            break
    if not content_soup:
        content_soup = soup.find("article") or soup.find("main") or soup.body or soup
    for bad in content_soup.find_all(["script", "style", "iframe", "ins", "noscript", "svg"]):
        bad.decompose()

    # ---- NOVO BLOCO: corta no "Central de cupons" (case-insensitive)
    raw_html = str(content_soup)
    stop_phrase = "central de cupons"
    low_html = raw_html.lower()
    if stop_phrase in low_html:
        # localizar posição insensível a maiúsc/minúsc
        idx = low_html.find(stop_phrase)
        raw_html = raw_html[:idx]
    content_soup = BeautifulSoup(raw_html, "html.parser")
    content_text = _collect_text_from_container(content_soup) or ""
    content_html = raw_html
    # ----------------------------

    # imagens
    images = []
    for img in content_soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src") or img.get("data-original")
        if src:
            images.append({
                "src": urljoin(url, src),
                "alt": img.get("alt", ""),
                "title": img.get("title", "")
            })

    # links
    links = []
    for a in content_soup.find_all("a", href=True):
        href = urljoin(url, a["href"])
        text = a.get_text(" ", strip=True)
        internal = urlparse(href).netloc.endswith(urlparse(SITE).netloc)
        links.append({"href": href, "text": text, "internal": internal})

    # validade (usa published_dt — que vem do RSS quando possível)
    valid_until = detect_valid_until(content_text, published_dt)

    if DEBUG:
        print("DEBUG published_dt:", published_dt)
        print("DEBUG content snippet:", content_text[:400])
        print("DEBUG detected valid_until:", valid_until)

    return {
        "url": url,
        "title": title,
        "date_published": date_published,
        "author": author,
        "content_text": content_text,
        "content_html": content_html,
        "images": images,
        "links": links,
        "valid_until": valid_until,
    }


def posts_de_hoje():
    feed = feedparser.parse(RSS_URL)
    hoje = datetime.now(TZ).date()
    items = []
    for entry in feed.entries:
        pub_dt = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                pub_dt = datetime(*entry.published_parsed[:6], tzinfo=TZ)
            except Exception:
                pub_dt = None
        if not pub_dt and hasattr(entry, "published"):
            try:
                dt = dateparser.parse(entry.published)
                pub_dt = dt.astimezone(TZ) if dt.tzinfo else dt.replace(tzinfo=TZ)
            except Exception:
                pub_dt = None
        if pub_dt:
            if pub_dt.date() == hoje:
                items.append({"link": entry.link, "feed_title": getattr(entry, "title", None), "published": pub_dt})
    # dedup
    seen = set()
    unique = []
    for it in items:
        if it["link"] not in seen:
            seen.add(it["link"])
            unique.append(it)
    return unique


def main():
    print("Iniciando coleta do Passageiro de Primeira (posts de hoje)...")
    conn = init_db()

    # -------------- limpeza: remove expirados antes de coletar --------------
    try:
        removed = delete_expired(conn)
    except Exception as e:
        print("❌ Falha ao executar limpeza de expirados:", e)
        removed = 0

    items = posts_de_hoje()
    if not items:
        print("Nenhum post de hoje encontrado.")
        conn.close()
        return
    print(f"Encontrados {len(items)} post(s) de hoje.\n")

    saved_count = 0
    for i, it in enumerate(items, start=1):
        print(f"[{i}/{len(items)}] Processando: {it['link']}")
        try:
            data = extrair_conteudo(it["link"], feed_title=it.get("feed_title"), published_dt=it.get("published"))
            upsert_post(conn, data)
            saved_count += 1
            print(f"   ✅ Salvo: {data.get('title')}")
            if data.get("valid_until"):
                # data já é datetime tz-aware
                print(f"      ↳ expira em: {data['valid_until'].isoformat()}")
        except Exception as e:
            print(f"   ❌ Erro: {e}")
        time.sleep(RATE_SECONDS)
    conn.close()
    print(f"Concluído. {saved_count} posts salvos.")


if __name__ == "__main__":
    main()
