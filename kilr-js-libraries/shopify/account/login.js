//version 1.0.3
document.addEventListener("DOMContentLoaded", function () {
    // Identify the relevant DOM elements
    const emailInput = document.querySelector('[kilr-account="login-email"]');
    const passwordInput = document.querySelector('[kilr-account="login-password"]');
    const loginButton = document.querySelector('[kilr-account="login-submit"]');
    const errorDisplay = document.querySelector('[kilr-account="login-error"]');

    // Cloudflare Worker endpoint
    const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";

    // Hide error display initially
    if (errorDisplay) {
        errorDisplay.style.display = "none";
    }

    // Initialize localStorage keys if not set
    if (!localStorage.getItem("customerAccessToken")) {
        localStorage.setItem("customerAccessToken", null);
    }
    if (!localStorage.getItem("customerId")) {
        localStorage.setItem("customerId", null);
    }

    // Check if an access token already exists and redirect
    const existingToken = localStorage.getItem("customerAccessToken");
    if (existingToken && existingToken !== "null") {
        window.location.href = `https://${window.location.hostname}/account/dashboard?token=${existingToken}`;
        return; // Stop further execution
    }

    // Listen for login button click
    loginButton.addEventListener("click", async function () {
        clearError();
        loginButton.classList.add("is-loading");

        try {
            const email = (emailInput.value || "").trim();
            const password = (passwordInput.value || "").trim();

            // === 1) Create Customer Access Token ===
            const createTokenQuery = `
                mutation MyMutation {
                    customerAccessTokenCreate(input: { email: "${email}", password: "${password}" }) {
                        customerAccessToken {
                            accessToken
                            expiresAt
                        }
                        customerUserErrors {
                            code
                            field
                            message
                        }
                    }
                }
            `;

            const tokenResponse = await sendShopifyRequest(createTokenQuery);

            // Check for Worker-level or GraphQL-level errors
            if (tokenResponse.error) {
                showError(tokenResponse.error);
                return;
            }
            if (tokenResponse.responseData?.errors) {
                showError(tokenResponse.responseData.errors[0].message);
                return;
            }

            const result = tokenResponse.responseData.data.customerAccessTokenCreate;
            // If the mutation returned user errors
            if (result.customerUserErrors && result.customerUserErrors.length > 0) {
                showError(result.customerUserErrors[0].message);
                return;
            }

            // Ensure the token was returned
            if (!result.customerAccessToken) {
                showError("No access token returned. Please check your credentials.");
                return;
            }

            // Store the accessToken
            const tokenObj = result.customerAccessToken;
            localStorage.setItem("customerAccessToken", tokenObj.accessToken);

            // === 2) Retrieve the Customer ID ===
            const getCustomerQuery = `
                query MyQuery {
                    customer(customerAccessToken: "${tokenObj.accessToken}") {
                        id
                    }
                }
            `;
            const customerDataResponse = await sendShopifyRequest(getCustomerQuery);
            if (customerDataResponse.error) {
                showError(customerDataResponse.error);
                return;
            }
            if (customerDataResponse.responseData?.errors) {
                showError(customerDataResponse.responseData.errors[0].message);
                return;
            }

            const customerData = customerDataResponse.responseData.data.customer;
            if (!customerData) {
                showError("Could not retrieve customer data with the provided token.");
                return;
            }

            // Extract numeric ID from "gid://shopify/Customer/12345"
            const customerId = customerData.id.split("/").pop();
            localStorage.setItem("customerId", customerId);

            // === 3) Redirect ===
            window.location.href = `https://${window.location.hostname}/account/dashboard?token=${tokenObj.accessToken}`;

        } catch (error) {
            console.error("[Login Error]", error);
            showError("An unexpected error occurred. Please try again.");
        } finally {
            loginButton.classList.remove("is-loading");
        }
    });

    /**
     * Sends a GraphQL request to the Cloudflare Worker
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
     * Helper to show an error
     */
    function showError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = "block";
        }
    }

    /**
     * Helper to clear errors
     */
    function clearError() {
        if (errorDisplay) {
            errorDisplay.textContent = "";
            errorDisplay.style.display = "none";
        }
    }
});
