// Version 1.4.4 - Cart Script
// Changes:
// 1) When the user removes a line or clears the cart, we immediately call
//    removeLineItemsMutation to update the Shopify cart in real time.
// 2) For quantity changes, we still do local updates and only sync on close/checkout.

(function () {
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

  let cartID = localStorage.getItem('cartID') || null;
  let cartContent = null; // local cache

  // -----------------------------------------------------------
  // createEmptyCart
  // -----------------------------------------------------------
  async function createEmptyCart() {
    const mutation = `
      mutation {
        cartCreate(input: { lines: [] }) {
          cart {
            id
            lines(first: 100) {
              nodes {
                id
                quantity
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
        }
      }
    `;
    const data = await sendShopifyQuery(mutation, {});
    const newCart = data?.data?.cartCreate?.cart || null;

    if (newCart) {
      cartID = newCart.id;
      localStorage.setItem('cartID', cartID);
      saveCartContentToLocalStorage(newCart);
      
    } else {
      
    }
    return newCart;
  }

  // -----------------------------------------------------------
  // Queries / Mutations
  // -----------------------------------------------------------
  const cartContentQuery = `
    query cartContent($cartId: ID!) {
      cart(id: $cartId) {
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
    }
  `;

  // Updated remove mutation returns detailed product fields.
  const removeLineItemsMutation = `
    mutation removeItem($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
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
      }
    }
  `;

  const updateCartLinesMutation = `
    mutation updateCartLine($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
      cartLinesUpdate(cartId: $cartId, lines: $lines) {
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
      }
    }
  `;

  // -----------------------------------------------------------
  // sendShopifyQuery
  // -----------------------------------------------------------
  async function sendShopifyQuery(storeFrontQuery, variables) {
    const response = await fetch("https://kilr-headless-shopify-query.adrian-b0e.workers.dev/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeFrontQuery, variables }),
    });
    const data = await response.json();
    
    return data.responseData;
  }

  // -----------------------------------------------------------
  // Local Storage Helpers
  // -----------------------------------------------------------
  function saveCartContentToLocalStorage(cartObj) {
    cartContent = cartObj;
    localStorage.setItem('cartContent', JSON.stringify(cartObj));
  }

  function loadCartContentFromLocalStorage() {
    const stored = localStorage.getItem('cartContent');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (err) {
        
      }
    }
    return null;
  }

  // -----------------------------------------------------------
  // saveCartContentToLocalStorage
  // -----------------------------------------------------------
  function saveCartContentToLocalStorage(cart) {
    if (cart) {
      localStorage.setItem('cartContent', JSON.stringify(cart));
    }
  }

  // loadCartContentFromLocalStorage
  // -----------------------------------------------------------
  function loadCartContentFromLocalStorage() {
    try {
      const cached = localStorage.getItem('cartContent');
      return cached ? JSON.parse(cached) : null;
    } catch (e) {
      
      return null;
    }
  }

  // New helper function to create an empty cart structure for local use
  function createEmptyCartStructure() {
    return {
      id: null,
      lines: { nodes: [] },
      cost: { totalAmount: { amount: '0.00', currencyCode: 'USD' } },
      checkoutUrl: '',
      totalQuantity: 0
    };
  }

  // fetchCartContent - if null => createEmptyCart
  // -----------------------------------------------------------
  async function fetchCartContent(cartId) {
    const customerPriceTier = localStorage.getItem('customerPriceTier');
    const customerId = localStorage.getItem('customerId');
    const customerAccessToken = localStorage.getItem('customerAccessToken');

    // Only use draft orders if: module is loaded, customer is logged in, and has a price tier
    if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
      const draftOrderId = localStorage.getItem('draftOrderID');
      
      // Always fetch fresh draft order data - no caching
      if (draftOrderId) {
        
        const draftOrder = await window.KilrCustomerPricing.fetchDraftOrder(draftOrderId);
        
        
        if (draftOrder) {
          const adaptedCart = window.KilrCustomerPricing.adaptDraftOrderToCart(draftOrder);
          
          saveCartContentToLocalStorage(adaptedCart);
          return adaptedCart;
        } else {
          
          // If draft order doesn't exist, clear the invalid ID
          localStorage.removeItem('draftOrderID');
        }
      }
      // If no draft order exists, return an empty cart structure.
      return createEmptyCartStructure();
    }

    // Standard cart logic for regular customers.
    if (!cartId) {
      
      return null;
    }
    

    const data = await sendShopifyQuery(cartContentQuery, { cartId });
    const newCartContent = data?.data?.cart || null;

    if (newCartContent) {
      
      saveCartContentToLocalStorage(newCartContent);
      return newCartContent;
    } else {
      
      const emptyCart = await createEmptyCart();
      return emptyCart;
    }
  }

  // -----------------------------------------------------------
  // UI / Rendering
  // -----------------------------------------------------------
  function updateCartCount(cartObj) {
    const cartCountEl = document.querySelector('[kilr-shopify="cart-count"]');
    if (!cartCountEl) return;
    if (!cartObj || typeof cartObj.totalQuantity !== 'number') {
      cartCountEl.textContent = '0';
      return;
    }
    cartCountEl.textContent = cartObj.totalQuantity.toString();
  }

  function computeClientSideTotals(cartObj) {
    let totalQuantity = 0;
    let totalCost = 0;

    cartObj.lines.nodes.forEach((line) => {
      const pricePerUnit = line?.merchandise?.price?.amount
        ? parseFloat(line.merchandise.price.amount)
        : 0;
      const qty = line.quantity || 0;
      const lineCost = pricePerUnit * qty;

      totalQuantity += qty;
      totalCost += lineCost;
    });

    cartObj.totalQuantity = totalQuantity;

    if (!cartObj.cost) {
      cartObj.cost = { totalAmount: { amount: '0.00', currencyCode: 'USD' } };
    }
    cartObj.cost.totalAmount.amount = totalCost.toFixed(2);
  }

  function updateCartTotal(cartObj) {
    const cartTotalEl = document.querySelector('[kilr-shopify="cart-total"]');
    if (!cartTotalEl) return;

    if (!cartObj || !cartObj.cost || !cartObj.cost.totalAmount) {
      cartTotalEl.textContent = '$0.00';
      return;
    }

    const val = parseFloat(cartObj.cost.totalAmount.amount).toFixed(2);
    cartTotalEl.textContent = `$${val}`;
  }

  let cartItemTemplate = null;
  function renderCartItems(cartObj) {
    
    const cartItemsContainer = document.querySelector('[kilr-shopify="cart-items"]');
    if (!cartItemsContainer) {
      
      return;
    }

    if (!cartItemTemplate) {
      const templateInDOM = document.querySelector('[kilr-shopify="cart-item"]');
      if (!templateInDOM) {
        
        return;
      }
      cartItemTemplate = templateInDOM.cloneNode(true);
      templateInDOM.remove();
    }

    cartItemsContainer.innerHTML = '';

    if (!cartObj || !cartObj.lines || !cartObj.lines.nodes || cartObj.lines.nodes.length === 0) {
      return;
    }

    cartObj.lines.nodes.forEach((line) => {
      
      const clone = cartItemTemplate.cloneNode(true);
      clone.setAttribute('data-line-id', line.id);

      const variantImageEl = clone.querySelector('[kilr-shopify="cart-variant-image"]');
      if (variantImageEl && line.merchandise.image && line.merchandise.image.url) {
        variantImageEl.src = line.merchandise.image.url;
      }

      const titleEl = clone.querySelector('[kilr-shopify="cart-variant-title"]');
      if (titleEl && line.merchandise.product) {
        titleEl.textContent = line.merchandise.product.title;
      }

      const optionsEl = clone.querySelector('[kilr-shopify="cart-variant-options"]');
      if (optionsEl) {
        optionsEl.textContent = line.merchandise.title;
      }

      // Add note display with debugging
      const noteEl = clone.querySelector('[kilr-shopify="cart-variant-note"]');
      
      if (noteEl) {
        
        const noteAttribute = line.attributes?.find(attr => attr.key === 'note');
        
        if (noteAttribute) {
          
          noteEl.textContent = noteAttribute.value;
        } else {
          
          noteEl.textContent = '';
        }
      }

      const outOfStockEl = clone.querySelector('[kilr-shopify="cart-variant-out-stock"]');
      const quantityInputEl = clone.querySelector('[kilr-shopify="cart-variant-quantity"]');
      const decBtn = clone.querySelector('[kilr-shopify="cart-variant-quantity-dec"]');
      const incBtn = clone.querySelector('[kilr-shopify="cart-variant-quantity-inc"]');

      const variantPrice = line.merchandise.price?.amount
        ? parseFloat(line.merchandise.price.amount)
        : 0;

      const priceEl = clone.querySelector('[kilr-shopify="cart-variant-price"]');
      const customerPriceEl = clone.querySelector('[kilr-shopify="cart-customer-price"]');
      const cartDiscountDescEl = clone.querySelector('[kilr-shopify="cart-discount-description"]');

      // Check if this is a tiered pricing customer with discounted price
      const customerPriceTier = localStorage.getItem('customerPriceTier');
      const isDiscountedPrice = window.KILR_CUSTOMER_PRICING_ENABLED && customerPriceTier && variantPrice > 0;

      // Get base price and discounted price from the line item data
      let basePrice = variantPrice;
      let discountedPrice = variantPrice;

      if (isDiscountedPrice) {
        // Add the customer price class to indicate this is tiered pricing
        if (priceEl) {
          priceEl.classList.add('cart-customer-price');
        }
        
        // Show discount description wrapper for tiered pricing customers
        if (cartDiscountDescEl) {
          cartDiscountDescEl.style.display = 'block';
        }
        
        // Use the base price and discounted price from cart adaptation
        if (line.merchandise.basePrice && line.merchandise.basePrice.amount) {
          basePrice = parseFloat(line.merchandise.basePrice.amount);
        }
        if (line.merchandise.price && line.merchandise.price.amount) {
          discountedPrice = parseFloat(line.merchandise.price.amount);
        }
        
        
      } else {
        // Regular customers - hide discount description wrapper
        if (cartDiscountDescEl) {
          cartDiscountDescEl.style.display = 'none';
        }
      }

      function toggleOutOfStock(qty, available) {
        if (!outOfStockEl) return;
        if (available !== 0 && qty > available) {
          outOfStockEl.classList.add('is-active');
        } else {
          outOfStockEl.classList.remove('is-active');
        }
      }

      function updateLineSubtotal(qty) {
        const lineSubtotal = variantPrice * qty;
        
        if (isDiscountedPrice) {
          // Show base price in cart-variant-price
          if (priceEl) {
            priceEl.textContent = `$${(basePrice * qty).toFixed(2)}`;
          }
          // Show discounted price in cart-customer-price
          if (customerPriceEl) {
            customerPriceEl.textContent = `$${(discountedPrice * qty).toFixed(2)}`;
            customerPriceEl.style.display = 'block';  // Make the element visible
          }
        } else {
          // Regular customers - just show the price and hide customer price
          if (priceEl) {
            priceEl.textContent = `$${lineSubtotal.toFixed(2)}`;
          }
          if (customerPriceEl) {
            customerPriceEl.style.display = 'none';   // Hide customer price for regular customers
          }
        }
      }

      // Initialize
      if (quantityInputEl) {
        quantityInputEl.value = line.quantity;
        toggleOutOfStock(line.quantity, line.merchandise.quantityAvailable);
        updateLineSubtotal(line.quantity);

        // BLUR => local quantity update
        quantityInputEl.addEventListener('blur', async () => {
          let val = parseInt(quantityInputEl.value, 10);
          if (isNaN(val)) {
            quantityInputEl.value = line.quantity;
            return;
          }
          if (val < 0) val = 0;

          if (val === 0) {
            const alertEl = clone.querySelector('[kilr-shopify="cart-variant-delete-alert"]');
            if (alertEl) {
              alertEl.classList.add('is-active');
            }
          }
          const available = line.merchandise.quantityAvailable || 0;
          if (available > 0 && val > available) {
            val = available;
          }

          line.quantity = val;
          quantityInputEl.value = val;
          toggleOutOfStock(val, available);
          updateLineSubtotal(val);

          computeClientSideTotals(cartObj);
          saveCartContentToLocalStorage(cartObj);
          updateCartCount(cartObj);
          updateCartTotal(cartObj);

          // Handle draft order updates for tiered customers
          const customerPriceTier = localStorage.getItem('customerPriceTier');
          const customerId = localStorage.getItem('customerId');
          const customerAccessToken = localStorage.getItem('customerAccessToken');
          if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier && window.KilrCustomerPricing) {
            
            if (val === 0) {
              
              await window.KilrCustomerPricing.removeDraftOrderItem(line.merchandise.id);
            } else {
              
              await window.KilrCustomerPricing.updateDraftOrderQuantity(line.merchandise.id, val);
            }
            
            // Force refresh the cart after draft order update
            
            document.dispatchEvent(new CustomEvent('cart-updated'));
          }
        });
      }

      if (decBtn && quantityInputEl) {
        decBtn.addEventListener('click', () => {
          let currentVal = parseInt(quantityInputEl.value, 10) || 0;
          const newVal = Math.max(0, currentVal - 1);
          quantityInputEl.value = newVal;
          line.quantity = newVal;

          if (newVal === 0) {
            const alertEl = clone.querySelector('[kilr-shopify="cart-variant-delete-alert"]');
            if (alertEl) {
              alertEl.classList.add('is-active');
            }
          }
          const available = line.merchandise.quantityAvailable || 0;
          toggleOutOfStock(newVal, available);
          updateLineSubtotal(newVal);

          computeClientSideTotals(cartObj);
          saveCartContentToLocalStorage(cartObj);
          updateCartCount(cartObj);
          updateCartTotal(cartObj);

          // Trigger blur event to handle draft order updates
          quantityInputEl.dispatchEvent(new Event('blur'));
        });
      }

      if (incBtn && quantityInputEl) {
        incBtn.addEventListener('click', () => {
          let currentVal = parseInt(quantityInputEl.value, 10) || 0;
          const newVal = currentVal + 1;
          quantityInputEl.value = newVal;
          line.quantity = newVal;

          const available = line.merchandise.quantityAvailable || 0;
          toggleOutOfStock(newVal, available);
          updateLineSubtotal(newVal);

          computeClientSideTotals(cartObj);
          saveCartContentToLocalStorage(cartObj);
          updateCartCount(cartObj);
          updateCartTotal(cartObj);

          // Trigger blur event to handle draft order updates
          quantityInputEl.dispatchEvent(new Event('blur'));
        });
      }

      const alertEl = clone.querySelector('[kilr-shopify="cart-variant-delete-alert"]');
      if (alertEl && line.quantity === 0) {
        alertEl.classList.add('is-active');
      }

      // "Delete Confirm" => remove immediately from Shopify
      const deleteConfirmBtn = clone.querySelector('[kilr-shopify="cart-variant-delete-confirm"]');
      if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', async () => {
          const loaderEl = deleteConfirmBtn.querySelector('.loader');
          if (loaderEl) loaderEl.classList.add('is-active');

          await removeLineFromShopify(cartObj, line.id);

          if (loaderEl) loaderEl.classList.remove('is-active');
        });
      }

      // "Delete Cancel"
      const deleteCancelBtn = clone.querySelector('[kilr-shopify="cart-variant-delete-cancel"]');
      if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener('click', () => {
          if (alertEl) {
            alertEl.classList.remove('is-active');
          }
          if (quantityInputEl.value === '0') {
            quantityInputEl.value = '1';
            line.quantity = 1;
            const available = line.merchandise.quantityAvailable || 0;
            toggleOutOfStock(1, available);
            updateLineSubtotal(1);

            computeClientSideTotals(cartObj);
            saveCartContentToLocalStorage(cartObj);
            updateCartCount(cartObj);
            updateCartTotal(cartObj);
          }
        });
      }

      // New "Remove" button functionality:
      // Instead of immediately removing the item,
      // we trigger the warning alert so the user can confirm deletion.
      const removeBtn = clone.querySelector('[kilr-shopify="cart-variant-remove"]');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          // Simulate setting the quantity to zero
          if (quantityInputEl) {
            quantityInputEl.value = '0';
            line.quantity = 0;
          }
          // Fire the remove warning alert
          const alertEl = clone.querySelector('[kilr-shopify="cart-variant-delete-alert"]');
          if (alertEl) {
            alertEl.classList.add('is-active');
          }
        });
      }

      cartItemsContainer.appendChild(clone);
    });
  }

  // -----------------------------------------------------------
  // removeLineFromShopify => real-time remove call
  // -----------------------------------------------------------
  async function removeLineFromShopify(cartObj, lineId) {
    if (!lineId || !cartID) {
      
      localRemoveLine(cartObj, lineId);
      return;
    }

    const customerPriceTier = localStorage.getItem('customerPriceTier');
    const customerId = localStorage.getItem('customerId');
    const customerAccessToken = localStorage.getItem('customerAccessToken');

    // Handle draft order item removal for tiered customers
    if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
      // Find the variant ID from the line item
      const line = cartObj.lines.nodes.find(l => l.id === lineId);
      if (line && line.merchandise && line.merchandise.id) {
        
        try {
          await window.KilrCustomerPricing.removeDraftOrderItem(line.merchandise.id);
          // Refresh cart content after removal
          const draftOrderId = localStorage.getItem('draftOrderID');
          if (draftOrderId) {
            const freshCartContent = await fetchCartContent(draftOrderId);
            if (freshCartContent) {
              cartContent = freshCartContent;
              refreshCartUI();
            }
          }
        } catch (error) {
          
        }
      }
      return;
    }

    // Standard cart logic
    try {
      const data = await sendShopifyQuery(removeLineItemsMutation, {
        cartId: cartID,
        lineIds: [lineId]
      });
      const updatedCart = data?.data?.cartLinesRemove?.cart;
      if (updatedCart) {
        cartObj = updatedCart;
      }
    } catch (err) {
      
    }
    // 2) remove locally
    localRemoveLine(cartObj, lineId);
  }

  function localRemoveLine(cartObj, lineId) {
    cartObj.lines.nodes = cartObj.lines.nodes.filter(l => l.id !== lineId);
    computeClientSideTotals(cartObj);
    saveCartContentToLocalStorage(cartObj);
    updateCartCount(cartObj);
    updateCartTotal(cartObj);
    renderCartItems(cartObj);
  }

  // "Clear cart" => remove all lines immediately from Shopify
  function setupCartClear() {
    const clearBtn = document.querySelector('[kilr-shopify="cart-clear"]');
    if (!clearBtn) return;

    clearBtn.addEventListener('click', async () => {
      const customerPriceTier = localStorage.getItem('customerPriceTier');
      const customerId = localStorage.getItem('customerId');
      const customerAccessToken = localStorage.getItem('customerAccessToken');

      // Only use draft order clearing if: module is loaded, customer is logged in, and has a price tier
      if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
        const draftOrderId = localStorage.getItem('draftOrderID');
        if (draftOrderId && window.KilrCustomerPricing) {
          
          try {
            // Use the customer pricing module to clear the draft order
            await window.KilrCustomerPricing.sendShopifyAdminQuery({
              adminAction: 'clearDraftOrder',
              draftOrderId: draftOrderId
            });
            // Remove the draftOrderID so a fresh draft order will be created when needed
            localStorage.removeItem('draftOrderID');
            
          } catch (error) {
            
            // Remove the draft order ID if clearing failed too
            localStorage.removeItem('draftOrderID');
          }
        }
        cartContent = createEmptyCartStructure();
        saveCartContentToLocalStorage(cartContent);
        refreshCartUI();
        return;
      }
      
      // --- Standard cart clearing logic ---
      if (!cartContent || !cartContent.lines) return;
      const allLineIds = cartContent.lines.nodes.map(l => l.id);

      // If we have an actual cartID, remove from Shopify in real-time
      if (cartID && allLineIds.length > 0) {
        try {
          const data = await sendShopifyQuery(removeLineItemsMutation, {
            cartId: cartID,
            lineIds: allLineIds
          });
          const updatedCart = data?.data?.cartLinesRemove?.cart;
          if (updatedCart) {
            cartContent = updatedCart;
          }
        } catch (err) {
          
        }
      }
      // Then set local lines to []
      cartContent.lines.nodes = [];
      computeClientSideTotals(cartContent);
      saveCartContentToLocalStorage(cartContent);
      updateCartCount(cartContent);
      updateCartTotal(cartContent);
      renderCartItems(cartContent);
    });
  }

  // -----------------------------------------------------------
  // 7) Cart Modal triggers
  // -----------------------------------------------------------
  function setupCartModalTriggers() {
    const cartTrigger = document.querySelector('[kilr-shopify="cart-trigger"]');
    const closeCartBtn = document.querySelector('[kilr-shopify="cart-close"]');
    const cartModalEl = document.querySelector('[kilr-shopify="cart-modal"]');

    if (!cartModalEl) {
      
      return;
    }

    // Open
    if (cartTrigger) {
      cartTrigger.addEventListener('click', () => {
        cartModalEl.classList.add('is-active');
      });
    }

    // Close => immediate close, sync quantity changes in background
    if (closeCartBtn) {
      closeCartBtn.addEventListener('click', () => {
        cartModalEl.classList.remove('is-active');
        // Now sync local quantity changes in background
        syncLocalCartToShopify()
          .then(() => {
            
            if (cartID) {
              fetchCartContent(cartID).then((fetched) => {
                if (fetched) {
                  cartContent = fetched;
                  refreshCartUI();
                  
                }
              });
            }
          })
          .catch((err) => {
            
          });
      });
    }
  }

  // -----------------------------------------------------------
  // 8) syncLocalCartToShopify (for quantity updates)
  // -----------------------------------------------------------
  async function syncLocalCartToShopify() {
    if (!cartID || !cartContent || !cartContent.lines) {
      return;
    }

    // Build lines for update
    const linesForUpdate = cartContent.lines.nodes.map((line) => ({
      id: line.id,
      merchandiseId: line.merchandise.id,
      quantity: line.quantity
    }));

    const validLines = linesForUpdate.filter(l => l.quantity > 0);

    if (validLines.length === 0) {
      
      return;
    }

    
    try {
      const data = await sendShopifyQuery(updateCartLinesMutation, {
        cartId: cartID,
        lines: validLines
      });
      const updatedCart = data?.data?.cartLinesUpdate?.cart;
      if (updatedCart) {
        cartContent = updatedCart;
        saveCartContentToLocalStorage(cartContent);
        
      }
    } catch (err) {
      
    }
  }

  // -----------------------------------------------------------
  // 9) Checkout
  // -----------------------------------------------------------
  function setupCartCheckout() {
    const checkoutBtn = document.querySelector('[kilr-shopify="cart-checkout"]');
    if (!checkoutBtn) return;

    checkoutBtn.addEventListener('click', async () => {
      // For tiered pricing customers, the checkout URL is the draft order's invoice_url.
      const customerPriceTier = localStorage.getItem('customerPriceTier');
      const customerId = localStorage.getItem('customerId');
      const customerAccessToken = localStorage.getItem('customerAccessToken');
      
      // Only use draft order checkout if: module is loaded, customer is logged in, and has a price tier
      if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
        if (cartContent && cartContent.checkoutUrl) {
          window.location.href = cartContent.checkoutUrl;
        } else {
          alert("Could not find your order details. Please try again.");
        }
        return;
      }

      // --- Standard Checkout Logic ---
      const loaderEl = checkoutBtn.querySelector('.loader');
      if (loaderEl) loaderEl.classList.add('is-active');

      try {
        if (!cartID) {
          
          return;
        }

        // sync local quantity changes
        await syncLocalCartToShopify();
        // then fetch final cart
        const updatedCart = await fetchCartContent(cartID);
        if (updatedCart && updatedCart.checkoutUrl) {
          window.location.href = updatedCart.checkoutUrl;
        }
      } finally {
        if (loaderEl) loaderEl.classList.remove('is-active');
      }
    });
  }

  // -----------------------------------------------------------
  // 10) refreshCartUI
  // -----------------------------------------------------------
  function refreshCartUI() {
    updateCartCount(cartContent);
    renderCartItems(cartContent);
    updateCartTotal(cartContent);
  }

  // -----------------------------------------------------------
  // 11) Initialization
  // -----------------------------------------------------------
  function initializeCart() {
    setupCartModalTriggers();
    setupCartClear();
    setupCartCheckout();
    
    let storedCartContent = loadCartContentFromLocalStorage();
    if (storedCartContent) {
      cartContent = storedCartContent;
    }
  
    (async () => {
      const customerPriceTier = localStorage.getItem('customerPriceTier');
      const customerId = localStorage.getItem('customerId');
      const customerAccessToken = localStorage.getItem('customerAccessToken');
  
      // --- New: Cart Conversion Logic ---
      // Only use tiered pricing if: module is loaded, customer is logged in, and has a price tier
      if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier && cartID) {
          // If a standard cart exists for a tiered customer, convert it.
          try {
              
              const response = await sendShopifyAdminQuery({
                  action: 'convertCartToDraftOrder',
                  payload: {
                      cartId: cartID,
                      customerId: `gid://shopify/Customer/${customerId}`,
                      priceTier: customerPriceTier
                  }
              });
              const draftOrder = response.data?.draftOrder;
              if (draftOrder) {
                  cartContent = window.KilrCustomerPricing.adaptDraftOrderToCart(draftOrder);
                  localStorage.setItem('draftOrderID', draftOrder.id);
                  saveCartContentToLocalStorage(cartContent);
                  localStorage.removeItem('cartID'); // Clear the old cart ID
                  cartID = null;
                  
              } else {
                  throw new Error("Cart conversion failed to return a draft order.");
              }
          } catch (error) {
              
              // Fallback to an empty cart to avoid errors
              cartContent = createEmptyCartStructure();
              saveCartContentToLocalStorage(cartContent);
          }
      } else if (window.KILR_CUSTOMER_PRICING_ENABLED && customerAccessToken && customerId && customerPriceTier) {
          // Customer has tiered pricing but no standard cart - check for existing draft order
          const draftOrderId = localStorage.getItem('draftOrderID');
          if (draftOrderId) {
              
              const freshCartContent = await fetchCartContent(draftOrderId);
              if (freshCartContent) {
                  cartContent = freshCartContent;
                  cartID = draftOrderId; // Set cartID to draft order ID for consistency
              } else {
                  
                  cartContent = createEmptyCartStructure();
              }
          } else {
              
              cartContent = createEmptyCartStructure();
          }
      } else if (!cartID) {
          
          const newCart = await createEmptyCart();
          cartContent = newCart || cartContent;
      } else {
          const freshCartContent = await fetchCartContent(cartID);
          if (freshCartContent) {
              cartContent = freshCartContent;
          }
      }
      refreshCartUI();
    })();
  
    // -----------------------------------------------------------
    // cart-updated event => refetch from Shopify
    // -----------------------------------------------------------
    document.addEventListener('cart-updated', async (event) => {
      // Use the cart ID from the event if provided, otherwise fall back to stored cartID
      const eventCartId = event.detail?.cartID;
      const activeCartId = eventCartId || cartID;
      
      if (activeCartId) {
        const newCartContent = await fetchCartContent(activeCartId);
        if (newCartContent) {
          cartContent = newCartContent;
          // Update the global cartID if we're using a new ID (like draft order)
          if (eventCartId && eventCartId !== cartID) {
            cartID = eventCartId;
          }
        }
        computeClientSideTotals(cartContent);
      }
      refreshCartUI();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    waitForHydration(() => {
      // Additional safety check to ensure DOM is stable
      if (document.readyState === 'loading') {
        window.addEventListener('load', initializeCart);
        return;
      }
      initializeCart();
    });
  });
})();


