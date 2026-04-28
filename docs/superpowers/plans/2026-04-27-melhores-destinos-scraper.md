# Melhores Destinos Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar um scraper para o site Melhores Destinos (melhoresdestinos.com.br) que coleta promoções via RSS + scraping HTML e salva na tabela `promocoes` do Supabase, idêntico ao fluxo existente do Passageiro de Primeira.

**Architecture:** Segue exatamente o mesmo padrão do `scrape_passageiro.py` — busca posts do dia via RSS feed (`melhoresdestinos.com.br/feed/`), faz scraping HTML de cada URL, extrai conteúdo/validade, e usa a função `upsert_promocao()` de `run.py` (que já tem o campo `fonte` para diferenciar a origem). O `run.py` é atualizado para rodar os dois scrapers em sequência.

**Tech Stack:** Python 3.11, requests, BeautifulSoup4 (lxml), feedparser, python-dateutil, psycopg2, Supabase PostgreSQL

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `scraper/scrape_melhores_destinos.py` | **Criar** | Lógica de scraping específica do Melhores Destinos: RSS, seletores HTML, extração de conteúdo e `valid_until` |
| `scraper/run.py` | **Modificar** | Importar e chamar o novo scraper após o Passageiro de Primeira; refatorar `upsert_promocao()` para aceitar `fonte` como parâmetro |
| `.github/workflows/scraper.yml` | **Modificar** | Garantir que o workflow continue funcionando (sem alterações estruturais, já roda via `run.py`) |

---

## Task 1: Inspecionar o site Melhores Destinos e definir seletores

**Files:**
- Create: `scraper/scrape_melhores_destinos.py` (parcial — apenas constantes e funções de fetch)

### Contexto

O Melhores Destinos (melhoresdestinos.com.br) é um WordPress. O RSS feed é `https://melhoresdestinos.com.br/feed/` e os posts usam seletores similares ao Passageiro de Primeira, mas com classes próprias do tema.

Seletores a tentar (em ordem de prioridade):
```
div.entry-content
div.post-content
div.td-post-content
article .entry-content
article
main
```

- [ ] **Step 1: Criar o arquivo base com constantes e função de fetch**

```python
# scraper/scrape_melhores_destinos.py
"""
Scraper para Melhores Destinos (melhoresdestinos.com.br).
Segue o mesmo contrato de scrape_passageiro.py:
  - posts_de_hoje() → lista de dicts com keys: link, feed_title, published
  - extrair_conteudo(url, feed_title, published_dt) → dict com keys:
      url, title, content_html, content_text, valid_until, date_published
"""
import time
import re
from datetime import datetime, date, timezone
from zoneinfo import ZoneInfo
from urllib.parse import urljoin

import requests
import feedparser
from bs4 import BeautifulSoup

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
```

- [ ] **Step 2: Commit parcial**

```bash
git add scraper/scrape_melhores_destinos.py
git commit -m "feat(scraper): add melhores destinos scraper skeleton"
```

---

## Task 2: Implementar `posts_de_hoje()` para Melhores Destinos

**Files:**
- Modify: `scraper/scrape_melhores_destinos.py`

### Contexto

Idêntico ao `posts_de_hoje()` de `scrape_passageiro.py`. Parseia o RSS, filtra apenas posts publicados hoje (horário de Brasília) e retorna a lista de dicts. O campo `published` é um objeto `datetime` com timezone.

- [ ] **Step 1: Adicionar função `posts_de_hoje()` ao arquivo**

Adicione ao final de `scraper/scrape_melhores_destinos.py`:

```python
def _parse_published(entry) -> datetime | None:
    """Converte o campo published do feedparser para datetime com tz."""
    if hasattr(entry, "published_parsed") and entry.published_parsed:
        import calendar
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
```

- [ ] **Step 2: Testar manualmente a função de RSS**

No terminal, dentro da pasta `scraper/`:
```bash
cd scraper && python -c "
from scrape_melhores_destinos import posts_de_hoje
posts = posts_de_hoje()
print(f'{len(posts)} posts encontrados hoje:')
for p in posts:
    print(' -', p['link'])
"
```

Resultado esperado: lista de URLs do melhoresdestinos.com.br publicados hoje (pode ser 0 se não publicaram hoje — nesse caso testar com um post recente manualmente).

- [ ] **Step 3: Commit**

```bash
git add scraper/scrape_melhores_destinos.py
git commit -m "feat(scraper): implement posts_de_hoje for melhores destinos"
```

---

## Task 3: Implementar extração de conteúdo HTML

