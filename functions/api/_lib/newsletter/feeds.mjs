/* ============================================================================
 * Newsletter — coleta e normalização de feeds RSS (fontes brasileiras).
 * ----------------------------------------------------------------------------
 * Sem dependências externas (o projeto não tem passo de build/empacotamento —
 * ver docs/ARCHITECTURE.md — então evitamos adicionar `fast-xml-parser` e
 * usamos um parser regex mínimo, suficiente para RSS 2.0/Atom bem-formado).
 * ==========================================================================*/

export const FEEDS = [
  { name: 'CERT.br',        url: 'https://www.cert.br/rss/certbr-rss.xml' },
  { name: 'CISO Advisor',   url: 'https://www.cisoadvisor.com.br/feed/' },
  { name: 'The Hack',       url: 'https://thehack.com.br/feed/' },
  { name: 'IT Forum',       url: 'https://itforum.com.br/feed/' },
  { name: 'Tecnoblog',      url: 'https://tecnoblog.net/feed/' },
];
// Valide cada URL no teste local — feeds mudam de endereço com frequência.
// Se um feed começar a falhar sempre, é mais barato trocá-lo do que depurá-lo.

const strip = (s = '') => String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return m ? m[1] : '';
}

function attr(xml, tagName, attrName) {
  const m = xml.match(new RegExp(`<${tagName}[^>]*\\s${attrName}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

// Parser mínimo: extrai blocos <item>...</item> (RSS) ou <entry>...</entry>
// (Atom) por regex. Não é um parser XML completo — não precisa ser, só
// precisamos de title/link/description/pubDate de feeds públicos conhecidos.
function parseFeed(xml) {
  const isAtom = /<feed[\s>]/i.test(xml) && !/<rss[\s>]/i.test(xml);
  const blocks = xml.match(isAtom ? /<entry[\s\S]*?<\/entry>/gi : /<item[\s\S]*?<\/item>/gi) || [];

  return blocks.map((block) => {
    const title = strip(tag(block, 'title'));
    let link = strip(tag(block, 'link'));
    if (isAtom) {
      // Atom: <link href="..."/> (self-closing), preferir rel="alternate" se houver
      link = attr(block, 'link', 'href') || link;
    }
    const description = strip(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content'));
    const pubDate = tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated');
    return { title, link, description, pubDate };
  });
}

export async function collectItems({ days = 7, perFeed = 8 } = {}) {
  const since = Date.now() - days * 864e5;

  const results = await Promise.allSettled(FEEDS.map(async (feed) => {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'GLCTechNewsletter/1.0 (+https://glctech.com.br)' },
      cf: { cacheTtl: 900 },
    });
    if (!res.ok) throw new Error(`${feed.name}: HTTP ${res.status}`);
    const xml = await res.text();
    const list = parseFeed(xml);

    return list.slice(0, perFeed).map((it) => ({
      source: feed.name,
      title: it.title,
      url: it.link,
      summary: it.description.slice(0, 500),
      published: Date.parse(it.pubDate) || Date.now(),
    }));
  }));

  const items = results
    .filter((r) => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .filter((i) => i.title && i.url?.startsWith('https://') && i.published >= since);

  const errors = results.filter((r) => r.status === 'rejected').map((r) => r.reason.message);

  // dedupe por título normalizado
  const seen = new Set();
  const unique = items.filter((i) => {
    const k = i.title.toLowerCase().slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { items: unique.slice(0, 40), errors };
}
