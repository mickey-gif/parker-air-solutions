// version 1.9.3

// Global variable to store all products for search functionality
if (!window.allCachedProducts) {
  window.allCachedProducts = [];
}

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

document.addEventListener('DOMContentLoaded', () => {
  waitForHydration(() => {
    // Additional safety check to ensure DOM is stable
    if (document.readyState === 'loading') {
      window.addEventListener('load', initializeSearch);
      return;
    }
    initializeSearch();
  });
});

async function initializeSearch() {
  // Verify essential elements exist before proceeding
  const requiredSelectors = [
    '[kilr-search="container"]',
    '[kilr-search="results-list"]'
  ];
  
  const allElementsExist = requiredSelectors.every(selector => 
    document.querySelector(selector) !== null
  );
  
  if (!allElementsExist) {
    console.warn('Search Script: Required elements not found, skipping initialization');
    return;
  }
  
  const searchContainer = document.querySelector('[kilr-search="container"]');
  const searchResultsList = document.querySelector('[kilr-search="results-list"]');
  const productTemplate = searchResultsList?.querySelector('[kilr-search="product-template"]');
  const viewAllLink = searchContainer?.querySelector('[kilr-search="view-all"]');
  const viewResultsLink = searchContainer?.querySelector('[kilr-search="view-results"]');
  
  // Find search input: check for a matching data attribute first, then look inside the container
  const searchMatchId = searchContainer?.dataset.searchMatch;
  const searchInput = searchMatchId 
    ? document.querySelector(`[kilr-filter="input"][data-search-match="${searchMatchId}"]`)
    : searchContainer?.querySelector('[kilr-filter="input"]');
    
  const filterButtons = searchContainer?.querySelectorAll('[kilr-filter="button"]');
  const totalCountElement = searchContainer?.querySelector('[kilr-filter="total"]');

  if (!searchContainer || !searchResultsList || !productTemplate) {
    console.error('Search script aborted: Essential elements not found.');
    return;
  }

  // Handle is-active state for external search input
  if (searchInput && searchMatchId) {
    searchInput.addEventListener('focus', () => {
      if (searchContainer) {
        searchContainer.classList.add('is-active');
        searchContainer.classList.remove('is-hidden');
      }
    });

    document.addEventListener('click', (event) => {
      if (searchContainer?.classList.contains('is-active')) {
        const isClickInsideContainer = searchContainer.contains(event.target);
        const isClickOnInput = event.target === searchInput;

        if (!isClickInsideContainer && !isClickOnInput) {
          searchContainer.classList.remove('is-active');
          searchContainer.classList.add('is-hidden');
        }
      }
    });
  }

  // Note: Dropdown input handling is now managed by nav.js
  // If this search input is inside a dropdown trigger, nav.js will handle the dropdown behavior

  // Store original hrefs if they exist
  const originalViewAllHref = viewAllLink?.getAttribute('href') || '/products';
  const originalViewResultsHref = viewResultsLink?.getAttribute('href') || '/products';

  // Update view links based on active filter or search
  function updateViewLinks() {
    const isFilterEnabled = searchContainer.getAttribute('data-filters') === 'true';
    const activeFilter = isFilterEnabled ?
      searchContainer.querySelector('[kilr-filter="button"].is-active') : null;
    const searchTerm = searchInput?.value.trim() || '';

    // Update view-all link
    if (viewAllLink) {
      let newHref = originalViewAllHref;

      // If there's an active filter with a data-slug, use that as the base URL
      if (activeFilter?.getAttribute('data-slug')) {
        newHref = activeFilter.getAttribute('data-slug');
      }

      // Add search term as filter parameter if it exists
      if (searchTerm) {
        const separator = newHref.includes('?') ? '&' : '?';
        newHref += `${separator}filter=${encodeURIComponent(searchTerm)}`;
      }

      viewAllLink.setAttribute('href', newHref);
    }

    // Update view-results link
    if (viewResultsLink) {
      let newHref = originalViewResultsHref;

      // If there's an active filter with a data-slug, use that as the base URL
      if (activeFilter?.getAttribute('data-slug')) {
        newHref = activeFilter.getAttribute('data-slug');
      }

      // Add search term as filter parameter if it exists
      if (searchTerm) {
        const separator = newHref.includes('?') ? '&' : '?';
        newHref += `${separator}filter=${encodeURIComponent(searchTerm)}`;
      }

      viewResultsLink.setAttribute('href', newHref);
    }
  }

  // Add click handlers to force navigation
  if (viewAllLink) {
    console.log('View-all link found:', viewAllLink);
    viewAllLink.addEventListener('click', (e) => {
      console.log('View-all link clicked');
      e.preventDefault();
      updateViewLinks();
      const currentHref = viewAllLink.getAttribute('href');
      console.log('Navigating to:', currentHref);
      window.location.href = currentHref;
    });
  } else {
    console.log('View-all link not found');
  }

  if (viewResultsLink) {
    console.log('View-results link found:', viewResultsLink, 'tagName:', viewResultsLink.tagName);
    // Check if link is inside a form
    const isInsideForm = viewResultsLink.closest('form') !== null;
    console.log('View-results link is inside form:', isInsideForm);

    viewResultsLink.addEventListener('click', (e) => {
      console.log('View-results link clicked');
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling
      e.stopImmediatePropagation(); // Prevent other handlers on same element

      // If inside a form, prevent form submission
      if (isInsideForm) {
        const form = viewResultsLink.closest('form');
        if (form) {
          console.log('Found parent form, preventing submission');
          // Create a submit event and prevent it
          const fakeSubmitEvent = new Event('submit', { cancelable: true, bubbles: false });
          form.dispatchEvent(fakeSubmitEvent);
        }
      }

      updateViewLinks();
      const currentHref = viewResultsLink.getAttribute('href');
      console.log('Final href:', currentHref);

      // Force navigation after a short delay to override any form handlers
      setTimeout(() => {
        console.log('Executing navigation to:', currentHref);
        window.location.href = currentHref;
      }, 10);
    });

    // Also add a fallback for when the link might be treated as a submit button
    if (viewResultsLink.type === 'submit' || viewResultsLink.getAttribute('type') === 'submit') {
      console.log('View-results element is a submit button, converting behavior');
      viewResultsLink.type = 'button'; // Change to button type to prevent form submission
    }
  } else {
    console.log('View-results link not found');
  }

  // Add listeners for filter changes and search input
  if (filterButtons) {
    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        setTimeout(() => {
          updateViewLinks();
        }, 100); // Increased timeout to ensure filter.js has completed
      });
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value;
      filterAndRenderProducts(searchTerm);
    });
  }

  // Remove template from results list and store it
  productTemplate.remove();

  // Clear any existing items in the results list (except the template and view all link)
  const viewAllTemp = viewAllLink?.cloneNode(true);
  searchResultsList.innerHTML = '';
  if (viewAllTemp) {
    searchResultsList.appendChild(viewAllTemp);
  }

  // Fetch all products
  let products = await fetchAllProducts();

  // Store products globally for search functionality
  window.allCachedProducts = [...products];

  // Check for a limit on the number of products to display
  const displayLimit = parseInt(searchContainer.dataset.limit, 10);

  // Function to filter and render products
  function filterAndRenderProducts(searchTerm = '') {
    let filteredProducts = [...window.allCachedProducts];

    // Apply search filtering with prioritization if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();

      // Score products based on where the search term appears
      const productsWithScores = window.allCachedProducts
        .map((product) => {
          let score = 0;
          let hasMatch = false;

          // Check tags (highest priority - score 100)
          if (product.tags && Array.isArray(product.tags)) {
            const tagMatch = product.tags.some(tag =>
              tag.toLowerCase().includes(searchLower)
            );
            if (tagMatch) {
              score += 100;
              hasMatch = true;
            }
          }

          // Check title (medium priority - score 50)
          if (product.title && product.title.toLowerCase().includes(searchLower)) {
            score += 50;
            hasMatch = true;
          }

          // Check description/shortSummary (lowest priority - score 10)
          const descriptionText = (product.shortSummary || product.description || '').toLowerCase();
          if (descriptionText.includes(searchLower)) {
            score += 10;
            hasMatch = true;
          }

          // Also check productType for additional relevance
          if (product.productType && product.productType.toLowerCase().includes(searchLower)) {
            score += 5; // Lower priority than description
            hasMatch = true;
          }

          return {
            product,
            score,
            hasMatch
          };
        })
        .filter(item => item.hasMatch) // Only keep products that match
        .sort((a, b) => b.score - a.score) // Sort by score descending (highest first)
        .map(item => item.product); // Extract just the products

      filteredProducts = productsWithScores;
    }

    // Sort by featured if data-default="featured" is set
    if (searchResultsList.dataset.default === 'featured') {
      filteredProducts.sort((a, b) => {
        const aIsFeatured = a.featured === 'true' || a.featured === true;
        const bIsFeatured = b.featured === 'true' || b.featured === true;
        if (aIsFeatured && !bIsFeatured) return -1;
        if (!aIsFeatured && bIsFeatured) return 1;
        return 0;
      });
    }

    // Clear existing products (keep view all link)
    const viewAllLink = searchResultsList.querySelector('[kilr-search="view-all"]');
    searchResultsList.innerHTML = '';
    if (viewAllLink) {
      searchResultsList.appendChild(viewAllLink);
    }

    // Display filtered products
    const productsToDisplay = displayLimit > 0 ? filteredProducts.slice(0, displayLimit) : filteredProducts;

    productsToDisplay.forEach((product, index) => {
      const productCard = productTemplate.cloneNode(true);
      productCard.removeAttribute('kilr-search'); // The cloned item is no longer a template

      // Add featured data attribute if the product is featured
      if (product.featured === 'true' || product.featured === true) {
        productCard.setAttribute('data-featured', 'true');
      }

      const productImage = productCard.querySelector('[kilr-search="image"]');
      const productTitle = productCard.querySelector('[kilr-search="title"]');
      const productPrice = productCard.querySelector('[kilr-search="price"]');
      const productType = productCard.querySelector('[kilr-search="type"]');
      const productFeatures = productCard.querySelector('[kilr-search="summary"]');
      const productTags = productCard.querySelector('[kilr-search="tags"]');

      // Update the product card's link
      if (productCard) {
        productCard.setAttribute('href', `/products/${product.handle}`);
      }

      // Handle each element - hide if no data available
      if (productImage) {
        if (product.featuredImage?.src) {
          const imageUrl = product.featuredImage.src;
          const widths = [16, 32, 48, 64, 96, 128, 256, 384, 640, 750, 828, 1080, 1200, 1920, 2048, 3840];

          // Generate srcset with all widths
          const srcset = widths
            .map(width => `${imageUrl}?width=${width}&quality=80&format=auto ${width}w`)
            .join(', ');

          productImage.src = `${imageUrl}?width=3840&quality=80&format=auto`;
          productImage.srcset = srcset;
          productImage.sizes = '100vw';
          productImage.alt = product.featuredImage.altText || product.title || 'Product Image';
          productImage.style.display = '';
        } else {
          productImage.style.display = 'none';
        }
      }

      if (productTitle) {
        if (product.title) {
          productTitle.textContent = product.title;
          productTitle.setAttribute('data-filter-type', 'all');
        } else {
          productTitle.style.display = 'none';
        }
      }

      if (productPrice) {
        if (product.priceRange?.maxVariantPrice?.amount) {
          productPrice.textContent = `$${product.priceRange.maxVariantPrice.amount}`;
        } else {
          productPrice.style.display = 'none';
        }
      }

      if (productType) {
        if (product.productType) {
          productType.textContent = product.productType;
          productType.setAttribute('data-filter-type', 'button');
        } else {
          productType.style.display = 'none';
        }
      }

      if (productFeatures) {
        const summary = typeof product.shortSummary === 'string' ? product.shortSummary :
                         (product.shortSummary?.value || '');

        if (summary) {
          productFeatures.textContent = summary;
          productFeatures.setAttribute('data-filter-type', 'input');
        } else {
          productFeatures.style.display = 'none';
        }
      }

      if (productTags) {
        if (product.tags && Array.isArray(product.tags) && product.tags.length > 0) {
          productTags.innerHTML = '';

          product.tags.forEach((tag, index) => {
            const tagElement = document.createElement('span');
            tagElement.setAttribute('kilr-search', 'tag');
            tagElement.textContent = tag;
            productTags.appendChild(tagElement);

            if (index < product.tags.length - 1) {
              const space = document.createTextNode(' ');
              productTags.appendChild(space);
            }
          });

          productTags.setAttribute('data-tags', product.tags.join(','));
        }
      }

      productCard.classList.remove('is-hidden');
      searchResultsList.appendChild(productCard);
    });

    // Update total count with filtered results count
    const totalElement = document.querySelector('[kilr-filter="total"]');
    if (totalElement) {
      totalElement.textContent = filteredProducts.length.toString();
    }

    // Update view links with search term
    updateViewLinks(searchTerm);
  }

  // Sort by featured if data-default="featured" is set
  if (searchResultsList.dataset.default === 'featured') {
    products.sort((a, b) => {
      const aIsFeatured = a.featured === 'true' || a.featured === true;
      const bIsFeatured = b.featured === 'true' || b.featured === true;
      if (aIsFeatured && !bIsFeatured) return -1;
      if (!aIsFeatured && bIsFeatured) return 1;
      return 0;
    });
  }

  // Initial render of all products (or featured first if set)
  filterAndRenderProducts();

  // Dispatch event to notify that products are loaded
  const productsLoadedEvent = new CustomEvent('kilrProductsLoaded', {
    detail: {
      containerElement: searchContainer, // Pass the direct element
      productCount: window.allCachedProducts.length
    }
  });
  document.dispatchEvent(productsLoadedEvent);
} // Close initializeSearch function

