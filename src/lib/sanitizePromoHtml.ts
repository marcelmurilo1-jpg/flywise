/**
 * sanitizePromoHtml — limpa o HTML que vem dos scrapers (Passageiro de Primeira / Melhores Destinos)
 * para renderização interna no FlyWise:
 *   - desfaz todos os <a> (mantém o texto, descarta o link)
 *   - remove iframes / scripts / formulários / forms de assinatura
 *   - corta blocos de rodapé editorial ("siga o ...", "compartilhe", "newsletter", "tags relacionadas")
 *   - remove menções aos domínios das fontes originais
 */

const STOP_PHRASES = [
    'siga o passageiro de primeira',
    'siga o melhores destinos',
    'siga nossas redes',
    'siga nas redes',
    'siga-nos',
    'inscreva-se em nossa newsletter',
    'assine nossa newsletter',
    'receba nossas dicas',
    'quer ficar por dentro',
    'quer receber as melhores',
    'compartilhe este post',
    'compartilhe nas redes',
    'compartilhe com amigos',
    'tags relacionadas',
    'leia também',
    'leia mais em',
    'veja também',
    'veja mais em',
    'saiba mais em',
    'mais informações em',
    'matéria completa em',
    'fonte:',
    'créditos:',
    'crédito:',
    'foto:',
    'fotos:',
    'imagem:',
    'imagens:',
    'clique aqui para ver',
    'clique aqui e veja',
    'acesse o site',
    'no site oficial',
]

const DOMAIN_PATTERNS = [
    /passageiro\s*de\s*primeira/gi,
    /passageirodeprimeira\.com/gi,
    /melhores\s*destinos/gi,
    /melhoresdestinos\.com(?:\.br)?/gi,
]

function hasStopPhrase(text: string): boolean {
    const lower = text.toLowerCase()
    return STOP_PHRASES.some(p => lower.includes(p))
}

function unwrapAnchors(root: HTMLElement) {
    const anchors = Array.from(root.querySelectorAll('a'))
    for (const a of anchors) {
        const text = a.textContent ?? ''
        a.replaceWith(document.createTextNode(text))
    }
}

function removeUnsafeTags(root: HTMLElement) {
    const selectors = [
        'script', 'style', 'iframe', 'form', 'input', 'button',
        'noscript', 'object', 'embed', 'svg',
    ]
    for (const sel of selectors) {
        root.querySelectorAll(sel).forEach(el => el.remove())
    }
}

function stripBlocksWithStopPhrases(root: HTMLElement) {
    const blockTags = ['p', 'div', 'section', 'aside', 'figure', 'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li']
    const blocks = Array.from(root.querySelectorAll(blockTags.join(',')))

    let cutoffReached = false
    for (const el of blocks) {
        if (!el.isConnected) continue
        const text = el.textContent ?? ''
        if (cutoffReached) {
            el.remove()
            continue
        }
        if (hasStopPhrase(text)) {
            cutoffReached = true
            el.remove()
        }
    }
}

function scrubDomainMentions(root: HTMLElement) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes: Text[] = []
    let cur = walker.nextNode()
    while (cur) {
        nodes.push(cur as Text)
        cur = walker.nextNode()
    }
    for (const n of nodes) {
        let txt = n.nodeValue ?? ''
        for (const re of DOMAIN_PATTERNS) txt = txt.replace(re, '')
        if (txt !== n.nodeValue) n.nodeValue = txt
    }
}

function collapseEmpty(root: HTMLElement) {
    const candidates = Array.from(root.querySelectorAll('p, div, section, span'))
    for (const el of candidates) {
        if (!el.isConnected) continue
        const hasMedia = el.querySelector('img, video, picture')
        if (hasMedia) continue
        if ((el.textContent ?? '').trim() === '') el.remove()
    }
}

export function sanitizePromoHtml(raw: string | null | undefined): string {
    if (!raw) return ''
    if (typeof window === 'undefined' || typeof DOMParser === 'undefined') return raw

    const doc = new DOMParser().parseFromString(`<div>${raw}</div>`, 'text/html')
    const root = doc.body.firstElementChild as HTMLElement | null
    if (!root) return ''

    removeUnsafeTags(root)
    unwrapAnchors(root)
    stripBlocksWithStopPhrases(root)
    scrubDomainMentions(root)
    collapseEmpty(root)

    return root.innerHTML
}

export function sanitizePromoSummary(raw: string | null | undefined, maxLen = 180): string {
    if (!raw) return ''
    const text = raw
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    let scrubbed = text
    for (const re of DOMAIN_PATTERNS) scrubbed = scrubbed.replace(re, '')
    scrubbed = scrubbed.replace(/\s+/g, ' ').trim()
    return scrubbed.length > maxLen ? scrubbed.slice(0, maxLen).trimEnd() + '…' : scrubbed
}
