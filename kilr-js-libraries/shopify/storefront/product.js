// Version 2.4.5 - Defer initial option selection until product data is loaded
(function () {

  /**
   * 1) Global Vars
   */
  let originalVariantImageSrc = null;
  let productQuantity = 1; // We'll preserve or clamp this on variant changes
  let cartID = localStorage.getItem('cartID') || null;
  let cartContent = null;

  // Global variables for preloading checkout
  let preloadedCheckoutUrl = null;
  let preloadedCartId = null;
  let preloadedVariantId = null; // New: store the variant ID for which checkout was preloaded

  // Derive slug from URL path
  const pathParts = window.location.pathname.split("/");
  let slug = pathParts[2] || "";  // Make this mutable so we can detect changes later
  

  /**
   * Bootstrap customer context if we have an access token but missing id/tier
   */
  (async function bootstrapCustomerContext() {
    try {
      const token = localStorage.getItem('customerAccessToken');
      const customerId = localStorage.getItem('customerId');
      const customerPriceTier = localStorage.getItem('customerPriceTier');
      if (!token || (customerId && customerPriceTier)) return;
      const q = `query Boot { customer(customerAccessToken: "${token}") { id tier: metafield(namespace: "unleashed", key: "price_tier") { value } } }`;
      const r = await fetch("https://kilr-headless-shopify-query.adrian-b0e.workers.dev/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeFrontQuery: q, variables: {} })
      }).then(res => res.json());
      const c = r.responseData?.data?.customer;
      if (c?.id) {
        localStorage.setItem('customerId', c.id.split('/').pop());
        if (c.tier?.value) localStorage.setItem('customerPriceTier', c.tier.value);
        
      }
    } catch (e) {
      
    }
  })();

  /**
   * 2) sendShopifyQuery: for all GraphQL calls
   */
  async function sendShopifyQuery(storeFrontQuery, variables) {
    const response = await fetch("https://kilr-headless-shopify-query.adrian-b0e.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeFrontQuery, variables }),
    });
    const data = await response.json();
    
    return data.responseData;
  }

  /**
   * 3) fetchCartById (optional helper)
   */
  async function fetchCartById(cartId) {
    const query = `
      query getCart($cartId: ID!) {
        cart(id: $cartId) {
          lines(first: 100) {
            nodes {
              id
              merchandise { ... on ProductVariant { id image { url } title unitPrice { amount currencyCode } price { amount currencyCode } selectedOptions { name value } sku compareAtPrice { amount } quantityAvailable product { description(truncateAt: 150) title } } }
              attributes { key value }
              cost { totalAmount { amount } }
              quantity
            }
          }
          cost { totalAmount { amount currencyCode } }
          checkoutUrl
          buyerIdentity { customer { id } }
          totalQuantity
          id
        }
      }
    `;
    const data = await sendShopifyQuery(query, { cartId });
    return data?.data?.cart || null;
  }

  /**
   * 4) fetchProductData: get the Shopify product by handle
   */
  const storeFrontQueryTemplate = `
    query ProductByHandle($slug: String = "") {
      product(handle: $slug) {
        id
        handle
        title
        description
        tags
        seo { description title }
        options(first: 3) { name values }
        variants(first: 100) {
          nodes {
            id
            title
            sku
            availableForSale
            currentlyNotInStock
            quantityAvailable
            image { url id }
            price { amount }
            selectedOptions { name value }
            price_tier_1: metafield(namespace: "custom", key: "price_tier_1") { value }
            price_tier_2: metafield(namespace: "custom", key: "price_tier_2") { value }
            price_tier_3: metafield(namespace: "custom", key: "price_tier_3") { value }
            price_tier_4: metafield(namespace: "custom", key: "price_tier_4") { value }
            price_tier_5: metafield(namespace: "custom", key: "price_tier_5") { value }
            price_tier_6: metafield(namespace: "custom", key: "price_tier_6") { value }
            price_tier_7: metafield(namespace: "custom", key: "price_tier_7") { value }
            price_tier_8: metafield(namespace: "custom", key: "price_tier_8") { value }
            price_tier_9: metafield(namespace: "custom", key: "price_tier_9") { value }
            price_tier_10: metafield(namespace: "custom", key: "price_tier_10") { value }
          }
        }
      }
    }
  `;
  async function fetchProductData(productSlug) {
    const data = await sendShopifyQuery(storeFrontQueryTemplate, { slug: productSlug });
    
    window.productData = data; 
  }

  /**
   * 5) updateProductPrice
   */
  function updateProductPrice() {
    const priceEl = document.querySelector('[kilr-shopify="product-price"]');
    const customerPriceEl = document.querySelector('[kilr-shopify="customer-price"]');
    const discountDescEl = document.querySelector('[kilr-shopify="product-discount-description"]');

    if (!priceEl || !window.selectedVariant) {
      if (priceEl) priceEl.textContent = "";
      if (customerPriceEl) customerPriceEl.style.display = 'none';
      if (discountDescEl) discountDescEl.style.display = 'none';
      return;
    }

    // Always show the normal/base price in product-price (multiplied by quantity)
    const baseUnit = parseFloat(window.selectedVariant.price.amount);
    const baseTotal = baseUnit * productQuantity;
    priceEl.textContent = `$${baseTotal.toFixed(2)}`;

    // Only show the tiered unit price in customer-price when available
    const customerPriceTier = localStorage.getItem('customerPriceTier');
    const tierMf = window.selectedVariant?.[`price_tier_${customerPriceTier}`];
    const tierAmount = tierMf?.value?.amount ? parseFloat(tierMf.value.amount) : null;

    const customerAccessToken = localStorage.getItem('customerAccessToken');
    if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerPriceTier && tierAmount) {
      if (customerPriceEl) {
        // Show the total tiered price (unit price × quantity) to match product-price behavior
        const tierTotal = tierAmount * productQuantity;
        customerPriceEl.textContent = `$${tierTotal.toFixed(2)}`;
        customerPriceEl.style.display = 'block';
      }
      // Show discount description wrapper when customer pricing is active (you handle the text content)
      if (discountDescEl) {
        discountDescEl.style.display = 'block';
      }
      // Add marker class to product-price when a customer tier is active
      priceEl.classList.add('customer-price');
    } else {
      if (customerPriceEl) customerPriceEl.style.display = 'none';
      // Hide discount description wrapper (you handle the text content)
      if (discountDescEl) discountDescEl.style.display = 'none';
      priceEl.classList.remove('customer-price');
    }
  }

  /**
   * 6) updateStockIndicator
   */
  function updateStockIndicator() {
    const outOfStockEl = document.querySelector('[kilr-shopify="out-stock"]');
    const inStockEl = document.querySelector('[kilr-shopify="in-stock"]');
    if (!window.selectedVariant) return;

    const isAvailable = window.selectedVariant.availableForSale;
    const available = window.selectedVariant.quantityAvailable;
    const isTracked = available !== null && available !== undefined;

    if (!isAvailable) {
      if (outOfStockEl) outOfStockEl.classList.add("is-active");
      if (inStockEl) inStockEl.classList.remove("is-active");
    }
    else if (isTracked && productQuantity > available) {
      if (outOfStockEl) outOfStockEl.classList.add("is-active");
      if (inStockEl) inStockEl.classList.remove("is-active");
    }
    else {
      if (outOfStockEl) outOfStockEl.classList.remove("is-active");
      if (inStockEl) inStockEl.classList.add("is-active");
    }
  }

  /**
   * 7) playCartLottieOnce (optional)
   */
  function playCartLottieOnce() {
    const lottieEl = document.querySelector('[kilr-shopify="cart-lottie"]');
    if (!lottieEl) return;

    lottieEl.setAttribute('loop', 'false');
    lottieEl.stop();
    lottieEl.seek(0);

    lottieEl.addEventListener('complete', () => {
      lottieEl.stop();
      lottieEl.seek(0);
    }, { once: true });

    lottieEl.play();
  }

  /**
   * 8) updateVariantImage - prefer image.url with fallback to src
   */
  function updateVariantImage() {
    console.log('🖼️ [PRODUCT] updateVariantImage called');
    console.log('🖼️ [PRODUCT] window.selectedVariant:', window.selectedVariant);
    
    const variantImageEl = document.querySelector('[kilr-shopify="variant-image"]');
    if (!originalVariantImageSrc && variantImageEl) {
      originalVariantImageSrc = variantImageEl.getAttribute("src");
      console.log('🖼️ [PRODUCT] Set originalVariantImageSrc:', originalVariantImageSrc);
    }

    const newImageUrl = (window.selectedVariant?.image?.url) || (window.selectedVariant?.image?.src) || originalVariantImageSrc || "";
    const newImageId = window.selectedVariant?.image?.id || null;
    
    console.log('🖼️ [PRODUCT] newImageUrl:', newImageUrl);
    console.log('🖼️ [PRODUCT] newImageId:', newImageId);

    // Dispatch an event for product image sliders to listen to
    // Always dispatch, even if the imageId is the same, to ensure sliders can sync up.
    
    const eventDetail = { 
      imageId: newImageId,
      imageUrl: newImageUrl,
      variant: window.selectedVariant
    };
    
    console.log('🖼️ [PRODUCT] Dispatching variant-image-changed event with detail:', eventDetail);
    
    document.dispatchEvent(new CustomEvent('variant-image-changed', {
      detail: eventDetail
    }));

    if (variantImageEl) {
      variantImageEl.setAttribute("src", newImageUrl);
      console.log('🖼️ [PRODUCT] Updated variant image element src to:', newImageUrl);
    } else {
      console.log('🖼️ [PRODUCT] No variant image element found with selector [kilr-shopify="variant-image"]');
    }

    document.querySelectorAll('[data-product-thumbnail]').forEach(thumb => {
      thumb.classList.remove('is-active');
    });
    document.querySelectorAll('[data-product-slide]').forEach(slide => {
      slide.classList.remove('is-active');
    });

    let thumbnailActivated = false;
    let slideActivated = false;

    if (newImageId) {
      const matchingThumbnail = document.querySelector(`[data-product-thumbnail][data-image-id="${newImageId}"]`);
      if (matchingThumbnail) {
        matchingThumbnail.classList.add('is-active');
        thumbnailActivated = true;
      }
      const matchingSlide = document.querySelector(`[data-product-slide][data-image-id="${newImageId}"]`);
      if (matchingSlide) {
        matchingSlide.classList.add('is-active');
        slideActivated = true;
      }
    }

    if (!thumbnailActivated || !slideActivated) {
      const thumbnails = document.querySelectorAll('[data-product-thumbnail]');
      const slides = document.querySelectorAll('[data-product-slide]');
      

      // Handle the case where there is only one thumbnail and one slide in the DOM.
      if (thumbnails.length === 1 && slides.length === 1) {
        
        const singleThumb = thumbnails[0];
        const singleSlide = slides[0];
        const thumbImg = singleThumb.tagName === 'IMG' ? singleThumb : singleThumb.querySelector('img');
        const slideImg = singleSlide.tagName === 'IMG' ? singleSlide : singleSlide.querySelector('img');

        // If there's a new image URL from the selected variant, update the sources.
        if (newImageUrl) {
          if (thumbImg) {
            
            thumbImg.src = newImageUrl;
            
            if (thumbImg.hasAttribute('srcset')) {
              thumbImg.srcset = newImageUrl;
            }
          }
          if (slideImg) {
            
            slideImg.src = newImageUrl;
            
            if (slideImg.hasAttribute('srcset')) {
              slideImg.srcset = newImageUrl;
            }
          }
        }
        
        singleThumb.classList.add('is-active');
        singleSlide.classList.add('is-active');
        thumbnailActivated = true;
        slideActivated = true;
      } else if (thumbnails.length === 0 && slides.length === 1) {
        // Handle case where slider creates thumbnails but they might not match data-product-thumbnail pattern
        const singleSlide = slides[0];
        const slideImg = singleSlide.tagName === 'IMG' ? singleSlide : singleSlide.querySelector('img');
        
        if (newImageUrl && slideImg) {
          slideImg.src = newImageUrl;
          if (slideImg.hasAttribute('srcset')) {
            slideImg.srcset = newImageUrl;
          }
        }
        
        singleSlide.classList.add('is-active');
        slideActivated = true;
      } else {
        // Fallback for multiple images, matching by src
        document.querySelectorAll('[data-product-thumbnail]').forEach(thumb => {
          const img = thumb.querySelector('img');
          if (img && img.src === newImageUrl) thumb.classList.add('is-active');
        });
        document.querySelectorAll('[data-product-slide]').forEach(slide => {
          const img = slide.querySelector('img');
          if (img && img.src === newImageUrl) slide.classList.add('is-active');
        });
      }
    }
  }

  /**
   * 9) updateSelectedOption
   */
  function updateSelectedOption(selector, option) {
    console.log('⚙️ [PRODUCT] updateSelectedOption called');
    
    const textEl = option.querySelector('[kilr-shopify="option-text"]');
    if (textEl) {
      const selectedTextEl = selector.querySelector('[kilr-shopify="selected-text"]');
      if (selectedTextEl) {
        const selectedText = textEl.textContent.trim();
        selectedTextEl.textContent = selectedText;
        
        console.log('⚙️ [PRODUCT] Selected option text:', selectedText);
        
        // Get the option name from either the selector or find it in the variant data
        const optionSelector = option.closest('[kilr-shopify="option-selector"]');
        
        
        if (optionSelector) {
          // Try to get option name from data attribute first
          let optionName = optionSelector.getAttribute('data-option-name');
          
          // If no data-option-name, try to find it from the product's options data
          if (!optionName && window.productData?.data?.product?.options) {
            const productOptions = window.productData.data.product.options;
            const selectedValue = selectedText.toLowerCase();
            for (const option of productOptions) {
              const hasValue = option.values.some(value => value.toLowerCase() === selectedValue);
              if (hasValue) {
                optionName = option.name;
                optionSelector.setAttribute('data-option-name', optionName);
                break;
              }
            }
          }

          console.log('⚙️ [PRODUCT] Option name:', optionName);
          
          if (optionName) {
            handleSubOptions(selectedText, optionName);
          }
        }
      }
    }

    const optionSwatchEl = option.querySelector('[kilr-shopify="option-swatch"]');
    if (optionSwatchEl) {
      const selectedSwatchEl = selector.querySelector('[kilr-shopify="selected-swatch"]');
      if (selectedSwatchEl) {
        selectedSwatchEl.setAttribute(
          "style",
          optionSwatchEl.getAttribute("style") || ""
        );
      }
    }
  }

  /**
   * 10) selectFirstOption
   */
  function selectFirstOption(selector) {
    const firstOption = selector.querySelector('[kilr-shopify="option"]');
    if (firstOption) {
      updateSelectedOption(selector, firstOption);
    }
  }

  /**
   * 11) handleVariantChange
   */
  function handleVariantChange() {
    if (!window.selectedVariant) {
      updateProductPrice();
      updateStockIndicator();
      return;
    }
    
    // Check if inventory is tracked
    const available = window.selectedVariant.quantityAvailable;
    const isTracked = available !== null && available !== undefined;
    const isAvailable = window.selectedVariant.availableForSale;

    // Only adjust quantity if it's 0 (initial state) or exceeds available tracked inventory
    if (productQuantity === 0) {
      productQuantity = 1;
    } else if (isTracked && available > 0 && productQuantity > available) {
      productQuantity = available;
    }

    const quantityEl = document.querySelector('[kilr-shopify="quantity"]');
    if (quantityEl) {
      quantityEl.value = String(productQuantity);
    }

    updateProductPrice();
    updateStockIndicator();

    const incrementBtn = document.querySelector('[kilr-shopify="quantity-inc"]');
    if (incrementBtn) {
      if (!isAvailable || (isTracked && productQuantity >= available)) {
        incrementBtn.style.display = 'none';
      } else {
        incrementBtn.style.display = '';
      }
    }
  }

  /**
   * 12) findSelectedVariant
   */
  function findSelectedVariant() {
    console.log('🔍 [PRODUCT] findSelectedVariant called');
    
    const selectedTexts = Array.from(
      document.querySelectorAll('[kilr-shopify="selected-text"]')
    )
      .map(el => el.textContent.trim())
      .filter(Boolean);

    console.log('🔍 [PRODUCT] selectedTexts from UI:', selectedTexts);

    if (
      !window.productData ||
      !window.productData.data ||
      !window.productData.data.product ||
      !window.productData.data.product.variants
    ) {
      console.log('🔍 [PRODUCT] Missing product data, returning early');
      return;
    }
    const variants = window.productData.data.product.variants.nodes || [];
    console.log('🔍 [PRODUCT] Available variants:', variants.length);

    const matchedVariant = variants.find((variant) => {
      const variantOptionValues = variant.selectedOptions.map(opt => opt.value.trim());
      const selectedSet = new Set(selectedTexts);
      const variantSet = new Set(variantOptionValues);
      const matches = (
        selectedSet.size === variantSet.size &&
        [...selectedSet].every(val => variantSet.has(val))
      );
      
      if (matches) {
        console.log('🔍 [PRODUCT] Found matching variant:', variant);
        console.log('🔍 [PRODUCT] Variant image data:', variant.image);
      }
      
      return matches;
    });

    const previousVariant = window.selectedVariant;
    window.selectedVariant = matchedVariant || null;
    
    console.log('🔍 [PRODUCT] Previous variant:', previousVariant);
    console.log('🔍 [PRODUCT] New selectedVariant:', window.selectedVariant);

    // Update SKU display if the element exists
    const skuEl = document.querySelector('[kilr-shopify="variant-sku"]');
    if (skuEl) {
      skuEl.textContent = window.selectedVariant && window.selectedVariant.sku ? window.selectedVariant.sku : "";
    }

    updateVariantImage();
    handleVariantChange(); 
  }

  /**
   * 13) handleQuantityControls
   *
   * UPDATED: The quantity element is now an input field.
   */
  function handleQuantityControls() {
    const quantityEl = document.querySelector('[kilr-shopify="quantity"]');
    const incrementBtn = document.querySelector('[kilr-shopify="quantity-inc"]');
    const decrementBtn = document.querySelector('[kilr-shopify="quantity-dec"]');

    if (!quantityEl) {
      
      return;
    }

    // Set initial quantity to 1 if not already set
    if (!productQuantity || productQuantity === 0) {
      productQuantity = 1;
      quantityEl.value = "1";
    }
    

    function updateQuantityDisplay() {
      if (quantityEl) {
        quantityEl.value = String(productQuantity);
      }
    }

    function updateQuantity(change) {
      const available = window.selectedVariant ? window.selectedVariant.quantityAvailable : 0;
      let newQty = productQuantity + change;
      if (newQty < 0) newQty = 0;
      if (available > 0 && newQty > available) {
        newQty = available;
      }
      productQuantity = newQty;
      updateQuantityDisplay();
      
      updateProductPrice();
      updateStockIndicator();

      if (incrementBtn) {
        if (available === 0 || productQuantity >= available) {
          incrementBtn.style.display = 'none';
        } else {
          incrementBtn.style.display = '';
        }
      }
    }

    if (incrementBtn) {
      incrementBtn.addEventListener("click", () => updateQuantity(1));
    }
    if (decrementBtn) {
      decrementBtn.addEventListener("click", () => updateQuantity(-1));
    }

    quantityEl.addEventListener("input", () => {
      let inputVal = parseInt(quantityEl.value.trim(), 10);
      const available = window.selectedVariant ? window.selectedVariant.quantityAvailable : 0;
      if (isNaN(inputVal)) {
        inputVal = productQuantity;
      }
      if (inputVal < 0) {
        inputVal = 0;
      }
      if (available > 0 && inputVal > available) {
        inputVal = available;
      }
      productQuantity = inputVal;
      
      updateProductPrice();
      updateStockIndicator();
      updateQuantityDisplay();

      if (incrementBtn) {
        if (available === 0 || productQuantity >= available) {
          incrementBtn.style.display = 'none';
        } else {
          incrementBtn.style.display = '';
        }
      }
    });
  }

  /**
   * 13.5) handleSubOptions
   * Manages visibility and collection of sub-option values
   */
  function handleSubOptions(selectedText, optionName) {
    
    
    // Find all sub-options containers for this option name (case insensitive)
    const subOptionsContainer = Array.from(document.querySelectorAll('[kilr-shopify="sub-options"]'))
      .find(container => {
        const containerOptionName = container.getAttribute('data-option-name');
        const containerNameLower = containerOptionName?.toLowerCase();
        const optionNameLower = optionName?.toLowerCase();

        // Handle common spelling difference for color/colour by normalizing to "color"
        const normalizedContainerName = containerNameLower === 'colour' ? 'color' : containerNameLower;
        const normalizedOptionName = optionNameLower === 'colour' ? 'color' : optionNameLower;

        const matches = normalizedContainerName === normalizedOptionName;

        
        return matches;
      });
    
    if (!subOptionsContainer) {
      
      return;
    }

    // Remove is-active class from all sub-options within this container
    const allSubOptions = subOptionsContainer.querySelectorAll('[kilr-shopify="sub-option"]');
    
    
    allSubOptions.forEach(subOpt => {
      subOpt.classList.remove('is-active');
      
    });

    // Add is-active class to matching sub-option if it exists (case insensitive)
    const matchingSubOption = Array.from(allSubOptions)
      .find(subOpt => {
        const subOptName = subOpt.getAttribute('data-sub-option-name');
        const matches = subOptName?.toLowerCase() === selectedText?.toLowerCase();
        
        return matches;
      });
    
    if (matchingSubOption) {
      
      matchingSubOption.classList.add('is-active');
    } else {
      
    }
  }

  /**
   * 13.6) setupSubOptionListeners
   * Sets up event listeners for sub-option inputs
   */
  function setupSubOptionListeners() {
    // Setup radio button listeners
    document.querySelectorAll('[kilr-shopify="sub-option"] input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        
        // Find the closest sub-option container
        const subOption = e.target.closest('[kilr-shopify="sub-option"]');
        if (subOption) {
          // Store the selected value in a data attribute for easy access
          subOption.setAttribute('data-selected-value', e.target.value);
        }
      });
    });

    // Setup input field listeners
    document.querySelectorAll('[kilr-shopify="sub-option"] input[type="text"]').forEach(input => {
      input.addEventListener('input', (e) => {
        
        // Find the closest sub-option container
        const subOption = e.target.closest('[kilr-shopify="sub-option"]');
        if (subOption) {
          // Store the input value in a data attribute
          subOption.setAttribute('data-selected-value', e.target.value);
        }
      });
    });
  }

  /**
   * 13.7) validateSubOptions
   * Checks if all visible sub-options have values
   */
  function validateSubOptions() {
    const activeSubOptions = document.querySelectorAll('[kilr-shopify="sub-option"].is-active');
    if (activeSubOptions.length === 0) return true;

    

    return Array.from(activeSubOptions).every(subOption => {
      // Check radio buttons
      const radios = subOption.querySelectorAll('input[type="radio"]');
      if (radios.length > 0) {
        const hasCheckedRadio = Array.from(radios).some(radio => radio.checked);
        
        return hasCheckedRadio;
      }

      // Check input fields
      const inputs = subOption.querySelectorAll('input[type="text"]');
      if (inputs.length > 0) {
        const hasValue = Array.from(inputs).some(input => input.value.trim() !== '');
        
        return hasValue;
      }

      return true;
    });
  }

  /**
   * 13.8) collectSubOptionValues
   * Collects all selected/input values from visible sub-options
   */
  function collectSubOptionValues() {
    const comments = [];
    const activeSubOptions = document.querySelectorAll('[kilr-shopify="sub-option"].is-active');
    
    activeSubOptions.forEach(subOption => {
      // Check for radio buttons
      const checkedRadio = subOption.querySelector('input[type="radio"]:checked');
      if (checkedRadio) {
        
        comments.push(checkedRadio.value.trim());
        return;
      }

      // Check for input fields
      const textInput = subOption.querySelector('input[type="text"]');
      if (textInput && textInput.value.trim()) {
        
        comments.push(textInput.value.trim());
      }
    });

    const result = comments.join(' | ');
    
    return result;
  }

  /**
   * 14) handleAddToCart
   */
  async function handleAddToCart() {
    

    if (!window.selectedVariant) {
      alert('Please select a variant first.');
      return;
    }

    // Validate sub-options first
    if (typeof validateSubOptions === 'function' && !validateSubOptions()) {
      alert("Please complete all required options before adding to cart.");
      return;
    }

    const customerPriceTier = localStorage.getItem('customerPriceTier');
    const customerId = localStorage.getItem('customerId');
    const customerAccessToken = localStorage.getItem('customerAccessToken');

    // Only use tiered pricing if: module is loaded, customer is logged in, and has a price tier
    if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
      // Add loading state
      const addToCartBtn = document.querySelector('[kilr-shopify="add-to-cart"]');
      if (addToCartBtn) {
        addToCartBtn.classList.add("is-loading");
      }
      let loaderEl = null;
      if (addToCartBtn) {
        loaderEl = addToCartBtn.querySelector('.loader');
        if (loaderEl) loaderEl.classList.add('is-active');
      }

      try {
        const mf = window.selectedVariant[`price_tier_${customerPriceTier}`];
        const priceOverride = mf?.value?.amount ? parseFloat(mf.value.amount) : null;
        if (!priceOverride) {
          alert("Your special pricing is not available for this product. Please contact support.");
          return;
        }
        const draftOrderOptions = {
          variant: window.selectedVariant,
          quantity: productQuantity,
          customerId: `gid://shopify/Customer/${customerId}`,
          priceOverride,
          note: (typeof collectSubOptionValues === 'function' ? collectSubOptionValues() : null),
        };
        await window.KilrCustomerPricing.addToDraftOrder(draftOrderOptions);
      } finally {
        // Remove loading state
        if (addToCartBtn) addToCartBtn.classList.remove("is-loading");
        if (loaderEl) loaderEl.classList.remove('is-active');
      }
      return;
    }

    // --- Standard "Add to Cart" Logic for everyone else ---
    const addToCartBtn = document.querySelector('[kilr-shopify="add-to-cart"]');
    if (addToCartBtn) {
      addToCartBtn.classList.add("is-loading");
    }
    let loaderEl = null;
    if (addToCartBtn) {
      loaderEl = addToCartBtn.querySelector('.loader');
      if (loaderEl) loaderEl.classList.add('is-active');
    }

    try {
      const selectedVariant = window.selectedVariant;
      if (!selectedVariant) {
        
        return;
      }

      

      // Check if variant is available for sale
      if (!selectedVariant.availableForSale) {
        alert("This product is currently out of stock and not available for purchase. Please contact us for more information.");
        return;
      }

      if (!cartID) {
        
        return;
      }

      cartContent = await fetchCartById(cartID);
      if (!cartContent) {
        
        return;
      }

      const merchandiseId = selectedVariant.id;
      const quantity = productQuantity;
      

      // Collect sub-option values for note
      const note = collectSubOptionValues();
      

      const existingLine = cartContent.lines.nodes.find(
        (line) => line.merchandise?.id === merchandiseId
      );

      let storeFrontQuery;
      let variables;

      if (existingLine) {
        
        storeFrontQuery = `
          mutation updateCartLine($cartId: ID!, $lineId: ID!, $quantity: Int!, $merchandiseId: ID!, $note: String!) {
            cartLinesUpdate(
              cartId: $cartId,
              lines: [
                {
                  id: $lineId,
                  quantity: $quantity,
                  merchandiseId: $merchandiseId,
                  attributes: [
                    {
                      key: "note",
                      value: $note
                    }
                  ]
                }
              ]
            ) {
              cart {
                id
                lines(first: 100) {
                  nodes {
                    id
                    quantity
                    attributes {
                      key
                      value
                    }
                    merchandise {
                      ... on ProductVariant {
                        id
                        price {
                          amount
                        }
                        image {
                          altText
                          url(transform: {maxHeight: 400})
                        }
                        title
                        quantityAvailable
                        product {
                          title
                          description
                        }
                      }
                    }
                    cost {
                      totalAmount {
                        amount
                      }
                    }
                  }
                }
                cost {
                  totalAmount {
                    amount
                    currencyCode
                  }
                }
                checkoutUrl
                totalQuantity
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = {
          cartId: cartID,
          lineId: existingLine.id,
          quantity,
          merchandiseId,
          note
        };
      } else {
        
        storeFrontQuery = `
          mutation addCartLine($cartId: ID!, $merchandiseId: ID!, $quantity: Int!, $note: String!) {
            cartLinesAdd(
              cartId: $cartId,
              lines: [
                {
                  merchandiseId: $merchandiseId,
                  quantity: $quantity,
                  attributes: [
                    {
                      key: "note",
                      value: $note
                    }
                  ]
                }
              ]
            ) {
              cart {
                id
                lines(first: 100) {
                  nodes {
                    id
                    quantity
                    attributes {
                      key
                      value
                    }
                    merchandise {
                      ... on ProductVariant {
                        id
                        price {
                          amount
                        }
                        image {
                          altText
                          url(transform: {maxHeight: 400})
                        }
                        title
                        quantityAvailable
                        product {
                          title
                          description
                        }
                      }
                    }
                    cost {
                      totalAmount {
                        amount
                      }
                    }
                  }
                }
                cost {
                  totalAmount {
                    amount
                    currencyCode
                  }
                }
                checkoutUrl
                totalQuantity
              }
              userErrors {
                field
                message
              }
            }
          }
        `;
        variables = { 
          cartId: cartID, 
          merchandiseId, 
          quantity, 
          note
        };
      }

      

      const data = await sendShopifyQuery(storeFrontQuery, variables);
      

      if (data?.data?.cartLinesAdd?.userErrors?.length > 0 || data?.data?.cartLinesUpdate?.userErrors?.length > 0) {
        const errors = data?.data?.cartLinesAdd?.userErrors || data?.data?.cartLinesUpdate?.userErrors;
        
        alert("There was an error adding the item to your cart. Please try again.");
        return;
      }

      // Get the updated cart from the mutation response
      const updatedCart = data?.data?.cartLinesAdd?.cart || data?.data?.cartLinesUpdate?.cart;
      if (updatedCart) {
        
        cartContent = updatedCart;
        // Save to localStorage and dispatch event
        localStorage.setItem('cartContent', JSON.stringify(updatedCart));
        document.dispatchEvent(new CustomEvent('cart-updated', {
          detail: { cartID }
        }));

        playCartLottieOnce();
        const cartModalEl = document.querySelector('[kilr-shopify="cart-modal"]');
        if (cartModalEl) {
          cartModalEl.classList.add('is-active');
        }
      } else {
        
      }
    } catch (error) {
      
      alert("There was an error adding the item to your cart. Please try again.");
    } finally {
      if (addToCartBtn) {
        addToCartBtn.classList.remove("is-loading");
      }
      if (loaderEl) {
        loaderEl.classList.remove("is-active");
      }
    }
  }

  /**
   * 15) Preload Checkout for Buy Now:
   * UPDATED: Now accepts the button element as a parameter and stores the variant ID.
   */
  async function preloadCheckout(buyNowBtn) {
    if (preloadedCheckoutUrl) return; // Already preloaded
    const numericVariantId = buyNowBtn.dataset.variantId;
    if (!numericVariantId) return;
    preloadedVariantId = numericVariantId; // Store the variant ID for which this checkout was preloaded
    const merchandiseId = `gid://shopify/ProductVariant/${numericVariantId}`;
    try {
      const newCartId = await createCart();
      if (!newCartId) {
        
        return;
      }
      const quantity = 1;
      const storeFrontQuery = `
        mutation addCartLine($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) {
          cartLinesAdd(
            cartId: $cartId,
            lines: [{
              merchandiseId: $merchandiseId,
              quantity: $quantity
            }]
          ) {
            cart {
              id
              checkoutUrl
            }
          }
        }
      `;
      const variables = { cartId: newCartId, merchandiseId, quantity };
      const response = await sendShopifyQuery(storeFrontQuery, variables);
      const updatedCart = response?.data?.cartLinesAdd?.cart;
      if (!updatedCart) {
        
        return;
      }
      preloadedCheckoutUrl = updatedCart.checkoutUrl;
      preloadedCartId = updatedCart.id;
      
    } catch(err) {
      
    }
  }

  /**
   * 16) handleBuyNow: 
   * - Checks that if a preloaded checkout exists, its variant ID matches the clicked button.
   */
  async function handleBuyNow(event) {
    event.preventDefault();

    const buyNowBtn = event.currentTarget;
    buyNowBtn.classList.add("is-loading");

    // Only use preloaded checkout if the variant IDs match
    if (preloadedCheckoutUrl && buyNowBtn.dataset.variantId === preloadedVariantId) {
      window.location.href = preloadedCheckoutUrl;
      return;
    }

    const numericVariantId = buyNowBtn.dataset.variantId;  // e.g. "12345"
    if (!numericVariantId) {
      
      buyNowBtn.classList.remove("is-loading");
      return;
    }

    const merchandiseId = `gid://shopify/ProductVariant/${numericVariantId}`;
    

    try {
      const newCartId = await createCart();
      if (!newCartId) {
        
        return;
      }

      const quantity = 1;

      const storeFrontQuery = `
        mutation addCartLine($cartId: ID!, $merchandiseId: ID!, $quantity: Int!) {
          cartLinesAdd(
            cartId: $cartId,
            lines: [{
              merchandiseId: $merchandiseId,
              quantity: $quantity
            }]
          ) {
            cart {
              id
              checkoutUrl
              lines(first: 100) {
                nodes {
                  id
                  quantity
                }
              }
            }
          }
        }
      `;
      const variables = { cartId: newCartId, merchandiseId, quantity };

      const response = await sendShopifyQuery(storeFrontQuery, variables);
      const updatedCart = response?.data?.cartLinesAdd?.cart;
      if (!updatedCart) {
        
        return;
      }
      window.location.href = updatedCart.checkoutUrl;
    } catch (err) {
      
    } finally {
      buyNowBtn.classList.remove("is-loading");
    }
  }

  /**
   * 17) setupOptionSelectors
   */
  function setupOptionSelectors() {
    
    const optionSelectors = document.querySelectorAll('[kilr-shopify="option-selector"]');
    
    
    if (!optionSelectors || optionSelectors.length === 0) return;

    // Initially remove is-active class from all sub-options
    document.querySelectorAll('[kilr-shopify="sub-option"]').forEach(subOpt => {
      subOpt.classList.remove('is-active');
    });

    // Setup sub-option input listeners
    setupSubOptionListeners();

    optionSelectors.forEach((selector) => {
      
      
      let isActive = false;

      selector.addEventListener("click", (event) => {
        if (!event.target.closest('[kilr-shopify="option"]')) {
          event.stopPropagation();
          isActive = !isActive;
          selector.classList.toggle("is-active", isActive);
        }
      });

      const options = selector.querySelectorAll('[kilr-shopify="option"]');
      options.forEach((option) => {
        option.addEventListener("click", (e) => {
          console.log('🎯 [PRODUCT] Option clicked:', option);
          e.stopPropagation();
          updateSelectedOption(selector, option);
          selector.classList.remove("is-active");
          isActive = false;

          waitForProductData(() => {
            console.log('🎯 [PRODUCT] Product data ready, calling findSelectedVariant');
            findSelectedVariant();
          });
        });
      });
    });
  }

  /**
   * 18) waitForProductData
   */
  function waitForProductData(callback) {
    const interval = setInterval(() => {
      if (window.productData && window.productData.data && window.productData.data.product) {
        clearInterval(interval);
        callback();
      }
    }, 100);
  }

  /**
   * 19) loadProductBySlug
   */
  function loadProductBySlug(newSlug) {
    fetchProductData(newSlug);
    waitForProductData(() => {
      // Select first available option for each selector now that product data is ready
      document.querySelectorAll('[kilr-shopify="option-selector"]').forEach(selector => {
        if (typeof selectFirstOption === 'function') {
          selectFirstOption(selector);
        }
      });
      // Hide option wrappers for options that are "Default Title"
      document.querySelectorAll('[kilr-shopify="option-selector"]').forEach(selector => {
        // Un-hide first in case the product is changing
        const wrapperToShow = selector.closest('[kilr-shopify="option-wrapper"]');
        if (wrapperToShow) {
            wrapperToShow.style.display = '';
        } else {
            selector.style.display = '';
        }

        const hasDefaultTitle = Array.from(selector.querySelectorAll('[kilr-shopify="option-text"]'))
          .some(el => el.textContent.trim() === 'Default Title');

        if (hasDefaultTitle) {
          const wrapperToHide = selector.closest('[kilr-shopify="option-wrapper"]');
          if (wrapperToHide) {
            wrapperToHide.style.display = 'none';
          } else {
            // Fallback for when there's no wrapper
            selector.style.display = 'none';
          }
        }
      });

      if (typeof findSelectedVariant === 'function') findSelectedVariant();
      if (typeof handleQuantityControls === 'function') handleQuantityControls();
    });
  }

  /**
   * 20) createCart (in case no cartID exists)
   */
  async function createCart() {
    const mutation = `
      mutation createCart {
        cartCreate {
          cart {
            id
            checkoutUrl
          }
        }
      }
    `;
    const data = await sendShopifyQuery(mutation, {});
    const newCart = data?.data?.cartCreate?.cart;
    if (newCart && newCart.id) {
      localStorage.setItem('cartID', newCart.id);
      cartID = newCart.id;
      return newCart.id;
    }
    return null;
  }

  /**
   * 21) Setup IntersectionObserver to Preload Checkout for Buy Now
   */
  function setupBuyNowPreload() {
    const buyNowBtns = document.querySelectorAll('[kilr-shopify="buy-now"]');
    buyNowBtns.forEach((btn) => {
      const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            preloadCheckout(entry.target);
            observer.unobserve(entry.target);
          }
        });
      });
      observer.observe(btn);
    });
  }

  /**
   * 22) Main initialization on page load
   */
  setupOptionSelectors();
  loadProductBySlug(slug);

  const addToCartBtn = document.querySelector('[kilr-shopify="add-to-cart"]');
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", handleAddToCart);
  }

  const buyNowBtns = document.querySelectorAll('[kilr-shopify="buy-now"]');
  buyNowBtns.forEach((btn) => {
    btn.addEventListener("click", handleBuyNow);
  });

  setupBuyNowPreload();

  /**
   * 23) Detect changes to the slug in the URL
   */
  function detectSlugChange() {
    setInterval(() => {
      const currentSlug = window.location.pathname.split("/")[2] || "";
      if (currentSlug !== slug) {
        
        slug = currentSlug;
        loadProductBySlug(slug);
      }
    }, 1500);
  }
  detectSlugChange();

  /**
   * 24) Handle pageshow to clear stale states on mobile devices
   */
  window.addEventListener("pageshow", () => {
    preloadedCheckoutUrl = null;
    preloadedVariantId = null;
    const buyNowBtns = document.querySelectorAll('[kilr-shopify="buy-now"]');
    buyNowBtns.forEach((btn) => {
      btn.classList.remove("is-loading");
    });
  });

})();