async function fetchAllProducts() {
    const CACHE_KEY = 'shopifyProducts';
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    
    // Determine if a reload is needed
    const navEntries = window.performance?.getEntriesByType("navigation");
    const isReload = (navEntries?.length > 0 && navEntries[0].type === 'reload') || window.performance?.navigation?.type === 1;
    const isNewOrigin = document.referrer && new URL(document.referrer).origin !== window.location.origin;

    if (cachedData && !isReload && !isNewOrigin) {
        // Use cached data if it exists and it's not a reload or a new origin
        return JSON.parse(cachedData);
    }

    // Fetch fresh data
    const allProducts = [];
    let hasNextPage = true;
    let endCursor = null;

    while (hasNextPage) {
      const graphqlQuery = `
        query MyQuery($first: Int!, $after: String) {
          products(first: $first, after: $after, sortKey: BEST_SELLING) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                handle
                description
                featuredImage {
                  url
                  altText
                }
                priceRange {
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                tags
                title
                vendor
                productType
                metafield(namespace: "custom", key: "short_summary") {
                  value
                }
                featured: metafield(namespace: "custom", key: "featured") {
                  value
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: 250,
        after: endCursor
      };

      const response = await fetch('https://kilr-headless-shopify-query.adrian-b0e.workers.dev/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeFrontQuery: graphqlQuery,
          variables: variables
        })
      });

      if (!response.ok) {
        
        return [];
      }

      const result = await response.json();
      const data = result.responseData;

      if (data.errors) {
        
        return [];
      }

      const products = data.data.products.edges;
      if (products && products.length > 0) {
        products.forEach(product => {
          const node = product.node;
          allProducts.push({
            handle: node.handle,
            description: node.description,
            featuredImage: {
              src: node.featuredImage?.url,
              altText: node.featuredImage?.altText
            },
            priceRange: node.priceRange,
            tags: node.tags,
            title: node.title,
            vendor: node.vendor,
            productType: node.productType,
            shortSummary: node.metafield?.value || '',
            featured: node.featured?.value
          });
        });
        endCursor = data.data.products.pageInfo.endCursor;
        hasNextPage = data.data.products.pageInfo.hasNextPage;
      } else {
        hasNextPage = false;
      }
    }

    // Store in sessionStorage
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(allProducts));
    return allProducts;
}

// Example usage to fetch and log all products
fetchAllProducts().then(products => {
  
});