**Files:**
- Modify: `scraper/scrape_melhores_destinos.py`

### Contexto

Segue o mesmo padrão de `extrair_conteudo()` em `scrape_passageiro.py`. Busca a URL, encontra o container de conteúdo via `_CONTENT_SELECTORS`, limpa tags indesejadas, extrai texto e HTML.

- [ ] **Step 1: Adicionar helpers de limpeza e extração**

Adicione ao final de `scraper/scrape_melhores_destinos.py`:

```python
_REMOVE_TAGS = {"script", "style", "iframe", "ins", "noscript", "svg", "form", "aside"}
_TEXT_TAGS = {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "div", "span", "a"}


def _clean_container(tag) -> None:
    """Remove tags indesejadas do container de conteúdo."""
    for el in tag.find_all(_REMOVE_TAGS):
        el.decompose()


def _collect_text(tag) -> str:
    """Extrai texto legível do container, cortando em stop phrases."""
    lines = []
    for el in tag.find_all(_TEXT_TAGS):
        text = el.get_text(" ", strip=True)
        if not text:
            continue
        lower = text.lower()
        if any(stop in lower for stop in _STOP_PHRASES):
            break
        lines.append(text)
    return "\n".join(dict.fromkeys(lines))  # dedup mantendo ordem


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
    # fallback: og:title
    og = soup.find("meta", property="og:title")
    if og and og.get("content"):
        return og["content"].strip()
    return feed_title or "Sem título"


def _make_absolute(href: str, base: str) -> str:
    return urljoin(base, href)
```

- [ ] **Step 2: Adicionar função principal `extrair_conteudo()`**

Adicione ao final de `scraper/scrape_melhores_destinos.py`:

```python
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
```

- [ ] **Step 3: Testar extração com URL real**

```bash
cd scraper && python -c "
from scrape_melhores_destinos import extrair_conteudo
# Use um post real do site — exemplo abaixo é um post típico
url = 'https://melhoresdestinos.com.br/passagens-aereas-promocionais.html'
data = extrair_conteudo(url)
print('Título:', data['title'])
print('Conteúdo (300 chars):', (data['content_text'] or '')[:300])
print('Valid until:', data['valid_until'])
"
```

Resultado esperado: título do post, início do conteúdo textual, e `valid_until` (ou None se não houver data de validade explícita no post).

- [ ] **Step 4: Commit**

```bash
git add scraper/scrape_melhores_destinos.py
git commit -m "feat(scraper): implement extrair_conteudo for melhores destinos"
```

---

## Task 4: Implementar `detect_valid_until()` reutilizando lógica do Passageiro

**Files:**
- Modify: `scraper/scrape_melhores_destinos.py`

### Contexto

O `scrape_passageiro.py` tem uma função `detect_valid_until()` robusta com parsing de datas em português. Ao invés de duplicar o código, importamos ela diretamente. O Melhores Destinos usa o mesmo idioma e padrões de data.

- [ ] **Step 1: Adicionar import da função de detecção**

No topo de `scraper/scrape_melhores_destinos.py`, logo após os imports existentes, adicione:

```python
# Reutiliza a lógica de detecção de validade do scraper do Passageiro de Primeira
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from scrape_passageiro import detect_valid_until
```

> **Nota:** Essa importação já está disponível pois ambos os scrapers ficam no mesmo diretório.

- [ ] **Step 2: Verificar que `detect_valid_until` é chamado em `extrair_conteudo()`**

Confirme que a linha `valid_until = detect_valid_until(content_text, url)` está presente na função `extrair_conteudo()` implementada na Task 3. Ela já está — nenhuma alteração necessária.

- [ ] **Step 3: Testar detecção de validade**

```bash
cd scraper && python -c "
from scrape_melhores_destinos import detect_valid_until
# Simula texto com data de validade típica do Melhores Destinos
texto = 'Promoção válida até 30/06/2026. Compre já suas passagens.'
resultado = detect_valid_until(texto, 'https://melhoresdestinos.com.br/teste')
print('valid_until:', resultado)
"
```

Resultado esperado: `2026-06-30 23:59:00+03:00` (ou similar com timezone BRT).

- [ ] **Step 4: Commit**

```bash
git add scraper/scrape_melhores_destinos.py
git commit -m "feat(scraper): reuse detect_valid_until from passageiro scraper"
```

---

## Task 5: Refatorar `upsert_promocao()` em `run.py` para aceitar `fonte` como parâmetro

**Files:**
- Modify: `scraper/run.py`

