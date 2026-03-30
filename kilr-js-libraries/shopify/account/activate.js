//Version 1.1.3
document.addEventListener("DOMContentLoaded", function () {
    // References to DOM elements
    const activationPasswordInput = document.querySelector('[kilr-account="activate-password"]');
    const setPasswordButton = document.querySelector('[kilr-account="activate-submit"]');
    const errorDisplay = document.querySelector('[kilr-account="activate-error"]');
    
    // Reference to the login redirect element
    const loginRedirectElement = document.querySelector('[kilr-account="login-redirect"]');

    // Your Cloudflare Worker URL
    const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";

    // 1) Get "id" (numeric GID portion) & "token" (activation token) from URL
    const urlParams = new URLSearchParams(window.location.search);
    const activationId = urlParams.get("id");
    const activationToken = urlParams.get("token");

    // Validate required params (this error is not from a Shopify query)
    if (!activationId || !activationToken) {
        showError("Missing or invalid 'id' or 'token' in the URL.");
        return;
    }

    // Construct the Customer GID from numeric ID
    const customerGID = `gid://shopify/Customer/${activationId}`;

    // Initialize localStorage if needed
    if (!localStorage.getItem("customerAccessToken")) {
        localStorage.setItem("customerAccessToken", null);
    }
    if (!localStorage.getItem("customerId")) {
        localStorage.setItem("customerId", null);
    }

    // Hide error display by default
    if (errorDisplay) {
        errorDisplay.style.display = "none";
    }

    // 2) Handle click of the "Set Password" button
    setPasswordButton.addEventListener("click", async function () {
        clearError();
        setPasswordButton.classList.add("is-loading");

        try {
            const password = activationPasswordInput.value.trim();

            // Validate password (client-side; not from Shopify query)
            if (!validatePassword(password)) {
                showError("Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.");
                return;
            }

            // === ACTIVATE CUSTOMER ===
            const activateQuery = `
              mutation MyMutation {
                customerActivate(
                  input: { activationToken: "${activationToken}", password: "${password}" }
                  id: "${customerGID}"
                ) {
                  customerAccessToken {
                    accessToken
                    expiresAt
                  }
                }
              }
            `;

            const activationResponse = await sendShopifyRequest(activateQuery);

            // Check Worker-level errors from Shopify query
            if (activationResponse.error) {
                showError(activationResponse.error, true);
                return;
            }

            // Check GraphQL errors from Shopify query
            if (activationResponse.responseData?.errors) {
                showError(activationResponse.responseData.errors[0].message, true);
                return;
            }

            // Extract the customer access token
            const tokenObj = activationResponse.responseData.data.customerActivate.customerAccessToken;
            if (!tokenObj) {
                showError("Failed to activate account. No access token returned.", true);
                return;
            }

            // Store the new access token
            localStorage.setItem("customerAccessToken", tokenObj.accessToken);

            // === RETRIEVE CUSTOMER DATA ===
            const customerDataQuery = `
              query MyQuery {
                customer(customerAccessToken: "${tokenObj.accessToken}") {
                  id
                }
              }
            `;
            const customerDataResponse = await sendShopifyRequest(customerDataQuery);

            if (customerDataResponse.error) {
                showError(customerDataResponse.error, true);
                return;
            }
            if (customerDataResponse.responseData?.errors) {
                showError(customerDataResponse.responseData.errors[0].message, true);
                return;
            }

            // Extract numeric ID from returned GID
            const customerIdGID = customerDataResponse.responseData.data.customer.id;
            const customerId = customerIdGID.split("/").pop();
            localStorage.setItem("customerId", customerId);

            // Redirect to the account dashboard
            window.location.href = `https://${window.location.hostname}/account/dashboard?customerAccessToken=${tokenObj.accessToken}`;
        } catch (error) {
            showError("An unexpected error occurred. Please try again.", true);
        } finally {
            setPasswordButton.classList.remove("is-loading");
        }
    });

    /**
     * Send a GraphQL query to the Cloudflare Worker
     */
    async function sendShopifyRequest(query) {
        try {
            const response = await fetch(cloudflareWorkerURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeFrontQuery: query, variables: {} })
            });

            const rawResponse = await response.text();
            return JSON.parse(rawResponse);
        } catch {
            return { error: "Request to Cloudflare Worker failed." };
        }
    }

    /**
     * Validate password (8+ chars, uppercase, lowercase, digit, special char)
     */
    function validatePassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    /**
     * Show error message in the DOM.
     * If hideSubmit is true (i.e. the error is from a Shopify query), also add the 'is-hidden' class
     * to the setPasswordButton and add 'is-active' to the login redirect element.
     */
    function showError(message, hideSubmit = false) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = "block";
        }
        if (loginRedirectElement) {
            loginRedirectElement.classList.add("is-active");
        }
        if (hideSubmit && setPasswordButton) {
            setPasswordButton.classList.add("is-hidden");
        }
    }

    /**
     * Clear any existing error message and remove the active/hidden state from UI elements.
     */
    function clearError() {
        if (errorDisplay) {
            errorDisplay.textContent = "";
            errorDisplay.style.display = "none";
        }
        if (loginRedirectElement) {
            loginRedirectElement.classList.remove("is-active");
        }
        if (setPasswordButton) {
            setPasswordButton.classList.remove("is-hidden");
        }
    }
});
