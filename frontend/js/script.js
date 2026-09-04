const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const toast = (message) => {
	const element = $('#toast');
	$('#toastMsg').textContent = message;
	element.classList.add('show');
	window.setTimeout(() => element.classList.remove('show'), 3200);
};

const signupOverlay = $('#signupOverlay');
const demoOverlay = $('#demoOverlay');
const openModal = (overlay) => overlay.classList.add('open');
const closeModal = (overlay) => overlay.classList.remove('open');

const openSignup = (plan) => {
	openModal(signupOverlay);
	if (plan) $('#plano').value = plan;
};

$$('#navCtaBtn, #heroCtaBtn, #finalCtaBtn, #mobileCtaBtn').forEach((button) => button.addEventListener('click', () => openSignup()));
$$('.plan-btn').forEach((button) => button.addEventListener('click', () => openSignup(button.dataset.plan)));
$$('#heroDemoBtn, #finalDemoBtn').forEach((button) => button.addEventListener('click', () => openModal(demoOverlay)));
$('#loginLink').addEventListener('click', (event) => { event.preventDefault(); toast('A área de acesso estará disponível em breve.'); });

$('#menuToggle').addEventListener('click', () => $('#mobilePanel').classList.add('open'));
$('#menuClose').addEventListener('click', () => $('#mobilePanel').classList.remove('open'));
$$('.mp-link').forEach((link) => link.addEventListener('click', () => $('#mobilePanel').classList.remove('open')));

$$('.modal-close').forEach((button) => button.addEventListener('click', () => closeModal(button.closest('.modal-overlay'))));
$$('.modal-overlay').forEach((overlay) => overlay.addEventListener('click', (event) => { if (event.target === overlay) closeModal(overlay); }));

$$('.tab-btn').forEach((button) => button.addEventListener('click', () => {
	$$('.tab-btn').forEach((tab) => tab.classList.toggle('active', tab === button));
	$$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === button.dataset.tab));
}));

const updatePrices = (yearly) => $$('.price-val').forEach((price) => { price.textContent = `R$ ${yearly ? price.dataset.y : price.dataset.m}`; });
$('#toggleMonthly').addEventListener('click', () => { updatePrices(false); $('#toggleMonthly').classList.add('active'); $('#toggleYearly').classList.remove('active'); });
$('#toggleYearly').addEventListener('click', () => { updatePrices(true); $('#toggleYearly').classList.add('active'); $('#toggleMonthly').classList.remove('active'); });

$$('.faq-q').forEach((question) => question.addEventListener('click', () => {
	const item = question.parentElement;
	const answer = $('.faq-a', item);
	const isOpen = item.classList.toggle('open');
	answer.style.maxHeight = isOpen ? `${answer.scrollHeight}px` : '0px';
}));

$('#realSignupForm').addEventListener('submit', (event) => {
	event.preventDefault();
	$('#signupForm').style.display = 'none';
	$('#signupSuccess').classList.add('open');
});
$('#signupDone').addEventListener('click', () => { closeModal(signupOverlay); $('#signupForm').style.display = ''; $('#signupSuccess').classList.remove('open'); $('#realSignupForm').reset(); });
$('#demoForm').addEventListener('submit', (event) => { event.preventDefault(); closeModal(demoOverlay); event.target.reset(); toast('Pedido recebido. Nossa equipe entrará em contato.'); });

document.addEventListener('keydown', (event) => { if (event.key === 'Escape') $$('.modal-overlay.open').forEach(closeModal); });
