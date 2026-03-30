(function () {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  function update() {
    if (window.scrollY > 60) {
      nav.classList.add('is-scrolled');
    } else {
      nav.classList.remove('is-scrolled');
    }
  }

  window.addEventListener('scroll', update, { passive: true });
  update();
})();