### Contexto

Atualmente `upsert_promocao()` em `run.py` tem `fonte` hardcoded como `"passageirodeprimeira.com"`. Precisamos tornar esse parâmetro configurável para suportar múltiplos scrapers.

- [ ] **Step 1: Alterar assinatura de `upsert_promocao()` em `run.py`**

Localize a função `upsert_promocao(conn, data: dict)` em `run.py` (linha ~143) e altere para:

```python
def upsert_promocao(conn, data: dict, fonte: str = "passageirodeprimeira.com"):
    """
    Insere ou atualiza uma promoção na tabela 'promocoes' do Supabase.
    Mapeia os campos do scraper para o schema do Supabase e classifica automaticamente.
    """
    cur = conn.cursor()
    now = datetime.now(TZ)

    conteudo = data.get("content_html") or data.get("content_text") or ""
    titulo = data.get("title") or "Sem título"
    categoria, subcategoria, programas_tags = classificar(titulo, conteudo)

    cur.execute(
        """
        INSERT INTO promocoes
            (titulo, conteudo, url, fonte, valid_until, categoria, subcategoria, programas_tags, created_at, updated_at)
        VALUES
            (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (url) DO UPDATE SET
            titulo         = EXCLUDED.titulo,
            conteudo       = EXCLUDED.conteudo,
            fonte          = EXCLUDED.fonte,
            valid_until    = EXCLUDED.valid_until,
            categoria      = EXCLUDED.categoria,
            subcategoria   = EXCLUDED.subcategoria,
            programas_tags = EXCLUDED.programas_tags,
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
            now,
            now,
        ),
    )
    conn.commit()
```

- [ ] **Step 2: Verificar que a chamada existente de `upsert_promocao()` em `main()` ainda funciona**

Na função `main()` de `run.py` (linha ~217), a chamada é:
```python
upsert_promocao(conn, data)
```
Como adicionamos `fonte` com valor default `"passageirodeprimeira.com"`, essa chamada continua funcionando sem alteração.

- [ ] **Step 3: Testar que o scraper do Passageiro continua funcionando**

```bash
cd scraper && python -c "
import os; os.environ.setdefault('DATABASE_URL', 'postgresql://localhost/test')
from run import classificar
cat, sub, tags = classificar('Passagens aéreas em promoção para Europa', 'voos baratos latam')
print(cat, sub, tags)
"
```

Resultado esperado: `passagens None ['LATAM Pass']`

- [ ] **Step 4: Commit**

```bash
git add scraper/run.py
git commit -m "refactor(scraper): make fonte a parameter in upsert_promocao"
```

---

## Task 6: Integrar o Melhores Destinos em `run.py`

**Files:**
- Modify: `scraper/run.py`

### Contexto

Adicionar a função `main_melhores_destinos()` ao `run.py` e chamá-la depois da execução do Passageiro de Primeira. O padrão é idêntico ao `main()` existente, mas importando de `scrape_melhores_destinos`.

- [ ] **Step 1: Adicionar o import do novo scraper no topo de `run.py`**

Após a linha que importa `scrape_passageiro`:
```python
from scrape_passageiro import (
    posts_de_hoje,
    extrair_conteudo,
    delete_expired as _delete_expired_legacy,
)
```

Adicione:
```python
from scrape_melhores_destinos import (
    posts_de_hoje as md_posts_de_hoje,
    extrair_conteudo as md_extrair_conteudo,
)
```

- [ ] **Step 2: Adicionar função `main_melhores_destinos()` em `run.py`**

Adicione após a função `main()` existente (antes do bloco `if __name__ == "__main__":`):

```python
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
```

- [ ] **Step 3: Chamar `main_melhores_destinos()` no bloco de execução**

No bloco `if __name__ == "__main__":`, dentro do `if os.environ.get("GITHUB_ACTIONS") == "true":`, altere para:

```python
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print("📋  Modo GitHub Actions — execução única")
        main()
        main_melhores_destinos()
```

No loop infinito (else), altere `main()` para:

```python
        while True:
            try:
                main()
                main_melhores_destinos()
            except Exception as e:
                print(f"❌  Erro em main(): {e}")
            print(f"\n⏳  Próxima execução em {INTERVAL_SECONDS // 60} minutos...\n")
            time.sleep(INTERVAL_SECONDS)
```

- [ ] **Step 4: Verificar imports e sintaxe**

```bash
cd scraper && python -c "import run; print('Imports OK')"
```

Resultado esperado: `Imports OK` (sem erros de importação).

