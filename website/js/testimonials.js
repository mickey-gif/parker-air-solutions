(function () {
  const track = document.getElementById('testimonialsTrack');
  const dotsContainer = document.getElementById('testimonialsDots');
  const prevBtn = document.getElementById('testimonialsPrev');
  const nextBtn = document.getElementById('testimonialsNext');

  if (!track || !dotsContainer) return;

  const cards = track.querySelectorAll('.testimonial-card');
  const totalCards = cards.length;
  let currentPage = 0;
  let cardsPerView = 3;

  function getCardsPerView() {
    var w = window.innerWidth;
    if (w <= 479) return 1;
    if (w <= 768) return 2;
    return 3;
  }

  function getTotalPages() {
    return Math.max(1, totalCards - cardsPerView + 1);
  }

  function buildDots() {
    dotsContainer.innerHTML = '';
    var pages = getTotalPages();
    for (var i = 0; i < pages; i++) {
      var dot = document.createElement('button');
      dot.className = 'testimonials_dot' + (i === currentPage ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Page ' + (i + 1));
      dot.dataset.page = i;
      dot.addEventListener('click', function () {
        goTo(parseInt(this.dataset.page));
      });
      dotsContainer.appendChild(dot);
    }
  }

  function goTo(page) {
    var pages = getTotalPages();
    currentPage = Math.max(0, Math.min(page, pages - 1));

    var card = cards[0];
    var style = getComputedStyle(track);
    var gap = parseFloat(style.gap) || 0;
    var cardWidth = card.offsetWidth + gap;
    var offset = currentPage * cardWidth;

    track.style.transform = 'translateX(-' + offset + 'px)';

    var dots = dotsContainer.querySelectorAll('.testimonials_dot');
    dots.forEach(function (d, i) {
      d.classList.toggle('is-active', i === currentPage);
    });
  }

  function init() {
    cardsPerView = getCardsPerView();
    currentPage = 0;
    buildDots();
    goTo(0);
  }

  prevBtn.addEventListener('click', function () {
    goTo(currentPage - 1);
  });

  nextBtn.addEventListener('click', function () {
    goTo(currentPage + 1);
  });

  window.addEventListener('resize', function () {
    var newPerView = getCardsPerView();
    if (newPerView !== cardsPerView) {
      cardsPerView = newPerView;
      init();
    }
  });

  init();
})();
