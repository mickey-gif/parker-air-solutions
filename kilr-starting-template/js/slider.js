//Version 2.7.9 - Ensure active slide has is-active class before calculating track height, with 500ms delay for transitions


(function() {
  class KilrSlider {
    constructor(container) {
      this.container = container;
      
      // Pre-bind all event handlers
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onWheel = this.onWheel.bind(this);
      this.onTouchStart = this.onTouchStart.bind(this);
      this.onTouchMove = this.onTouchMove.bind(this);
      this.onTouchEnd = this.onTouchEnd.bind(this);
      
      // Add debounce protection
      this.lastTransitionTime = 0;
      this.minTransitionInterval = 50; // Minimum ms between transitions
      
      // Track previously active slide
      this.previouslyActiveSlide = null;
      this.previouslyActiveLeft = null;
      
      // Check for replace mode
      this.isReplaceMode = this.container.getAttribute('data-track-mode') === 'replace';

      // Prioritize data-transition-speed, then data-animation-time, then default
      const transitionSpeed = container.getAttribute('data-transition-speed');  
      const animationTimeAttr = container.getAttribute('data-animation-time');
      if (transitionSpeed !== null) {
        this.animationTime = parseInt(transitionSpeed, 10) || 300;
      } else if (animationTimeAttr !== null) {
        this.animationTime = parseInt(animationTimeAttr, 10) || 300;
      } else {
        this.animationTime = 300;
      }

      // Set ARIA attributes for accessibility.
      if (!this.container.hasAttribute('role')) {
        this.container.setAttribute('role', 'region');
      }
      if (!this.container.hasAttribute('aria-roledescription')) {
        this.container.setAttribute('aria-roledescription', 'carousel');
      }
      if (!this.container.hasAttribute('aria-label')) {
        this.container.setAttribute('aria-label', 'Featured Slides');
      }

      // Query slider elements - find at any depth but ensure they belong to this container
      this.track = findClosestChildElement(container, '[kilr-slider="track"]');
      this.nav = findClosestChildElement(container, '[kilr-slider="navigation"]');
      this.pagination = findClosestChildElement(container, '[kilr-slider="pagination"]');
      this.liveAnnouncement = findClosestChildElement(container, '[kilr-slider="live-announcement"]');

      // Helper function to find the closest child element that belongs to this container
      function findClosestChildElement(container, selector) {
        // Find all matching elements within the container
        const elements = container.querySelectorAll(selector);
        
        // Filter to only those that belong to this container instance
        // (their closest container should be this container)
        for (const element of elements) {
          const closestContainer = element.closest('[kilr-slider="container"]');
          if (closestContainer === container) {
            return element;
          }
        }
        return null;
      }

      // Helper function to find all child elements that belong to this container
      function findAllChildElements(container, selector) {
        // Find all matching elements within the container
        const elements = container.querySelectorAll(selector);
        
        // Filter to only those that belong to this container instance
        return Array.from(elements).filter(element => {
          const closestContainer = element.closest('[kilr-slider="container"]');
          return closestContainer === container;
        });
      }

      // Use data-active-position for horizontal alignment (default center)
      this.activePosition = container.getAttribute('data-active-position') || 'center';
      // Use data-slide-align for vertical alignment (default top)
      this.slideAlign = container.getAttribute('data-slide-align') || 'top';
      this.swipeMode = container.getAttribute('data-slide-swipe') || 'snap';

      // Loop mode: if data-loop-mode="true", enable infinite loop; otherwise, boundaries apply.
      this.loopMode = container.getAttribute('data-loop-mode') === 'true';

      this.activeIndex = 1; // Default to first slide
      this.isAnimating = false;
      this.isInitialHeightCalculation = true; // Track if this is the initial height calculation
      // Read CSS gap from the track element (flex/grid gap); fall back to 20px if not set
      const trackStyle = window.getComputedStyle(this.track);
      const gapStr = trackStyle.getPropertyValue('gap') || trackStyle.getPropertyValue('column-gap') || trackStyle.getPropertyValue('grid-gap');
      this.gap = parseInt(gapStr, 10) || 20;

      // For event prevention and command queue.
      this.lastTouchTime = 0;
      this.lastNavClickTime = 0;
      this.navQueue = [];
      this.wheelTimeout = null;

      // Touch variables.
      this.touchStartX = 0;
      this.touchStartY = 0;
      this.touchDeltaX = 0;
      this.initialPositions = [];

      // Get original slides - only direct children of track
      this.originalSlides = Array.from(this.track.children).filter(child => 
        child.getAttribute('kilr-slider') === 'slide'
      );
      
      console.log('🎠 [SLIDER] Found original slides:', this.originalSlides.length);
      
      // Assign slide IDs if not present
      this.originalSlides.forEach((slide, index) => {
        if (!slide.getAttribute('kilr-slider-slide-id')) {
          slide.setAttribute('kilr-slider-slide-id', String(index + 1));
        }
        const slideId = slide.getAttribute('kilr-slider-slide-id');
        const imageId = slide.getAttribute('data-image-id');
        console.log(`🎠 [SLIDER] Slide ${index + 1}: ID="${slideId}", image-id="${imageId}"`);
      });
      
      if (this.originalSlides.length === 0) {
        console.log('🎠 [SLIDER] No slides found, exiting');
        return;
      }

      // Ensure initial activeIndex is valid (1-based)
      this.activeIndex = Math.max(1, Math.min(this.activeIndex, this.originalSlides.length));

      // Remove any existing is-active classes from all slides
      this.originalSlides.forEach(s => s.classList.remove('is-active'));
      // Make sure our starting slide is marked active before we measure
      if (this.originalSlides[this.activeIndex - 1]) {
        this.originalSlides[this.activeIndex - 1].classList.add('is-active');
      }
      void this.track.offsetWidth; // Force reflow after setting initial active slide
      // Lock in the track height now that our active slide's own CSS (padding/etc) is applied
      this.updateTrackHeight();

      // 1) Measure initial fixed widths SYNCHRONOUSLY
      this.measureSlideWidths();

      // 2) Initialize clones if in loop mode
      if (this.loopMode) {
        this.createClones(); // createClones should set this.allSlidesElements
      } else {
        this.allSlidesElements = this.originalSlides;
      }

      // 3) Build positions using those fixed widths
      this.computeSlidePositions();

      // 4) Initialize navigation and events
      // Always setup pagination (thumbnails) even for single slides
      this.setupPagination();
      // Only setup navigation controls if multiple slides
      if (this.originalSlides.length > 1) {
        this.setupNavigation();
      }
      
      // Update active slide without recomputing positions
      this.updateActiveSlide(false); // Let updateActiveSlide handle final positioning
      this.announceSlide();

      // Make container focusable
      this.container.tabIndex = 0;

      // Add keyboard navigation
      this.container.addEventListener('keydown', this.onKeyDown);

      // Add horizontal wheel scrolling
      this.track.addEventListener('wheel', this.onWheel, { passive: false });

      // Add touch swipe handlers
      this.track.addEventListener('touchstart', this.onTouchStart, { passive: false });
      this.track.addEventListener('touchmove', this.onTouchMove, { passive: false });
      this.track.addEventListener('touchend', this.onTouchEnd);

      // 5) Listen for resize
      window.addEventListener('resize', () => {
        this.measureSlideWidths();
        this.computeSlidePositions();
        // After resize, active slide might need re-centering and nav states update
        this.updateActiveSlide(true);
      });

      // Store instance reference on the container
      this.container._kilrSlider = this;

      // Add product image slider functionality
      const productImageAttr = container.getAttribute('data-product-image');
      if ((productImageAttr !== null && productImageAttr !== 'false') || container.classList.contains('w-product-image')) {
        console.log('🎠 [SLIDER] Product image slider enabled for container:', container);
        
        // Initialize image ID mapping when product data becomes available
        this.initializeImageMapping();
        
        document.addEventListener('variant-image-changed', (event) => {
          console.log('🎠 [SLIDER] Received variant-image-changed event:', event.detail);
          
          const { imageId, imageUrl, variant } = event.detail;
          
          // If no imageId provided, don't try to navigate
          if (!imageId) {
            console.log('🎠 [SLIDER] No imageId provided, skipping navigation');
            return;
          }

          // Extract the numeric part of the Shopify image ID
          const numericImageId = imageId.split('/').pop();
          console.log('🎠 [SLIDER] Looking for numeric image ID:', numericImageId);

          // Log current state for debugging
          console.log('🎠 [SLIDER] Current activeIndex:', this.activeIndex);
          console.log('🎠 [SLIDER] Available originalSlides:', this.originalSlides.length);
          
          // Log slide image IDs (abbreviated)
          const slideImageIds = this.originalSlides.map((slide, index) => {
            const slideImageId = slide.getAttribute('data-image-id');
            return `Slide ${index + 1}: ${slideImageId || 'null'}`;
          });
          console.log('🎠 [SLIDER] Slide image IDs:', slideImageIds.join(', '));

          // Find the slide with matching image ID - check both allSlidesElements and originalSlides
          let targetSlide = null;
          let originalIndex = -1;

          // First try to find in allSlidesElements (handles loop mode)
          if (this.allSlidesElements) {
            targetSlide = this.allSlidesElements.find(slide => {
              const slideImageId = slide.getAttribute('data-image-id');
              const matches = slideImageId && slideImageId.includes(numericImageId);
              if (matches) {
                console.log('🎠 [SLIDER] Found matching slide in allSlidesElements:', slide);
              }
              return matches;
            });

            if (targetSlide) {
              // Find the original slide index, not the clone index
              const targetOriginalId = targetSlide.getAttribute('kilr-slider-slide-id')?.replace(/^[+-]/, '');
              console.log('🎠 [SLIDER] Target original ID:', targetOriginalId);
              
              this.originalSlides.forEach((slide, index) => {
                if (slide.getAttribute('kilr-slider-slide-id') === targetOriginalId) {
                  originalIndex = index + 1;
                  console.log('🎠 [SLIDER] Found original index:', originalIndex);
                }
              });
            }
          }

          // Fallback: search directly in originalSlides
          if (originalIndex === -1) {
            console.log('🎠 [SLIDER] Fallback: searching directly in originalSlides');
            
            this.originalSlides.forEach((slide, index) => {
              const slideImageId = slide.getAttribute('data-image-id');
              if (slideImageId && slideImageId.includes(numericImageId)) {
                originalIndex = index + 1;
                targetSlide = slide;
                console.log('🎠 [SLIDER] Found matching slide in originalSlides:', slide, 'at index:', originalIndex);
              }
            });
          }

          // If we found a matching slide and it's different from current, navigate to it
          if (originalIndex !== -1 && originalIndex !== this.activeIndex) {
            console.log('🎠 [SLIDER] Navigating to slide:', originalIndex, 'from current:', this.activeIndex);
            this.goToSlide(originalIndex);
          } else if (originalIndex === this.activeIndex) {
            console.log('🎠 [SLIDER] Target slide is already active, no navigation needed');
          } else {
            console.log('🎠 [SLIDER] No matching slide found for image ID:', numericImageId);
          }
        });
      } else {
        console.log('🎠 [SLIDER] Product image slider NOT enabled for this container');
      }

      this.lastDirection = null; // Track the last movement direction
    }

    // Initialize image ID mapping for product sliders
    initializeImageMapping() {
      console.log('🎠 [SLIDER] Initializing image mapping...');
      
      // Wait for product data to be available
      const checkProductData = () => {
        if (window.productData?.data?.product) {
          console.log('🎠 [SLIDER] Product data available, mapping images...');
          this.mapSlideImagesToVariants();
        } else {
          console.log('🎠 [SLIDER] Waiting for product data...');
          setTimeout(checkProductData, 100);
        }
      };
      
      checkProductData();
    }

    // Map slider images to Shopify variant images by URL matching
    mapSlideImagesToVariants() {
      const product = window.productData.data.product;
      if (!product) {
        console.log('🎠 [SLIDER] No product data available for mapping');
        return;
      }

      console.log('🎠 [SLIDER] Product data:', product);

      // Collect all unique images from variants
      const variantImages = new Map(); // URL -> imageId
      const variants = product.variants?.nodes || [];
      
      variants.forEach(variant => {
        if (variant.image?.url && variant.image?.id) {
          const imageUrl = variant.image.url;
          const imageId = variant.image.id;
          // Extract numeric ID
          const numericId = imageId.split('/').pop();
          variantImages.set(imageUrl, numericId);
          console.log('🎠 [SLIDER] Found variant image:', imageUrl, '-> ID:', numericId);
        }
      });

      console.log('🎠 [SLIDER] Total variant images found:', variantImages.size);

      // Map slider images to variant images
      this.originalSlides.forEach((slide, index) => {
        const slideImg = slide.querySelector('img, [kilr-slider="image"]');
        if (slideImg) {
          const slideImageUrl = slideImg.src || slideImg.getAttribute('src');
          console.log(`🎠 [SLIDER] Slide ${index + 1} image URL:`, slideImageUrl);
          
          // Try to find matching variant image by URL
          let matchedImageId = null;
          
          // Direct URL match
          if (variantImages.has(slideImageUrl)) {
            matchedImageId = variantImages.get(slideImageUrl);
            console.log(`🎠 [SLIDER] Direct URL match found for slide ${index + 1}: ID ${matchedImageId}`);
          } else {
            // Try URL matching without query parameters
            const cleanSlideUrl = slideImageUrl.split('?')[0];
            for (const [variantUrl, imageId] of variantImages) {
              const cleanVariantUrl = variantUrl.split('?')[0];
              if (cleanSlideUrl === cleanVariantUrl) {
                matchedImageId = imageId;
                console.log(`🎠 [SLIDER] Clean URL match found for slide ${index + 1}: ID ${matchedImageId}`);
                break;
              }
            }
          }

          // Try filename matching as fallback
          if (!matchedImageId) {
            const slideFilename = slideImageUrl.split('/').pop().split('?')[0];
            for (const [variantUrl, imageId] of variantImages) {
              const variantFilename = variantUrl.split('/').pop().split('?')[0];
              if (slideFilename === variantFilename) {
                matchedImageId = imageId;
                console.log(`🎠 [SLIDER] Filename match found for slide ${index + 1}: ID ${matchedImageId}`);
                break;
              }
            }
          }

          if (matchedImageId) {
            slide.setAttribute('data-image-id', matchedImageId);
            console.log(`🎠 [SLIDER] Assigned image ID ${matchedImageId} to slide ${index + 1}`);
          } else {
            console.log(`🎠 [SLIDER] No variant image match found for slide ${index + 1}`);
          }
        } else {
          console.log(`🎠 [SLIDER] No image element found in slide ${index + 1}`);
        }
      });

      // Update allSlidesElements if in loop mode
      if (this.loopMode && this.allSlidesElements) {
        this.allSlidesElements.forEach(slide => {
          const originalId = slide.getAttribute('kilr-slider-slide-id')?.replace(/^[+-]/, '');
          if (originalId) {
            const originalSlide = this.originalSlides.find(s => 
              s.getAttribute('kilr-slider-slide-id') === originalId
            );
            if (originalSlide) {
              const imageId = originalSlide.getAttribute('data-image-id');
              if (imageId) {
                slide.setAttribute('data-image-id', imageId);
                console.log(`🎠 [SLIDER] Copied image ID ${imageId} to clone slide`);
              }
            }
          }
        });
      }

      console.log('🎠 [SLIDER] Image mapping complete');
    }

    measureSlideWidths() {
      if (!this.originalSlides || this.originalSlides.length === 0) {
        this.inactiveSlideWidth = 0;
        this.activeSlideWidth = 0;
        return;
      }

      // Pick our active one (we just added .is-active in constructor!)
      const activeSlide = this.originalSlides[this.activeIndex - 1];
      // And pick any other slide for the "inactive" measurement
      // Ensure inactiveSlide is different from activeSlide, if possible
      let inactiveSlide = this.originalSlides.find((s, i) => i !== (this.activeIndex - 1));
      if (!inactiveSlide) { // If only one slide, or couldn't find a different one
          inactiveSlide = activeSlide; // Fallback to activeSlide for measurement (widths will be same)
      }

      // 1) Measure inactive:
      // Ensure the slide chosen for inactive measurement is indeed inactive
      const wasInactiveOriginallyActive = inactiveSlide.classList.contains('is-active');
      inactiveSlide.classList.remove('is-active');
      void inactiveSlide.offsetWidth; // force reflow
      
      // Temporarily disable transitions and measure
      const originalInactiveTransition = inactiveSlide.style.transition;
      inactiveSlide.style.transition = 'none';
      void inactiveSlide.offsetWidth; // force reflow
      const inactiveW = inactiveSlide.getBoundingClientRect().width;
      inactiveSlide.style.transition = originalInactiveTransition;
      
      if (wasInactiveOriginallyActive) inactiveSlide.classList.add('is-active'); // Restore if it was active

      // 2) Measure active:
      // Ensure the chosen activeSlide is active for measurement
      const wasActiveOriginallyInactive = !activeSlide.classList.contains('is-active');
      activeSlide.classList.add('is-active');
      void activeSlide.offsetWidth; // force reflow
      
      // Temporarily disable transitions and measure
      const originalActiveTransition = activeSlide.style.transition;
      activeSlide.style.transition = 'none';
      void activeSlide.offsetWidth; // force reflow
      const activeW = activeSlide.getBoundingClientRect().width;
      activeSlide.style.transition = originalActiveTransition;
      
      if (wasActiveOriginallyInactive) activeSlide.classList.remove('is-active'); // Restore if it was not meant to be active

      // Store
      this.inactiveSlideWidth = inactiveW;
      this.activeSlideWidth   = activeW;

      // 3) Now restore the classes on _all_ slides properly based on current this.activeIndex
      this.originalSlides.forEach((s,i) => {
        s.classList.toggle('is-active', (i + 1) === this.activeIndex);
      });
      if (this.loopMode && this.allSlidesElements) {
          this.allSlidesElements.forEach(s => {
              let originalId = s.getAttribute('kilr-slider-slide-id');
              if (originalId && (originalId.startsWith('+') || originalId.startsWith('-'))) {
                  originalId = originalId.substring(1);
              }
              s.classList.toggle('is-active', originalId === String(this.activeIndex));
          });
      }
      void this.track.offsetWidth; // Final reflow after class restoration
    }

    computeSlidePositions() {
      const slides = this.loopMode ? this.allSlidesElements : this.originalSlides;
      
      // Use our stored fixed widths
      const inactiveW = this.inactiveSlideWidth;
      const activeW = this.activeSlideWidth;
      
      // Remove left positioning only, let CSS handle transitions
      slides.forEach(slide => {
        slide.style.left = '';
      });

      // Calculate positions
      let currentLeft = 0;
      const activeSlideIndex = this.loopMode ? 
        this.clonesLeft.length + (this.activeIndex - 1) :
        this.activeIndex - 1;

      this.slideData = slides.map((slide, index) => {
        slide.style.position = 'absolute';
        const isActive = index === activeSlideIndex;
        const width = isActive ? activeW : inactiveW;
        
        const data = {
          element: slide,
          left: currentLeft,
          width: width,
          inactiveWidth: inactiveW,
          activeWidth: activeW,
          isActive
        };
        
        currentLeft += width + this.gap;
        return data;
      });

      // Apply states and transformations
      slides.forEach((slide, index) => {
        if (index === activeSlideIndex) {
          slide.classList.add('is-active');
        } else {
          slide.classList.remove('is-active');
        }

        // Apply vertical alignment
        slide.style.top = (this.slideAlign === 'center' && window.innerWidth >= 768) ? '50%' : 
                         (this.slideAlign === 'bottom') ? '100%' : '0';
      });

      // Update track height before positioning
      this.updateTrackHeight();

      // Position slides relative to container
      const containerWidth = this.container.offsetWidth;
      const activeSlideData = this.slideData[activeSlideIndex];
      
      if (activeSlideData) {
        let targetLeft;
        if (this.activePosition === 'center') {
          targetLeft = (containerWidth - activeSlideData.width) / 2;
        } else if (this.activePosition === 'left') {
          targetLeft = 0;
        } else if (this.activePosition === 'right') {
          targetLeft = containerWidth - activeSlideData.width;
        } else {
          targetLeft = (containerWidth - activeSlideData.width) / 2;
        }

        const diff = targetLeft - activeSlideData.left;
        this.slideData.forEach(data => {
          data.left += diff;
          this.updateTransform(data);
        });
      }
    }

    // Update transform with horizontal shift and vertical alignment.
    updateTransform(data) {
      let translateY = "";
      if (this.slideAlign === 'center' && window.innerWidth >= 768) {
        translateY = " translateY(-50%)";
      } else if (this.slideAlign === 'bottom') {
        translateY = " translateY(-100%)";
      }
      // Never set transition in JS - let CSS handle it
      data.element.style.transform = `translateX(${data.left}px)${translateY}`;
    }

    createClones() {
      const originals = this.originalSlides;
      this.track.innerHTML = '';

      this.clonesLeft = originals.map(el => {
        const clone = el.cloneNode(true);
        const origId = el.getAttribute('kilr-slider-slide-id');
        clone.setAttribute('kilr-slider-slide-id', '-' + origId);
        clone.setAttribute('kilr-slider-clone', 'true');
        return clone;
      });
      this.clonesRight = originals.map(el => {
        const clone = el.cloneNode(true);
        const origId = el.getAttribute('kilr-slider-slide-id');
        clone.setAttribute('kilr-slider-slide-id', '+' + origId);
        clone.setAttribute('kilr-slider-clone', 'true');
        return clone;
      });

      this.allSlidesElements = [];
      this.clonesLeft.forEach(el => {
        this.track.appendChild(el);
        this.allSlidesElements.push(el);
      });
      originals.forEach(el => {
        this.track.appendChild(el);
        this.allSlidesElements.push(el);
      });
      this.clonesRight.forEach(el => {
        this.track.appendChild(el);
        this.allSlidesElements.push(el);
      });
    }

    setupNavigation() {
      if (!this.nav) {
        return;
      }

      const nextBtn = this.nav.querySelector('[kilr-slider="next"]');
      const prevBtn = this.nav.querySelector('[kilr-slider="prev"]');

      const handleNavClick = (e, direction) => {
        e.preventDefault();
        e.stopPropagation();

        // Get the clicked button's container slider
        const clickedSlider = e.target.closest('[kilr-slider="container"]');
        
        // Only proceed if this click belongs to our slider
        if (clickedSlider === this.container) {
          // Add debounce check here too
          const now = Date.now();
          if (now - this.lastTransitionTime < this.minTransitionInterval) {
            return;
          }
          
          if (direction === 'next') {
            this.next();
          } else {
            this.prev();
          }
        }
      };

      if (nextBtn) {
        nextBtn.addEventListener('click', (e) => handleNavClick(e, 'next'));
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', (e) => handleNavClick(e, 'prev'));
      }
    }

    setupPagination() {
      if (!this.pagination) return;
      
      const template = this.pagination.querySelector('[kilr-slider="bullet"], [kilr-slider="thumbnail"]');
      let isThumbnail = false;
      if (template) {
        isThumbnail = template.getAttribute('kilr-slider') === 'thumbnail';
      }
      this.pagination.innerHTML = '';

      for (let i = 0; i < this.originalSlides.length; i++) {
        let element;
        if (template) {
          element = template.cloneNode(true);
        } else {
          element = document.createElement('div');
          element.setAttribute('kilr-slider', 'bullet');
        }
        element.setAttribute('kilr-slider-index', i + 1);
        element.setAttribute('role', 'button');
        element.setAttribute('tabindex', '0');
        element.setAttribute('aria-label', `Go to slide ${i + 1}`);
        element.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const clickedSlider = e.target.closest('[kilr-slider="container"]');
          if (clickedSlider === this.container) {
            this.goToSlide(i + 1);
          }
        });

        element.addEventListener('touchend', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const touchedSlider = e.target.closest('[kilr-slider="container"]');
          if (touchedSlider === this.container) {
            this.goToSlide(i + 1);
          }
        });
        if (isThumbnail) {
          const img = element.querySelector(':scope > img');
          if (img) {
            const correspondingSlide = this.originalSlides[i];
            if (correspondingSlide) {
              const slideImg = correspondingSlide.querySelector(':scope > [kilr-slider="image"]');
              if (slideImg && slideImg.getAttribute('src')) {
                img.setAttribute('src', slideImg.getAttribute('src'));
              }
            }
          }
        }
        this.pagination.appendChild(element);
      }

      if (this.pagination.classList.contains('is-dynamic-width')) {
        let bulletCount = this.originalSlides.length;
        let bulletWidth = (100 / bulletCount).toFixed(3);
        let bulletElements = this.pagination.querySelectorAll(':scope > [kilr-slider="bullet"]');
        bulletElements.forEach(bullet => {
          bullet.style.width = `${bulletWidth}%`;
        });
      }
    }

    updateTrackHeight() {
      const slides = this.loopMode ? this.allSlidesElements : this.originalSlides;
      if (!slides) return; // Guard against undefined slides
      
      // Ensure the active slide (first slide initially) has is-active class before measuring height
      const activeSlideIndex = this.loopMode ? 
        this.clonesLeft.length + (this.activeIndex - 1) :
        this.activeIndex - 1;
      const activeSlide = slides[activeSlideIndex];
      if (activeSlide && !activeSlide.classList.contains('is-active')) {
        activeSlide.classList.add('is-active');
        void activeSlide.offsetWidth; // Force reflow after adding class
      }
      
      // Only delay on initial height calculation to account for transition animations
      const calculateHeight = () => {
        let maxHeight = 0;
        slides.forEach(slide => {
          const h = slide.offsetHeight;
          if (h > maxHeight) maxHeight = h;
        });
        // First, set the track height to the computed tallest slide height.
        this.track.style.height = maxHeight + "px";

        // Now adjust the slide heights based on the data-slide-height attribute.
        // If data-slide-height is "100", set each slide's height to "100%".
        // Otherwise remove any inline height (so SVGs don't get height="auto" attributes)
        const slideHeightAttr = this.container.getAttribute('data-slide-height');
        if (slideHeightAttr === "100") {
          slides.forEach(slide => {
            slide.style.height = "100%";
          });
        } else {
          slides.forEach(slide => {
            slide.style.removeProperty('height');
          });
        }
      };
      
      if (this.isInitialHeightCalculation) {
        // Delay only on initial calculation
        setTimeout(() => {
          calculateHeight();
          this.isInitialHeightCalculation = false; // Mark as no longer initial
        }, 500);
      } else {
        // Calculate immediately for subsequent calls
        calculateHeight();
      }
    }

    updateActiveSlide(applyTransformations = true) {
      const slides = this.loopMode ? this.allSlidesElements : this.originalSlides;
      const activeSlideIndex = this.loopMode ? 
        this.clonesLeft.length + (this.activeIndex - 1) :
        this.activeIndex - 1;

      // Update active states and store previous active
      slides.forEach((slide, index) => {
        const willBeActive = index === activeSlideIndex;
        const wasActive = slide.classList.contains('is-active');
        
        if (wasActive && !willBeActive) {
          this.previouslyActiveSlide = slide;
          this.previouslyActiveLeft = this.slideData.find(d => d.element === slide)?.left;
        }

        if (willBeActive) {
          slide.classList.add('is-active');
          slide.setAttribute('aria-hidden', 'false');
          // Call handleDataReplacement for the newly active slide
          if (this.isReplaceMode) {
            this.handleDataReplacement(slide);
          }
        } else {
          slide.classList.remove('is-active');
          slide.setAttribute('aria-hidden', 'true');
        }
      });

      // Update navigation states
      this.updateNavigationAndPaginationStates();

      // Only recompute positions if requested
      if (applyTransformations) {
        this.computeSlidePositions();
      }

      // Update live region for accessibility
      if (this.liveAnnouncement) {
        this.liveAnnouncement.textContent = `Showing slide ${this.activeIndex} of ${this.originalSlides.length}`;
      }
    }

    updateNavigationAndPaginationStates() {
      // Update navigation buttons visibility
      if (!this.loopMode && this.nav) {
        const nextBtn = this.nav.querySelector('[kilr-slider="next"]');
        const prevBtn = this.nav.querySelector('[kilr-slider="prev"]');
        
        if (nextBtn) {
          nextBtn.classList.toggle('is-hidden', this.activeIndex >= this.originalSlides.length);
          nextBtn.setAttribute('aria-disabled', this.activeIndex >= this.originalSlides.length);
        }
        if (prevBtn) {
          prevBtn.classList.toggle('is-hidden', this.activeIndex <= 1);
          prevBtn.setAttribute('aria-disabled', this.activeIndex <= 1);
        }
      }

      // Update pagination bullets
      if (this.pagination) {
        const bullets = Array.from(this.pagination.children);
        bullets.forEach((bullet, index) => {
          const isActive = index === this.activeIndex - 1;
          bullet.classList.toggle('is-active', isActive);
          bullet.setAttribute('aria-current', isActive ? 'true' : 'false');
          if (isActive) {
            // If pagination container is scrollable, scroll active thumbnail to the left edge.
            if (this.pagination.scrollWidth > this.pagination.clientWidth) {
              this.pagination.scrollTo({
                left: bullet.offsetLeft,
                behavior: 'smooth'
              });
            }
          }
        });
      }
    }

    handleDataReplacement(activeSlide) {
      
      // First find all source elements in the active slide
      const sourceElements = activeSlide.querySelectorAll('[data-source-element]');
      

      // Find all replace elements in the document
      const replaceElements = document.querySelectorAll('[data-replace-element]');
      

      // Process each source element
      sourceElements.forEach(sourceElement => {
        // Get the key we're looking for
        const key = sourceElement.getAttribute('data-source-element');
        

        // Find the matching replace element in the document
        const replaceElement = document.querySelector(`[data-replace-element="${key}"]`);
        

        if (!replaceElement) {
          return;
        }

        // Handle different element types
        if (sourceElement.classList.contains('w-you-tube')) {
          // Create a deep clone of the source element
          const clone = sourceElement.cloneNode(true);
          
          // Copy over any properties that might be lost in cloning
          Array.from(sourceElement.attributes).forEach(attr => {
            clone.setAttribute(attr.name, attr.value);
          });

          // Preserve any existing classes from the replace element
          clone.className = replaceElement.className;
          
          // Replace the target element with our clone
          replaceElement.parentNode.replaceChild(clone, replaceElement);

          // Set up mutation observer to watch for iframe additions
          const observer = new MutationObserver((mutations, obs) => {
            for (const mutation of mutations) {
              // Check if nodes were added
              if (mutation.addedNodes.length) {
                const sourceIframe = sourceElement.querySelector('iframe');
                const targetIframe = clone.querySelector('iframe');
                
                // If source has iframe and target doesn't, copy it
                if (sourceIframe && !targetIframe) {
                  const iframeClone = sourceIframe.cloneNode(true);
                  clone.appendChild(iframeClone);
                }
                
                // If both have iframes, stop observing
                if (sourceIframe && targetIframe) {
                  obs.disconnect();
                }
              }
            }
          });

          // Start observing both source and target
          observer.observe(sourceElement, { 
            childList: true, 
            subtree: true 
          });
          observer.observe(clone, { 
            childList: true, 
            subtree: true 
          });

          // Set a timeout to stop the observer after a reasonable time
          setTimeout(() => {
            if (observer) {
              observer.disconnect();
            }
          }, 10000); // Stop after 10 seconds max

        } else if (sourceElement.tagName === 'IMG') {
          // For images, we want to replace the actual image element
          const sourceImage = sourceElement;
          const targetImage = replaceElement.tagName === 'IMG' ? replaceElement : replaceElement.querySelector('img');

          if (!targetImage) {
            return;
          }

          // Directly set the properties
          targetImage.src = sourceImage.src;
          
          // Handle srcset if it exists
          const sourceSrcset = sourceImage.getAttribute('srcset');
          if (sourceSrcset) {
            targetImage.setAttribute('srcset', sourceSrcset);
          } else {
            targetImage.removeAttribute('srcset');
          }

          // Handle alt text
          targetImage.alt = sourceImage.alt || '';

        } else if (sourceElement.tagName === 'DIV') {
          replaceElement.innerHTML = sourceElement.innerHTML;
          
        } else if (sourceElement.tagName === 'A') {
          if (replaceElement.tagName === 'A') {
            replaceElement.href = sourceElement.href;
          } else {
            const targetLink = replaceElement.querySelector('a');
            if (targetLink) {
              targetLink.href = sourceElement.href;
            }
          }
          
        } else {
          replaceElement.textContent = sourceElement.textContent;
        }
      });
    }

    announceSlide() {
      if (this.liveAnnouncement) {
        this.liveAnnouncement.textContent = `Slide ${this.activeIndex} of ${this.originalSlides.length}`;
      }
    }

    processQueue() {
      if (this.navQueue.length > 0) {
        const command = this.navQueue.shift();
        if (command.type === 'next') {
          this.next();
        } else if (command.type === 'prev') {
          this.prev();
        } else if (command.type === 'goto') {
          this.goToSlide(command.target);
        }
      }
    }

    next() {
      const now = Date.now();
      if (now - this.lastTransitionTime < this.minTransitionInterval) return;
      this.lastTransitionTime = now;
      this.lastDirection = 'next';

      // compute the soon-to-be active slide
      let newIndex = this.loopMode
        ? (this.activeIndex % this.originalSlides.length) + 1
        : Math.min(this.activeIndex + 1, this.originalSlides.length);

      // Initial shift by inactive width + gap
      const shiftAmount = this.inactiveSlideWidth + this.gap;

      this.slideData.forEach(d => {
        d.left -= shiftAmount;
        this.updateTransform(d);
      });

      // now finalize with a full position recalculation
      this.activeIndex = newIndex;
      this.updateActiveSlide(true); // Let updateActiveSlide handle final positioning
      this.announceSlide();
    }

    prev() {
      const now = Date.now();
      if (now - this.lastTransitionTime < this.minTransitionInterval) return;
      this.lastTransitionTime = now;
      this.lastDirection = 'prev';

      // Remember which slide was active
      const oldActive = this.allSlidesElements.find(s => s.classList.contains('is-active'));
      this.previouslyActiveSlide = oldActive;

      // Initial shift by inactive width + gap
      const shiftAmount = this.inactiveSlideWidth + this.gap;
      
      this.slideData.forEach(d => {
        d.left += shiftAmount;
        this.updateTransform(d);
      });

      // Update active index and do a full position recalculation
      let newIndex = this.loopMode
        ? (this.activeIndex === 1 ? this.originalSlides.length : this.activeIndex - 1)
        : Math.max(this.activeIndex - 1, 1);

      this.activeIndex = newIndex;
      this.updateActiveSlide(true); // Let updateActiveSlide handle final positioning
      this.announceSlide();
    }

    goToSlide(targetIndex) {
      if (this.isAnimating || targetIndex === this.activeIndex) {
        return;
      }
      if (targetIndex < 1 || targetIndex > this.originalSlides.length) {
        return;
      }

      // Set isAnimating flag when transition starts
      const onTransitionStart = () => {
        this.isAnimating = true;
      };

      // Clear isAnimating flag when transition ends
      const onTransitionEnd = () => {
        this.isAnimating = false;
        if (this.loopMode) this.repositionSlides();
        this.processQueue();
      };

      // Add transition listeners to the slides that will move
      this.allSlidesElements.forEach(slide => {
        slide.addEventListener('transitionstart', onTransitionStart, { once: true });
        slide.addEventListener('transitionend', onTransitionEnd, { once: true });
      });

      this.activeIndex = targetIndex;
      this.updateActiveSlide();
      this.announceSlide();
    }

    repositionSlides() {
      if (!this.loopMode) return;
      const containerWidth = this.container.offsetWidth;
      let leftmost = this.slideData[0];
      let rightmost = this.slideData[0];
      this.slideData.forEach(data => {
        if (data.left < leftmost.left) leftmost = data;
        if (data.left > rightmost.left) rightmost = data;
      });
      if (leftmost.left + leftmost.width + this.gap < 0) {
        // Let CSS handle the transition
        leftmost.left = rightmost.left + rightmost.width + this.gap;
        leftmost.element.style.transform = `translateX(${leftmost.left}px)`;
      }
      if (rightmost.left > containerWidth) {
        // Let CSS handle the transition
        rightmost.left = leftmost.left - rightmost.width - this.gap;
        rightmost.element.style.transform = `translateX(${rightmost.left}px)`;
      }
      // Reapply horizontal alignment based on activePosition.
      let activeSlide = this.slideData[this.clonesLeft.length + (this.activeIndex - 1)];
      let targetLeft;
      if (this.activePosition === 'center') {
        targetLeft = (containerWidth - activeSlide.width) / 2;
      } else if (this.activePosition === 'left') {
        targetLeft = 0;
      } else if (this.activePosition === 'right') {
        targetLeft = containerWidth - activeSlide.width;
      } else {
        targetLeft = (containerWidth - activeSlide.width) / 2;
      }
      let diff = targetLeft - activeSlide.left;
      this.slideData.forEach(data => {
        data.left += diff;
        this.updateTransform(data);
      });
    }

    onKeyDown(e) {
      // Get the element that received the key event
      const targetElement = e.target;
      
      // Find which slider this element belongs to
      const targetSlider = targetElement.closest('[kilr-slider="container"]');
      
      // Only handle keys if the event belongs to our slider
      if (targetSlider !== this.container) {
        return;
      }

      if (this.isAnimating) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        this.prev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        this.next();
      }
    }

    onWheel(e) {
      // Get the element that received the wheel event
      const targetElement = e.target;
      
      // Find which slider this element belongs to
      const targetSlider = targetElement.closest('[kilr-slider="container"]');
      
      // Only handle wheel if the event belongs to our slider
      if (targetSlider !== this.container) {
        return;
      }

      // Check if vertical scrolling is dominant
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) {
        return;
      }

      e.preventDefault();
      if (this.wheelTimeout) {
        return;
      }

      this.wheelTimeout = setTimeout(() => {
        this.wheelTimeout = null;
      }, this.animationTime);

      const threshold = 30;
      if (e.deltaX > threshold) {
        this.next();
      } else if (e.deltaX < -threshold) {
        this.prev();
      }
    }

    onTouchStart(e) {
      // Get the element that received the touch
      const targetElement = e.target;
      
      // Find which slider this element belongs to
      const targetSlider = targetElement.closest('[kilr-slider="container"]');
      
      // Only handle touch if the event belongs to our slider
      if (targetSlider !== this.container) {
        return;
      }

      if (this.isAnimating) {
        return;
      }

      // Store which slider is being touched
      if (!window.activeSliderTouch) {
        window.activeSliderTouch = this.container;
      } else if (window.activeSliderTouch !== this.container) {
        return;
      }

      e.stopPropagation();
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchDeltaX = 0;
      this.initialPositions = this.slideData.map(data => data.left);
    }

    onTouchMove(e) {
      // Only proceed if this is the slider being touched
      if (window.activeSliderTouch !== this.container) {
        return;
      }

      if (this.isAnimating) return;

      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - this.touchStartX;
      const diffY = currentY - this.touchStartY;

      // If vertical scrolling is dominant, release the touch
      if (Math.abs(diffY) > Math.abs(diffX)) {
        window.activeSliderTouch = null;
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      
      
      this.touchDeltaX = diffX;
      this.slideData.forEach((data, index) => {
        const newPos = this.initialPositions[index] + this.touchDeltaX;
        data.left = newPos;
        this.updateTransform(data);
      });
    }

    onTouchEnd(e) {
      // Only proceed if this is the slider being touched
      if (window.activeSliderTouch !== this.container) {
        return;
      }

      // Clear the active slider touch
      window.activeSliderTouch = null;

      if (this.isAnimating) return;
      e.stopPropagation();

      const threshold = 50;
      if (!this.loopMode) {
        if (this.activeIndex === 1 && this.touchDeltaX > threshold) {
          this.resetSlidePositions();
          return;
        }
        if (this.activeIndex === this.originalSlides.length && this.touchDeltaX < -threshold) {
          this.resetSlidePositions();
          return;
        }
      }

      if (this.touchDeltaX < -threshold) {
        this.next();
      } else if (this.touchDeltaX > threshold) {
        this.prev();
      } else {
        this.resetSlidePositions();
      }
      this.touchDeltaX = 0;
    }

    resetSlidePositions() {
      this.updateActiveSlide();
      this.processQueue();
    }

    onResize() {
      // Clear stored widths to force recalculation
      this.slideWidths = null;
      this.computeSlidePositions();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    console.log('🎠 [SLIDER] DOM loaded, initializing sliders');
    const sliderContainers = document.querySelectorAll('[kilr-slider="container"]');
    console.log('🎠 [SLIDER] Found slider containers:', sliderContainers.length);
    
    sliderContainers.forEach((container, index) => {
      console.log(`🎠 [SLIDER] Initializing slider ${index + 1}:`, container);
      console.log(`🎠 [SLIDER] Container has data-product-image="${container.getAttribute('data-product-image')}"`);
      new KilrSlider(container);
    });
  });
})();

  