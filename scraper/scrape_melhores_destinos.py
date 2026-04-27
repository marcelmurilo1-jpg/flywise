"""
Scraper para Melhores Destinos (melhoresdestinos.com.br).
Segue o mesmo contrato de scrape_passageiro.py:
  - posts_de_hoje() → lista de dicts com keys: link, feed_title, published
  - extrair_conteudo(url, feed_title, published_dt) → dict com keys:
      url, title, content_html, content_text, valid_until, date_published
"""
import os
import re
import sys
from datetime import datetime, date, timedelta, timezone
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup

# Reutiliza a lógica de detecção de validade do scraper do Passageiro de Primeira
sys.path.insert(0, os.path.dirname(__file__))
from scrape_passageiro import detect_valid_until  # noqa: E402

TZ = ZoneInfo("America/Sao_Paulo")
HOMEPAGE_URL = "https://www.melhoresdestinos.com.br/"
SITE_BASE = "https://www.melhoresdestinos.com.br"
RATE_SECONDS = 1.5
REQUEST_TIMEOUT = 20
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    )
}

_CONTENT_SELECTORS = [
    "div.entry-content",
    "div.post-content",
    "div.td-post-content",
    "article .entry-content",
    "article",
    "main",
    "div.content",
    "section",
]

_STOP_PHRASES = [
    "quer ficar por dentro",
    "siga o melhores destinos",
    "newsletter",
    "receba nossas dicas",
    "compartilhe este post",
    "tags relacionadas",
]

_REMOVE_TAGS = {"script", "style", "iframe", "ins", "noscript", "svg", "form", "aside"}
_TEXT_TAGS = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "div", "span", "a"}


# ─── Homepage scraping ────────────────────────────────────────────────────────

_TEMPO_RE = re.compile(r"há\s+(\d+)\s+(minuto|minutos|hora|horas|dia|dias)")


def _relative_to_datetime(texto: str) -> datetime | None:
    """Converte 'há X minutos/horas/dias' em datetime absoluto (BRT)."""
    m = _TEMPO_RE.search(texto.lower())
    if not m:
        return None
    n, unit = int(m.group(1)), m.group(2)
    now = datetime.now(TZ)
    if "minuto" in unit:
        return now - timedelta(minutes=n)
    if "hora" in unit:
        return now - timedelta(hours=n)
    if "dia" in unit:
        return now - timedelta(days=n)
    return None


def posts_de_hoje() -> list[dict]:
    """
    Raspa a homepage do Melhores Destinos e retorna posts das últimas 24h.
    Retorna lista de dicts: {link, feed_title, published}
    """
    try:
        resp = requests.get(HOMEPAGE_URL, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        print(f"[MD] Erro ao acessar homepage: {e}")
        return []

    cutoff = datetime.now(TZ) - timedelta(hours=24)
    seen_urls: set[str] = set()
    results = []

    # Dois estilos de card na homepage: div.card (principal) e div.fim-card (sidebar/lista)
    for span in soup.find_all("span", string=_TEMPO_RE):
        pub = _relative_to_datetime(span.get_text())
        if pub is None or pub < cutoff:
            continue

        # Sobe até encontrar o <a> ancestral com href do site
        a_tag = span.find_parent("a")
        if not a_tag:
            card = span.find_parent("div", class_=re.compile(r"card"))
            if card:
                a_tag = card.find_parent("a")
        if not a_tag:
            continue

        link = a_tag.get("href", "")
        if not link.startswith("https://www.melhoresdestinos.com.br"):
            continue
        if link in seen_urls:
            continue
        seen_urls.add(link)

        # Título: h2 dentro do card ou feed_title vazio (extrair_conteudo pega do HTML)
        title_el = a_tag.find("h2") or a_tag.find("h3") or a_tag.find("p")
        feed_title = title_el.get_text(strip=True) if title_el else ""

        results.append({"link": link, "feed_title": feed_title, "published": pub})

    return results


# ─── HTML helpers ─────────────────────────────────────────────────────────────

def _clean_container(tag) -> None:
    for el in tag.find_all(_REMOVE_TAGS):
        el.decompose()


def _collect_text(tag) -> str:
    lines = []
    for el in tag.find_all(_TEXT_TAGS):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        lower = text.lower()
        if any(stop in lower for stop in _STOP_PHRASES):
            break
        lines.append(text)
    return "\n".join(dict.fromkeys(lines))


def _fetch_html(url: str) -> BeautifulSoup | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        return BeautifulSoup(resp.text, "lxml")
    except Exception as e:
        print(f"[MD] Erro ao buscar {url}: {e}")
        return None


def _find_container(soup: BeautifulSoup):
    for selector in _CONTENT_SELECTORS:
        el = soup.select_one(selector)
        if el:
            return el
    return None


def _extract_title(soup: BeautifulSoup, feed_title: str | None) -> str:
    for tag in ("h1", "h2"):
        el = soup.find(tag)
        if el:
            t = el.get_text(strip=True)
            if t:
                return t
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        return og["content"].strip()
    return feed_title or "Sem título"


# ─── Extração principal ────────────────────────────────────────────────────────

def extrair_conteudo(
    url: str,
    feed_title: str | None = None,
    published_dt: datetime | None = None,
) -> dict:
    """
    Scrape uma URL do Melhores Destinos e retorna dict com:
      url, title, content_html, content_text, valid_until, date_published
    """
    soup = _fetch_html(url)
    if soup is None:
        return {
            "url": url,
            "title": feed_title or "Sem título",
            "content_html": None,
            "content_text": None,
            "valid_until": None,
            "date_published": published_dt.date() if published_dt else date.today(),
        }

    title = _extract_title(soup, feed_title)
    container = _find_container(soup)

    if container:
        _clean_container(container)
        content_text = _collect_text(container)
        content_html = str(container)[:50_000]
    else:
        content_text = soup.get_text(" ", strip=True)[:5_000]
        content_html = None

    valid_until = detect_valid_until(content_text, published_dt)

    return {
        "url": url,
        "title": title,
        "content_html": content_html,
        "content_text": content_text,
        "valid_until": valid_until,
        "date_published": published_dt.date() if published_dt else date.today(),
    }
