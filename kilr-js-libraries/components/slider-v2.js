// Version 2.0.0 (Modern Native Flex + CSS Scroll Snap)

(function() {
  class KilrSliderV2 {
    constructor(container) {
      this.container = container;
      this.track = this.findClosestChildElement('[kilr-slider="track"]');
      this.pagination = this.findClosestChildElement('[kilr-slider="pagination"]');
      this.liveAnnouncement = this.findClosestChildElement('[kilr-slider="live-announcement"]');
      
      this.originalSlides = Array.from(this.track.children).filter(child => 
        child.getAttribute('kilr-slider') === 'slide'
      );
      
      if (this.originalSlides.length === 0) return;
      
      this.isReplaceMode = this.container.getAttribute('data-track-mode') === 'replace';
      this.activePosition = this.container.getAttribute('data-active-position') || 'center'; // 'left', 'center', 'right'
      this.slideAlign = this.container.getAttribute('data-slide-align') || 'stretch'; // top, center, bottom normally, but stretch is best for flex
      this.loopMode = this.container.getAttribute('data-loop-mode') === 'true';
      
      // Accessibility
      if (!this.container.hasAttribute('role')) this.container.setAttribute('role', 'region');
      if (!this.container.hasAttribute('aria-roledescription')) this.container.setAttribute('aria-roledescription', 'carousel');
      
      // Transform traditional slider CSS into modern flex + snap
      this.applyNativeStyles();

      // Assign reference IDs
      this.originalSlides.forEach((slide, index) => {
        if (!slide.getAttribute('kilr-slider-slide-id')) {
          slide.setAttribute('kilr-slider-slide-id', String(index + 1));
        }
      });
      
      this.allSlides = [...this.originalSlides];
      this.activeIndex = 0;
      this.scrollTimeout = null;

      if (this.loopMode) {
        this.setupClones();
      }

      this.setupPagination();
      this.setupNavigation();
      
      // Wait for layout rendering, then bind the scroll event to automatically detect active slides
      setTimeout(() => {
        this.track.addEventListener('scroll', this.onScroll.bind(this), { passive: true });
        
        // Setup initial slide position
        if (this.loopMode) {
            this.scrollToSlide(this.originalSlides[0], false);
        } else {
            this.updateActiveState();
        }
      }, 100);

      // Handle product images if specified
      const productImageAttr = container.getAttribute('data-product-image');
      if ((productImageAttr !== null && productImageAttr !== 'false') || container.classList.contains('w-product-image')) {
        this.initializeImageMapping();
        document.addEventListener('variant-image-changed', this.handleVariantChange.bind(this));
      }

      // Accessibility Keyboard interaction
      this.container.tabIndex = 0;
      this.container.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    applyNativeStyles() {
      // Setup Container
      this.container.style.position = 'relative';

      // Setup Track for Flex + Native Snapping
      this.track.style.display = 'flex';
      this.track.style.overflowX = 'auto';
      
      // We start it off as mandatory, handle edge cases dynamically 
      this.track.style.scrollSnapType = 'x mandatory';
      
      // Hide standard scrollbars to look clean
      this.track.style.scrollbarWidth = 'none'; // Firefox
      this.track.style.msOverflowStyle = 'none'; // IE/Edge
      
      // For WebKit (Safari/Chrome), we dynamically inject CSS to hide the track scrollbar
      if (!document.getElementById('kilr-slider-v2-webkits')) {
        const style = document.createElement('style');
        style.id = 'kilr-slider-v2-webkits';
        style.textContent = `
          [kilr-slider="track"]::-webkit-scrollbar { display: none; }
          .kilr-slider-v2-nosnap { scroll-snap-type: none !important; }
        `;
        document.head.appendChild(style);
      }

      // Convert vertical alignments to Flex terms
      let alignMap = {
        'top': 'flex-start',
        'center': 'center',
        'bottom': 'flex-end',
        'stretch': 'stretch' // Using stretch gives all slides the height of the tallest slide natively!
      };
      
      // Force stretch unless actively requested otherwise, since stretch acts as the natively perfect "calculateHeight"
      this.track.style.alignItems = alignMap[this.slideAlign] || 'stretch';

      // Alignment relative to the track bounds
      let snapAlignMap = {
        'left': 'start',
        'center': 'center',
        'right': 'end'
      };
      let snapAlign = snapAlignMap[this.activePosition] || 'center';

      // Configure each slide to behave like a standard snapping child
      this.originalSlides.forEach(slide => {
        // Remove old absolute positions if they existed in user's CSS
        slide.style.position = 'relative';
        slide.style.left = 'auto';
        slide.style.top = 'auto';
        slide.style.transform = 'none';
        
        // Prevent layout crushing
        slide.style.flexShrink = '0';
        slide.style.scrollSnapAlign = snapAlign;
      });
    }

    setupClones() {
      // For infinite loop, duplicate slides at the beginning and end
      this.clonesLeft = this.originalSlides.map(s => {
        const c = s.cloneNode(true);
        c.setAttribute('kilr-slider-clone', 'true');
        return c;
      });
      this.clonesRight = this.originalSlides.map(s => {
        const c = s.cloneNode(true);
        c.setAttribute('kilr-slider-clone', 'true');
        return c;
      });

      this.clonesLeft.forEach(c => this.track.insertBefore(c, this.track.firstChild));
      this.clonesRight.forEach(c => this.track.appendChild(c));

      this.allSlides = [...this.clonesLeft, ...this.originalSlides, ...this.clonesRight];
    }

    findClosestChildElement(selector) {
      const elements = this.container.querySelectorAll(selector);
      for (const element of elements) {
        if (element.closest('[kilr-slider="container"]') === this.container) return element;
      }
      return null;
    }

    findAllChildElements(selector) {
      const elements = this.container.querySelectorAll(selector);
      return Array.from(elements).filter(el => el.closest('[kilr-slider="container"]') === this.container);
    }

    setupNavigation() {
      const nextBtns = this.findAllChildElements('[kilr-slider="next"]');
      const prevBtns = this.findAllChildElements('[kilr-slider="prev"]');

      nextBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); this.next(); }));
      prevBtns.forEach(btn => btn.addEventListener('click', (e) => { e.preventDefault(); this.prev(); }));
    }

    setupPagination() {
      if (!this.pagination) return;
      
      const template = this.pagination.querySelector('[kilr-slider="bullet"], [kilr-slider="thumbnail"]');
      let isThumbnail = template ? template.getAttribute('kilr-slider') === 'thumbnail' : false;
      this.pagination.innerHTML = '';

      this.originalSlides.forEach((slide, i) => {
        let element = template ? template.cloneNode(true) : document.createElement('div');
        if (!template) element.setAttribute('kilr-slider', 'bullet');
        
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', `Go to slide ${i + 1}`);
        
        const applyAction = (e) => {
          e.preventDefault();
          this.scrollToSlide(this.originalSlides[i]);
        };
        element.addEventListener('click', applyAction);
        element.addEventListener('touchend', applyAction);

        if (isThumbnail) {
           const img = element.querySelector(':scope > img');
           const slideImg = slide.querySelector(':scope > [kilr-slider="image"]');
           if (img && slideImg && slideImg.getAttribute('src')) {
             img.setAttribute('src', slideImg.getAttribute('src'));
           }
        }
        this.pagination.appendChild(element);
      });
      
      if (this.pagination.classList.contains('is-dynamic-width')) {
        let width = `${100 / this.originalSlides.length}%`;
        Array.from(this.pagination.children).forEach(b => b.style.width = width);
      }
    }

    onScroll() {
      clearTimeout(this.scrollTimeout);
      this.updateActiveState();

      if (this.loopMode) {
         this.scrollTimeout = setTimeout(() => {
           this.handleInfiniteLoop();
         }, 150); // Validate infinite loop when scrolling has effectively stopped
      }
    }

    handleInfiniteLoop() {
      const activeSlide = this.getActiveSlideElement();
      if (!activeSlide) return;

      const isClone = activeSlide.getAttribute('kilr-slider-clone') === 'true';
      if (isClone) {
        // Find the "real" version of this clone
        const origId = activeSlide.getAttribute('kilr-slider-slide-id');
        const targetOrig = this.originalSlides.find(s => s.getAttribute('kilr-slider-slide-id') === origId);
        
        if (targetOrig) {
          // Disable snapping briefly so we don't snap back when teleporting
          this.track.classList.add('kilr-slider-v2-nosnap');
          
          this.scrollToSlide(targetOrig, false); // false = instant jump, no smooth scrolling
          
          requestAnimationFrame(() => {
            this.track.classList.remove('kilr-slider-v2-nosnap');
          });
        }
      }
    }

    getActiveSlideElement() {
      // Find the slide closest to our intended position relative to the container
      const trackRect = this.track.getBoundingClientRect();
      let anchorPoint;
      if (this.activePosition === 'left') {
        anchorPoint = trackRect.left;
      } else if (this.activePosition === 'right') {
        anchorPoint = trackRect.right;
      } else {
        anchorPoint = trackRect.left + trackRect.width / 2;
      }

      let closestSlide = null;
      let minDistance = Infinity;

      this.allSlides.forEach(slide => {
        const slideRect = slide.getBoundingClientRect();
        let slideAnchor;
        
        if (this.activePosition === 'left') {
          slideAnchor = slideRect.left;
        } else if (this.activePosition === 'right') {
          slideAnchor = slideRect.right;
        } else {
          slideAnchor = slideRect.left + slideRect.width / 2;
        }

        const distance = Math.abs(anchorPoint - slideAnchor);
        if (distance < minDistance) {
          minDistance = distance;
          closestSlide = slide;
        }
      });

      return closestSlide;
    }

    updateActiveState() {
      const activeElement = this.getActiveSlideElement();
      if (!activeElement) return;

      const activeId = activeElement.getAttribute('kilr-slider-slide-id');
      const realIndex = this.originalSlides.findIndex(s => s.getAttribute('kilr-slider-slide-id') === activeId);

      if (realIndex !== -1 && realIndex !== this.activeIndex) {
        this.activeIndex = realIndex;

        // Apply toggles
        this.allSlides.forEach(slide => {
            const isMatch = slide.getAttribute('kilr-slider-slide-id') === activeId;
            slide.classList.toggle('is-active', isMatch);
            slide.setAttribute('aria-hidden', isMatch ? 'false' : 'true');
            if (isMatch && this.isReplaceMode) {
              this.handleDataReplacement(slide);
            }
        });

        this.updateNavPagination();
      }
    }

    updateNavPagination() {
      // Bullets & Thumbnails
      if (this.pagination) {
        Array.from(this.pagination.children).forEach((b, i) => {
          const isActive = (i === this.activeIndex);
          b.classList.toggle('is-active', isActive);
          b.setAttribute('aria-current', isActive ? 'true' : 'false');
          if (isActive && this.pagination.scrollWidth > this.pagination.clientWidth) {
              b.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
          }
        });
      }

      // Hide / Show next and prev limits
      if (!this.loopMode) {
        const nextBtns = this.findAllChildElements('[kilr-slider="next"]');
        const prevBtns = this.findAllChildElements('[kilr-slider="prev"]');
        const isAtEnd = this.activeIndex >= this.originalSlides.length - 1;
        const isAtStart = this.activeIndex <= 0;
        
        nextBtns.forEach(btn => {
          btn.classList.toggle('is-hidden', isAtEnd);
          btn.setAttribute('aria-disabled', isAtEnd);
        });
        prevBtns.forEach(btn => {
          btn.classList.toggle('is-hidden', isAtStart);
          btn.setAttribute('aria-disabled', isAtStart);
        });
      }

      if (this.liveAnnouncement) {
        this.liveAnnouncement.textContent = `Slide ${this.activeIndex + 1} of ${this.originalSlides.length}`;
      }
    }

    scrollToSlide(slideElement, smooth = true) {
      if (!slideElement) return;

      const trackRect = this.track.getBoundingClientRect();
      const slideRect = slideElement.getBoundingClientRect();
      
      // Calculate the exact pixel offset required to align the slide using bounding boxes
      let targetLeft = this.track.scrollLeft + (slideRect.left - trackRect.left);

      let scrollOffset = 0;
      if (this.activePosition === 'left') {
        scrollOffset = targetLeft;
      } else if (this.activePosition === 'right') {
        scrollOffset = targetLeft - trackRect.width + slideRect.width;
      } else { 
        scrollOffset = targetLeft - (trackRect.width / 2) + (slideRect.width / 2);
      }

      this.track.scrollTo({
        left: scrollOffset,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }

    next() {
      const activeEl = this.getActiveSlideElement();
      if (!activeEl) return;
      const indexInAll = this.allSlides.indexOf(activeEl);
      if (indexInAll < this.allSlides.length - 1) {
        this.scrollToSlide(this.allSlides[indexInAll + 1]);
      }
    }

    prev() {
      const activeEl = this.getActiveSlideElement();
      if (!activeEl) return;
      const indexInAll = this.allSlides.indexOf(activeEl);
      if (indexInAll > 0) {
        this.scrollToSlide(this.allSlides[indexInAll - 1]);
      }
    }

    onKeyDown(e) {
      if (e.target.closest('[kilr-slider="container"]') !== this.container) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); this.prev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); this.next(); }
    }

    // Identical data replacement block from original script
    handleDataReplacement(activeSlide) {
      const sourceElements = activeSlide.querySelectorAll('[data-source-element]');
      const replaceElements = document.querySelectorAll('[data-replace-element]');

      sourceElements.forEach(sourceElement => {
        const key = sourceElement.getAttribute('data-source-element');
        const replaceElement = document.querySelector(`[data-replace-element="${key}"]`);
        if (!replaceElement) return;

        if (sourceElement.classList.contains('w-you-tube')) {
          const clone = sourceElement.cloneNode(true);
          Array.from(sourceElement.attributes).forEach(attr => clone.setAttribute(attr.name, attr.value));
          clone.className = replaceElement.className;
          replaceElement.parentNode.replaceChild(clone, replaceElement);

          const observer = new MutationObserver((mutations, obs) => {
            for (const mutation of mutations) {
              if (mutation.addedNodes.length) {
                const sourceIframe = sourceElement.querySelector('iframe');
                const targetIframe = clone.querySelector('iframe');
                
                if (sourceIframe && !targetIframe) {
                  clone.appendChild(sourceIframe.cloneNode(true));
                }
                
                if (sourceIframe && targetIframe) obs.disconnect();
              }
            }
          });

          observer.observe(sourceElement, { childList: true, subtree: true });
          observer.observe(clone, { childList: true, subtree: true });
          setTimeout(() => { if (observer) observer.disconnect(); }, 10000);

        } else if (sourceElement.tagName === 'IMG') {
          const targetImage = replaceElement.tagName === 'IMG' ? replaceElement : replaceElement.querySelector('img');
          if (targetImage) {
            targetImage.src = sourceElement.src;
            const srcset = sourceElement.getAttribute('srcset');
            if (srcset) targetImage.setAttribute('srcset', srcset);
            else targetImage.removeAttribute('srcset');
            targetImage.alt = sourceElement.alt || '';
          }
        } else if (sourceElement.tagName === 'DIV') {
          replaceElement.innerHTML = sourceElement.innerHTML;
        } else if (sourceElement.tagName === 'A') {
          if (replaceElement.tagName === 'A') {
            replaceElement.href = sourceElement.href;
          } else {
            const targetLink = replaceElement.querySelector('a');
            if (targetLink) targetLink.href = sourceElement.href;
          }
        } else {
          replaceElement.textContent = sourceElement.textContent;
        }
      });
    }

    // Shopify Product Image Logic from original script 
    initializeImageMapping() {
      const checkProductData = () => {
        if (window.productData?.data?.product) this.mapSlideImagesToVariants();
        else setTimeout(checkProductData, 100);
      };
      checkProductData();
    }
    
    mapSlideImagesToVariants() {
      const product = window.productData.data.product;
      if (!product) return;
      const variantImages = new Map();
      (product.variants?.nodes || []).forEach(variant => {
        if (variant.image?.url && variant.image?.id) {
          variantImages.set(variant.image.url, variant.image.id.split('/').pop());
        }
      });

      this.originalSlides.forEach(slide => {
        const img = slide.querySelector('img, [kilr-slider="image"]');
        if (img) {
          let matchedImageId = null;
          const src = img.src || img.getAttribute('src');
          if (variantImages.has(src)) matchedImageId = variantImages.get(src);
          else {
            const cleanSrc = src.split('?')[0];
            for (const [vUrl, id] of variantImages) {
               if (cleanSrc === vUrl.split('?')[0]) { matchedImageId = id; break; }
            }
          }
          if (matchedImageId) slide.setAttribute('data-image-id', matchedImageId);
        }
      });
      
      this.allSlides.forEach(slide => {
         const id = slide.getAttribute('kilr-slider-slide-id');
         const orig = this.originalSlides.find(o => o.getAttribute('kilr-slider-slide-id') === id);
         if (orig && orig.getAttribute('data-image-id')) {
           slide.setAttribute('data-image-id', orig.getAttribute('data-image-id'));
         }
      });
    }

    handleVariantChange(event) {
      const { imageId } = event.detail;
      if (!imageId) return;
      const numericId = imageId.split('/').pop();
      // Determine destination without mutating
      const targetOrig = this.originalSlides.find(s => {
         const sid = s.getAttribute('data-image-id');
         return sid && sid.includes(numericId);
      });
      if (targetOrig) this.scrollToSlide(targetOrig, true);
    }
  }

  // Globally bind the new slider
  document.addEventListener('DOMContentLoaded', () => {
    const sliderContainers = document.querySelectorAll('[kilr-slider="container"]');
    sliderContainers.forEach(container => new KilrSliderV2(container));
  });
})();
