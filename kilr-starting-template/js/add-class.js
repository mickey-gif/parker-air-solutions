/**
 * Add Class Handler
 * Version: 1.0.6
 * Description: Adds/removes classes to elements based on hover, click, click-out, or scroll triggers (in-25, in-25-out-75) with flexible breakpoint support. Supports group mode for exclusive class application.
 * Last Updated: 2025-01-27
 */

(function() {
    class AddClassHandler {
        static VERSION = '1.0.6';

        constructor() {
            this.triggers = [];
            this.intersectionObservers = new Map();
            this.resizeTimeout = null;
            this.groups = new Map(); // Store group information
            this.initializeGroups();
            this.initializeTriggers();
            this.setupResizeListener();
        }

        initializeGroups() {
            // Find all group containers
            const groupContainers = document.querySelectorAll('[kilr-add-class="group"]');
            
            groupContainers.forEach(groupContainer => {
                // Find all trigger elements within this group
                const groupTriggers = groupContainer.querySelectorAll('[kilr-add-class="trigger"]');
                const groupId = this.generateGroupId();
                
                // Store group information
                const groupData = {
                    container: groupContainer,
                    triggers: Array.from(groupTriggers),
                    className: null // Will be set from first trigger
                };
                
                // Initialize group triggers and get common className
                groupTriggers.forEach((trigger, index) => {
                    const className = trigger.getAttribute('data-class-name');
                    if (className) {
                        if (!groupData.className) {
                            groupData.className = className;
                        }
                        // Store group info on each trigger
                        trigger._addClassGroupId = groupId;
                        trigger._addClassGroupData = groupData;
                    }
                });
                
                if (groupData.className && groupData.triggers.length > 0) {
                    this.groups.set(groupId, groupData);
                }
            });
        }

        generateGroupId() {
            return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }

        initializeTriggers() {
            const triggerElements = document.querySelectorAll('[kilr-add-class="trigger"]');
            
            // Remove active class from all trigger elements on page load
            // BUT preserve is-active class if present
            triggerElements.forEach(element => {
                const className = element.getAttribute('data-class-name');
                const hasIsActive = element.classList.contains('is-active');
                
                if (className) {
                    // Only remove if element doesn't have is-active class
                    if (!hasIsActive) {
                        element.classList.remove(className);
                    }
                }
            });
            
            triggerElements.forEach(element => {
                const className = element.getAttribute('data-class-name');
                const triggerType = element.getAttribute('data-trigger-type');
                
                if (!className || !triggerType) {
                    console.warn('AddClassHandler: Missing data-class-name or data-trigger-type attribute');
                    return;
                }

                const triggerConfig = this.parseTriggerType(triggerType);
                this.setupTrigger(element, className, triggerConfig);
            });
        }

        parseTriggerType(triggerType) {
            const config = {
                type: null,
                breakpoint: null,
                aboveType: null,
                belowType: null,
                scrollIn: null,
                scrollOut: null
            };

            // Check for breakpoint syntax: hover-bp991-in-25-out-75 or hover-bp991-click
            const breakpointMatch = triggerType.match(/^(.+?)-bp(\d+)-(.+)$/);
            if (breakpointMatch) {
                config.breakpoint = parseInt(breakpointMatch[2], 10);
                const aboveTypeStr = breakpointMatch[1];
                const belowTypeStr = breakpointMatch[3];
                
                // Parse above breakpoint type
                config.aboveType = this.parseSingleTriggerType(aboveTypeStr);
                if (!config.aboveType) {
                    console.warn(`AddClassHandler: Unknown trigger type "${aboveTypeStr}" for above breakpoint`);
                }
                
                // Parse below breakpoint type
                config.belowType = this.parseSingleTriggerType(belowTypeStr);
                if (!config.belowType) {
                    console.warn(`AddClassHandler: Unknown trigger type "${belowTypeStr}" for below breakpoint`);
                }
                
                return config;
            }

            // Parse simple trigger types (no breakpoint)
            config.type = this.parseSingleTriggerType(triggerType);
            if (!config.type) {
                console.warn(`AddClassHandler: Unknown trigger type "${triggerType}"`);
            }

            return config;
        }

        parseSingleTriggerType(triggerType) {
            // Parse simple trigger types
            if (triggerType === 'hover') {
                return { type: 'hover' };
            } else if (triggerType === 'click') {
                return { type: 'click' };
            } else if (triggerType === 'click-out') {
                return { type: 'click-out' };
            } else {
                // Parse scroll triggers: in-25 or in-25-out-75
                const scrollMatch = triggerType.match(/^in-(\d+)(?:-out-(\d+))?$/);
                if (scrollMatch) {
                    return {
                        type: 'scroll',
                        scrollIn: parseInt(scrollMatch[1], 10),
                        scrollOut: scrollMatch[2] ? parseInt(scrollMatch[2], 10) : null
                    };
                }
            }
            return null;
        }

        setupTrigger(element, className, config) {
            // Check if we need to handle breakpoints
            if (config.breakpoint !== null) {
                this.setupBreakpointTrigger(element, className, config);
            } else {
                // Simple trigger without breakpoints
                this.setupSimpleTrigger(element, className, config);
            }
        }

        setupBreakpointTrigger(element, className, config) {
            const updateTrigger = () => {
                const width = window.innerWidth;
                const isAboveBreakpoint = width >= config.breakpoint;
                
                // Remove all existing listeners and observers
                this.cleanupTrigger(element);
                
                const triggerConfig = isAboveBreakpoint ? config.aboveType : config.belowType;
                
                if (!triggerConfig) {
                    return;
                }

                // Setup the appropriate trigger based on type
                switch (triggerConfig.type) {
                    case 'hover':
                        this.setupHoverTrigger(element, className);
                        break;
                    case 'click':
                        this.setupClickTrigger(element, className);
                        break;
                    case 'click-out':
                        this.setupClickOutTrigger(element, className);
                        break;
                    case 'scroll':
                        this.setupScrollTrigger(element, className, triggerConfig.scrollIn, triggerConfig.scrollOut);
                        break;
                }
            };

            // Initial setup
            updateTrigger();

            // Store cleanup function
            element._addClassCleanup = () => {
                this.cleanupTrigger(element);
            };

            // Store update function for resize
            element._addClassUpdate = updateTrigger;
        }

        setupSimpleTrigger(element, className, config) {
            if (!config.type) {
                return;
            }

            switch (config.type.type) {
                case 'hover':
                    this.setupHoverTrigger(element, className);
                    break;
                case 'click':
                    this.setupClickTrigger(element, className);
                    break;
                case 'click-out':
                    this.setupClickOutTrigger(element, className);
                    break;
                case 'scroll':
                    this.setupScrollTrigger(element, className, config.type.scrollIn, config.type.scrollOut);
                    break;
            }
        }

        handleGroupExclusivity(element, className) {
            // Check if this element is part of a group
            if (element._addClassGroupId && element._addClassGroupData) {
                const groupData = element._addClassGroupData;
                // Remove class from all other triggers in the same group
                groupData.triggers.forEach(trigger => {
                    if (trigger !== element && trigger.classList.contains(className)) {
                        trigger.classList.remove(className);
                    }
                });
            }
        }

        setupHoverTrigger(element, className) {
            const addClass = () => {
                this.handleGroupExclusivity(element, className);
                element.classList.add(className);
            };

            const removeClass = () => {
                element.classList.remove(className);
            };

            element.addEventListener('mouseenter', addClass);
            element.addEventListener('mouseleave', removeClass);

            // Store cleanup function
            element._addClassListeners = [
                { type: 'mouseenter', handler: addClass },
                { type: 'mouseleave', handler: removeClass }
            ];
        }

        setupClickTrigger(element, className) {
            const toggleClass = () => {
                const hasClass = element.classList.contains(className);
                if (hasClass) {
                    element.classList.remove(className);
                } else {
                    this.handleGroupExclusivity(element, className);
                    element.classList.add(className);
                }
            };

            element.addEventListener('click', toggleClass);

            // Store cleanup function
            element._addClassListeners = [
                { type: 'click', handler: toggleClass }
            ];
        }

        setupClickOutTrigger(element, className) {
            const addClass = (e) => {
                e.stopPropagation();
                this.handleGroupExclusivity(element, className);
                element.classList.add(className);
            };

            const removeClass = () => {
                element.classList.remove(className);
            };

            // Add class on click
            element.addEventListener('click', addClass);

            // Remove class on hover out
            element.addEventListener('mouseleave', removeClass);

            // Remove class on click outside
            const handleClickOutside = (e) => {
                if (!element.contains(e.target)) {
                    removeClass();
                }
            };

            // Use capture phase to catch clicks before they bubble
            document.addEventListener('click', handleClickOutside, true);

            // Store cleanup function
            element._addClassListeners = [
                { type: 'click', handler: addClass },
                { type: 'mouseleave', handler: removeClass }
            ];
            element._addClassClickOutsideHandler = handleClickOutside;
        }

        setupScrollTrigger(element, className, scrollIn, scrollOut) {
            // Track scroll direction
            let lastScrollY = window.scrollY;
            let isActive = false;
            let hasCrossedIn = false;
            let hasCrossedOut = false;

            // Create thresholds array
            const thresholds = [];
            const scrollInThreshold = scrollIn / 100;
            thresholds.push(scrollInThreshold);
            
            if (scrollOut !== null) {
                const scrollOutThreshold = scrollOut / 100;
                thresholds.push(scrollOutThreshold);
            }

            // Create IntersectionObserver options
            const options = {
                root: null, // Use viewport
                rootMargin: '0px',
                threshold: thresholds
            };

            const scrollHandler = () => {
                const currentScrollY = window.scrollY;
                const scrollingDown = currentScrollY > lastScrollY;
                lastScrollY = currentScrollY;

                // Get element position relative to viewport
                const rect = element.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const elementHeight = rect.height;
                const elementTop = rect.top;
                
                // Calculate how much of the element is visible from the top of the viewport
                // If elementTop is negative, element is above viewport top, so we see more
                // If elementTop is positive, element is below viewport top
                let visibleFromTop = 0;
                
                if (elementTop <= 0) {
                    // Element top is at or above viewport top
                    // Visible amount = how much has scrolled past the top
                    visibleFromTop = Math.min(elementHeight, -elementTop);
                } else {
                    // Element top is below viewport top
                    // Visible amount = viewport height - element top position
                    visibleFromTop = Math.max(0, Math.min(elementHeight, viewportHeight - elementTop));
                }
                
                const visiblePercentage = (visibleFromTop / elementHeight) * 100;

                if (scrollOut !== null) {
                    // Handle scroll-in-out behavior
                    if (scrollingDown) {
                        // Scrolling down: add at scrollIn%, remove at scrollOut%
                        if (visiblePercentage >= scrollIn && visiblePercentage < scrollOut) {
                            if (!isActive) {
                                this.handleGroupExclusivity(element, className);
                                element.classList.add(className);
                                isActive = true;
                            }
                            hasCrossedIn = true;
                        } else if (visiblePercentage >= scrollOut) {
                            if (isActive) {
                                element.classList.remove(className);
                                isActive = false;
                            }
                            hasCrossedOut = true;
                        } else if (visiblePercentage < scrollIn && hasCrossedIn) {
                            if (isActive) {
                                element.classList.remove(className);
                                isActive = false;
                            }
                        }
                    } else {
                        // Scrolling up: add at scrollOut%, remove at scrollIn%
                        if (visiblePercentage <= scrollOut && visiblePercentage > scrollIn) {
                            if (!isActive) {
                                this.handleGroupExclusivity(element, className);
                                element.classList.add(className);
                                isActive = true;
                            }
                        } else if (visiblePercentage <= scrollIn) {
                            if (isActive) {
                                element.classList.remove(className);
                                isActive = false;
                            }
                            hasCrossedIn = false;
                            hasCrossedOut = false;
                        } else if (visiblePercentage > scrollOut && hasCrossedOut) {
                            if (isActive) {
                                element.classList.remove(className);
                                isActive = false;
                            }
                        }
                    }
                } else {
                    // Simple scroll-in: add when threshold is reached, never remove
                    if (visiblePercentage >= scrollIn && !isActive) {
                        this.handleGroupExclusivity(element, className);
                        element.classList.add(className);
                        isActive = true;
                    }
                }
            };

            // Use IntersectionObserver to detect when element enters viewport
            const observerCallback = (entries) => {
                entries.forEach(entry => {
                    // IntersectionObserver helps us know when element is in viewport
                    // But we use scroll handler for precise percentage calculations
                });
            };

            const observer = new IntersectionObserver(observerCallback, options);
            observer.observe(element);

            // Add scroll listener for precise tracking
            window.addEventListener('scroll', scrollHandler, { passive: true });

            // Initial check
            scrollHandler();

            // Store observer and handler for cleanup
            element._addClassObserver = observer;
            element._addClassScrollHandler = scrollHandler;
        }

        cleanupTrigger(element) {
            // Remove event listeners
            if (element._addClassListeners) {
                element._addClassListeners.forEach(({ type, handler }) => {
                    element.removeEventListener(type, handler);
                });
                element._addClassListeners = null;
            }

            // Remove click outside listener
            if (element._addClassClickOutsideHandler) {
                document.removeEventListener('click', element._addClassClickOutsideHandler, true);
                element._addClassClickOutsideHandler = null;
            }

            // Disconnect IntersectionObserver
            if (element._addClassObserver) {
                element._addClassObserver.disconnect();
                element._addClassObserver = null;
            }

            // Remove scroll listener
            if (element._addClassScrollHandler) {
                window.removeEventListener('scroll', element._addClassScrollHandler);
                element._addClassScrollHandler = null;
            }
        }

        setupResizeListener() {
            window.addEventListener('resize', () => {
                // Debounce resize events
                clearTimeout(this.resizeTimeout);
                this.resizeTimeout = setTimeout(() => {
                    // Update all breakpoint triggers
                    document.querySelectorAll('[kilr-add-class="trigger"]').forEach(element => {
                        if (element._addClassUpdate) {
                            element._addClassUpdate();
                        }
                    });
                }, 150);
            });
        }
    }

    // Initialize the add class handler
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            new AddClassHandler();
        });
    } else {
        new AddClassHandler();
    }

    // Make AddClassHandler available globally if needed
    window.AddClassHandler = AddClassHandler;
})();

