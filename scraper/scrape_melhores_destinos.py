"""
Scraper para Melhores Destinos (melhoresdestinos.com.br).
Segue o mesmo contrato de scrape_passageiro.py:
  - posts_de_hoje() → lista de dicts com keys: link, feed_title, published
  - extrair_conteudo(url, feed_title, published_dt) → dict com keys:
      url, title, content_html, content_text, valid_until, date_published
"""
import calendar
import os
import sys
import time
from datetime import datetime, date, timezone
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

import feedparser
import requests
from bs4 import BeautifulSoup

# Reutiliza a lógica de detecção de validade do scraper do Passageiro de Primeira
sys.path.insert(0, os.path.dirname(__file__))
from scrape_passageiro import detect_valid_until  # noqa: E402

TZ = ZoneInfo("America/Sao_Paulo")
RSS_URL = "https://melhoresdestinos.com.br/feed/"
SITE_BASE = "https://melhoresdestinos.com.br"
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


# ─── RSS ──────────────────────────────────────────────────────────────────────

def _parse_published(entry) -> datetime | None:
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        ts = calendar.timegm(entry.published_parsed)
        return datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(TZ)
    return None


def posts_de_hoje() -> list[dict]:
    """
    Busca os posts publicados hoje no RSS do Melhores Destinos.
    Retorna lista de dicts: {link, feed_title, published}
    """
    today = date.today()
    try:
        feed = feedparser.parse(RSS_URL)
    except Exception as e:
        print(f"[MD] Erro ao ler RSS: {e}")
        return []

    results = []
    for entry in feed.entries:
        pub = _parse_published(entry)
        if pub is None:
            continue
        if pub.astimezone(TZ).date() != today:
            continue
        results.append({
            "link": entry.get("link", ""),
            "feed_title": entry.get("title", ""),
            "published": pub,
        })

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

    valid_until = detect_valid_until(content_text, url)

    return {
        "url": url,
        "title": title,
        "content_html": content_html,
        "content_text": content_text,
        "valid_until": valid_until,
        "date_published": published_dt.date() if published_dt else date.today(),
    }
