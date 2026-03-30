// Version 2.8.3
(() => {
  // Wait for React hydration to complete before initializing
  function waitForHydration(callback) {
    // Enhanced React environment detection for Webstudio/Cloudflare Pages
    const isReactEnvironment = typeof window !== 'undefined' && (
      window.React || 
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ ||
      document.querySelector('[data-reactroot]') || 
      document.querySelector('#__next') || 
      document.querySelector('#root') ||
      document.querySelector('[data-react-helmet]') ||
      document.documentElement.hasAttribute('data-react-helmet') ||
      window.__NEXT_DATA__ ||
      window.__nuxt ||
      document.querySelector('script[src*="react"]') ||
      document.querySelector('script[src*="next"]') ||
      document.querySelector('script[src*="components"]') || // Webstudio component scripts
      window.location.hostname.includes('.wstd.io') || // Webstudio domain
      window.location.hostname.includes('pages.dev') || // Cloudflare Pages
      document.querySelector('[class*="w-"]') || // Webstudio class indicators
      document.querySelector('script[src*="B_4A-rpq"]') // The specific script causing errors
    );
    
    // Always assume React environment and apply delay for safety in this setup
    if (isReactEnvironment || true) { // Force React-like behavior
      // More aggressive delay strategy
      let delayApplied = false;
      
      const applyCallback = () => {
        if (!delayApplied) {
          delayApplied = true;
          callback();
        }
      };
      
      // Multiple delay strategies
      if (window.requestIdleCallback) {
        window.requestIdleCallback(applyCallback);
      }
      
      // Also use a timeout as backup
      setTimeout(applyCallback, 500);
      
    } else {
      callback();
    }
  }

  // Variable to keep track of the currently active dropdown
  let kilrActiveDropdown = null;

  // Function to handle delay for adding class
  const handleDelay = (element, className, delay) => {
    if (element) {
      setTimeout(() => {
        element.classList.add(className);
      }, delay);
    }
  };

  // Function to handle hidden attribute for direct children
  const handleHiddenForChildren = (parentElement, isActive) => {
    if (!parentElement) return;
    const hiddenElements = Array.from(parentElement.children).filter(child => child.hasAttribute('kilr-nav-hidden'));
    hiddenElements.forEach(el => handleHidden(el, isActive));
  };

  // Function to handle hidden attribute
  const handleHidden = (element, isActive) => {
    if (!element) return;
    const delay = element.getAttribute('kilr-nav-hidden');
    if (isActive) {
      element.classList.remove('is-hidden');
    } else if (delay) {
      setTimeout(() => {
        element.classList.add('is-hidden');
      }, delay);
    } else {
      element.classList.add('is-hidden');
    }
  };

  // Function to initialize the first sub-dropdown based on sub_dropdown_type and window width
  const initializeFirstSubDropdown = (parentDropdown, isMobile = false) => {
    if (!parentDropdown) return;
    const subDropdownType = parentDropdown.getAttribute('sub-dropdown-type');
    const subDropdowns = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
    subDropdowns.forEach((subDropdown) => subDropdown.classList.remove('is-active'));

    if (!isMobile && subDropdownType === 'type1') {
      const firstSubDropdown = subDropdowns[0];
      if (firstSubDropdown) {
        firstSubDropdown.classList.add('is-active');
        handleHiddenForChildren(firstSubDropdown, true);
      }
    }
  };

  // Function to close active dropdown
  const closeActiveDropdown = () => {
    if (kilrActiveDropdown) {
      kilrActiveDropdown.classList.remove('is-active');
      handleHiddenForChildren(kilrActiveDropdown, false);
      kilrActiveDropdown = null;
    }
  };
  
  // Function to handle inputs inside dropdown triggers
  const setupInputsInDropdownTriggers = () => {
    // Find all dropdown triggers
    const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
    
    
    dropdownTriggers.forEach(trigger => {
      // Find any inputs inside the trigger (search inputs, text inputs, etc.)
      const inputs = trigger.querySelectorAll('input');
      
      if (inputs.length === 0) return; // Skip if no inputs inside this trigger
      
      // Find the parent dropdown
      const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
      if (!parentDropdown) return; // Skip if not inside a dropdown
      
      
      
      // Set up each input inside this trigger
      inputs.forEach(input => {
        
        
        // Focus handler - activate dropdown
        input.addEventListener('focus', (e) => {
          
          
          // Activate the dropdown
          parentDropdown.classList.add('is-active');
          kilrActiveDropdown = parentDropdown;
          
          // Handle hidden elements
          handleHiddenForChildren(parentDropdown, true);
          
          // Initialize first sub-dropdown if needed
          initializeFirstSubDropdown(parentDropdown);
        });
        
        // Blur handler - check if focus is still within the dropdown
        input.addEventListener('blur', (event) => {
          
          
          // Add a small delay to check where focus moved
          setTimeout(() => {
            // Check if focus moved within the dropdown
            if (parentDropdown.contains(document.activeElement)) {
              
              return;
            }
            
            // Check if we clicked somewhere inside the dropdown
            if (event.relatedTarget && parentDropdown.contains(event.relatedTarget)) {
              
              return;
            }
            
            // Only close if this dropdown is the active one
            if (parentDropdown === kilrActiveDropdown) {
              
              closeActiveDropdown();
            }
          }, 50);
        });
        
        // Prevent trigger click from toggling dropdown when interacting with the input
        input.addEventListener('click', (e) => {
          e.stopPropagation();
        });
        
        // Prevent input mousedown events from bubbling to avoid dropdown state issues
        input.addEventListener('mousedown', (e) => {
          e.stopPropagation();
        });
      });
    });
  };

  const initializeNav = () => {
    // Scroll trigger logic
    const scrollTrigger = document.querySelector('[kilr-nav="scroll-trigger"]');
    const navElement = document.querySelector('[kilr-nav="nav"]');

    if (scrollTrigger && navElement) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Trigger is in view (back at the starting point)
            navElement.classList.remove('is-scrolling');
          } else {
            // Trigger is out of view (scrolled down)
            navElement.classList.add('is-scrolling');
          }
        });
      }, { threshold: 0 });
      observer.observe(scrollTrigger);
    }

    const breakpointElement = document.querySelector('[kilr-nav-hamburger-breakpoint]');
    const breakpoint = breakpointElement
      ? parseInt(breakpointElement.getAttribute('kilr-nav-hamburger-breakpoint'), 10)
      : 0;

    const navContainer = document.querySelector('[kilr-nav="nav"]');
    const isHoverEnabled = navContainer && navContainer.getAttribute('drop-down') === 'hover';

    // Initialize first sub-dropdowns if they exist
    const dropdowns = document.querySelectorAll('[kilr-nav="dropdown"]');
    if (dropdowns.length > 0) {
      dropdowns.forEach((dropdown) => initializeFirstSubDropdown(dropdown));
    }
    
    // Set up inputs in dropdown triggers
    setupInputsInDropdownTriggers();

    if (isHoverEnabled && dropdowns.length > 0) {
      const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
      dropdownTriggers.forEach(trigger => {
        trigger.addEventListener('mouseenter', () => {
          const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
          if (!parentDropdown) return;

          parentDropdown.classList.add('is-active');
          initializeFirstSubDropdown(parentDropdown);
          kilrActiveDropdown = parentDropdown;
          handleHiddenForChildren(parentDropdown, true);
        });
      });

      dropdowns.forEach(dropdown => {
        dropdown.addEventListener('mouseleave', () => {
          setTimeout(() => {
            if (!dropdown.contains(document.querySelector(':hover'))) {
              dropdown.classList.remove('is-active');
              kilrActiveDropdown = null;
              handleHiddenForChildren(dropdown, false);
            }
          }, 10);
        });
      });
    }

    // Add click outside handler
    document.addEventListener('click', (event) => {
      if (kilrActiveDropdown && !event.target.closest('[kilr-nav="dropdown"]')) {
        closeActiveDropdown();
      }
    });

    const dropdownTriggers = document.querySelectorAll('[kilr-nav="dropdown-trigger"]');
    dropdownTriggers.forEach(trigger => {
      trigger.addEventListener('click', (event) => {
        // Prevent the click from bubbling to document
        event.stopPropagation();
        
        const parentDropdown = trigger.closest('[kilr-nav="dropdown"]');
        if (!parentDropdown) return;

        const isActive = parentDropdown.classList.contains('is-active');
        if (window.innerWidth <= breakpoint) {
          const subDropdowns = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
          subDropdowns.forEach(subDropdown => subDropdown.classList.remove('is-active'));

          const subHeader = parentDropdown.querySelector('[kilr-nav="sub-header"]');
          if (subHeader) subHeader.classList.add('is-hidden');
        }

        if (kilrActiveDropdown && kilrActiveDropdown !== parentDropdown) {
          kilrActiveDropdown.classList.remove('is-active');
          handleHiddenForChildren(kilrActiveDropdown, false);
        }
        if (!isActive) {
          handleDelay(parentDropdown, 'is-active', 10);
          kilrActiveDropdown = parentDropdown;
          handleHiddenForChildren(parentDropdown, true);
        } else {
          parentDropdown.classList.remove('is-active');
          kilrActiveDropdown = null;
          handleHiddenForChildren(parentDropdown, false);
        }
        initializeFirstSubDropdown(parentDropdown, window.innerWidth <= breakpoint);
      });
    });

    const subDropdownTriggers = document.querySelectorAll('[kilr-nav="sub-dropdown-trigger"]');
    subDropdownTriggers.forEach(trigger => {
      trigger.addEventListener('click', () => {
        const parentSubDropdown = trigger.closest('[kilr-nav="sub-dropdown"]');
        if (!parentSubDropdown) return;

        const isActive = parentSubDropdown.classList.contains('is-active');
        const siblingSubDropdowns = parentSubDropdown.parentElement.querySelectorAll('[kilr-nav="sub-dropdown"]');
        siblingSubDropdowns.forEach(el => {
          if (el !== parentSubDropdown) {
            el.classList.remove('is-active');
            handleHiddenForChildren(el, false);
          }
        });

        if (!isActive) {
          handleDelay(parentSubDropdown, 'is-active', 50);
          handleHiddenForChildren(parentSubDropdown, true);
        } else {
          parentSubDropdown.classList.remove('is-active');
          handleHiddenForChildren(parentSubDropdown, false);
        }

        const parentDropdown = parentSubDropdown.closest('[kilr-nav="dropdown"]');
        const subHeader = parentDropdown && parentDropdown.querySelector('[kilr-nav="sub-header"]');
        if (subHeader) {
          const subLabel = parentSubDropdown.querySelector('[kilr-nav="sub-label"]');
          if (subLabel) subHeader.textContent = subLabel.textContent;
          subHeader.classList.remove('is-hidden');
        }
      });
    });

    const subHeaders = document.querySelectorAll('[kilr-nav="sub-header"]');
    subHeaders.forEach(subHeader => {
      subHeader.addEventListener('click', () => {
        const parentDropdown = subHeader.closest('[kilr-nav="dropdown"]');
        if (!parentDropdown) return;

        const subDropdownsToClear = parentDropdown.querySelectorAll('[kilr-nav="sub-dropdown"]');
        subDropdownsToClear.forEach(el => el.classList.remove('is-active'));
        subHeader.classList.add('is-hidden');
      });
    });

    const hamburger = document.querySelector('[kilr-nav="hamburger"]');
    const menu = document.querySelector('[kilr-nav="menu"]');
    const nav = document.querySelector('[kilr-nav="nav"]');

    if (hamburger && menu && nav) {
      hamburger.addEventListener('click', (event) => {
        // Prevent event bubbling to avoid conflicts with document click handlers
        event.stopPropagation();

        const isHamburgerActive = hamburger.classList.contains('is-active');
        const shouldBeActive = !isHamburgerActive;

        // Ensure all elements are in sync by explicitly setting/removing classes
        if (shouldBeActive) {
          hamburger.classList.add('is-active');
          menu.classList.add('is-active');
          nav.classList.add('is-active');
          document.body.classList.add('kilr-nav-no-scroll');
        } else {
          hamburger.classList.remove('is-active');
          menu.classList.remove('is-active');
          nav.classList.remove('is-active');
          document.body.classList.remove('kilr-nav-no-scroll');
        }
      });
    }

    // Close menu when clicking a link to the same page
    if (nav) {
      const links = nav.querySelectorAll('a');
      links.forEach(link => {
        if (link.href && link.protocol.startsWith('http')) {
          link.addEventListener('click', () => {
            try {
              const linkUrl = new URL(link.href);
              const currentUrl = new URL(window.location.href);

              if (
                linkUrl.host === currentUrl.host &&
                linkUrl.pathname === currentUrl.pathname &&
                linkUrl.search === currentUrl.search
              ) {
                closeActiveDropdown();

                if (hamburger && hamburger.classList.contains('is-active')) {
                  hamburger.classList.remove('is-active');
                  menu.classList.remove('is-active');
                  nav.classList.remove('is-active');
                  document.body.classList.remove('kilr-nav-no-scroll');
                }
              }
            } catch (e) {
              console.error('Error parsing URL:', e);
            }
          });
        }
      });
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    waitForHydration(() => {
      // Additional safety check to ensure DOM is stable
      if (document.readyState === 'loading') {
        window.addEventListener('load', initializeNav);
        return;
      }
      initializeNav();
    });
  });
})();
