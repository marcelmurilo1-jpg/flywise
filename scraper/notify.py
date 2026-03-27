#!/usr/bin/env python3
"""
notify.py — Envia e-mails de promoções para usuários do FlyWise via Resend.

Fluxo:
  1. Busca promoções novas (notificado_em IS NULL) e ainda válidas.
  2. Para cada promoção, encontra usuários cujas preferências combinam.
  3. Agrupa os e-mails por usuário (máx. 1 e-mail por execução, com N promoções).
  4. Envia via Resend e marca notificado_em = NOW() em cada promoção enviada.

Variáveis de ambiente necessárias:
  DATABASE_URL   — URL de conexão Supabase/Postgres
  RESEND_API_KEY — API key do Resend (re_...)
  FROM_EMAIL     — remetente verificado no Resend (ex: noreply@flywise.com.br)
"""
import os
import time
from datetime import datetime
from zoneinfo import ZoneInfo

import psycopg2
import psycopg2.extras
import requests
from dotenv import load_dotenv

load_dotenv()

TZ           = ZoneInfo("America/Sao_Paulo")
DB_URL       = os.getenv("DATABASE_URL")
RESEND_KEY   = os.getenv("RESEND_API_KEY")
FROM_EMAIL   = os.getenv("FROM_EMAIL", "FlyWise <noreply@flywise.com.br>")
RESEND_URL   = "https://api.resend.com/emails"
MAX_PROMOS   = 5          # máx. de promoções por e-mail
RATE_SLEEP   = 0.3        # segundos entre chamadas à API do Resend


# ─── DB ───────────────────────────────────────────────────────────────────────

def db_connect():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL não encontrado.")
    return psycopg2.connect(DB_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def buscar_promocoes_validas(conn) -> list[dict]:
    """Retorna promoções válidas (não expiradas) com categoria definida."""
    now = datetime.now(TZ)
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, titulo, conteudo, url, categoria, subcategoria, programas_tags, valid_until
            FROM   promocoes
            WHERE  categoria IS NOT NULL
              AND  (valid_until IS NULL OR valid_until > %s)
            ORDER  BY created_at DESC
            LIMIT  100
            """,
            (now,),
        )
        return cur.fetchall()


def buscar_promos_ja_enviadas(conn, user_id: str) -> set[int]:
    """Retorna IDs de promoções já enviadas para este usuário."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT promotion_id FROM user_promotion_log WHERE user_id = %s",
            (user_id,),
        )
        return {row["promotion_id"] for row in cur.fetchall()}


def registrar_envio(conn, user_id: str, ids: list[int]):
    """Registra promoções como enviadas para este usuário."""
    if not ids:
        return
    now = datetime.now(TZ)
    with conn.cursor() as cur:
        for promo_id in ids:
            cur.execute(
                """
                INSERT INTO user_promotion_log (user_id, promotion_id, sent_at)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id, promotion_id) DO NOTHING
                """,
                (user_id, promo_id, now),
            )
    conn.commit()


def buscar_preferencias_usuarios(conn) -> list[dict]:
    """
    Retorna usuários com notificações ativas, junto ao e-mail deles.
    Faz JOIN entre notification_preferences, user_profiles e auth.users.
    Respeita os toggles de notifications_email e notifications_promotions do perfil.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
                np.user_id,
                u.email,
                np.passagens,
                np.milhas,
                np.programas,
                np.alerta_promocao,
                np.alerta_award_space
            FROM notification_preferences np
            JOIN auth.users u ON u.id = np.user_id
            LEFT JOIN user_profiles up ON up.id = np.user_id
            WHERE np.notificacoes_ativas = TRUE
              AND u.email IS NOT NULL
              AND COALESCE(up.notifications_email, TRUE) = TRUE
              AND COALESCE(up.notifications_promotions, TRUE) = TRUE
            """
        )
        return cur.fetchall()


# ─── Matching ─────────────────────────────────────────────────────────────────

def promos_para_usuario(usuario: dict, promos: list[dict], ja_enviadas: set[int]) -> list[dict]:
    """Filtra promoções que interessam a um usuário específico."""
    resultado = []
    for p in promos:
        if p["id"] in ja_enviadas:
            continue

        cat = p["categoria"]
        subcategoria = p.get("subcategoria")
        tags = p["programas_tags"] or []

        if cat == "passagens" and usuario["passagens"]:
            resultado.append(p)
        elif cat == "milhas" and usuario["milhas"]:
            # Respeita alerta_promocao (transferência) e alerta_award_space (clubes)
            if subcategoria == "transferencia" and not usuario["alerta_promocao"]:
                continue
            if subcategoria == "clube" and not usuario["alerta_award_space"]:
                continue
            # Filtro por programa: se usuário selecionou programas, exige match;
            # se não selecionou nenhum, recebe todas as promoções de milhas
            prefs_prog = usuario["programas"] or []
            if not prefs_prog or not tags or any(t in prefs_prog for t in tags):
                resultado.append(p)

    return resultado[:MAX_PROMOS]


# ─── E-mail HTML ──────────────────────────────────────────────────────────────

