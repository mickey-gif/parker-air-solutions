/* ============================================================
   Service Page — Gallery Carousel + FAQ Accordion
   ============================================================ */

(function () {

  /* ---- Gallery Carousel ---- */
  const galleryTrack = document.getElementById('galleryTrack');
  const galleryDotsContainer = document.getElementById('galleryDots');
  const galleryPrev = document.getElementById('galleryPrev');
  const galleryNext = document.getElementById('galleryNext');

  if (galleryTrack && galleryDotsContainer) {
    const slides = galleryTrack.querySelectorAll('.service-gallery_slide');
    const totalSlides = slides.length;
    let currentSlide = 0;
    let slidesPerView = 2;

    function getSlidesPerView() {
      return window.innerWidth <= 991 ? 1 : 2;
    }

    function getTotalPages() {
      return Math.max(1, totalSlides - slidesPerView + 1);
    }

    function buildGalleryDots() {
      galleryDotsContainer.innerHTML = '';
      var pages = getTotalPages();
      for (var i = 0; i < pages; i++) {
        var dot = document.createElement('button');
        dot.className = 'service-gallery_dot' + (i === currentSlide ? ' is-active' : '');
        dot.setAttribute('aria-label', 'Slide ' + (i + 1));
        dot.dataset.slide = i;
        dot.addEventListener('click', function () {
          goToSlide(parseInt(this.dataset.slide));
        });
        galleryDotsContainer.appendChild(dot);
      }
    }

    function goToSlide(index) {
      var pages = getTotalPages();
      currentSlide = Math.max(0, Math.min(index, pages - 1));

      var slide = slides[0];
      var style = getComputedStyle(galleryTrack);
      var gap = parseFloat(style.gap) || 0;
      var slideWidth = slide.offsetWidth + gap;
      var offset = currentSlide * slideWidth;

      galleryTrack.style.transform = 'translateX(-' + offset + 'px)';

      var dots = galleryDotsContainer.querySelectorAll('.service-gallery_dot');
      dots.forEach(function (d, i) {
        d.classList.toggle('is-active', i === currentSlide);
      });
    }

    function initGallery() {
      slidesPerView = getSlidesPerView();
      currentSlide = 0;
      buildGalleryDots();
      goToSlide(0);
    }

    if (galleryPrev) {
      galleryPrev.addEventListener('click', function () {
        goToSlide(currentSlide - 1);
      });
    }

    if (galleryNext) {
      galleryNext.addEventListener('click', function () {
        goToSlide(currentSlide + 1);
      });
    }

    window.addEventListener('resize', function () {
      var newPerView = getSlidesPerView();
      if (newPerView !== slidesPerView) {
        slidesPerView = newPerView;
        initGallery();
      }
    });

    initGallery();
  }


  /* ---- FAQ Accordion ---- */
  var faqItems = document.querySelectorAll('.service-faq_item');

  faqItems.forEach(function (item) {
    var question = item.querySelector('.service-faq_question');
    if (!question) return;

    question.addEventListener('click', function () {
      var isActive = item.classList.contains('is-active');

      // Close all other items
      faqItems.forEach(function (other) {
        other.classList.remove('is-active');
      });

      // Toggle current
      if (!isActive) {
        item.classList.add('is-active');
      }
    });
  });

})();
