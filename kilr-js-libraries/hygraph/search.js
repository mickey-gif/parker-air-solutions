// version 1.5.4
document.addEventListener('DOMContentLoaded', async function () {
  console.log('DOMContentLoaded: search script initialized');
  const searchField = document.querySelector('[kilr-search="search-field"]');
  const searchContainer = document.querySelector('[kilr-search="container"]');
  const productTemplate = document.querySelector('[kilr-search="product-card"]');
  const searchResultsList = document.querySelector('[kilr-search="search-results-list"]');
  const focusBg = document.querySelector('[kilr-search="focus-bg"]');
  const totalResultsElement = document.querySelector('[kilr-search="total-results"]');
  console.log('Debug Elements:', { searchField, searchContainer, focusBg, totalResultsElement });

  // Fetch all products
  let products = await fetchAllProducts();
  console.log('fetchAllProducts resolved; products count:', products.length, products);

  // Note: Dropdown behavior is now handled by nav.js setupInputsInDropdownTriggers()
  // The search input should be inside a [kilr-nav="dropdown-trigger"] element

  // Set up focus/blur events for the search field
  if (searchContainer && focusBg && searchField) {
    searchField.addEventListener('focus', () => {
      console.log('DEBUG focus handler:', { searchContainer, focusBg, classesBefore: [...searchContainer.classList] });
      console.log('Focus event triggered on search field');

      // Close any active dropdowns or sub-dropdowns before opening the search modal
      const activeDropdowns = document.querySelectorAll('[kilr-nav="dropdown"].is-active');
      activeDropdowns.forEach(dropdown => dropdown.classList.remove('is-active'));
      const activeSubDropdowns = document.querySelectorAll('[kilr-nav="sub-dropdown"].is-active');
      activeSubDropdowns.forEach(subDropdown => subDropdown.classList.remove('is-active'));

      searchContainer.classList.add('is-active');
      focusBg.classList.add('is-active');
      searchContainer.classList.remove('is-hidden');
      focusBg.classList.remove('is-hidden');
      console.log('DEBUG focus after:', [...searchContainer.classList], [...focusBg.classList]);
    });

    searchField.addEventListener('blur', (event) => {
      console.log('DEBUG blur handler: relatedTarget=', event.relatedTarget, 'searchContainer.contains?', searchContainer.contains(event.relatedTarget));
      if (!searchContainer.contains(event.relatedTarget)) {
        console.log('Blur event triggered on search field');
        searchContainer.classList.remove('is-active');
        focusBg.classList.remove('is-active');
        console.log('DEBUG blur remove:', [...searchContainer.classList], [...focusBg.classList]);
        const hideDelay = parseInt(searchContainer.getAttribute('is-hidden')) || 0;
        console.log('DEBUG hideDelay from attr is-hidden:', searchContainer.getAttribute('is-hidden'), '=>', hideDelay);
        setTimeout(() => {
          searchContainer.classList.add('is-hidden');
          focusBg.classList.add('is-hidden');
          console.log('DEBUG hide after timeout:', [...searchContainer.classList], [...focusBg.classList]);
        }, hideDelay);
      }
    });
  }

  // Prevent container from losing active state on mousedown
  searchContainer.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  if (searchField) {
    // If we have an input field that matches filter input, replace the direct event handling
    const filterInput = searchContainer?.querySelector('[kilr-filter="input"]');
    if (filterInput) {
      // Transfer search field value to filter input for integrated use
      searchField.addEventListener('input', function (e) {
        filterInput.value = e.target.value;
        const inputEvent = new Event('input', { bubbles: true });
        filterInput.dispatchEvent(inputEvent);
      });
    } else {
      // Fallback to original behavior if no filter input
      searchField.addEventListener('input', function (e) {
        const query = e.target.value.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        updateSearchResults(query);
      });
    }
  }

  function updateSearchResults(query) {
    console.log('updateSearchResults called with query:', query);
    
    const normalizedQuery = query.toLowerCase().replace(/[^a-z0-9 ]/g, '');

    // Score all products
    const scoredProducts = products.map(product => ({
      product: product,
      scoreData: getSearchScore(product, normalizedQuery)
    }));

    // Filter out non-matches
    const filteredProducts = scoredProducts.filter(item => item.scoreData.matches);

    // Sort products based on score
    filteredProducts.sort((a, b) => {
        // 1. Perfect matches first
        if (a.scoreData.isPerfectMatch && !b.scoreData.isPerfectMatch) return -1;
        if (!a.scoreData.isPerfectMatch && b.scoreData.isPerfectMatch) return 1;

        // 2. Then prioritize items matching all search terms
        if (a.scoreData.hasAllWords && !b.scoreData.hasAllWords) return -1;
        if (!a.scoreData.hasAllWords && b.scoreData.hasAllWords) return 1;
        
        // 3. Then compare scores
        if (a.scoreData.score !== b.scoreData.score) {
            return b.scoreData.score - a.scoreData.score;
        }

        return 0; // Keep original order if scores are equal
    });

    const finalProducts = filteredProducts.map(item => item.product);
    
    console.log('Filtered products count:', finalProducts.length, finalProducts);

    // Update total results count
    if (totalResultsElement) {
      totalResultsElement.textContent = finalProducts.length;
    }

    // Handle all products for the filtering system
    renderAllProducts(products);

    // Dispatch event to notify that products are loaded (for filter.js integration)
    const productsLoadedEvent = new CustomEvent('kilrProductsLoaded', {
      detail: {
        containerElement: searchContainer,
        productCount: products.length
      }
    });
    document.dispatchEvent(productsLoadedEvent);
  }

  function renderAllProducts(productList) {
    // Clear the results list first
    searchResultsList.innerHTML = '';

    // Add view all link if needed
    const viewAllLink = document.querySelector('[kilr-search="view-all"]');
    if (viewAllLink) {
      const viewAllClone = viewAllLink.cloneNode(true);
      searchResultsList.appendChild(viewAllClone);
    }

    productList.forEach(product => {
      console.log('Rendering product:', product.slug || product.productName);
      const productCard = productTemplate.cloneNode(true);
      const productImage = productCard.querySelector('[kilr-search="product-image"]');
      const productTitle = productCard.querySelector('[kilr-search="product-title"]');

      // Update the product card's link
      if (productCard) {
        productCard.setAttribute('href', `/products/${product.slug}`);
      }

      if (productImage) {
        productImage.src = product.heroImage?.url || '';
        productImage.alt = product.heroImage?.altText || 'Product Image';
      }
      
      if (productTitle) {
        productTitle.textContent = product.productName;
        // Add filter data attributes for compatibility with filter.js
        productTitle.setAttribute('data-filter-type', 'all');
      }

      // Populate the product analysis text
      const productAnalysis = productCard.querySelector('[kilr-search="product-analysis"]');
      if (productAnalysis) {
        productAnalysis.textContent = product.shortAnalysis || '';
        // Add filter data attributes for compatibility with filter.js
        productAnalysis.setAttribute('data-filter-type', 'input');
      }

      // Handle crop types as tags for filtering
      const productTags = productCard.querySelector('[kilr-search="product-tags"]');
      if (productTags && product.cropType && product.cropType.length > 0) {
        productTags.innerHTML = '';
        
        product.cropType.forEach((crop, index) => {
          if (crop.cropType) {
            const tagElement = document.createElement('span');
            tagElement.setAttribute('kilr-search', 'tag');
            tagElement.textContent = crop.cropType;
            productTags.appendChild(tagElement);

            if (index < product.cropType.length - 1) {
              const space = document.createTextNode(' ');
              productTags.appendChild(space);
            }
          }
        });

        const tagValues = product.cropType.map(crop => crop.cropType).filter(Boolean);
        productTags.setAttribute('data-tags', tagValues.join(','));
        productTags.setAttribute('data-filter-type', 'button');
      }

      productCard.classList.remove('is-hidden');
      searchResultsList.appendChild(productCard);
    });
  }

  function getSearchScore(product, query) {
    if (!query) return { matches: true, score: 0, isPerfectMatch: false, hasAllWords: false };

    const searchWords = query.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .split(/\s+/)
        .filter(word => word.length > 0);

    if (searchWords.length === 0) return { matches: true, score: 0, isPerfectMatch: false, hasAllWords: false };

    const productName = (product.productName || '').toLowerCase().replace(/[^\w\s-]/g, '');
    const shortAnalysis = (product.shortAnalysis || '').toLowerCase().replace(/[^\w\s-]/g, '');
    const cropTypes = (Array.isArray(product.cropType) ? product.cropType : [])
        .map(ct => (ct.cropType || '').toLowerCase().replace(/[^\w\s-]/g, ''));

    const contentWords = [
        ...productName.split(/\s+/),
        ...shortAnalysis.split(/\s+/),
        ...cropTypes.flatMap(ct => ct.split(/\s+/))
    ].filter(word => word.length > 0);

    let isPerfectMatch = productName === query.toLowerCase().replace(/[^\w\s-]/g, '');
    
    let matchedWords = new Set();
    let exactMatches = 0;

    searchWords.forEach(searchWord => {
        if (contentWords.some(word => word === searchWord)) {
            matchedWords.add(searchWord);
            exactMatches++;
        } else if (contentWords.some(word => word.includes(searchWord))) {
            matchedWords.add(searchWord);
        }
    });
    
    const score = (matchedWords.size * 1000) + exactMatches;

    return {
        matches: matchedWords.size > 0 || isPerfectMatch,
        score: score,
        isPerfectMatch: isPerfectMatch,
        hasAllWords: matchedWords.size === searchWords.length,
    };
  }

  // Perform an initial search (show all products)
  updateSearchResults('');
});

async function fetchAllProducts() {
  console.log('fetchAllProducts: starting');
  const response = await fetch('https://hygraph-query.adrian-b0e.workers.dev/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      hygraphQuery: `
        query MyQuery($first: Int = 250) {
          products(first: $first) {
            productName
            shortAnalysis
            slug
            heroImage {
              altText
              url
            }
            cropType(first: 50) {
              cropType
            }
          }
        }
      `,
      variables: { first: 250 }
    })
  });
  console.log('fetchAllProducts: response status', response.status);
  const json = await response.json();
  console.log('fetchAllProducts: json received', json);
  // Try to extract products array from various response shapes
  let rawProducts = [];
  if (json.data?.data?.products) {
    rawProducts = json.data.data.products;
  } else if (json.data?.products) {
    rawProducts = json.data.products;
  } else {
    console.error('fetchAllProducts: no products array found in response', json);
    return [];
  }
  console.log('fetchAllProducts: extracted products count', rawProducts.length);
  return rawProducts.map(p => ({
    productName: p.productName,
    shortAnalysis: p.shortAnalysis,
    slug: p.slug,
    heroImage: p.heroImage,
    cropType: p.cropType
  }));
}