def _badge(cat: str) -> str:
    color = "#2563eb" if cat == "milhas" else "#16a34a"
    label = "Milhas" if cat == "milhas" else "Passagem"
    return (
        f'<span style="display:inline-block;padding:2px 10px;border-radius:999px;'
        f'background:{color};color:#fff;font-size:11px;font-weight:700;'
        f'letter-spacing:0.03em;margin-bottom:6px">{label}</span>'
    )


def _promo_block(p: dict) -> str:
    titulo = p["titulo"] or "Promoção"
    cat    = p["categoria"] or "passagens"
    conteudo_raw = (p["conteudo"] or "")
    # Extrai primeiros ~200 caracteres sem tags HTML
    import re
    conteudo = re.sub(r"<[^>]+>", "", conteudo_raw)[:220].strip()
    if len(conteudo) == 220:
        conteudo += "…"

    url = "https://flywisebr.com/promotions"

    expira = ""
    if p.get("valid_until"):
        expira = (
            f'<p style="margin:6px 0 0;font-size:12px;color:#9ca3af">'
            f'⏳ Válida até {p["valid_until"].strftime("%d/%m/%Y")}</p>'
        )

    return f"""
    <div style="border:1.5px solid #e5e7eb;border-radius:14px;padding:18px 20px;margin-bottom:16px">
      {_badge(cat)}
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:#0f172a;line-height:1.3">
        {titulo}
      </h3>
      <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">{conteudo}</p>
      {expira}
      <a href="{url}" style="display:inline-block;margin-top:14px;padding:9px 18px;
         border-radius:10px;background:#2563eb;color:#fff;font-size:13px;
         font-weight:700;text-decoration:none">Ver promoção →</a>
    </div>
    """


def build_html(promos: list[dict]) -> str:
    blocos = "".join(_promo_block(p) for p in promos)
    qtd = len(promos)
    palavra = "promoção" if qtd == 1 else "promoções"
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:20px;
       border:1.5px solid #e5e7eb;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06)">

    <!-- Header -->
    <div style="background:#2563eb;padding:28px 32px">
      <h1 style="margin:0;font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.02em">
        ✈️ FlyWise — {qtd} {palavra} para você
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8)">
        Selecionadas de acordo com suas preferências
      </p>
    </div>

    <!-- Body -->
    <div style="padding:28px 32px">
      {blocos}
    </div>

    <!-- Footer -->
    <div style="padding:20px 32px;border-top:1.5px solid #f1f5f9;background:#f8fafc">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center">
        Você recebe este e-mail porque ativou alertas no FlyWise.<br>
        Para cancelar, acesse
        <a href="https://flywisebr.com/configuracoes" style="color:#2563eb">configurações</a>.
      </p>
    </div>
  </div>
</body>
</html>"""


def build_subject(promos: list[dict]) -> str:
    if len(promos) == 1:
        titulo = (promos[0]["titulo"] or "Promoção")[:60]
        return f"✈️ {titulo}"
    return f"✈️ {len(promos)} promoções novas para você — FlyWise"


# ─── Resend ───────────────────────────────────────────────────────────────────

def enviar_email(to: str, subject: str, html: str) -> bool:
    if not RESEND_KEY:
        print(f"   ⚠️  RESEND_API_KEY não configurado — pulando envio para {to}")
        return False

    resp = requests.post(
        RESEND_URL,
        headers={
            "Authorization": f"Bearer {RESEND_KEY}",
            "Content-Type": "application/json",
        },
        json={"from": FROM_EMAIL, "to": [to], "subject": subject, "html": html},
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return True
    print(f"   ❌ Resend erro {resp.status_code}: {resp.text[:200]}")
    return False


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("=" * 55)
    print("📧  FlyWise Notifier")
    print(f"⏰  {datetime.now(TZ).strftime('%d/%m/%Y %H:%M:%S')}")
    print("=" * 55)

    conn = db_connect()
    print("✅  Conectado ao banco.")

    promos = buscar_promocoes_validas(conn)
    if not promos:
        print("📭  Nenhuma promoção válida encontrada.")
        conn.close()
        return

    print(f"📬  {len(promos)} promoção(ões) válida(s) disponível(is).")

    usuarios = buscar_preferencias_usuarios(conn)
    if not usuarios:
        print("👥  Nenhum usuário com notificações ativas.")
        conn.close()
        return

    print(f"👥  {len(usuarios)} usuário(s) com notificações ativas.\n")

    total_enviados = 0

    for u in usuarios:
        email   = u["email"]
        user_id = str(u["user_id"])

        ja_enviadas  = buscar_promos_ja_enviadas(conn, user_id)
        selecionadas = promos_para_usuario(u, promos, ja_enviadas)
        if not selecionadas:
            continue

        subject = build_subject(selecionadas)
        html    = build_html(selecionadas)

        print(f"📨  Enviando para {email} ({len(selecionadas)} promo(s))…")
        try:
            ok = enviar_email(email, subject, html)
            if ok:
                print(f"   ✅ Enviado.")
                registrar_envio(conn, user_id, [p["id"] for p in selecionadas])
                total_enviados += len(selecionadas)
        except Exception as exc:
            print(f"   ⚠️  Erro ao enviar para {email}: {exc}")
        time.sleep(RATE_SLEEP)

    if total_enviados:
        print(f"\n🏁  {total_enviados} envio(s) registrado(s) no log.")
    else:
        print("\n📭  Nenhum e-mail enviado.")

    conn.close()


if __name__ == "__main__":
    main()
