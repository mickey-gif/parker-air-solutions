//version 1.0.1
document.addEventListener("DOMContentLoaded", function () {
    // DOM elements
    const recoveryEmailInput = document.querySelector('[kilr-account="recover-email"]');
    const recoverButton = document.querySelector('[kilr-account="recover-submit"]');
    const errorDisplay = document.querySelector('[kilr-account="recover-error"]');

    // Your Cloudflare Worker URL
    const cloudflareWorkerURL = "https://kilr-headless-shopify-query.adrian-b0e.workers.dev/";

    // Hide error display by default
    if (errorDisplay) {
        errorDisplay.style.display = "none";
    }

    // Listen for click on recover button
    recoverButton.addEventListener("click", async function () {
        clearError();
        recoverButton.classList.add("is-loading");

        try {
            const email = (recoveryEmailInput.value || "").trim();
            const redirectPage = recoverButton.getAttribute("data-recover-redirect");

            // === 1) Send the recovery request ===
            const recoveryQuery = `
              mutation MyMutation {
                customerRecover(email: "${email}") {
                  customerUserErrors {
                    code
                    field
                    message
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `;

            const recoveryResponse = await sendShopifyRequest(recoveryQuery);

            // Check for Worker-level or GraphQL-level errors
            if (recoveryResponse.error) {
                showError(recoveryResponse.error);
                return;
            }
            if (recoveryResponse.responseData?.errors) {
                showError(recoveryResponse.responseData.errors[0].message);
                return;
            }

            // Parse out any user errors
            const result = recoveryResponse.responseData.data.customerRecover;

            // Check for 'customerUserErrors'
            if (result.customerUserErrors && result.customerUserErrors.length > 0) {
                showError(result.customerUserErrors[0].message);
                return;
            }
            // Check for 'userErrors'
            if (result.userErrors && result.userErrors.length > 0) {
                showError(result.userErrors[0].message);
                return;
            }

            // === 2) Success: Shopify sends a recovery email to the user ===
            // Optionally redirect
            if (redirectPage) {
                window.location.href = `https://${window.location.hostname}/${redirectPage}`;
            }
        } catch (error) {
            console.error("[Recover Error]", error);
            showError("An unexpected error occurred. Please try again.");
        } finally {
            recoverButton.classList.remove("is-loading");
        }
    });

    // Helper: Send GraphQL query to Cloudflare Worker
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

    // Helper: Show error message
    function showError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = "block";
        }
    }

    // Helper: Clear any existing error
    function clearError() {
        if (errorDisplay) {
            errorDisplay.textContent = "";
            errorDisplay.style.display = "none";
        }
    }
});
