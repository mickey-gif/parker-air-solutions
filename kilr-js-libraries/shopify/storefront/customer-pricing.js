// Version 1.2.1 - Customer Tiered Pricing Module

(function () {
  console.log("[Customer Pricing] Initializing module...");
  
  // Check if customer access token exists before enabling pricing module
  const customerToken = localStorage.getItem("customerAccessToken");
  const hasValidToken = customerToken && customerToken !== "null" && customerToken.trim() !== "";
  
  if (!hasValidToken) {
    console.log("[Customer Pricing] ❌ No valid customer access token found. Module disabled.");
    window.KILR_CUSTOMER_PRICING_ENABLED = false;
    return; // Exit early if no token
  }
  
  console.log("[Customer Pricing] ✅ Valid customer token found. Enabling pricing module.");
  
  // 1. Set a global flag to indicate that this module is active.
  // Other scripts will check for this flag to modify their behavior.
  window.KILR_CUSTOMER_PRICING_ENABLED = true;

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

  function triggerCartOpen() {
    playCartLottieOnce();
    const cartModalEl = document.querySelector('[kilr-shopify="cart-modal"]');
    if (cartModalEl) {
        cartModalEl.classList.add('is-active');
    }
  }

  // This object will be the main interface for the tiered pricing functionality.
  window.KilrCustomerPricing = {
    /**
     * addToDraftOrder
     * Handles adding/updating items in a draft order for customers with tiered pricing.
     * @param {object} options - Contains variant, quantity, customerId, priceOverride, and note.
     */
    async addToDraftOrder(options) {
      const { variant, quantity, customerId, priceOverride, note } = options;
      console.log("Attempting to add to draft order:", options);
      console.log("Price override value:", priceOverride, "Type:", typeof priceOverride);

      if (!customerId) {
        console.error("Customer ID is required for draft orders.");
        alert("Could not identify the customer. Please log in again.");
        return;
      }

      // Validate variant object
      if (!variant || !variant.id) {
        console.error("Invalid variant object:", variant);
        alert("Product variant information is missing. Please refresh the page and try again.");
        return;
      }

      // Validate other required fields
      if (!quantity || quantity < 1) {
        console.error("Invalid quantity:", quantity);
        alert("Please select a valid quantity.");
        return;
      }

      if (!priceOverride || priceOverride <= 0) {
        console.error("Invalid price override:", priceOverride);
        alert("Price information is missing. Please refresh the page and try again.");
        return;
      }

      let draftOrderId = localStorage.getItem('draftOrderID');
      const draftOrderData = {
        customerId: customerId,
        variantId: variant.id,
        quantity: quantity,
        customPrice: priceOverride,
        note: note,
        draftOrderId: draftOrderId,
      };

      console.log("Draft order data being sent to worker:", draftOrderData);

      try {
        const response = await this.sendShopifyAdminQuery(draftOrderData);

        console.log("Worker response received:", response);
        
        // Check for null or undefined response
        if (!response) {
          console.error('Worker returned null/undefined response');
          alert('No response from server. Please try again.');
          return;
        }

        // Top-level transport error
        if (response.error) {
          console.error('Worker transport error:', response.error);
          
          // Check if this is a "Cannot read properties of null" error
          if (response.error.includes('Cannot read properties of null')) {
            console.error('Worker encountered a null object error. This might indicate:');
            console.error('1. Draft order not found or failed to create');
            console.error('2. Customer not found in Shopify');
            console.error('3. Product variant not found in Shopify');
            console.error('4. Worker configuration issue');
            
            // Try to clear invalid draft order ID and retry once
            if (draftOrderId) {
              console.log('Clearing potentially invalid draft order ID and retrying...');
              localStorage.removeItem('draftOrderID');
              
              // Retry without the draft order ID
              const retryData = { ...draftOrderData };
              delete retryData.draftOrderId;
              
              console.log('Retrying with fresh draft order creation:', retryData);
              
              try {
                const retryResponse = await this.sendShopifyAdminQuery(retryData);
                if (!retryResponse.error) {
                  console.log('Retry successful, processing response...');
                  // Process the retry response
                  const retryGraphqlResponse = retryResponse.data || {};
                  const retryUserErrors = retryGraphqlResponse.data?.draftOrderCreate?.userErrors || [];
                  
                  if (retryUserErrors.length === 0) {
                    const newDraftOrder = retryGraphqlResponse.data?.draftOrderCreate?.draftOrder;
                    if (newDraftOrder) {
                      localStorage.setItem('draftOrderID', newDraftOrder.id);
                      const adaptedCart = this.adaptDraftOrderToCart(newDraftOrder);
                      localStorage.setItem('cartContent', JSON.stringify(adaptedCart));
                      console.log("Retry successful - new draft order created:", newDraftOrder);
                      document.dispatchEvent(new CustomEvent('cart-updated', { detail: { cartID: newDraftOrder.id } }));
                      triggerCartOpen();
                      return;
                    }
                  }
                }
              } catch (retryError) {
                console.error('Retry also failed:', retryError);
              }
            }
            
            alert('There was an issue with your order. This might be due to:\n• Product not available for your pricing tier\n• Temporary server issue\n• Account configuration problem\n\nPlease try refreshing the page or contact support if the issue persists.');
          } else {
            alert('A server error occurred. Please try again or contact support if the issue persists.');
          }
          
          throw new Error(typeof response.error === 'string' ? response.error : 'Worker error');
        }

        // Handle GraphQL errors and userErrors
        const graphqlResponse = response.data || {};
        
        // Check for GraphQL-level errors
        if (graphqlResponse.errors && graphqlResponse.errors.length > 0) {
          console.error('GraphQL errors:', graphqlResponse.errors);
          alert(`GraphQL error: ${graphqlResponse.errors[0].message}`);
          return;
        }

        // Check for specific worker error codes
        if (graphqlResponse.error && graphqlResponse.error.code) {
          switch (graphqlResponse.error.code) {
            case 'DRAFT_ORDER_NOT_FOUND':
              console.log('Draft order not found, clearing stored ID and retrying...');
              localStorage.removeItem('draftOrderID');
              // Retry automatically
              const retryData = { ...draftOrderData };
              delete retryData.draftOrderId;
              return this.addToDraftOrder(options);
              
            case 'VARIANT_NOT_FOUND':
              console.error('Product variant not found:', graphqlResponse.error.variantId);
              alert('This product is no longer available. Please refresh the page and try again.');
              return;
              
            default:
              console.error('Worker returned error code:', graphqlResponse.error.code);
              alert(`Error: ${graphqlResponse.error.message}`);
              return;
          }
        }

        // Check for worker-wrapped errors (error.adminRaw.data.draftOrderUpdate.userErrors)
        if (graphqlResponse.error && graphqlResponse.error.adminRaw) {
          const adminResponse = graphqlResponse.error.adminRaw;
          const userErrors = adminResponse.data?.draftOrderCreate?.userErrors || adminResponse.data?.draftOrderUpdate?.userErrors || [];
          
          if (userErrors.length > 0) {
            console.error('Draft order userErrors (from adminRaw):', userErrors);
            
            // Handle "Draft order not found" by clearing the invalid ID and creating a new one
            if (userErrors[0].message.includes("Draft order not found")) {
              console.log("Draft order not found, clearing invalid ID and creating new draft order...");
              localStorage.removeItem('draftOrderID');
              
              // Retry without the draftOrderID (this will create a new draft order)
              const retryData = { ...draftOrderData };
              delete retryData.draftOrderId;
              
              const retryResponse = await this.sendShopifyAdminQuery(retryData);
              if (retryResponse.error) {
                throw new Error(retryResponse.error);
              }
              
              const retryGraphqlResponse = retryResponse.data || {};
              const retryUserErrors = retryGraphqlResponse.data?.draftOrderCreate?.userErrors || [];
              if (retryUserErrors.length > 0) {
                alert(`Draft order error: ${retryUserErrors[0].message}`);
                return;
              }
              
              const newDraftOrder = retryGraphqlResponse.data?.draftOrderCreate?.draftOrder;
              if (newDraftOrder) {
                localStorage.setItem('draftOrderID', newDraftOrder.id);
                const adaptedCart = this.adaptDraftOrderToCart(newDraftOrder);
                localStorage.setItem('cartContent', JSON.stringify(adaptedCart));
                console.log("New draft order created successfully:", newDraftOrder);
                document.dispatchEvent(new CustomEvent('cart-updated', { detail: { cartID: newDraftOrder.id } }));
                triggerCartOpen();
                return;
              }
            }
            
            alert(`Draft order error: ${userErrors[0].message}`);
            return;
          }
        }

        // Check for direct Admin API userErrors
        const userErrors = graphqlResponse.data?.draftOrderCreate?.userErrors || graphqlResponse.data?.draftOrderUpdate?.userErrors || [];
        if (userErrors.length > 0) {
          console.error('Draft order userErrors:', userErrors);
          
          // Handle "Draft order not found" by clearing the invalid ID and creating a new one
          if (userErrors[0].message.includes("Draft order not found")) {
            console.log("Draft order not found, clearing invalid ID and creating new draft order...");
            localStorage.removeItem('draftOrderID');
            
            // Retry without the draftOrderID (this will create a new draft order)
            const retryData = { ...draftOrderData };
            delete retryData.draftOrderId;
            
            const retryResponse = await this.sendShopifyAdminQuery(retryData);
            if (retryResponse.error) {
              throw new Error(retryResponse.error);
            }
            
            const retryGraphqlResponse = retryResponse.data || {};
            const retryUserErrors = retryGraphqlResponse.data?.draftOrderCreate?.userErrors || [];
            if (retryUserErrors.length > 0) {
              alert(`Draft order error: ${retryUserErrors[0].message}`);
              return;
            }
            
            const newDraftOrder = retryGraphqlResponse.data?.draftOrderCreate?.draftOrder;
            if (newDraftOrder) {
              localStorage.setItem('draftOrderID', newDraftOrder.id);
              const adaptedCart = this.adaptDraftOrderToCart(newDraftOrder);
              localStorage.setItem('cartContent', JSON.stringify(adaptedCart));
              console.log("New draft order created successfully:", newDraftOrder);
              document.dispatchEvent(new CustomEvent('cart-updated', { detail: { cartID: newDraftOrder.id } }));
              triggerCartOpen();
              return;
            }
          }
          
          alert(`Draft order error: ${userErrors[0].message}`);
          return;
        }

        // Extract the draft order from the GraphQL response
        const newDraftOrder = graphqlResponse.data?.draftOrderCreate?.draftOrder || graphqlResponse.data?.draftOrderUpdate?.draftOrder;

        if (!newDraftOrder) {
          console.error('Unexpected worker response:', response);
          alert('Unexpected response from server while updating your order.');
          return;
        }

        localStorage.setItem('draftOrderID', newDraftOrder.id);
        const adaptedCart = this.adaptDraftOrderToCart(newDraftOrder);
        localStorage.setItem('cartContent', JSON.stringify(adaptedCart));
        console.log("Saved adapted cart to localStorage:", adaptedCart);
        document.dispatchEvent(new CustomEvent('cart-updated', { detail: { cartID: newDraftOrder.id } }));
        triggerCartOpen();
        console.log("Draft order updated successfully:", newDraftOrder);
      } catch (error) {
        console.error("Error adding to draft order:", error);
        alert("An error occurred while updating your order. Please try again.");
      }
    },

    /**
     * sendShopifyAdminQuery
     */
    async sendShopifyAdminQuery(payload) {
      const workerUrl = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";
      
      // If payload contains adminAction, use it; otherwise default to updateDraftOrder
      let requestBody;
      if (payload.adminAction) {
        // Payload already contains adminAction, send as-is
        requestBody = payload;
      } else {
        // Legacy format - wrap in updateDraftOrder action
        requestBody = { adminAction: "updateDraftOrder", payload };
      }
      
      console.log("Sending to worker:", requestBody);
      
      try {
        const res = await fetch(workerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        console.log("Worker response status:", res.status, res.statusText);
        
        if (!res.ok) {
          console.error(`Worker returned ${res.status}: ${res.statusText}`);
          const errorText = await res.text();
          console.error("Worker error response:", errorText);
          return { error: `Worker error ${res.status}: ${errorText}` };
        }

        const responseText = await res.text();
        console.log("Worker raw response:", responseText);
        
        if (!responseText) {
          return { error: 'Empty response from worker' };
        }

        try {
          return JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse worker response as JSON:", e);
          return { error: 'Invalid JSON from worker: ' + responseText };
        }
      } catch (e) {
        console.error("Network error contacting worker:", e);
        return { error: 'Network error: ' + e.message };
      }
    },

    /**
     * fetchDraftOrder - Fetches a draft order by ID
     */
    async fetchDraftOrder(draftOrderId) {
      try {
        const response = await this.sendShopifyAdminQuery({
          adminAction: 'getDraftOrder',
          draftOrderId: draftOrderId
        });

        if (response.error) {
          console.error('Worker transport error:', response.error);
          return null;
        }

        const graphqlResponse = response.data || {};
        
        // Check for GraphQL-level errors
        if (graphqlResponse.errors && graphqlResponse.errors.length > 0) {
          console.error('GraphQL errors fetching draft order:', graphqlResponse.errors);
          return null;
        }

        const draftOrder = graphqlResponse.data?.draftOrder || null;
        console.log('fetchDraftOrder returning:', draftOrder);
        return draftOrder;
      } catch (error) {
        console.error('Error fetching draft order:', error);
        return null;
      }
    },

    /**
     * updateDraftOrderQuantity - Updates quantity for a specific line item
     */
    async updateDraftOrderQuantity(variantId, newQuantity) {
      try {
        const draftOrderId = localStorage.getItem('draftOrderID');
        if (!draftOrderId) {
          console.warn('No draft order ID found for quantity update');
          return false;
        }

        const customerId = localStorage.getItem('customerId');
        if (!customerId) {
          console.warn('No customer ID found for quantity update');
          return false;
        }

        // Get the current tiered price for this variant
        const customerPriceTier = localStorage.getItem('customerPriceTier');
        let priceOverride = null;

        // Try to get cached cart content to find current price
        try {
          const cachedCartStr = localStorage.getItem('cartContent');
          if (cachedCartStr) {
            const cachedCart = JSON.parse(cachedCartStr);
            if (cachedCart && cachedCart.lines && cachedCart.lines.nodes) {
              const lineItem = cachedCart.lines.nodes.find(line => line.merchandise.id === variantId);
              if (lineItem && lineItem.merchandise.price) {
                priceOverride = parseFloat(lineItem.merchandise.price.amount);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to parse cached cart content:', e);
        }

        const updateData = {
          customerId: `gid://shopify/Customer/${customerId}`,
          variantId: variantId,
          quantity: newQuantity,
          customPrice: priceOverride,
          note: null, // Don't add unnecessary notes for cart updates
          draftOrderId: draftOrderId,
        };

        console.log('Updating draft order quantity:', updateData);
        
        const response = await this.sendShopifyAdminQuery(updateData);
        
        if (response.error) {
          console.error('Error updating draft order quantity:', response.error);
          return false;
        }

        const graphqlResponse = response.data || {};
        const newDraftOrder = graphqlResponse.data?.draftOrderUpdate?.draftOrder;
        
        if (newDraftOrder) {
          const adaptedCart = this.adaptDraftOrderToCart(newDraftOrder);
          localStorage.setItem('cartContent', JSON.stringify(adaptedCart));
          console.log('Draft order quantity updated successfully');
          return true;
        }

        return false;
      } catch (error) {
        console.error('Error updating draft order quantity:', error);
        return false;
      }
    },

    /**
     * removeDraftOrderItem - Removes an item from draft order
     */
    async removeDraftOrderItem(variantId) {
      return await this.updateDraftOrderQuantity(variantId, 0);
    },

    /**
     * syncCartWithDraftOrder - Syncs all cart changes with draft order
     */
    async syncCartWithDraftOrder(cartChanges) {
      try {
        console.log('Syncing cart changes with draft order:', cartChanges);
        
        // Process each change
        for (const change of cartChanges) {
          if (change.quantity === 0) {
            await this.removeDraftOrderItem(change.variantId);
          } else {
            await this.updateDraftOrderQuantity(change.variantId, change.quantity);
          }
        }
        
        // Refresh the cart display
        document.dispatchEvent(new CustomEvent('cart-updated'));
        return true;
      } catch (error) {
        console.error('Error syncing cart with draft order:', error);
        return false;
      }
    },

    /**
     * adaptDraftOrderToCart
     */
    adaptDraftOrderToCart(draftOrder) {
      if (!draftOrder) return null;
      
      // Calculate total quantity separately
      const totalQuantity = (draftOrder.lineItems?.nodes || []).reduce((sum, line) => sum + line.quantity, 0);
      
      const cart = {
        id: draftOrder.id,
        checkoutUrl: draftOrder.invoiceUrl,
        totalQuantity: totalQuantity,
        cost: {
          totalAmount: {
            amount: draftOrder.totalPrice,
            currencyCode: draftOrder.currencyCode,
          },
        },
        lines: {
          nodes: (draftOrder.lineItems?.nodes || []).map(line => {
            // Calculate effective price (originalUnitPrice - discount)
            const basePrice = parseFloat(line.originalUnitPrice || line.variant?.price || 0);
            const discountAmount = parseFloat(line.appliedDiscount?.value || 0);
            const effectivePrice = basePrice - discountAmount;
            
            console.log(`Cart adaptation for line ${line.id}: base=${basePrice}, discount=${discountAmount}, effective=${effectivePrice}`);
            
            return {
              id: line.id,
              quantity: line.quantity,
              attributes: line.customAttributes,
              merchandise: {
                id: line.variant.id,
                price: { amount: effectivePrice.toFixed(2) }, // Discounted price
                basePrice: { amount: basePrice.toFixed(2) }, // Original price
                discountAmount: discountAmount,
                image: line.variant.image,
                title: line.variantTitle,
                quantityAvailable: line.variant.inventoryQuantity,
                product: { title: line.title },
              },
              cost: {
                totalAmount: { amount: (effectivePrice * line.quantity).toFixed(2) },
              },
            };
          }),
        },
      };
      return cart;
    }
  };

  // Listen for customer data cleanup events
  document.addEventListener('customer-data-cleared', function(event) {
    console.log("[Customer Pricing] Customer data cleared event received. Disabling module.");
    window.KILR_CUSTOMER_PRICING_ENABLED = false;
  });

  console.log("Customer Tiered Pricing module loaded and enabled.");
})();
