/**
 * renderNav(activePage)
 * Prepends the site-wide navigation bar to <body>.
 * activePage: 'moment' | 'fitness' | 'assets' | ''
 */
export function renderNav(activePage) {
  const nav = document.createElement('div');
  nav.className = 'site-nav';

  const pages = [
    { id: 'moment',  label: 'Moment',  href: '/moment/'  },
    { id: 'fitness', label: 'Fitness', href: '/fitness/' },
    { id: 'assets',  label: 'Assets',  href: '/assets/'  },
  ];

  nav.innerHTML = `
    <a class="site-nav-brand" href="/">Life Log</a>
    <div class="site-nav-links">
      ${pages.map(p => `<a href="${p.href}" class="${activePage === p.id ? 'active' : ''}">${p.label}</a>`).join('')}
    </div>
  `;

  document.body.insertBefore(nav, document.body.firstChild);
}
