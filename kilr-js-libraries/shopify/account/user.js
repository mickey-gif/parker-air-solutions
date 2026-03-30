// Version 2.0.0 - Added re-population on tab-click to support dynamic tab content (e.g., Radix tabs) + User Account Management + Fixed Save API Compatibility + Fixed Navigation Visibility + Fixed Token Sequence Race Conditions + Fixed Auto-Redirect Issue + Real Shopify Save Mutations + Enhanced Navigation State Management + kilr-order List Population + kilr-user Data Population + Save Functionality + Storage Cleanup + Dashboard Access + Logout Handling + Dynamic Slug Replacement + URL Token Check + Customer Price Tier + Navigation Visibility + Added '.block' class guard + Added order data logging + Added polling for order list container + Replaced order link instead of updating to avoid event listener issues + Switched to class-based nav hiding with observer guard + Added polling for nav elements to fix race condition + Made script re-entrant to prevent redeclaration errors
// Make script re-entrant by attaching state to the window object
if (typeof window.kilrUserScriptInitialized === 'undefined') {
	window.kilrUserScriptInitialized = false;
	window.kilrNavObserver = null;
	window.isProgrammaticallyUpdatingNav = false;
	window.currentLoginState = false;
}

document.addEventListener("DOMContentLoaded", async function () {
	// Prevent re-initialization of listeners if script runs multiple times
	if (window.kilrUserScriptInitialized) {
		console.log("[User Account] Script already initialized. Skipping re-initialization.");
		// Re-enforce nav state on subsequent runs, as DOM might have been replaced
		const token = localStorage.getItem("customerAccessToken");
		const isLoggedIn = token && token !== "null" && token.trim() !== "";
		showNavigationElements(isLoggedIn);
		return;
	}
	window.kilrUserScriptInitialized = true;

	const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/"; // Your Cloudflare Worker URL
	const bodyEl = document.querySelector("body");
	const logoutButton = document.querySelector('[kilr-account="logout-submit"]');
  
	console.debug("[User Account] Starting user account management script...");
	console.log(`[DEBUG] Script load timestamp: ${Date.now()}`);

	/**
	 * showNavigationElements:
	 * Shows/hides navigation elements based on authentication status.
	 * @param {boolean} isLoggedIn - Whether the user is logged in
	 */
	function showNavigationElements(isLoggedIn) {
		window.isProgrammaticallyUpdatingNav = true;
		window.currentLoginState = isLoggedIn;
		// Look for both kilr-user and kilr-account attributes for backward compatibility
		const loginNav = document.querySelector('[kilr-user="nav-login"]') || document.querySelector('[kilr-account="nav-login"]');
		const accountNav = document.querySelector('[kilr-user="nav-account"]') || document.querySelector('[kilr-account="nav-account"]');
		
		console.debug(`[showNavigationElements] Setting navigation visibility. User logged in: ${isLoggedIn}`);
		console.debug(`[showNavigationElements] Found login nav: ${!!loginNav}, account nav: ${!!accountNav}`);
		
		if (isLoggedIn) {
			// User is logged in - show account nav, hide login nav
			if (loginNav) {
				loginNav.classList.add('is-hidden');
				console.debug('[showNavigationElements] Hidden login nav element');
			} else {
				console.debug('[showNavigationElements] No login nav element found to hide');
			}
			if (accountNav) {
				accountNav.classList.remove('is-hidden');
				console.debug('[showNavigationElements] Shown account nav element');
			} else {
				console.debug('[showNavigationElements] No account nav element found to show');
			}
		} else {
			// User is not logged in - show login nav, hide account nav
			if (accountNav) {
				accountNav.classList.add('is-hidden');
				console.debug('[showNavigationElements] Hidden account nav element');
			} else {
				console.debug('[showNavigationElements] No account nav element found to hide');
			}
			if (loginNav) {
				loginNav.classList.remove('is-hidden');
				console.debug('[showNavigationElements] Shown login nav element');
			} else {
				console.debug('[showNavigationElements] No login nav element found to show');
			}
		}
		
		// Use a timeout to ensure the flag is reset after the current execution stack clears
		setTimeout(() => {
			window.isProgrammaticallyUpdatingNav = false;
		}, 0);
	}

	/**
	 * Storage Manager Functions
	 * Handles customer data validation and cleanup
	 */
	function hasValidToken() {
		const token = localStorage.getItem("customerAccessToken");
		const isValid = token && token !== "null" && token.trim() !== "";
		console.log(`[Storage Manager] Token validation: ${isValid ? "✅ Valid" : "❌ Invalid"} (${token})`);
		return isValid;
	}

	function clearCustomerData() {
		console.log("[Storage Manager] Clearing all customer data...");
		const keysToRemove = [
			"customerAccessToken",
			"customerId", 
			"customerPriceTier",
			"customerData",
			"cartContent",
			"draftOrderID"
		];
		
		let removedCount = 0;
		keysToRemove.forEach(key => {
			if (localStorage.getItem(key) !== null) {
				localStorage.removeItem(key);
				removedCount++;
				console.log(`[Storage Manager] Removed: ${key}`);
			}
		});
		
		console.log(`[Storage Manager] Cleanup complete. Removed ${removedCount} items.`);
		
		// Dispatch event to notify other scripts
		document.dispatchEvent(new CustomEvent('customer-data-cleared', {
			detail: { removedItems: removedCount }
		}));
		
		// Update navigation to show login state
		showNavigationElements(false);
		
		return removedCount;
	}

	function validateAndCleanupStorage() {
		console.log("[Storage Manager] Running data validation...");
		
		if (!hasValidToken()) {
			console.log("[Storage Manager] Invalid or missing token detected. Token will need validation.");
			// Don't automatically clear data - let the dashboard page handle redirects
			// Only clear if explicitly called by other functions
			return false; // Token invalid
		}
		
		console.log("[Storage Manager] Token validation passed. Data integrity maintained.");
		return true; // Token valid
	}

	function initializeStorageManager() {
		console.log("[Storage Manager] Initializing storage cleanup and validation...");
		
		// Perform initial cleanup check
		validateAndCleanupStorage();
		
		// Set up periodic validation (every 5 minutes)
		setInterval(() => {
			validateAndCleanupStorage();
		}, 300000);
		
		console.log("[Storage Manager] Automatic cleanup monitoring enabled (5 min intervals).");
		
		// Make functions globally available
		window.KilrStorageManager = {
			hasValidToken,
			clearCustomerData,
			validateAndCleanup: validateAndCleanupStorage
		};
		
		// Make navigation function globally available for testing
		window.KilrNavigation = {
			showNavigationElements,
			testNavigation: function() {
				console.log("Testing navigation visibility...");
				const token = localStorage.getItem("customerAccessToken");
				const isLoggedIn = token && token !== "null" && token.trim() !== "";
				console.log(`Current login status: ${isLoggedIn ? "✅ Logged in" : "❌ Not logged in"}`);
				showNavigationElements(isLoggedIn);
			}
		};
	}

	/**
	 * initializeNavigationState:
	 * Sets initial navigation visibility based on current login status
	 * This runs on every page load to ensure proper nav state
	 */
	function initializeNavigationState() {
		console.log("[Navigation] Initializing navigation state...");
  
		const token = localStorage.getItem("customerAccessToken");
		const isLoggedIn = token && token !== "null" && token.trim() !== "";
		
		console.log(`[Navigation] Login status: ${isLoggedIn ? "✅ Logged in" : "❌ Not logged in"}`);

		// Poll for the navigation elements in case they are loaded dynamically
		const maxRetries = 50; // 50 * 100ms = 5 seconds
		let retries = 0;
		const intervalId = setInterval(() => {
			const loginNav = document.querySelector('[kilr-user="nav-login"]') || document.querySelector('[kilr-account="nav-login"]');
			const accountNav = document.querySelector('[kilr-user="nav-account"]') || document.querySelector('[kilr-account="nav-account"]');
			if (loginNav && accountNav) {
				clearInterval(intervalId);
				console.log(`[Navigation] Found navigation elements after ${retries * 100}ms.`);
				// Set initial navigation visibility based on login status
				showNavigationElements(isLoggedIn);
				// Set up MutationObserver to guard the navigation elements
				if (!window.kilrNavObserver) {
					window.kilrNavObserver = new MutationObserver(mutations => {
						if (window.isProgrammaticallyUpdatingNav) {
							return; // Ignore changes made by our own script
						}
						console.warn("[Navigation] Manual change detected. Reverting to correct state.");
						showNavigationElements(window.currentLoginState);
					});
					window.kilrNavObserver.observe(loginNav, {
						attributes: true,
						attributeFilter: ['class']
					});
					window.kilrNavObserver.observe(accountNav, {
						attributes: true,
						attributeFilter: ['class']
					});
					console.log("[Navigation] MutationObserver is now guarding nav elements.");
				}
			} else {
				retries++;
				if (retries >= maxRetries) {
					clearInterval(intervalId);
					console.error("[Navigation] Could not find navigation elements after 5 seconds. The script looks for '[kilr-user=\"nav-login\"]' and '[kilr-user=\"nav-account\"]'.");
				}
			}
		}, 100);
		
		// Listen for storage changes to update navigation (with debounce to prevent race conditions)
		let storageUpdateTimeout;
		window.addEventListener('storage', function(e) {
			if (e.key === 'customerAccessToken') {
				console.log("[Navigation] Customer access token changed, updating navigation...");
				
				// Clear any existing timeout to debounce rapid changes
				if (storageUpdateTimeout) {
					clearTimeout(storageUpdateTimeout);
				}
				
				// Delay the navigation update to allow other processes to complete
				storageUpdateTimeout = setTimeout(() => {
					const newToken = e.newValue;
					const newIsLoggedIn = newToken && newToken !== "null" && newToken.trim() !== "";
					console.log(`[Navigation] Debounced navigation update: ${newIsLoggedIn ? "logged in" : "logged out"}`);
					showNavigationElements(newIsLoggedIn);
				}, 100); // 100ms delay
			}
		});
  
		// Listen for custom events from storage cleanup
		document.addEventListener('customer-data-cleared', function() {
			console.log("[Navigation] Customer data cleared event received, showing login navigation...");
			showNavigationElements(false);
		});
		
		console.log("[Navigation] Navigation state initialization completed (polling started).");
	}

	// 0) FIRST: Seed localStorage from URL query token if present (?token= or ?customerAccessToken=)
	// This MUST happen before any token validation to avoid race conditions
	const queryParams = new URLSearchParams(window.location.search);
	const queryToken = queryParams.get("token") || queryParams.get("customerAccessToken");
	console.log(`[DEBUG] Current URL: ${window.location.href}`);
	console.log(`[DEBUG] Query token found: ${queryToken}`);
	if (queryToken) {
		console.log("[DEBUG] Found token in query params. Seeding localStorage FIRST.");
		localStorage.setItem("customerAccessToken", queryToken);
	}

	// Initialize storage cleanup and validation (AFTER token seeding)
	initializeStorageManager();

	// Initialize navigation state based on current login status (AFTER token seeding)
	initializeNavigationState();
  
	// 1) Check if the body is marked as dashboard.
	if (!bodyEl || !bodyEl.matches('[kilr-account="dashboard"]')) {
		console.log("[DEBUG] Body is not marked as dashboard. Exiting script.");
		return; // If body is not dashboard, do nothing
	}
  
	// 2) Lock the page visually by adding "is-loading" to the body.
	console.debug("[Page Load] Adding 'is-loading' class to body.");
	bodyEl.classList.add("is-loading");

	// Find and guard the element with the 'block' class
	const guardedElement = document.querySelector(".block");
	let blockObserver;
  
	// 3) Set up a MutationObserver to ensure "is-loading" and the "dashboard" attribute remain until verification is complete.
	const observer = new MutationObserver(mutations => {
		mutations.forEach(mutation => {
			if (mutation.type === "attributes") {
				if (!bodyEl.classList.contains("is-loading")) {
					console.debug("[MutationObserver] 'is-loading' class missing on body. Re-adding it.");
					bodyEl.classList.add("is-loading");
				}
				if (!bodyEl.matches('[kilr-account="dashboard"]')) {
					console.debug("[MutationObserver] 'dashboard' attribute missing on body. Re-adding it.");
					bodyEl.setAttribute("kilr-account", "dashboard");
				}
			}
		});
	});
	observer.observe(bodyEl, {
		attributes: true,
		attributeFilter: ["class", "kilr-account"],
		attributeOldValue: true
	});

	// If a guarded element is found, observe it to prevent class removal
	if (guardedElement) {
		console.debug("[Page Load] Guarding element with class 'block'.");
		blockObserver = new MutationObserver(mutations => {
			mutations.forEach(mutation => {
				if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
					if (!mutation.target.classList.contains('block')) {
						console.debug("[MutationObserver] 'block' class manually removed, re-adding it.");
						mutation.target.classList.add('block');
					}
				}
			});
		});
		blockObserver.observe(guardedElement, {
			attributes: true,
			attributeFilter: ['class']
		});
	}
  
	// 4) Retrieve the access token and customerId from localStorage.
	// Re-check for query token one more time to ensure it's been processed
	const finalToken = queryToken || localStorage.getItem("customerAccessToken");
	const storedCustomerId = localStorage.getItem("customerId");
	console.log(`[DEBUG] Final token (query: ${queryToken}, stored: ${localStorage.getItem("customerAccessToken")}): ${finalToken}`);
	console.log(`[DEBUG] Retrieved customerId from localStorage: ${storedCustomerId}`);
	
	// Use the final token for all subsequent operations
	const token = finalToken;
  
	// If no token exists, show login nav and redirect to the root domain.
	if (!token || token === "null") {
		console.log("[DEBUG] ❌ REDIRECT REASON 1: No valid token found");
		console.log(`[DEBUG] Token value: '${token}', Type: ${typeof token}`);
		showNavigationElements(false); // Show login nav
		window.location.href = "/";
		return;
	}
  
	// 5) Legacy URL token validation - only check path token if no query token exists
	const pathSegments = window.location.pathname.split('/').filter(Boolean);
	const urlTokenFromPath = pathSegments[pathSegments.length - 1];
	console.log(`[DEBUG] Path segments: ${JSON.stringify(pathSegments)}`);
	console.log(`[DEBUG] URL token from path: ${urlTokenFromPath}`);
	
	// Only validate path token if:
	// 1. No query token is present, AND
	// 2. The path appears to contain a token (long alphanumeric string), AND  
	// 3. No search params exist in the URL
	const looksLikeToken = urlTokenFromPath && urlTokenFromPath.length > 20 && /^[a-zA-Z0-9]+$/.test(urlTokenFromPath);
	console.log(`[DEBUG] Query token present: ${!!queryToken}`);
	console.log(`[DEBUG] Looks like token: ${looksLikeToken}`);
	console.log(`[DEBUG] Tokens match: ${token === urlTokenFromPath}`);
	console.log(`[DEBUG] Has search params: ${window.location.search.indexOf("token=") !== -1}`);
	
	if (!queryToken && looksLikeToken && token !== urlTokenFromPath && window.location.search.indexOf("token=") === -1) {
		console.log("[DEBUG] ❌ REDIRECT REASON 2: Path token mismatch");
		window.location.href = "/";
		return;
	}
  
	// 6) Verify the token by querying Shopify via the Cloudflare Worker.
	try {
		console.log("[DEBUG] ✅ About to verify token with Shopify...");
		console.log(`[DEBUG] Token being verified: ${token.substring(0, 10)}...`);
		const verifiedId = await verifyAccessToken(token, cloudflareWorkerURL);
		console.log(`[DEBUG] Verification result: ${verifiedId}`);
		if (verifiedId) {
			console.log("[DEBUG] ✅ Token verified successfully! Unlocking page...");
			observer.disconnect();
			if (blockObserver) {
				blockObserver.disconnect();
			}
			bodyEl.classList.remove("is-loading");
			bodyEl.removeAttribute("kilr-account");
			if (guardedElement) {
				guardedElement.classList.remove("block");
				console.debug("[Page Load] Removed 'block' class from guarded element.");
			}
			// Ensure customerId is persisted for other scripts (cart/product)
			localStorage.setItem("customerId", verifiedId);
			// Show account nav since user is logged in
			showNavigationElements(true);
		} else {
			console.log("[DEBUG] ❌ REDIRECT REASON 3: Token verification failed");
			showNavigationElements(false); // Show login nav
			window.location.href = "/";
			return;
		}
	} catch (error) {
		console.log("[DEBUG] ❌ REDIRECT REASON 4: Error during token verification");
		console.error("[Page Load] Error verifying token:", error);
		showNavigationElements(false); // Show login nav on error
		window.location.href = "/";
		return;
	}
  
	// 7) Replace ":slug" in links with the stored customerAccessToken.
	replaceSlugWithToken();
	console.debug("[Page Load] Finished token verification and slug replacement.");
  
	/**
	 * populateCustomerData:
	 * Populates page elements with user data using kilr-user attributes.
	 * @param {object} customerData - The customer object from Shopify
	 */
	function populateCustomerData(customerData) {
		console.log("[DEBUG] Starting user data population...");
		
		try {
			// Basic user information
			populateElement('[kilr-user="first-name"]', customerData.firstName);
			populateElement('[kilr-user="last-name"]', customerData.lastName);
			populateElement('[kilr-user="display-name"]', customerData.displayName);
			populateElement('[kilr-user="full-name"]', `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim());
			populateElement('[kilr-user="email"]', customerData.email);
			populateElement('[kilr-user="phone"]', customerData.phone);
			populateElement('[kilr-user="price-tier"]', customerData.priceTier?.value);
			populateElement('[kilr-user="company"]', customerData.defaultAddress?.company);
			populateElement('[kilr-user="tags"]', customerData.tags?.join(', '));
			
			// Dates (formatted)
			if (customerData.createdAt) {
				const createdDate = new Date(customerData.createdAt);
				populateElement('[kilr-user="created-at"]', createdDate.toLocaleDateString());
				populateElement('[kilr-user="member-since"]', createdDate.getFullYear().toString());
			}
			
			// Default address
			if (customerData.defaultAddress) {
				const addr = customerData.defaultAddress;
				populateElement('[kilr-user="address-name"]', `${addr.firstName || ''} ${addr.lastName || ''}`.trim());
				populateElement('[kilr-user="address-company"]', addr.company);
				populateElement('[kilr-user="address-line1"]', addr.address1);
				populateElement('[kilr-user="address-line2"]', addr.address2);
				populateElement('[kilr-user="address-city"]', addr.city);
				populateElement('[kilr-user="address-province"]', addr.province);
				populateElement('[kilr-user="address-country"]', addr.country);
				populateElement('[kilr-user="address-zip"]', addr.zip);
				populateElement('[kilr-user="address-phone"]', addr.phone);
				
				// Full formatted address
				const fullAddress = [
					addr.address1,
					addr.address2,
					addr.city,
					addr.province,
					addr.zip,
					addr.country
				].filter(Boolean).join(', ');
				populateElement('[kilr-user="address-full"]', fullAddress);
			}
			
			// Order statistics
			if (customerData.orders) {
				populateElement('[kilr-user="order-count"]', customerData.orders.totalCount?.toString());
				
				// Recent orders
				if (customerData.orders.nodes && customerData.orders.nodes.length > 0) {
					const recentOrder = customerData.orders.nodes[0];
					populateElement('[kilr-user="last-order-number"]', recentOrder.name || recentOrder.orderNumber);
					populateElement('[kilr-user="last-order-total"]', recentOrder.totalPrice?.amount);
					populateElement('[kilr-user="last-order-status"]', recentOrder.fulfillmentStatus);
					
					if (recentOrder.processedAt) {
						const orderDate = new Date(recentOrder.processedAt);
						populateElement('[kilr-user="last-order-date"]', orderDate.toLocaleDateString());
					}
				}
			}
			
			// Marketing preferences
			populateElement('[kilr-user="accepts-marketing"]', customerData.acceptsMarketing ? 'Yes' : 'No');
			
			// Set up save functionality for forms
			setupSaveFunctionality();
			
			// Populate order list
			populateOrderList(customerData.orders);
			
			console.log("[DEBUG] User data population completed");
			
		} catch (error) {
			console.error("[DEBUG] Error populating user data:", error);
		}
	}
	
	/**
	 * populateElement:
	 * Helper function to populate a single element with data.
	 * @param {string} selector - CSS selector for the element
	 * @param {string} value - Value to populate
	 */
	function populateElement(selector, value) {
		if (!value) return;
		
		const elements = document.querySelectorAll(selector);
		elements.forEach(element => {
			if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
				element.value = value;
			} else {
				element.textContent = value;
			}
		});
		
		if (elements.length > 0) {
			console.log(`[DEBUG] Populated ${elements.length} element(s) with selector "${selector}": ${value}`);
		}
	}

	/**
	 * setupSaveFunctionality:
	 * Sets up save functionality for kilr-user="save" buttons/elements
	 */
	function setupSaveFunctionality() {
		console.log("[DEBUG] Setting up save functionality...");
		
		const saveElements = document.querySelectorAll('[kilr-user="save"]');
		console.log(`[DEBUG] Found ${saveElements.length} save element(s)`);
		
		saveElements.forEach(saveElement => {
			// Prevent attaching multiple listeners if the element persists across re-renders
			if (saveElement.dataset.saveListenerAttached) return;
			saveElement.dataset.saveListenerAttached = 'true';

			saveElement.addEventListener('click', async function(event) {
				event.preventDefault();
				console.log("[User Save] Save button clicked");
				
				// Add loading state
				saveElement.classList.add('is-loading');
				saveElement.disabled = true;
				
				try {
					// Collect all form data from kilr-user input fields
					const formData = collectUserFormData();
					console.log("[User Save] Collected form data:", formData);
					
					// Save the data
					const success = await saveUserData(formData);
					
					if (success) {
						console.log("[User Save] ✅ Data saved successfully");
						// You can add success feedback here
						showSaveMessage('Data saved successfully!', 'success');
					} else {
						console.log("[User Save] ❌ Failed to save data");
						showSaveMessage('Failed to save data. Please try again.', 'error');
					}
					
				} catch (error) {
					console.error("[User Save] Error saving data:", error);
					showSaveMessage('An error occurred while saving. Please try again.', 'error');
				} finally {
					// Remove loading state
					saveElement.classList.remove('is-loading');
					saveElement.disabled = false;
				}
			});
		});
	}

	/**
	 * collectUserFormData:
	 * Collects data from all kilr-user input fields
	 */
	function collectUserFormData() {
		const formData = {};
		
		// Define the fields we can collect and their corresponding customer fields
		const fieldMapping = {
			'first-name': 'firstName',
			'last-name': 'lastName',
			'email': 'email',
			'phone': 'phone',
			'company': 'company'
		};
		
		Object.keys(fieldMapping).forEach(kilrField => {
			const elements = document.querySelectorAll(`[kilr-user="${kilrField}"]`);
			elements.forEach(element => {
				if (element.tagName.toLowerCase() === 'input' || element.tagName.toLowerCase() === 'textarea') {
					const value = element.value.trim();
					if (value) {
						formData[fieldMapping[kilrField]] = value;
					}
				}
			});
		});
		
		return formData;
	}

	/**
	 * saveUserData:
	 * Saves user data via the Shopify Admin API
	 */
	async function saveUserData(formData) {
		console.log("[User Save] Saving user data:", formData);
		
		const customerId = localStorage.getItem('customerId');
		if (!customerId) {
			console.error("[User Save] No customer ID found");
			return false;
		}
		
		try {
			// Build the customer update mutation
			const customerGID = `gid://shopify/Customer/${customerId}`;
			
			// Prepare the input object for customer update
			const input = {};
			if (formData.firstName) input.firstName = formData.firstName;
			if (formData.lastName) input.lastName = formData.lastName;
			if (formData.email) input.email = formData.email;
			if (formData.phone) input.phone = formData.phone;
			
			console.log("[User Save] Customer update input:", input);
			
			// Handle company separately via address update if needed
			let needsAddressUpdate = false;
			if (formData.company !== undefined) {
				needsAddressUpdate = true;
			}
			
			// Build the Storefront API mutation query with variables
			const updateMutation = `
				mutation customerUpdate($customerAccessToken: String!, $customer: CustomerUpdateInput!) {
					customerUpdate(customerAccessToken: $customerAccessToken, customer: $customer) {
						customer {
							id
							firstName
							lastName
							email
							phone
						}
						customerUserErrors {
							code
							field
							message
						}
					}
				}
			`;
			
			// Get the customer access token for Storefront API
			const customerAccessToken = localStorage.getItem('customerAccessToken');
			if (!customerAccessToken) {
				console.error("[User Save] No customer access token found");
				return false;
			}
			
			// Prepare variables for Storefront API
			const variables = {
				customerAccessToken: customerAccessToken,
				customer: input
			};
			
			console.log("[User Save] Sending customer update to worker:", { mutation: updateMutation, variables });
			
			// Send the mutation via the worker using Storefront API format
			const response = await sendShopifyRequest(updateMutation, variables);
			
			if (response.error) {
				console.error("[User Save] Worker error:", response.error);
				return false;
			}
			
			const graphqlResponse = response.data || {};
			
			// Check for GraphQL errors
			if (graphqlResponse.errors && graphqlResponse.errors.length > 0) {
				console.error("[User Save] GraphQL errors:", graphqlResponse.errors);
				return false;
			}
			
			// Check for user errors from the mutation (Storefront API uses customerUserErrors)
			const updateResult = graphqlResponse.data?.customerUpdate;
			if (updateResult?.customerUserErrors && updateResult.customerUserErrors.length > 0) {
				console.error("[User Save] Customer update errors:", updateResult.customerUserErrors);
				showSaveMessage(`Error: ${updateResult.customerUserErrors[0].message}`, 'error');
				return false;
			}
			
			// Check if customer was successfully updated
			if (updateResult?.customer) {
				console.log("[User Save] Customer updated successfully:", updateResult.customer);
				
				// Update localStorage with new data
				const storedCustomerData = localStorage.getItem('customerData');
				if (storedCustomerData) {
					try {
						const customerData = JSON.parse(storedCustomerData);
						// Update the stored customer data with new values
						Object.assign(customerData, updateResult.customer);
						localStorage.setItem('customerData', JSON.stringify(customerData));
						console.log("[User Save] Updated stored customer data");
					} catch (e) {
						console.warn("[User Save] Failed to update stored customer data:", e);
					}
				}
				
				// Handle company field via address update if needed
				if (needsAddressUpdate && formData.company !== undefined) {
					const addressUpdateSuccess = await updateCustomerAddress(customerId, formData.company);
					if (!addressUpdateSuccess) {
						console.warn("[User Save] Customer updated but address update failed");
						showSaveMessage('Profile updated, but company update failed', 'warning');
						return true; // Still return true since customer update succeeded
					}
				}
				
				return true;
			} else {
				console.error("[User Save] No customer returned from update");
				return false;
			}
			
		} catch (error) {
			console.error("[User Save] Exception during save:", error);
			return false;
		}
	}

	/**
	 * updateCustomerAddress:
	 * Updates the customer's default address company field
	 */
	async function updateCustomerAddress(customerId, company) {
		console.log("[Address Update] Updating customer address company field:", company);
		
		try {
			// Get current customer data to find default address ID
			const storedCustomerData = localStorage.getItem('customerData');
			if (!storedCustomerData) {
				console.error("[Address Update] No stored customer data found");
				return false;
			}
			
			const customerData = JSON.parse(storedCustomerData);
			const defaultAddress = customerData.defaultAddress;
			
			if (!defaultAddress || !defaultAddress.id) {
				console.error("[Address Update] No default address found for customer");
				return false;
			}
			
			// Build address update mutation
			const addressInput = {
				id: defaultAddress.id,
				company: company,
				// Keep existing address data
				firstName: defaultAddress.firstName,
				lastName: defaultAddress.lastName,
				address1: defaultAddress.address1,
				address2: defaultAddress.address2,
				city: defaultAddress.city,
				province: defaultAddress.province,
				country: defaultAddress.country,
				zip: defaultAddress.zip,
				phone: defaultAddress.phone
			};
			
			const addressUpdateMutation = `
				mutation customerAddressUpdate($customerAccessToken: String!, $id: ID!, $address: MailingAddressInput!) {
					customerAddressUpdate(customerAccessToken: $customerAccessToken, id: $id, address: $address) {
						customerAddress {
							id
							company
						}
						customerUserErrors {
							code
							field
							message
						}
					}
				}
			`;
			
			const customerAccessToken = localStorage.getItem('customerAccessToken');
			if (!customerAccessToken) {
				console.error("[Address Update] No customer access token found");
				return false;
			}
			
			// Send via Storefront API (customer can update their own address)
			const response = await sendShopifyRequest(addressUpdateMutation, {
				customerAccessToken: customerAccessToken,
				id: defaultAddress.id,
				address: addressInput
			});
			
			if (response.error) {
				console.error("[Address Update] Error updating address:", response.error);
				return false;
			}
			
			const addressResult = response.responseData?.data?.customerAddressUpdate;
			if (addressResult?.customerUserErrors && addressResult.customerUserErrors.length > 0) {
				console.error("[Address Update] Address update errors:", addressResult.customerUserErrors);
				return false;
			}
			
			if (addressResult?.customerAddress) {
				console.log("[Address Update] Address updated successfully");
				
				// Update stored customer data
				if (customerData.defaultAddress) {
					customerData.defaultAddress.company = company;
					localStorage.setItem('customerData', JSON.stringify(customerData));
				}
				
				return true;
			}
			
			return false;
			
		} catch (error) {
			console.error("[Address Update] Exception during address update:", error);
			return false;
		}
	}

	/**
	 * showSaveMessage:
	 * Shows a save result message to the user
	 */
	function showSaveMessage(message, type) {
		console.log(`[User Save] ${type.toUpperCase()}: ${message}`);
		
		// Look for a message container
		const messageContainer = document.querySelector('[kilr-user="message"]');
		if (messageContainer) {
			messageContainer.textContent = message;
			messageContainer.className = `save-message save-message--${type}`;
			messageContainer.style.display = 'block';
			
			// Hide message after 5 seconds
			setTimeout(() => {
				messageContainer.style.display = 'none';
			}, 5000);
		}
	}

	/**
	 * populateOrderList:
	 * Populates the order list using the template item for each order
	 * @param {object} ordersData - The orders object from customer data
	 */
	function populateOrderList(ordersData) {
		console.log("[Order List] Starting order list population...");
		console.log("[Order List] Received orders data:", ordersData);

		if (!ordersData || !ordersData.nodes || ordersData.nodes.length === 0) {
			console.log("[Order List] No orders found for customer");
			return;
		}

		// Poll for the order list container in case it's loaded dynamically
		const maxRetries = 50; // 50 * 100ms = 5 seconds timeout
		let retries = 0;
		const intervalId = setInterval(() => {
			const orderListContainer = document.querySelector('[kilr-order="list"]');

			if (orderListContainer) {
				clearInterval(intervalId);
				console.log(`[Order List] Found order list container after ${retries * 100}ms.`);
				
				// Find the template item
				const templateItem = orderListContainer.querySelector('[kilr-order="item"]');
				if (!templateItem) {
					console.log("[Order List] No template item found");
					return;
				}
		
				console.log(`[Order List] Found ${ordersData.nodes.length} orders to populate`);
		
				// Clear existing items except the template
				const existingItems = orderListContainer.querySelectorAll('[kilr-order="item"]:not(:first-child)');
				existingItems.forEach(item => item.remove());
		
				// Process each order
				ordersData.nodes.forEach((order, index) => {
					let orderItem;
			
					if (index === 0) {
						// Use the template for the first order
						orderItem = templateItem;
					} else {
						// Clone the template for subsequent orders
						orderItem = templateItem.cloneNode(true);
						orderListContainer.appendChild(orderItem);
					}
			
					// Populate order data
					populateOrderItem(orderItem, order);
				});
		
				console.log("[Order List] Order list population completed");

			} else {
				retries++;
				if (retries >= maxRetries) {
					clearInterval(intervalId);
					console.log("[Order List] No order list container found after waiting 5 seconds. The script is looking for an element with the attribute 'kilr-order=\"list\"'. Please ensure this element exists in your HTML and is loaded in a timely manner.");
				}
			}
		}, 100);
	}

	/**
	 * populateOrderItem:
	 * Populates a single order item with order data
	 * @param {HTMLElement} orderItem - The order item element
	 * @param {object} order - The order data from Shopify
	 */
	function populateOrderItem(orderItem, order) {
		try {
			// Order number
			const orderNumberEl = orderItem.querySelector('[kilr-order="order-number"]');
			if (orderNumberEl) {
				const orderNumber = order.name || order.orderNumber || order.id.split('/').pop();
				if (orderNumberEl.tagName.toLowerCase() === 'input') {
					orderNumberEl.value = orderNumber;
				} else {
					orderNumberEl.textContent = orderNumber;
				}
			}
			
			// Order date
			const orderDateEl = orderItem.querySelector('[kilr-order="date"]');
			if (orderDateEl && order.processedAt) {
				const orderDate = new Date(order.processedAt).toLocaleDateString();
				if (orderDateEl.tagName.toLowerCase() === 'input') {
					orderDateEl.value = orderDate;
				} else {
					orderDateEl.textContent = orderDate;
				}
			}
			
			// Order price
			const orderPriceEl = orderItem.querySelector('[kilr-order="price"]');
			if (orderPriceEl && order.totalPrice) {
				const priceText = `${order.totalPrice.currencyCode} ${order.totalPrice.amount}`;
				if (orderPriceEl.tagName.toLowerCase() === 'input') {
					orderPriceEl.value = priceText;
				} else {
					orderPriceEl.textContent = priceText;
				}
			}
			
			// Order link
			const orderLinkEl = orderItem.querySelector('[kilr-order="link"]');
			if (orderLinkEl && order.statusUrl) {
				if (orderLinkEl.tagName.toLowerCase() === 'a') {
					// Clone the link to remove any previously attached event listeners
					const newLink = orderLinkEl.cloneNode(true);
					newLink.href = order.statusUrl;
					if (!newLink.textContent.trim()) {
						newLink.textContent = 'View Order';
					}
					// Replace the old link with the new one
					orderLinkEl.parentNode.replaceChild(newLink, orderLinkEl);
				} else if (orderLinkEl.tagName.toLowerCase() === 'input') {
					orderLinkEl.value = order.statusUrl;
				} else {
					orderLinkEl.textContent = order.statusUrl;
				}
			}
			
			console.log(`[Order List] Populated order: ${order.name || order.orderNumber}`);
			
		} catch (error) {
			console.error("[Order List] Error populating order item:", error, order);
		}
	}

	/**
	 * verifyAccessToken:
	 * Sends a GraphQL query to Shopify (via the Cloudflare Worker) using the customerAccessToken.
	 * If valid, returns the numeric portion of the customer ID and stores the price tier.
	 * Otherwise, returns null.
	 */
	async function verifyAccessToken(token, workerURL) {
		const verifyQuery = `
			query MyQuery {
				customer(customerAccessToken: "${token}") {
					id
					firstName
					lastName
					displayName
					email
					phone
					acceptsMarketing
					createdAt
					updatedAt
					defaultAddress {
						id
						firstName
						lastName
						company
						address1
						address2
						city
						province
						country
						zip
						phone
					}
					addresses(first: 10) {
						nodes {
							id
							firstName
							lastName
							company
							address1
							address2
							city
							province
							country
							zip
							phone
						}
					}
					orders(first: 50) {
						totalCount
						nodes {
							id
							name
							orderNumber
							processedAt
							totalPrice {
								amount
								currencyCode
							}
							fulfillmentStatus
							financialStatus
							statusUrl
						}
					}
					priceTier: metafield(namespace: "unleashed", key: "price_tier") {
						value
					}
					tags
				}
			}
		`;
		try {
			console.log("[DEBUG] Making fetch request to worker...");
			const response = await fetch(workerURL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ storeFrontQuery: verifyQuery, variables: {} })
			});
			console.log(`[DEBUG] Worker response status: ${response.status}`);
			const data = await response.json();
			console.log("[DEBUG] Worker response data:", data);
			
			if (data.error) {
				console.log(`[DEBUG] Worker returned error: ${data.error}`);
				return null;
			}
			if (data.responseData?.errors) {
				console.log("[DEBUG] GraphQL errors:", data.responseData.errors);
				return null;
			}
			const customerObj = data.responseData?.data?.customer;
			console.log("[DEBUG] Customer object:", customerObj);
			if (!customerObj || !customerObj.id) {
				console.log("[DEBUG] No customer found or missing ID");
				return null;
			}

			// Store the customer's price tier
			const priceTier = customerObj.priceTier ? customerObj.priceTier.value : null;
			if (priceTier) {
				console.log(`[DEBUG] Customer Price Tier Found: ${priceTier}`);
			}
			localStorage.setItem('customerPriceTier', priceTier);
			
			// Store full customer data for page population
			localStorage.setItem('customerData', JSON.stringify(customerObj));
			console.log("[DEBUG] Stored complete customer data in localStorage");
			
			// Populate page elements with customer data
			populateCustomerData(customerObj);
			
			const numericId = customerObj.id.split("/").pop();
			console.log(`[DEBUG] Verified customer numeric ID: ${numericId}`);
			return numericId;
		} catch (err) {
			console.log("[DEBUG] Exception during token verification:", err);
			return null;
		}
	}
  
	/**
	 * replaceSlugWithToken:
	 * Finds all anchor elements whose href contains ":slug", clones them, updates the href with the URL-encoded customerAccessToken,
	 * and then replaces the original element with the updated clone.
	 */
	function replaceSlugWithToken() {
		const accessToken = localStorage.getItem("customerAccessToken");
		console.debug("[replaceSlugWithToken] Access token:", accessToken);
		if (!accessToken || accessToken === "null") return;
  
		const links = document.querySelectorAll("a[href*=':slug']");
		console.debug(`[replaceSlugWithToken] Found ${links.length} link(s) with ':slug'.`);
		links.forEach(link => {
			// Use getAttribute to get the original attribute value
			const originalHref = link.getAttribute("href");
			console.debug("[replaceSlugWithToken] Original link href:", originalHref);
			const newHref = originalHref.replace(":slug", encodeURIComponent(accessToken));
			console.debug("[replaceSlugWithToken] New href:", newHref);
  
			// Clone the element and update the href attribute on the clone.
			const newLink = link.cloneNode(true);
			newLink.setAttribute("href", newHref);
			console.debug("[replaceSlugWithToken] Cloned new link with updated href:", newLink.getAttribute("href"));
  
			// Replace the original link with the new updated clone.
			link.parentNode.replaceChild(newLink, link);
			console.debug("[replaceSlugWithToken] Replaced original link with updated clone.");
		});
	}
  
	// === LOGOUT FUNCTIONALITY ===
	if (logoutButton) {
		console.debug("[Logout] Logout button found. Attaching event listener.");
		logoutButton.addEventListener("click", async function (event) {
			console.debug("[Logout] Logout button clicked.", event);
			event.preventDefault(); // Prevent default behavior in case it is an anchor.
  
			// Stage 2: Add is-loading state to the logout button and the body.
			logoutButton.classList.add("is-loading");
			bodyEl.classList.add("is-loading");
			console.debug("[Logout] Stage 2: Added 'is-loading' class to logout button and body.");
  
			try {
				// Stage 3: Retrieve the access token.
				const accessToken = localStorage.getItem("customerAccessToken");
				console.debug("[Logout] Stage 3: Retrieved access token:", accessToken);
				if (!accessToken || accessToken === "null") {
					console.warn("[Logout] Stage 3: No valid access token found. Clearing local data and redirecting.");
					clearLocalStorage();
					redirectToRoot();
					return;
				}
  
				// Stage 4: Build the logout query.
				const logoutQuery = `
					mutation MyMutation {
						customerAccessTokenDelete(customerAccessToken: "${accessToken}") {
							deletedAccessToken
							userErrors {
								message
							}
						}
					}
				`;
				console.debug("[Logout] Stage 4: Built logout query:", logoutQuery);
  
				// Stage 5: Send the logout query to Shopify.
				console.debug("[Logout] Stage 5: Sending logout query to Shopify...");
				const logoutResponse = await sendShopifyRequest(logoutQuery);
				console.debug("[Logout] Stage 5: Received logout response:", logoutResponse);
  
				// Stage 6: Check for errors in the response.
				if (logoutResponse.error) {
					console.error("[Logout Error] Stage 6: Error in logout response:", logoutResponse.error);
				}
				if (logoutResponse.responseData?.errors) {
					console.error("[Logout Error] Stage 6: Error in logout response:", logoutResponse.responseData.errors[0].message);
				}
  
				// Stage 7: Clear local storage, show login nav, and redirect.
				console.debug("[Logout] Stage 7: Clearing local storage, showing login nav, and redirecting.");
				clearLocalStorage();
				showNavigationElements(false); // Show login nav after logout
				redirectToRoot();
			} catch (error) {
				console.error("[Logout] Error during logout process:", error);
			} finally {
				// Stage 8: Remove the is-loading state.
				logoutButton.classList.remove("is-loading");
				bodyEl.classList.remove("is-loading");
				console.debug("[Logout] Stage 8: Removed 'is-loading' class from logout button and body.");
			}
		});
	} else {
		console.debug("[Logout] Logout button not found on page.");
	}
  
	/**
	 * sendShopifyRequest:
	 * Sends a GraphQL request to the Cloudflare Worker.
	 */
	async function sendShopifyRequest(query, variables = {}) {
		try {
			console.debug("[sendShopifyRequest] Sending query:", query);
			console.debug("[sendShopifyRequest] Variables:", variables);
			const response = await fetch(cloudflareWorkerURL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ storeFrontQuery: query, variables: variables })
			});
			const rawResponse = await response.text();
			console.debug("[sendShopifyRequest] Raw response:", rawResponse);
			return JSON.parse(rawResponse);
		} catch (error) {
			console.error("[sendShopifyRequest] Request to Cloudflare Worker failed:", error);
			return { error: "Request to Cloudflare Worker failed." };
		}
	}

  
	/**
	 * clearLocalStorage:
	 * Clears customer authentication data from localStorage.
	 * Uses the integrated storage manager for comprehensive cleanup.
	 */
	function clearLocalStorage() {
		console.debug("[clearLocalStorage] Using storage manager for comprehensive cleanup.");
		return clearCustomerData();
	}
  
	/**
	 * redirectToRoot:
	 * Redirects the user to the root domain.
	 */
	function redirectToRoot() {
		console.debug("[redirectToRoot] Redirecting to the homepage.");
		window.location.href = "/";
	}

	// Re-populate data on tab clicks, as some tab components (like Radix) can re-render content
	document.body.addEventListener('click', function(e) {
		const tabTrigger = e.target.closest('[role="tab"]');
		if (tabTrigger) {
			console.debug("[User Account] Tab click detected, attempting to re-populate data.");
			// Use a timeout to allow the tab content to be rendered before populating
			setTimeout(() => {
				const customerDataString = localStorage.getItem("customerData");
				if (customerDataString) {
					try {
						const customerData = JSON.parse(customerDataString);
						console.debug("[User Account] Re-populating data from localStorage.");
						populateCustomerData(customerData);
					} catch (error) {
						console.error("[User Account] Failed to parse customer data from localStorage for re-population:", error);
					}
				} else {
					console.debug("[User Account] No customer data found in localStorage to re-populate.");
				}
			}, 150); // 150ms delay, adjustable if content renders slower
		}
	});
});
  
  
  