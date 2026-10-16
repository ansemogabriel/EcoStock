// A única interação deste mockup é abrir e fechar o menu em telas pequenas.
const menuToggle = document.querySelector('#menuToggle');
const sidebar = document.querySelector('#sidebar');
const sidebarScrim = document.querySelector('#sidebarScrim');

function closeMenu() {
  sidebar.classList.remove('open');
  sidebarScrim.classList.remove('visible');
  menuToggle.setAttribute('aria-expanded', 'false');
}

menuToggle.addEventListener('click', () => {
  const isOpen = sidebar.classList.toggle('open');
  sidebarScrim.classList.toggle('visible', isOpen);
  menuToggle.setAttribute('aria-expanded', String(isOpen));
});

sidebarScrim.addEventListener('click', closeMenu);

sidebar.querySelectorAll('.nav-link').forEach((link) => {
  link.addEventListener('click', closeMenu);
});
