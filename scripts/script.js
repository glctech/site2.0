// =====================================================
// GLCTech - Scripts globais do site
// - Corrige/moderniza o menu hambúrguer
// - Mantém compatibilidade com páginas que usam .header/.nav/.menu-toggle
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');

  if (!toggle || !nav) return;

  const setExpanded = (isOpen) => {
    toggle.classList.toggle('active', isOpen);
    nav.classList.toggle('active', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    document.documentElement.classList.toggle('nav-open', isOpen);
  };

  // Estado inicial
  if (!toggle.hasAttribute('aria-expanded')) toggle.setAttribute('aria-expanded', 'false');

  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.contains('active');
    setExpanded(!isOpen);
  });

  // Fecha ao clicar em link
  nav.querySelectorAll('a').forEach((a) => {
    a.addEventListener('click', () => setExpanded(false));
  });

  // Fecha com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setExpanded(false);
  });

  // Fecha ao clicar fora
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    const clickedInside = nav.contains(target) || toggle.contains(target);
    if (!clickedInside) setExpanded(false);
  });
});