- [ ] **Step 5: Commit**

```bash
git add scraper/run.py
git commit -m "feat(scraper): integrate melhores destinos scraper into run.py"
```

---

## Task 7: Testar o fluxo completo end-to-end

**Files:**
- No new files

### Contexto

Testar o scraper do Melhores Destinos com uma URL real (não necessariamente de hoje, só para validar que o pipeline funciona). Usa `DATABASE_URL` do `.env` local ou variável de ambiente.

- [ ] **Step 1: Testar scraping de um post real do Melhores Destinos**

```bash
cd scraper && python -c "
from scrape_melhores_destinos import extrair_conteudo
# Pegar a URL de um post recente do melhoresdestinos.com.br manualmente
# Substitua pela URL de um post real que aparecer no site hoje
url = 'https://melhoresdestinos.com.br/passagens-aereas-promocionais.html'
data = extrair_conteudo(url)
print('URL:', data['url'])
print('Título:', data['title'])
print('Conteúdo (200 chars):', (data.get('content_text') or '')[:200])
print('valid_until:', data['valid_until'])
print('date_published:', data['date_published'])
"
```

Resultado esperado: campos preenchidos corretamente, sem erros.

- [ ] **Step 2: Testar upsert em banco real (requer DATABASE_URL no .env)**

```bash
cd scraper && python -c "
from dotenv import load_dotenv; load_dotenv()
from run import db_connect, upsert_promocao, classificar
from scrape_melhores_destinos import extrair_conteudo

url = 'https://melhoresdestinos.com.br/passagens-aereas-promocionais.html'
data = extrair_conteudo(url)

conn = db_connect()
upsert_promocao(conn, data, fonte='melhoresdestinos.com.br')
conn.close()
print('Upsert OK para:', data['title'])
"
```

Resultado esperado: `Upsert OK para: <título do post>` sem erros. Verificar no Supabase que o registro aparece com `fonte = 'melhoresdestinos.com.br'`.

- [ ] **Step 3: Validar no Supabase**

No painel do Supabase, rodar:
```sql
SELECT id, titulo, fonte, valid_until, categoria, created_at
FROM promocoes
WHERE fonte = 'melhoresdestinos.com.br'
ORDER BY created_at DESC
LIMIT 5;
```

Resultado esperado: pelo menos 1 linha com os campos corretos.

- [ ] **Step 4: Commit final**

```bash
git add scraper/scrape_melhores_destinos.py scraper/run.py
git commit -m "feat(scraper): melhores destinos scraper fully integrated and tested"
```

---

## Task 8: Verificar GitHub Actions workflow

**Files:**
- Read: `.github/workflows/scraper.yml`

### Contexto

O workflow atual roda `python run.py`. Como `run.py` agora chama ambos os scrapers em sequência, **nenhuma alteração no workflow é necessária**. Esta task é de verificação.

- [ ] **Step 1: Confirmar que o workflow chama `run.py` sem alterações**

```bash
cat .github/workflows/scraper.yml | grep -A5 "python"
```

Resultado esperado: linha `python run.py` ou `python scraper/run.py` — ambos estão corretos.

- [ ] **Step 2: Confirmar que `requirements.txt` cobre todas as dependências do novo scraper**

```bash
cd scraper && grep -E "requests|beautifulsoup4|feedparser|lxml|python-dateutil|psycopg2" requirements.txt
```

Resultado esperado: todas as 5 bibliotecas listadas. Se alguma estiver faltando:

```bash
cd scraper && pip show <biblioteca> | grep Version
# Adicionar ao requirements.txt no formato: biblioteca==X.Y.Z
```

- [ ] **Step 3: Commit se requirements.txt foi alterado (senão pular)**

```bash
git add scraper/requirements.txt
git commit -m "chore(scraper): ensure melhores destinos deps in requirements.txt"
```

---

## Checklist de cobertura do spec

- [x] Scraper busca posts do dia via RSS do Melhores Destinos
- [x] Scraper faz scraping HTML de cada URL com seletores adaptados ao site
- [x] Extração de `valid_until` reutiliza lógica de parsing de datas do Passageiro
- [x] Dados salvos na tabela `promocoes` com `fonte = 'melhoresdestinos.com.br'`
- [x] Classificação automática (categoria/subcategoria/programas_tags) reutilizada
- [x] `run.py` executa ambos os scrapers em sequência
- [x] GitHub Actions continua funcionando sem alterações estruturais
- [x] Campo `fonte` em `upsert_promocao()` parametrizado (não mais hardcoded)
