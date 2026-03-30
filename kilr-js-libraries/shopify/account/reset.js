
//version 1.0.3
document.addEventListener("DOMContentLoaded", function () {
    // 1) Identify DOM elements
    const newPasswordInput = document.querySelector('[kilr-account="new-password"]');
    const confirmPasswordInput = document.querySelector('[kilr-account="confirm-password"]');
    const resetButton = document.querySelector('[kilr-account="reset-submit"]');
    const errorDisplay = document.querySelector('[kilr-account="reset-error"]');

    // 2) Cloudflare Worker URL
    const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";

    // 3) Parse URL params for `id` and `token` (e.g. ?id=12345&token=abc123)
    const urlParams = new URLSearchParams(window.location.search);
    const numericId = urlParams.get("id");       // e.g. 12345
    const resetToken = urlParams.get("token");   // e.g. abc123

    // Construct the full GID from numericId
    const customerGID = numericId ? `gid://shopify/Customer/${numericId}` : null;

    // 4) If missing id or token, we can't proceed
    if (!customerGID || !resetToken) {
        showError("Missing or invalid 'id' or 'token' in the URL.");
        return;
    }

    // Initialize localStorage keys if needed
    if (!localStorage.getItem("customerAccessToken")) {
        localStorage.setItem("customerAccessToken", null);
    }
    if (!localStorage.getItem("customerId")) {
        localStorage.setItem("customerId", null);
    }

    // Hide error display initially
    if (errorDisplay) {
        errorDisplay.style.display = "none";
    }

    // 5) Handle reset button click
    resetButton.addEventListener("click", async function () {
        clearError();
        resetButton.classList.add("is-loading");

        try {
            const newPassword = (newPasswordInput.value || "").trim();
            const confirmPassword = (confirmPasswordInput.value || "").trim();

            // Validate matching passwords
            if (newPassword !== confirmPassword) {
                showError("Passwords do not match. Please confirm your password correctly.");
                return;
            }

            // Validate password strength
            if (!validatePassword(newPassword)) {
                showError("Password must be at least 8 characters long, include an uppercase letter, a lowercase letter, a number, and a special character.");
                return;
            }

            // === 6) Run "customerReset" mutation ===
            // Pass the GID, resetToken, and new password.
            const resetQuery = `
              mutation MyMutation {
                customerReset(
                  id: "${customerGID}",
                  input: { resetToken: "${resetToken}", password: "${newPassword}" }
                ) {
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

            const resetResponse = await sendShopifyRequest(resetQuery);

            // Check Worker-level or GraphQL errors
            if (resetResponse.error) {
                showError(resetResponse.error);
                return;
            }
            if (resetResponse.responseData?.errors) {
                showError(resetResponse.responseData.errors[0].message);
                return;
            }

            const resetData = resetResponse.responseData.data.customerReset;

            // If Shopify returns any user errors
            if (resetData.customerUserErrors && resetData.customerUserErrors.length > 0) {
                showError(resetData.customerUserErrors[0].message);
                return;
            }

            // Ensure we got a token
            if (!resetData.customerAccessToken) {
                showError("No access token returned after reset. Please try again.");
                return;
            }

            // Store the new access token
            const tokenObj = resetData.customerAccessToken;
            localStorage.setItem("customerAccessToken", tokenObj.accessToken);

            // === 7) Fetch the customer ID using the new token ===
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

            const customerObj = customerDataResponse.responseData.data.customer;
            if (!customerObj) {
                showError("Failed to retrieve customer data with the new token.");
                return;
            }

            // Extract numeric ID from "gid://shopify/Customer/12345"
            const updatedCustomerId = customerObj.id.split("/").pop();
            localStorage.setItem("customerId", updatedCustomerId);

            // === 8) Redirect ===
            window.location.href = `https://${window.location.hostname}/account/dashboard?token=${tokenObj.accessToken}`;

        } catch (error) {
            console.error("[Reset Error]", error);
            showError("An unexpected error occurred. Please try again.");
        } finally {
            resetButton.classList.remove("is-loading");
        }
    });

    /**
     * Helper: Send a GraphQL query to the Cloudflare Worker
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
     * Helper: Validate password complexity
     */
    function validatePassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    /**
     * Helper: Display error message
     */
    function showError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = "block";
        }
    }

    /**
     * Helper: Clear any existing error
     */
    function clearError() {
        if (errorDisplay) {
            errorDisplay.textContent = "";
            errorDisplay.style.display = "none";
        }
    }
});
