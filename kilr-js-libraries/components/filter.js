/**
 * Kilr Filter Script
 * Version: 1.6.5
 * Last updated: 2025-09-22
 */

// Initialize all filter containers that aren't search containers
document.addEventListener('DOMContentLoaded', () => {
    const filterContainers = document.querySelectorAll('[kilr-filter="container"]:not([kilr-search="container"]), [kilr-product-feed="container"]');
    filterContainers.forEach(container => {
        initializeFilter(container);
    });
});

// Also initialize when products are loaded (for search integration)
document.addEventListener('kilrProductsLoaded', (event) => {
    // New: Prioritize direct element reference
    if (event.detail?.containerElement) {
        initializeFilter(event.detail.containerElement);
        return; // Exit if we have the direct element
    }
    // Fallback for older versions: Use the selector
    if (event.detail?.containerSelector) {
        const container = document.querySelector(event.detail.containerSelector);
        if (container) {
            initializeFilter(container);
        }
    }
});

function initializeFilter(container) {
    // Get all required elements
    const isSearchContainer = container.hasAttribute('kilr-search');

    // Find input using same logic as search.js: check for matching data attribute first, then look inside container
    const searchMatchId = container?.dataset.searchMatch;
    const filterInput = searchMatchId
      ? document.querySelector(`[kilr-filter="input"][data-search-match="${searchMatchId}"]`)
      : container.querySelector('[kilr-filter="input"]');

    const isButtonFilter = isSearchContainer ? container.getAttribute('data-filters') === 'true' : false;
    const loadMoreBtn = container.querySelector('[kilr-filter="loadmore"], [kilr-product-feed="load-more"]');
    const itemsList = container.querySelector('[kilr-filter="items-list"], [kilr-search="results-list"], [kilr-product-feed="list"]');
    const buttonLists = container.querySelectorAll('[kilr-filter="buttons"]');

    // For product feed, also find individual filter buttons
    const individualButtons = container.querySelectorAll('[kilr-filter="button"]');
    
    // Store active filters per button list
    const activeFiltersByList = new Map();
    let originalOrder = []; // To store the initial order of items

    if (!container || !itemsList) {
        
        return;
    }

    // Get the show amount from the container
    const showAmountAttr = isSearchContainer 
        ? (container.getAttribute('data-show') || container.getAttribute('nav-data-show'))
        : container.getAttribute('data-show');
        
    const showAmount = showAmountAttr ? parseInt(showAmountAttr) : Infinity;
    let currentlyShown = showAmount;

    // Initialize button filters
    if (buttonLists.length > 0 || individualButtons.length > 0) {
        // Handle button lists (existing functionality)
        buttonLists.forEach((buttonList, listIndex) => {
            const buttonType = buttonList.getAttribute('data-button-type') || 'checkbox';
            const buttons = buttonList.querySelectorAll('[kilr-filter="button"]');

            // Initialize the Map entry for this button list
            activeFiltersByList.set(buttonList, new Set());

            // Activate first button for radio types
            if (buttonType === 'radio' && buttons.length > 0) {
                const firstButton = buttons[0];
                const textElement = firstButton.querySelector('.w-text');
                const filterValue = textElement ? textElement.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, '') : '';
                activeFiltersByList.get(buttonList).add(filterValue);
                firstButton.classList.add('is-active');
            }

            buttons.forEach((button) => {
                button.addEventListener('click', () => {
                    const textElement = button.querySelector('[class*="w-text"]');
                    const filterValue = textElement ? textElement.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, '') : '';
                    const activeFilters = activeFiltersByList.get(buttonList);

                    if (buttonType === 'radio') {
                        // For radio, deselect all buttons in THIS list only
                        buttons.forEach(btn => {
                            btn.classList.remove('is-active');
                        });
                        activeFilters.clear();
                        // Select clicked button
                        button.classList.add('is-active');
                        activeFilters.add(filterValue);
                    } else {
                        // For checkbox, toggle this button
                        if (button.classList.contains('is-active')) {
                            button.classList.remove('is-active');
                            activeFilters.delete(filterValue);
                        } else {
                            button.classList.add('is-active');
                            activeFilters.add(filterValue);
                        }
                    }

                    const searchTerm = filterInput ? filterInput.value.trim() : '';

                    // For product-feed containers, dispatch custom event instead of filtering directly
                    if (container.hasAttribute('kilr-product-feed')) {
                        const filterEvent = new CustomEvent('kilrFilterChanged', {
                            detail: {
                                searchTerm,
                                activeFilters: Array.from(activeFilters)
                            }
                        });
                        console.log('🔍 FILTER.JS: Dispatching kilrFilterChanged event');
                        console.log('🔍 FILTER.JS: searchTerm:', searchTerm);
                        console.log('🔍 FILTER.JS: activeFilters:', Array.from(activeFilters));
                        container.dispatchEvent(filterEvent);
                    } else {
                        filterItems(searchTerm);
                    }
                });
            });
        });

        // Handle individual buttons (for product feed)
        if (individualButtons.length > 0 && buttonLists.length === 0) {
            // Create a virtual button list for individual buttons
            const virtualButtonList = { individualButtons: true };
            activeFiltersByList.set(virtualButtonList, new Set());

            individualButtons.forEach((button) => {
                button.addEventListener('click', () => {
                    const textElement = button.querySelector('[class*="w-text"]');
                    const filterValue = textElement ? textElement.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, '') : '';
                    const activeFilters = activeFiltersByList.get(virtualButtonList);

                    // For product feed buttons, treat as checkbox (can select multiple)
                    if (button.classList.contains('is-active')) {
                        button.classList.remove('is-active');
                        activeFilters.delete(filterValue);
                    } else {
                        button.classList.add('is-active');
                        activeFilters.add(filterValue);
                    }

                    const searchTerm = filterInput ? filterInput.value.trim() : '';

                    // For product-feed containers, dispatch custom event instead of filtering directly
                    if (container.hasAttribute('kilr-product-feed')) {
                        const filterEvent = new CustomEvent('kilrFilterChanged', {
                            detail: {
                                searchTerm,
                                activeFilters: Array.from(activeFilters)
                            }
                        });
                        console.log('🔍 FILTER.JS: Dispatching kilrFilterChanged event');
                        console.log('🔍 FILTER.JS: searchTerm:', searchTerm);
                        console.log('🔍 FILTER.JS: activeFilters:', Array.from(activeFilters));
                        container.dispatchEvent(filterEvent);
                    } else {
                        filterItems(searchTerm);
                    }
                });
            });
        }
    }

    // Function to update total count
    const updateTotalCount = (count) => {
        // Re-query the element each time to get a fresh reference after potential framework re-renders.
        const totalElement = container.querySelector('[kilr-filter="total"]');
        if (totalElement) {
            // For product-feed containers, the count is updated by product-feed.js
            // For other containers, update it here
            if (!container.hasAttribute('kilr-product-feed')) {
                totalElement.textContent = count.toString();
            }
        }
    };

    // Function to check if an item matches search terms and get its score
    const getSearchScore = (item, searchTerm) => {
        if (!searchTerm) return { matches: true, score: 0, isPerfectMatch: false };

        const searchWords = searchTerm.toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
            .split(/\s+/)
            .filter(word => word.length > 0);

        if (searchWords.length === 0) return { matches: true, score: 0, isPerfectMatch: false };

        const searchableElements = item.querySelectorAll('[data-filter-type="all"], [data-filter-type="input"], [kilr-product-feed="title"], [kilr-product-feed="description"]');
        let matchedWords = new Set();
        let exactMatches = 0;
        let isPerfectMatch = false; // New flag

        // Check each searchable element
        searchableElements.forEach(element => {
            if (element.style.display === 'none') return;

            // Check for a perfect match (case-insensitive)
            if (element.textContent.trim().toLowerCase() === searchTerm.toLowerCase()) {
                isPerfectMatch = true;
            }

            // Get element content and clean it
            const content = element.textContent.toLowerCase()
                .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
                .split(/\s+/)
                .filter(word => word.length > 0);

            // Check each search word against the content
            searchWords.forEach(searchWord => {
                // Check for exact word match
                if (content.some(word => word === searchWord)) {
                    matchedWords.add(searchWord);
                    exactMatches++;
                }
                // Check for partial word match if no exact match
                else if (content.some(word => word.includes(searchWord) || searchWord.includes(word))) {
                    matchedWords.add(searchWord);
                }
            });
        });

        // Calculate score:
        // - Number of matched search words (primary factor)
        // - Exact matches bonus (secondary factor)
        const score = (matchedWords.size * 1000) + exactMatches;
        
        return {
            matches: matchedWords.size > 0,
            score: score,
            matchCount: matchedWords.size,
            totalSearchWords: searchWords.length,
            hasAllWords: matchedWords.size === searchWords.length,
            isPerfectMatch: isPerfectMatch,
        };
    };

    // Function to check if an item matches button filters
    const matchesButtonFilters = (item) => {
        // If no active filters in any list, return true
        const hasAnyActiveFilters = Array.from(activeFiltersByList.values())
            .some(filters => filters.size > 0);
            
        if (!hasAnyActiveFilters) return true;

        const filterableElements = item.querySelectorAll('[data-filter-type="all"], [data-filter-type="button"], [kilr-product-feed="title"], [kilr-product-feed="description"]');
        
        // Check each button list separately
        return Array.from(activeFiltersByList.entries()).every(([buttonList, activeFilters]) => {
            // If this list has no active filters, it's a match
            if (activeFilters.size === 0) return true;
            
            // For this list's active filters, ANY must match (OR logic)
            return Array.from(activeFilters).some(filterValue => {
                return Array.from(filterableElements).some(element => {
                    let content = element.textContent.trim().toLowerCase().replace(/[^\w\s-]/g, '');
                    
                    // Special handling for tags
                    if (element.hasAttribute('kilr-search') && 
                        element.getAttribute('kilr-search') === 'tags') {
                        // Get tags from data attribute
                        const tags = element.getAttribute('data-tags')?.split(',') || [];
                        return tags.some(tag => tag.toLowerCase() === filterValue);
                    }
                    
                    return content === filterValue;
                });
            });
        });
    };

    // Function to filter and sort items
    const filterItems = (searchTerm) => {
        // Get all filter items, excluding the template
        const filterItems = Array.from(itemsList.children).filter(item => 
            !item.hasAttribute('kilr-search="product-template"') && 
            !item.hasAttribute('kilr-search="view-all"')
        );
            
        // Create an array to hold items and their match status
        const itemsWithStatus = filterItems.map(item => {
            const searchScore = getSearchScore(item, searchTerm);
            const matchesFilters = matchesButtonFilters(item);
            
            // A perfect match should always be shown, otherwise, it must match both search and filters
            const show = (searchTerm && searchScore.isPerfectMatch) || (searchScore.matches && matchesFilters);

            return {
                element: item,
                searchScore,
                matchesFilters,
                shouldShow: show
            };
        });

        // Sort items:
        // 1. Featured products first (when no search or with search)
        // 2. Perfect matches first (with search)
        // 3. Items matching all search terms (with search)
        // 4. Then by number of matched terms (with search)
        // 5. Then by exact match count (with search)
        // 6. Filter matches as tiebreaker (with search)
        // 7. Original order (no search, non-featured)
        itemsWithStatus.sort((a, b) => {
            // Always prioritize featured products first
            const aIsFeatured = a.element.hasAttribute('data-featured');
            const bIsFeatured = b.element.hasAttribute('data-featured');
            if (aIsFeatured && !bIsFeatured) return -1;
            if (!aIsFeatured && bIsFeatured) return 1;

            if (searchTerm) {
                // 1. Perfect matches first (within featured/non-featured groups)
                if (a.searchScore.isPerfectMatch && !b.searchScore.isPerfectMatch) return -1;
                if (!a.searchScore.isPerfectMatch && b.searchScore.isPerfectMatch) return 1;

                // 2. Then prioritize items matching all search terms
                if (a.searchScore.hasAllWords && !b.searchScore.hasAllWords) return -1;
                if (!a.searchScore.hasAllWords && b.searchScore.hasAllWords) return 1;

                // 3 & 4. Then compare scores (includes both match count and exact matches)
                if (a.searchScore.score !== b.searchScore.score) {
                    return b.searchScore.score - a.searchScore.score;
                }

                // 5. Use filter matches as tiebreaker
                if (a.matchesFilters && !b.matchesFilters) return -1;
                if (!a.matchesFilters && b.matchesFilters) return 1;
            } else {
                // If no search term, sort by original order (preserving featured sorting)
                const indexA = originalOrder.indexOf(a.element);
                const indexB = originalOrder.indexOf(b.element);
                return indexA - indexB;
            }
            return 0;
        });

        // Re-order the DOM elements to match the sorted list
        itemsWithStatus.forEach(item => {
            itemsList.appendChild(item.element);
        });

        let totalMatches = 0;

        // Count all matching items (not just visible ones)
        itemsWithStatus.forEach(item => {
            if (item.shouldShow) {
                totalMatches++;
            }
        });

        // Update the total count with all matching items
        updateTotalCount(totalMatches);

        let visibleItems = 0;
        itemsWithStatus.forEach(item => {
            if (item.shouldShow) {
                visibleItems++;
                if (visibleItems <= currentlyShown) {
                    item.element.classList.remove('is-hidden');
                    item.element.classList.add('is-active');
                } else {
                    item.element.classList.add('is-hidden');
                    item.element.classList.remove('is-active');
                }
            } else {
                item.element.classList.add('is-hidden');
                item.element.classList.remove('is-active');
            }
        });

        // Show/hide load more button based on whether there are more items to show
        if (loadMoreBtn) {
            if (totalMatches > currentlyShown) {
                loadMoreBtn.style.display = 'block';
            } else {
                loadMoreBtn.style.display = 'none';
            }
        }
    };

    // Add input event listener if input exists
    if (filterInput) {
        filterInput.addEventListener('input', (e) => {
            currentlyShown = showAmount; // Reset to initial display amount when filtering
            const searchTerm = e.target.value.trim();

            // For product-feed containers, dispatch custom event instead of filtering directly
            if (container.hasAttribute('kilr-product-feed')) {
                // Get all active filters from all button lists
                const allActiveFilters = [];
                activeFiltersByList.forEach((filters) => {
                    allActiveFilters.push(...Array.from(filters));
                });

                console.log('🔍 FILTER.JS: Dispatching kilrFilterChanged event for search input');
                console.log('🔍 FILTER.JS: searchTerm:', searchTerm);
                console.log('🔍 FILTER.JS: allActiveFilters:', allActiveFilters);

                const filterEvent = new CustomEvent('kilrFilterChanged', {
                    detail: {
                        searchTerm,
                        activeFilters: allActiveFilters
                    }
                });
                container.dispatchEvent(filterEvent);
            } else {
                filterItems(searchTerm);
            }
        });
    }

    // Add load more functionality
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            currentlyShown += showAmount;
            filterItems(filterInput ? filterInput.value.trim() : '');
        });
    }

    // Store the initial order once the DOM is ready
    originalOrder = Array.from(itemsList.children);

    // Initial filter
    filterItems(filterInput ? filterInput.value.trim() : '');
}

