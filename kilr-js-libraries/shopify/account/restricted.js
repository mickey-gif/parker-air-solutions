// Version 1.5.0 - User Account Management + Storage Cleanup + Dashboard Access + Customer Data Population + Logout Handling + Dynamic Slug Replacement + URL Token Check + Customer Price Tier + Navigation Visibility

document.addEventListener("DOMContentLoaded", async function () {
	const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/"; // Your Cloudflare Worker URL
	const bodyEl = document.querySelector("body");
	const logoutButton = document.querySelector('[kilr-account="logout-submit"]');
  
	console.debug("[User Account] Starting user account management script...");

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
		
		return removedCount;
	}

	function validateAndCleanupStorage() {
		console.log("[Storage Manager] Running data validation...");
		
		if (!hasValidToken()) {
			console.log("[Storage Manager] Invalid or missing token detected. Initiating cleanup...");
			clearCustomerData();
			return false; // Token invalid, data cleaned
		}
		
		console.log("[Storage Manager] Token validation passed. Data integrity maintained.");
		return true; // Token valid
	}

	function initializeStorageManager() {
		console.log("[Storage Manager] Initializing storage cleanup and validation...");
		
		// Perform initial cleanup check
		validateAndCleanupStorage();
		
		// Set up periodic validation (every 30 seconds)
		setInterval(() => {
			validateAndCleanupStorage();
		}, 30000);
		
		console.log("[Storage Manager] Automatic cleanup monitoring enabled (30s intervals).");
		
		// Make functions globally available
		window.KilrStorageManager = {
			hasValidToken,
			clearCustomerData,
			validateAndCleanup: validateAndCleanupStorage
		};
	}

	// Initialize storage cleanup and validation
	initializeStorageManager();
  
	// 0) Seed localStorage from URL query token if present (?token= or ?customerAccessToken=)
	const queryParams = new URLSearchParams(window.location.search);
	const queryToken = queryParams.get("token") || queryParams.get("customerAccessToken");
	console.log(`[DEBUG] Current URL: ${window.location.href}`);
	console.log(`[DEBUG] Query token found: ${queryToken}`);
	if (queryToken) {
		console.log("[DEBUG] Found token in query params. Seeding localStorage.");
		localStorage.setItem("customerAccessToken", queryToken);
	}
  
	// 1) Check if the body is marked as dashboard.
	if (!bodyEl || !bodyEl.matches('[kilr-account="dashboard"]')) {
		console.log("[DEBUG] Body is not marked as dashboard. Exiting script.");
		return; // If body is not dashboard, do nothing
	}
  
	// 2) Lock the page visually by adding "is-loading" to the body.
	console.debug("[Page Load] Adding 'is-loading' class to body.");
	bodyEl.classList.add("is-loading");
  
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
  
	// 4) Retrieve the access token and customerId from localStorage.
	const token = localStorage.getItem("customerAccessToken");
	const storedCustomerId = localStorage.getItem("customerId");
	console.log(`[DEBUG] Retrieved token from localStorage: ${token}`);
	console.log(`[DEBUG] Retrieved customerId from localStorage: ${storedCustomerId}`);
  
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
			bodyEl.classList.remove("is-loading");
			bodyEl.removeAttribute("kilr-account");
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
	 * Populates page elements with customer data using kilr-customer attributes.
	 * @param {object} customerData - The customer object from Shopify
	 */
	function populateCustomerData(customerData) {
		console.log("[DEBUG] Starting customer data population...");
		
		try {
			// Basic customer information
			populateElement('[kilr-customer="first-name"]', customerData.firstName);
			populateElement('[kilr-customer="last-name"]', customerData.lastName);
			populateElement('[kilr-customer="display-name"]', customerData.displayName);
			populateElement('[kilr-customer="full-name"]', `${customerData.firstName || ''} ${customerData.lastName || ''}`.trim());
			populateElement('[kilr-customer="email"]', customerData.email);
			populateElement('[kilr-customer="phone"]', customerData.phone);
			populateElement('[kilr-customer="price-tier"]', customerData.priceTier?.value);
			populateElement('[kilr-customer="tags"]', customerData.tags?.join(', '));
			
			// Dates (formatted)
			if (customerData.createdAt) {
				const createdDate = new Date(customerData.createdAt);
				populateElement('[kilr-customer="created-at"]', createdDate.toLocaleDateString());
				populateElement('[kilr-customer="member-since"]', createdDate.getFullYear().toString());
			}
			
			// Default address
			if (customerData.defaultAddress) {
				const addr = customerData.defaultAddress;
				populateElement('[kilr-customer="address-name"]', `${addr.firstName || ''} ${addr.lastName || ''}`.trim());
				populateElement('[kilr-customer="address-company"]', addr.company);
				populateElement('[kilr-customer="address-line1"]', addr.address1);
				populateElement('[kilr-customer="address-line2"]', addr.address2);
				populateElement('[kilr-customer="address-city"]', addr.city);
				populateElement('[kilr-customer="address-province"]', addr.province);
				populateElement('[kilr-customer="address-country"]', addr.country);
				populateElement('[kilr-customer="address-zip"]', addr.zip);
				populateElement('[kilr-customer="address-phone"]', addr.phone);
				
				// Full formatted address
				const fullAddress = [
					addr.address1,
					addr.address2,
					addr.city,
					addr.province,
					addr.zip,
					addr.country
				].filter(Boolean).join(', ');
				populateElement('[kilr-customer="address-full"]', fullAddress);
			}
			
			// Order statistics
			if (customerData.orders) {
				populateElement('[kilr-customer="order-count"]', customerData.orders.totalCount?.toString());
				
				// Recent orders
				if (customerData.orders.nodes && customerData.orders.nodes.length > 0) {
					const recentOrder = customerData.orders.nodes[0];
					populateElement('[kilr-customer="last-order-number"]', recentOrder.name || recentOrder.orderNumber);
					populateElement('[kilr-customer="last-order-total"]', recentOrder.totalPrice?.amount);
					populateElement('[kilr-customer="last-order-status"]', recentOrder.fulfillmentStatus);
					
					if (recentOrder.processedAt) {
						const orderDate = new Date(recentOrder.processedAt);
						populateElement('[kilr-customer="last-order-date"]', orderDate.toLocaleDateString());
					}
				}
			}
			
			// Marketing preferences
			populateElement('[kilr-customer="accepts-marketing"]', customerData.acceptsMarketing ? 'Yes' : 'No');
			
			console.log("[DEBUG] Customer data population completed");
			
		} catch (error) {
			console.error("[DEBUG] Error populating customer data:", error);
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
					orders(first: 10) {
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
	 * showNavigationElements:
	 * Shows/hides navigation elements based on authentication status.
	 * @param {boolean} isLoggedIn - Whether the user is logged in
	 */
	function showNavigationElements(isLoggedIn) {
		const loginNav = document.querySelector('[kilr-account="nav-login"]');
		const accountNav = document.querySelector('[kilr-account="nav-account"]');
		
		console.debug(`[showNavigationElements] Setting navigation visibility. User logged in: ${isLoggedIn}`);
		
		if (isLoggedIn) {
			// User is logged in - show account nav, hide login nav
			if (loginNav) {
				loginNav.style.display = 'none';
				console.debug('[showNavigationElements] Hidden login nav element');
			}
			if (accountNav) {
				accountNav.style.display = '';
				console.debug('[showNavigationElements] Shown account nav element');
			}
		} else {
			// User is not logged in - show login nav, hide account nav
			if (accountNav) {
				accountNav.style.display = 'none';
				console.debug('[showNavigationElements] Hidden account nav element');
			}
			if (loginNav) {
				loginNav.style.display = '';
				console.debug('[showNavigationElements] Shown login nav element');
			}
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
	async function sendShopifyRequest(query) {
		try {
			console.debug("[sendShopifyRequest] Sending query:", query);
			const response = await fetch(cloudflareWorkerURL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ storeFrontQuery: query, variables: {} })
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
	 */
	function clearLocalStorage() {
		console.debug("[clearLocalStorage] Clearing customerAccessToken, customerId, and customerPriceTier from localStorage.");
		localStorage.removeItem("customerAccessToken");
		localStorage.removeItem("customerId");
		localStorage.removeItem("customerPriceTier");
	}
  
	/**
	 * redirectToRoot:
	 * Redirects the user to the root domain.
	 */
	function redirectToRoot() {
		console.debug("[redirectToRoot] Redirecting to the homepage.");
		window.location.href = "/";
	}
});
  
  
  