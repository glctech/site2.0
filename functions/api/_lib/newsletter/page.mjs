/* ============================================================================
 * Newsletter — página HTML simples de resultado (confirmar/descadastrar/
 * aprovar), com a identidade visual do site (ver docs/ARCHITECTURE.md).
 * ==========================================================================*/

const esc = (s = '') => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function brandPage(title, message, { extraHtml = '', status = 200 } = {}) {
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — GLCTech</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'DM Sans', Arial, sans-serif; background: #2d2d2d; color: #c9c9c9;
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 2rem; text-align: center;
  }
  .card { max-width: 440px; }
  h1 { font-family: 'Syne', Arial, sans-serif; color: #fff; font-size: 1.6rem; margin-bottom: 1rem; }
  p { line-height: 1.7; margin-bottom: 1.5rem; }
  a.btn {
    display: inline-block; background: #e6262c; color: #fff; text-decoration: none;
    padding: 12px 24px; border-radius: 4px; font-weight: 600; font-family: 'Syne', Arial, sans-serif;
  }
  a.link { color: #e6262c; }
</style>
</head>
<body>
  <div class="card">
    <h1>${esc(title)}</h1>
    <p>${esc(message)}</p>
    ${extraHtml}
    <p><a class="link" href="https://glctech.com.br">glctech.com.br</a></p>
  </div>
</body>
</html>`;

  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
