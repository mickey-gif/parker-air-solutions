//version 1.0.18

document.addEventListener("DOMContentLoaded", async () => {
  

  // --- URL PARAMETER FILTER LOGIC ---
  // Check the URL for a "filter" parameter and apply it.
  let activeFilterValues = new Set();
  const urlParams = new URLSearchParams(window.location.search);
  const urlFilter = urlParams.get("filter");
  if (urlFilter) {
    urlFilter.split(",").forEach((val) => {
      if (val.trim()) {
        activeFilterValues.add(val.trim());
      }
    });
    
  }

  // Helper to update the URL "filter" parameter with active filters.
  function updateURLFilter() {
    const url = new URL(window.location);
    if (activeFilterValues.size === 0) {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", Array.from(activeFilterValues).join(","));
    }
    try {
      // Use relative URL to avoid issues with HTTP Basic Auth credentials in URL
      const relativeUrl = url.pathname + url.search;
      window.history.pushState({}, "", relativeUrl);
    } catch (e) {
      // Fallback: if pushState fails (e.g., due to security restrictions), 
      // silently continue - the filter will still work, just won't update URL
      console.warn('Could not update URL filter parameter:', e.message);
    }
  }

  // Helper to generate singular/plural variations of a word
  function getWordVariations(word) {
    const variations = new Set([word.toLowerCase()]);
    const lowerWord = word.toLowerCase();
    
    // Simple pluralization rules
    if (lowerWord.endsWith('s') && lowerWord.length > 1) {
      // Try removing 's' for singular
      variations.add(lowerWord.slice(0, -1));
      
      // Handle 'es' endings (gates -> gate)
      if (lowerWord.endsWith('es') && lowerWord.length > 2) {
        variations.add(lowerWord.slice(0, -2));
      }
      
      // Handle 'ies' endings (categories -> category)
      if (lowerWord.endsWith('ies') && lowerWord.length > 3) {
        variations.add(lowerWord.slice(0, -3) + 'y');
      }
    } else {
      // Add plural forms
      if (lowerWord.endsWith('y') && lowerWord.length > 1 && !'aeiou'.includes(lowerWord[lowerWord.length - 2])) {
        // category -> categories
        variations.add(lowerWord.slice(0, -1) + 'ies');
      } else if (lowerWord.endsWith('s') || lowerWord.endsWith('sh') || lowerWord.endsWith('ch') || lowerWord.endsWith('x') || lowerWord.endsWith('z')) {
        // gate -> gates, but also handle special cases
        variations.add(lowerWord + 'es');
      } else {
        // gate -> gates
        variations.add(lowerWord + 's');
      }
    }
    
    return variations;
  }

  // --- HELPER FUNCTION: Get Collection Handle from URL ---
  // For example:
  //   /collections/glass-pool-fencing--face-mount-pool-fence → handle: "face-mount-pool-fence"
  //   /collections/glass-pool-fencing → handle: "glass-pool-fencing"
  function getCollectionHandle() {
    const path = window.location.pathname;
    const segments = path.split("/");
    const collectionIndex = segments.indexOf("collections");
    if (collectionIndex !== -1 && segments.length > collectionIndex + 1) {
      let slug = segments[collectionIndex + 1];
      if (slug.includes("--")) {
        const parts = slug.split("--");
        return parts[1] ? parts[1].trim() : slug;
      }
      return slug;
    }
    return "";
  }

  // --- GLOBAL VARIABLES ---
  let fullFilterOptions = null;         // Unique filter options (from fetched products).
  let productFeedProducts = [];         // All products.
  let visibleCount = 20;                // Initial number of items to display.
  let currentRenderedCount = 0;         // How many items have been rendered so far.

  const workerEndpoint = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";
  

  // --- ELEMENT REFERENCES ---
  // The container that holds both filters and the list.
  const feedContainer = document.querySelector('[kilr-product-feed="container"]');
  if (!feedContainer) {
    
    return;
  }

  // The list element where product items will be rendered.
  let listContainer = feedContainer.querySelector('[kilr-product-feed="list"]');
  if (!listContainer) {
    listContainer = document.createElement("div");
    listContainer.setAttribute("kilr-product-feed", "list");
    feedContainer.appendChild(listContainer);
  }

  // The product item template.
  let itemTemplate = document.querySelector('[kilr-product-feed="item"]');
  if (itemTemplate) {
    itemTemplate = itemTemplate.cloneNode(true);
    // Do not change its attribute; it remains as "item"
    
    document.querySelector('[kilr-product-feed="item"]').remove();
  } else {
    
  }

  // The filters container and filter template.
  const filterContainer = document.querySelector('[kilr-product-feed="filters"]');
  let filterTemplate = filterContainer
    ? filterContainer.querySelector('[kilr-product-feed="filter-template"]')
    : null;
  if (filterTemplate) {
    filterTemplate = filterTemplate.cloneNode(true);
    
    filterContainer.querySelector('[kilr-product-feed="filter-template"]').remove();
  } else {
    
  }

  // The load more button.
  const loadMoreBtn = document.querySelector('[kilr-product-feed="load-more"]');

  // --- HELPER FUNCTION: Call the Worker ---
  async function callWorker(query, variables = {}) {
    
    
    const payload = { storeFrontQuery: query, variables };
    try {
      const response = await fetch(workerEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        
        throw new Error(`Worker Error: ${errorText}`);
      }
      const json = await response.json();
      
      return json.responseData;
    } catch (err) {
      
      throw err;
    }
  }

  // --- FETCH PRODUCTS ---
  // Fetch all products for a collection using the collection handle.
  // Uses caching for performance - checks collection-specific cache first, then global cache.
  async function fetchAllProducts(handle, forceRefresh = false) {
    const cacheKey = handle ? `collectionProducts_${handle}` : 'allProducts';

    // Skip cache if force refresh is requested
    if (!forceRefresh) {
      // Check for collection-specific cached products first
      const cachedProducts = sessionStorage.getItem(cacheKey);
      console.log(`Checking for cached products with key: ${cacheKey}`);
      console.log(`Cached data exists: ${!!cachedProducts}`);
      if (cachedProducts) {
        try {
          const parsedProducts = JSON.parse(cachedProducts);
          console.log(`Found ${parsedProducts.length} cached products`);
          // Only use cache if it has products, otherwise continue to check other caches
          if (parsedProducts.length > 0) {
            console.log(`Using cached products for ${handle || 'all products'}`);
            return parsedProducts;
          } else {
            console.log('Cached products array is empty, removing corrupted cache and checking other caches...');
            sessionStorage.removeItem(cacheKey);
          }
        } catch (err) {
          console.warn('Error parsing cached products, checking other caches:', err);
        }
      }

      // Check for global cached products from search.js (only for non-collection pages)
      // Use !handle for empty string, null, undefined, etc.
      if (!handle || handle === '') {
        console.log('No collection handle detected, trying to use all products from search.js cache');

        // Function to check and use global cache
        const checkGlobalCache = () => {
          const globalCache = sessionStorage.getItem('shopifyProducts');
          console.log(`Global cache exists: ${!!globalCache}`);
          if (globalCache) {
            try {
              console.log('Using globally cached products from search.js');
              let products = JSON.parse(globalCache);
              console.log(`Found ${products.length} products in global cache`);
              // Only use if it has products
              if (products.length > 0) {
                // Normalize image data to match our expected structure
                products = products.map(product => ({
                  ...product,
                  featuredImage: product.featuredImage ? {
                    url: product.featuredImage.src || product.featuredImage.url
                  } : null
                }));
                // Cache under our key for future use
                sessionStorage.setItem(cacheKey, JSON.stringify(products));
                sessionStorage.removeItem('productFeedRetryAttempted'); // Clear retry flag on success
                console.log(`Cached ${products.length} products under key: ${cacheKey}`);
                return products;
              } else {
                console.log('Global cache is also empty, will make API call');
                return null;
              }
            } catch (err) {
              console.warn('Error parsing global cache, will make API call:', err);
              return null;
            }
          } else {
            console.log('No global cache found from search.js');
            return null;
          }
        };

        // Try to get products from global cache
        let products = checkGlobalCache();

        // If no products found and this is the initial load, wait a bit for search.js to load
        if (!products && !sessionStorage.getItem('productFeedRetryAttempted')) {
          console.log('No products found, waiting for search.js to potentially load...');
          sessionStorage.setItem('productFeedRetryAttempted', 'true');

          // Wait 2 seconds for search.js to potentially load and cache products
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Try again
          products = checkGlobalCache();

          if (products) {
            console.log('Found products after waiting for search.js!');
          } else {
            console.log('Still no products after waiting, will make API call');
          }
        }

        if (products) {
          return products;
        }
      }
    } else {
      console.log('Force refresh requested, skipping cache');
    }

    // Make API call and cache results
    console.log(`Fetching products for ${handle || 'all products'} from API`);
    console.log('Using handle:', handle);
    let allProducts = [];
    let cursor = null;
    let hasNextPage = true;

    // Use different query based on whether we have a collection handle
    const prodQuery = handle ? `
      query getProducts($cursor: String, $handle: String = "") {
        collection(handle: $handle) {
          products(first: 50, after: $cursor) {
            edges {
              cursor
              node {
                id
                title
                description
                handle
                featuredImage {
                  url
                }
                tags
                productType
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    ` : `
      query getAllProducts($cursor: String) {
        products(first: 50, after: $cursor, sortKey: BEST_SELLING) {
          edges {
            cursor
            node {
              id
              title
              description
              handle
              featuredImage {
                url
              }
              tags
              productType
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    console.log('Starting API call loop...');
    console.log('Using query type:', handle ? 'collection' : 'all products');
    while (hasNextPage) {
      const variables = handle ? { handle, cursor } : { cursor };
      console.log('Making API call with variables:', variables);
      try {
        const data = await callWorker(prodQuery, variables);
        console.log('API response received:', data);

        // Different response structure based on query type
        const productsData = handle
          ? data?.data?.collection?.products
          : data?.data?.products;
        console.log('Products data:', productsData);

        if (!productsData) {
          console.warn('No products data in response, breaking loop');
          break;
        }

        const edges = productsData.edges || [];
        console.log(`Processing ${edges.length} product edges`);

        edges.forEach((edge) => {
          const product = edge.node;
          // Normalize featuredImage to ensure consistent structure
          if (product.featuredImage && product.featuredImage.url) {
            product.featuredImage = {
              url: product.featuredImage.url
            };
          }
          allProducts.push(product);
        });

        hasNextPage = productsData.pageInfo.hasNextPage;
        console.log('Has next page:', hasNextPage);

        if (edges.length > 0) {
          cursor = edges[edges.length - 1].cursor;
          console.log('New cursor:', cursor);
        } else {
          hasNextPage = false;
        }
      } catch (err) {
        console.error('API call failed:', err);
        break;
      }
    }

    console.log(`API call loop completed. Total products fetched: ${allProducts.length}`);

    // Cache the results
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(allProducts));
      sessionStorage.removeItem('productFeedRetryAttempted'); // Clear retry flag on API success
      console.log(`Cached ${allProducts.length} products for ${handle || 'all products'}`);
    } catch (cacheErr) {
      console.warn('Failed to cache products:', cacheErr);
    }

    return allProducts;
  }

  // --- FILTERING & SORTING FUNCTIONS ---
  function filterProducts(products, searchTerm = '') {
    console.log('🔎 PRODUCT-FEED.JS: filterProducts called with', products.length, 'products and searchTerm:', searchTerm);
    let filteredProducts = products;

    // Filter by search term first with scoring for prioritization
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();

      // First, filter to only products that match the search
      const productsWithScores = products
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

          // Check description (lowest priority - score 10)
          if (product.description && product.description.toLowerCase().includes(searchLower)) {
            score += 10;
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

    // Then filter by active filter values (tags)
    if (activeFilterValues.size === 0) return filteredProducts;

    return filteredProducts.filter((product) => {
      if (!product.tags || !Array.isArray(product.tags) || product.tags.length === 0) return false;
      
      // Check if any of the product's tags match any of the active filter values (including singular/plural variations)
      return product.tags.some(tag => {
        const trimmedTag = tag.trim().toLowerCase();
        
        // Check if any active filter value matches this tag (including variations)
        return Array.from(activeFilterValues).some(filterValue => {
          const filterVariations = getWordVariations(filterValue);
          return filterVariations.has(trimmedTag);
        });
      });
    });

    console.log('🔎 PRODUCT-FEED.JS: filterProducts returning', filteredProducts.length, 'filtered products');
    return filteredProducts;
  }

  function sortProducts(products) {
    const sortSelect = document.querySelector('[kilr-product-feed="sort-options"]');
    const sortOrderCheckbox = document.querySelector('[kilr-product-feed="sorting"] input[type="checkbox"]');
    if (!sortSelect) return products;
    const sortKey = sortSelect.value;
    const ascending = sortOrderCheckbox ? sortOrderCheckbox.checked : true;
    return products.slice().sort((a, b) => {
      let aVal, bVal;
      if (sortKey === "price") {
        aVal = parseFloat(a.priceRange?.minVariantPrice?.amount || 0);
        bVal = parseFloat(b.priceRange?.minVariantPrice?.amount || 0);
      } else {
        aVal = a[sortKey] || "";
        bVal = b[sortKey] || "";
      }
      if (aVal < bVal) return ascending ? -1 : 1;
      if (aVal > bVal) return ascending ? 1 : -1;
      return 0;
    });
  }

  function populateSortOptions() {
    const sortSelect = document.querySelector('[kilr-product-feed="sort-options"]');
    if (!sortSelect || productFeedProducts.length === 0) return;
    const currentSelection = sortSelect.value;
    sortSelect.innerHTML = "";
    const keys = new Set();
    productFeedProducts.forEach((product) => {
      if (product.title) keys.add("title");
      if (product.description) keys.add("description");
      if (product.priceRange && product.priceRange.minVariantPrice)
        keys.add("price");
    });
    keys.forEach((key) => {
      if (!key) return;
      const optionEl = document.createElement("option");
      optionEl.value = key;
      optionEl.setAttribute("label", key.charAt(0).toUpperCase() + key.slice(1));
      optionEl.classList.add("w-option");
      sortSelect.appendChild(optionEl);
    });
    if (currentSelection && Array.from(keys).includes(currentSelection)) {
      sortSelect.value = currentSelection;
    }
  }

  // --- RENDERING FUNCTION ---
  /**
   * Renders products into the list element.
   *
   * If "append" is false, clears only the list's innerHTML (leaving filters intact) and resets the rendered count.
   * If "append" is true, then only new items are appended.
   */
  function renderProducts(append = false) {
    console.log('🏭 PRODUCT-FEED.JS: renderProducts called, append:', append);
    console.log('🏭 PRODUCT-FEED.JS: currentSearchTerm:', currentSearchTerm);
    console.log('🏭 PRODUCT-FEED.JS: activeFilterValues:', Array.from(activeFilterValues));
    console.log('🏭 PRODUCT-FEED.JS: productFeedProducts.length (before filtering):', productFeedProducts.length);

    let products = productFeedProducts;
    products = filterProducts(products, currentSearchTerm);
    products = sortProducts(products);

    console.log('🏭 PRODUCT-FEED.JS: products.length (after filtering):', products.length);

    // Update count displays (if they exist).
    const totalCountEl = document.querySelector('[kilr-product-feed="product-totals"]');
    const visibleCountEl = document.querySelector('[kilr-product-feed="products-visible"]');
    const filterTotalEl = document.querySelector('[kilr-filter="total"]');

    console.log('🏭 PRODUCT-FEED.JS: Updating counts...');
    console.log('🏭 PRODUCT-FEED.JS: totalCountEl found:', !!totalCountEl);
    console.log('🏭 PRODUCT-FEED.JS: visibleCountEl found:', !!visibleCountEl);
    console.log('🏭 PRODUCT-FEED.JS: filterTotalEl found:', !!filterTotalEl);

    if (totalCountEl) {
      totalCountEl.innerText = products.length;
      console.log('🏭 PRODUCT-FEED.JS: Set [kilr-product-feed="product-totals"] to:', products.length);
    }
    if (visibleCountEl) {
      visibleCountEl.innerText = Math.min(visibleCount, products.length);
      console.log('🏭 PRODUCT-FEED.JS: Set [kilr-product-feed="products-visible"] to:', Math.min(visibleCount, products.length));
    }
    if (filterTotalEl) {
      filterTotalEl.innerText = products.length;
      console.log('🏭 PRODUCT-FEED.JS: Set [kilr-filter="total"] to:', products.length);
    }

    // Clear only the list element if not appending.
    if (!append) {
      listContainer.innerHTML = "";
      currentRenderedCount = 0;
    }

    const productsToShow = products.slice(currentRenderedCount, visibleCount);
    productsToShow.forEach((product) => {
      if (!itemTemplate) {
        console.error("Item template is not available.");
        return;
      }
      const clone = itemTemplate.cloneNode(true);
      // Map product data into the template.
      const titleEl = clone.querySelector('[kilr-product-feed="title"]');
      if (titleEl) titleEl.innerText = product.title || "";
      const descEl = clone.querySelector('[kilr-product-feed="description"]');
      if (descEl) descEl.innerText = product.description || "";
      const imgEl = clone.querySelector('[kilr-product-feed="image"]');
      if (imgEl) {
        const imageUrl = product.featuredImage?.url || product.featuredImage?.src;
        if (imageUrl) {
          imgEl.src = imageUrl;
          imgEl.style.display = '';
          console.log('Setting image src for product:', product.title, 'to:', imageUrl);
        } else {
          imgEl.style.display = 'none';
          console.log('No image URL found for product:', product.title, 'featuredImage:', product.featuredImage);
        }
      } else {
        console.log('No image element found in template for product:', product.title);
      }
      const priceEl = clone.querySelector('[kilr-product-feed="price"]');
      if (priceEl && product.priceRange && product.priceRange.minVariantPrice) {
        priceEl.innerText = product.priceRange.minVariantPrice.amount;
      }
      
      // Handle dynamic link building with product handle
      const handleEl = clone.querySelector('[kilr-product-feed="handle"]');
      if (handleEl && product.handle) {
        // Check if it's an anchor tag and update href
        if (handleEl.tagName.toLowerCase() === 'a') {
          const currentHref = handleEl.getAttribute('href') || '';
          // Replace :slug with the actual product handle
          const newHref = currentHref.replace(':slug', product.handle);
          handleEl.setAttribute('href', newHref);
        }
        // Also set the text content if needed
        handleEl.setAttribute('data-handle', product.handle);
      }
      
      const tagsContainer = clone.querySelector('[kilr-product-feed="tags"]');
      if (tagsContainer) {
        tagsContainer.innerHTML = "";
        if (product.tags && product.tags.length > 0) {
          product.tags.forEach((tag) => {
            const tagEl = document.createElement("div");
            tagEl.innerText = tag;
            tagEl.classList.add("tag");
            tagsContainer.appendChild(tagEl);
          });
        }
      }
      listContainer.appendChild(clone);
    });
    currentRenderedCount = visibleCount;
    populateSortOptions();

    // --- FILTER BUTTONS ---
    if (filterContainer) {
      const filterField = filterContainer.getAttribute("data-filter-option");
      // Get the tag to exclude from filters (e.g., data-exclude-tag="initial")
      const excludeTag = filterContainer.getAttribute("data-exclude-tag") || "";
      if (filterField) {
        if (!fullFilterOptions) {
          let uniqueFilters = new Set();
          productFeedProducts.forEach((product) => {
            if (product.tags && Array.isArray(product.tags)) {
              product.tags.forEach(tag => {
                const trimmedTag = tag.trim();
                // More comprehensive exclusion logic for all "initial option" variations
                const lowerTag = trimmedTag.toLowerCase();
                const shouldExclude =
                  !trimmedTag || // Empty tags
                  lowerTag === excludeTag.toLowerCase() || // Exact match with exclude attribute
                  lowerTag === 'initial option' || // Exact "initial option"
                  lowerTag === 'initial' || // Just "initial"
                  lowerTag.includes('initial option') || // Contains "initial option"
                  lowerTag.includes('initial') && lowerTag.includes('option') || // Contains both words
                  /^initial\s+option$/i.test(trimmedTag); // Regex for "initial [whitespace] option"

                if (!shouldExclude) {
                  uniqueFilters.add(trimmedTag);
                }
              });
            }
          });
          fullFilterOptions = Array.from(uniqueFilters).sort();
          
        }
        // Re-render filter buttons without clearing the entire container if needed.
        filterContainer.innerHTML = "";
        fullFilterOptions.forEach((value) => {
          let filterEl = filterTemplate ? filterTemplate.cloneNode(true) : document.createElement("div");
          if (!filterTemplate) {
            filterEl.innerText = value;
            filterEl.setAttribute("kilr-product-feed", "filter");
          } else {
            filterEl.removeAttribute("kilr-product-feed");
            filterEl.setAttribute("kilr-product-feed", "filter");
            filterEl.innerText = value;
          }
          // Check if this filter should be active based on variations
          let shouldBeActive = false;
          if (activeFilterValues.has(value)) {
            shouldBeActive = true;
          } else {
            // Check if any active filter value has variations that match this filter option
            for (const activeFilter of activeFilterValues) {
              const activeFilterVariations = getWordVariations(activeFilter);
              if (activeFilterVariations.has(value.toLowerCase())) {
                shouldBeActive = true;
                break;
              }
            }
          }
          
          if (shouldBeActive) {
            filterEl.classList.add("is-active");
          }
          filterEl.addEventListener("click", () => {
            const valueVariations = getWordVariations(value);
            
            if (activeFilterValues.has(value)) {
              // Remove this value and any related variations that are currently active
              activeFilterValues.delete(value);
              for (const variation of valueVariations) {
                if (variation !== value.toLowerCase()) {
                  // Find the properly cased version in activeFilterValues
                  for (const activeFilter of Array.from(activeFilterValues)) {
                    if (activeFilter.toLowerCase() === variation) {
                      activeFilterValues.delete(activeFilter);
                      break;
                    }
                  }
                }
              }
            } else {
              // Add this value
              activeFilterValues.add(value);
            }
            updateURLFilter();
            visibleCount = 20;
            renderProducts(false);
          });
          filterContainer.appendChild(filterEl);
        });
      }
    }

    // Update load more button visibility.
    if (loadMoreBtn) {
      let displayNumber = parseInt(loadMoreBtn.getAttribute("data-display-number"), 10);
      if (isNaN(displayNumber)) displayNumber = 20;
      loadMoreBtn.style.display = products.length > visibleCount ? "block" : "none";
    }
  }

  // --- EVENT LISTENERS ---
  if (loadMoreBtn) {
    loadMoreBtn.addEventListener("click", (e) => {
      e.preventDefault();
      let displayNumber = parseInt(loadMoreBtn.getAttribute("data-display-number"), 10);
      if (isNaN(displayNumber)) displayNumber = 20;
      visibleCount += displayNumber;
      renderProducts(true);
    });
  }
  const sortSelectEl = document.querySelector('[kilr-product-feed="sort-options"]');
  if (sortSelectEl) {
    sortSelectEl.addEventListener("change", () => {
      visibleCount = 20;
      renderProducts(false);
    });
  }
  const sortOrderCheckbox = document.querySelector('[kilr-product-feed="sorting"] input[type="checkbox"]');
  if (sortOrderCheckbox) {
    sortOrderCheckbox.addEventListener("change", () => {
      visibleCount = 20;
      renderProducts(false);
    });
  }

  // Store current search term
  let currentSearchTerm = '';

  // Listen for filter changes from filter.js
  feedContainer.addEventListener('kilrFilterChanged', (event) => {
    console.log('📦 PRODUCT-FEED.JS: Received kilrFilterChanged event');
    console.log('📦 PRODUCT-FEED.JS: event.detail:', event.detail);
    const { searchTerm, activeFilters } = event.detail;

    console.log('📦 PRODUCT-FEED.JS: Processing filters...');
    console.log('📦 PRODUCT-FEED.JS: searchTerm:', searchTerm);
    console.log('📦 PRODUCT-FEED.JS: activeFilters:', activeFilters);

    // Update active filter values from the event
    activeFilterValues.clear();
    activeFilters.forEach(filter => {
      activeFilterValues.add(filter.toLowerCase());
    });

    console.log('📦 PRODUCT-FEED.JS: Updated activeFilterValues:', Array.from(activeFilterValues));

    // Update current search term
    currentSearchTerm = searchTerm || '';

    console.log('📦 PRODUCT-FEED.JS: Updated currentSearchTerm:', currentSearchTerm);

    // Update URL filter parameter
    updateURLFilter();

    // Reset visible count and re-render
    visibleCount = 20;
    console.log('📦 PRODUCT-FEED.JS: Calling renderProducts(false)');
    renderProducts(false);
  });

  // --- INITIALIZATION ---
  const collectionHandle = getCollectionHandle();
  console.log('Initializing product feed for collection:', collectionHandle);
  console.log('Current URL:', window.location.href);
  console.log('Current pathname:', window.location.pathname);

  try {
    productFeedProducts = await fetchAllProducts(collectionHandle);
    console.log('Fetched products:', productFeedProducts.length, 'products');

    // Log first product to check data structure
    if (productFeedProducts.length > 0) {
      console.log('First product data:', {
        title: productFeedProducts[0].title,
        handle: productFeedProducts[0].handle,
        featuredImage: productFeedProducts[0].featuredImage,
        priceRange: productFeedProducts[0].priceRange
      });
    } else {
      console.warn('No products fetched! This might indicate an API error or empty collection.');
    }

    visibleCount = 20;
    renderProducts(false);

    // Dispatch event to notify that products are loaded (for filter.js integration)
    const productsLoadedEvent = new CustomEvent('kilrProductsLoaded', {
      detail: {
        containerElement: feedContainer, // Pass the direct element
        productCount: productFeedProducts.length
      }
    });
    document.dispatchEvent(productsLoadedEvent);
    console.log('Dispatched kilrProductsLoaded event for filter.js integration');
  } catch (err) {
    console.error('Error initializing product feed:', err);
    // Try to clear cache and retry once
    console.log('Attempting to clear cache and retry...');
    if (collectionHandle) {
      sessionStorage.removeItem(`collectionProducts_${collectionHandle}`);
    }
    try {
      productFeedProducts = await fetchAllProducts(collectionHandle, true); // Force fresh API call
      console.log('Retry successful, fetched products:', productFeedProducts.length);
      visibleCount = 20;
      renderProducts(false);

      // Dispatch event even after retry
      const productsLoadedEvent = new CustomEvent('kilrProductsLoaded', {
        detail: {
          containerElement: feedContainer,
          productCount: productFeedProducts.length
        }
      });
      document.dispatchEvent(productsLoadedEvent);
    } catch (retryErr) {
      console.error('Retry also failed:', retryErr);
    }
  }
});



  