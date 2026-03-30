/* version 1.4.4 */

$(document).ready(function() {
    // Define the missing variables
    let option1SelectedValue = '';
    let option2SelectedValue = '';
    let option3SelectedValue = '';
    let variantQuantity = 1;
    let currentVariant = null;
    let cart = [];
    $('[kilr_shopify="object_information"]').css('display', 'none');
    $('[kilr_shopify="add-to-cart"]').css('display', 'none');
    $('[kilr_shopify="cart_object-counter"]').text(cart.length);
    var selectedOptions = {
        optionKeys: {},
        subOptionValues: {}
    };

    // Function to store the selected option key and values
    function storeSelectedOption(optionNumber, optionKey, subOptionValues) {
        selectedOptions.optionKeys[optionNumber] = optionKey;
        selectedOptions.subOptionValues[optionNumber] = subOptionValues;
    }

    // Function to update the hero image
    function updateHeroImage(imageSrc, imageSrcset) {
        var heroImage = $('[kilr_shopify="hero-image"]');
        heroImage.fadeOut(400, function() {
            heroImage.attr('src', imageSrc);
            // Update the srcset attribute if provided, otherwise clear it
            if (imageSrcset) {
                heroImage.attr('srcset', imageSrcset);
            } else {
                heroImage.removeAttr('srcset');
            }
            heroImage.fadeIn(400);
        });
    }

    // Initialize the hero image with the first gallery image
    var firstGalleryImage = $('[kilr_shopify="gallery-item"]:first [kilr_shopify="gallery-image"]');
    updateHeroImage(firstGalleryImage.attr('src'), firstGalleryImage.attr('srcset'));

    // Set the first gallery-item to have the active state
    $('[kilr_shopify="gallery-item"]:first').addClass('image-is-active');

    // Using event delegation for dynamically added elements
    $(document).on('click', '[kilr_shopify="gallery-item"]', function() {
        var galleryImage = $(this).find('[kilr_shopify="gallery-image"]');
        var galleryImageSrc = galleryImage.attr('src');
        var galleryImageSrcset = galleryImage.attr('srcset');

        // Update the hero image with the selected gallery image
        updateHeroImage(galleryImageSrc, galleryImageSrcset);

        // Update the active state of the gallery items
        $('[kilr_shopify="gallery-item"]').removeClass('image-is-active');
        $(this).addClass('image-is-active');
    });

    // Handling mouseover and mouseout events
    $(document).on('mouseover', '[kilr_shopify="gallery-item"]', function() {
        $(this).addClass('mouse-is-over');
    }).on('mouseout', '[kilr_shopify="gallery-item"]', function() {
        $(this).removeClass('mouse-is-over');
    });

   // Function to automatically select the first option in each variant options list
   function autoSelectFirstOptions() {
    $('[kilr_shopify="options"]').each(function() {
        if ($(this).attr('option-auto-select') === 'true') {
            console.log('Auto-selecting first option for:', $(this));
            $(this).find('[kilr_shopify^="variant_option-"]').each(function(i) {
                console.log('Selecting the first option in this list:', $(this));
                $(this).children().first().trigger('click');
            });
        }
    });
}

// Call the function to automatically select first options if option-auto-select is true
autoSelectFirstOptions();

    // Hide the comma in the last item of the applications list
    $('[kilr_shopify="applications"] [kilr_shopify="application"]:last-child [kilr_shopify="comma"]').css('display', 'none');

    // Function to get the appropriate template based on the header text of the option
    function getTemplateForOption(headerText) {
        let selectedTemplate = null;
        let headerTextLower = headerText.toLowerCase(); // Convert header text to lowercase
        $('[kilr_shopify="option-templates"] [kilr_shopify_option-template]').each(function() {
            const templateValues = $(this).attr('kilr_shopify_option-template').toLowerCase().split(', ');
            if (templateValues.includes(headerTextLower)) { // Compare both in lowercase
                selectedTemplate = $(this).clone();
                return false; // break out of each loop
            }
        });
        if (selectedTemplate === null) {
            console.warn(`No template found for header text: ${headerText}`);
        }
        return selectedTemplate;
    }

    // Get the limit value from the kilr_shopify-limit attribute
    let limitValue = parseInt($('[kilr_shopify-limit]').attr('kilr_shopify-limit'));
    async function loadCart() {
        let cartData = await Wized.data.get("c.cart");
        if (!cartData) {
            cart = [];
        } else {
            cart = JSON.parse(cartData);
        }
    }

    for (let i = 1; i <= 3; i++) {
        let values = $(`[kilr_shopify='product_option-${i}-values']`).text().split(', ');
        let parent = $(`[kilr_shopify='variant_option-${i}_list']`);
    
        // Find the ancestor element with kilr_shopify_option attribute
        let optionValue = parent.closest('[kilr_shopify_option]').attr('kilr_shopify_option');
    
        // Find the appropriate template
        let template = null;
        $('[kilr_shopify_option-template]').each(function() {
            let templateOptions = $(this).attr('kilr_shopify_option-template').split(', ');
    
            // Checking if the template is applicable for the current option
            if (templateOptions.includes(optionValue)) {
                template = $(this).clone().removeAttr('kilr_shopify_option-template');
                return false; // Break the loop
            }
        });
    
        // Fallback to the default template if no specific match is found
        if (!template) {
            template = $('[kilr_shopify_option-template="default"]').clone().removeAttr('kilr_shopify_option-template');
            if (!template.length) {
                console.error(`No default template found for option ${optionValue}`);
                continue;
            }
        }


        values.forEach((value, index) => {
            let clonedTemplate = template.clone();
            clonedTemplate.find(`[kilr_shopify='option-x_value']`).text(value).attr('kilr_shopify', `option-${i}_value`);

            // Event handler for the cloned template
            clonedTemplate.click(function() {
                $(this).addClass('is-active');
                $(this).siblings().removeClass('is-active');

                switch (i) {
                    case 1:
                        option1SelectedValue = $(this).text();
                        break;
                    case 2:
                        option2SelectedValue = $(this).text();
                        break;
                    case 3:
                        option3SelectedValue = $(this).text();
                        break;
                }

                $(`[kilr_shopify='option-${i}_title-element']`).text($(this).text());

                $('[kilr_shopify="variant_data"]').each(function() {
                    let option1Value = $(this).find('[kilr_shopify="variant_option-1-value"]').text();
                    let option2Value = $(this).find('[kilr_shopify="variant_option-2-value"]').text();
                    let option3Value = $(this).find('[kilr_shopify="variant_option-3-value"]').text();

                    if (option1Value === option1SelectedValue && option2Value === option2SelectedValue && option3Value === option3SelectedValue) {
                        let variantObject = {
                            gid: $(this).find('[kilr_shopify="variant_gid"]').text(),
                            src: $(this).find('[kilr_shopify="variant_image"]').attr('src'),
                            srcset: $(this).find('[kilr_shopify="variant_image"]').attr('srcset'),
                            price: $(this).find('[kilr_shopify="variant_price"]').text(),
                            title: $(this).find('[kilr_shopify="variant_title"]').text(),
                            qty: variantQuantity
                        };
                        if ($('[kilr_shopify="limit"]').text() === 'true') {
                            variantObject.limit = limitValue;
                        }

                        let totalPrice = variantQuantity * parseFloat(variantObject.price);
                        $('[kilr_shopify="product_price"]').text(`$${totalPrice.toFixed(2)}`);
                        currentVariant = variantObject;

                        // Show object_information element
                        $('[kilr_shopify="object_information"]').css('display', 'flex');
                        $('[kilr_shopify="add-to-cart"]').css('display', 'block');

                        // Check if the variantQuantity has reached the limit value
                        if ($('[kilr_shopify="limit"]').text() === 'true' && variantQuantity >= limitValue) {
                            $('[kilr_shopify="quantity_inc"]').hide();
                        }

                        // Update the hero image with the selected variant's image
                        updateHeroImage(variantObject.src, variantObject.srcset);
                    }
                });
            });

            parent.append(clonedTemplate);
        });

        if (i === 1) {
            let firstVariantPrice = $('[kilr_shopify="variant_data"]').first().find('[kilr_shopify="variant_price"]').text();
            $('[kilr_shopify="product_price"]').text(`$${firstVariantPrice}`);
        }
    }

    $('[kilr_shopify="quantity_inc"]').click(function() {
        variantQuantity++;
        $('[kilr_shopify="variant_quantity"]').text(variantQuantity);
        if (currentVariant) {
            currentVariant.qty = variantQuantity;
            let totalPrice = variantQuantity * parseFloat(currentVariant.price);
            $('[kilr_shopify="product_price"]').text(`$${totalPrice.toFixed(2)}`);
        }

        // Check if the variantQuantity has reached the limit value
        if ($('[kilr_shopify="limit"]').text() === 'true' && variantQuantity >= limitValue) {
            $('[kilr_shopify="quantity_inc"]').hide();
        }
    });

    $('[kilr_shopify="quantity_dec"]').click(function() {
        if (variantQuantity > 1) {
            variantQuantity--;
            $('[kilr_shopify="variant_quantity"]').text(variantQuantity);
            if (currentVariant) {
                currentVariant.qty = variantQuantity;
                let totalPrice = variantQuantity * parseFloat(currentVariant.price);
                $('[kilr_shopify="product_price"]').text(`$${totalPrice.toFixed(2)}`);
            }

            // Check if the variantQuantity is less than the limit value
            if ($('[kilr_shopify="limit"]').text() === 'true' && variantQuantity < limitValue) {
                $('[kilr_shopify="quantity_inc"]').show();
            }
        }
    });
    // "Add to Cart" click handler to format sub-options as customAttributes
    $('[kilr_shopify="add-to-cart"]').click(async function() {
        const addToCartButton = $(this);
        addToCartButton.text("Adding to Cart..."); // Change button text to 'Adding to Cart...'

        await loadCart();

        // Check if the variantQuantity exceeds the limit value
        if ($('[kilr_shopify="limit"]').text() === 'true' && variantQuantity > limitValue) {
            variantQuantity = limitValue;
            $('[kilr_shopify="variant_quantity"]').text(variantQuantity);
            if (currentVariant) {
                currentVariant.qty = variantQuantity;
                let totalPrice = variantQuantity * parseFloat(currentVariant.price);
                $('[kilr_shopify="product_price"]').text(`$${totalPrice.toFixed(2)}`);
            }
        }

        // Format sub-option data to the variant object before updating the cart
        if (currentVariant) {
            // Initialize customAttributes as an empty array
            currentVariant.customAttributes = [];

            // Loop over selected options and format them as customAttributes
            Object.keys(selectedOptions.optionKeys).forEach(optionNumber => {
                let optionKey = selectedOptions.optionKeys[optionNumber];
                let subOptionValue = selectedOptions.subOptionValues[optionNumber];
                if (optionKey && subOptionValue) {
                    // Push an object with key and value to the customAttributes array
                    currentVariant.customAttributes.push({
                        key: optionKey,
                        value: subOptionValue
                    });
                }
            });

            // Update cart with new variant object
            updateCart(currentVariant);
        }

        setTimeout(function() {
            addToCartButton.text("Added to Cart"); // Change button text to 'Added to Cart' after 1000ms
        }, 1000);
    });

    // Reset the text on the add-to-cart button when quantity is changed or a different variant is selected
    $('[kilr_shopify="quantity_inc"], [kilr_shopify="quantity_dec"]').click(function() {
        $('[kilr_shopify="add-to-cart"]').text("Add to Cart");
    });

    // Handling the event when an option value or its parent is selected
    $(document).on('click', '.option-button', function() {
        var optionElement = $(this).find('[kilr_shopify^="option-"][kilr_shopify$="_value"]');

        if (optionElement.length) {
            var optionValue = optionElement.text();
            var optionNumber = optionElement.attr('kilr_shopify').match(/\d+/)[0]; // Extract the option number (1, 2, or 3)
            var ancestorOptionElement = optionElement.closest('[kilr_shopify_option]');
            var optionKey = ancestorOptionElement.attr('kilr_shopify_option');
            console.log('Option selected:', optionValue, 'for option number:', optionNumber);

            // Clear the previous sub-options from the matching kilr_shopify=sub-option element
            var subOptionsContainer = ancestorOptionElement.find('[kilr_shopify="sub-option"]');
            subOptionsContainer.empty();

            // Find and clone the sub-option element
            var subOptions = [];
            $('[kilr_shopify_sub-option]').each(function() {
                if ($(this).attr('kilr_shopify_sub-option') === optionValue) {
                    console.log('Sub-option matched for value:', optionValue);
                    var clonedSubOption = $(this).clone().removeAttr('kilr_shopify_sub-option');
                    // Change the kilr_shopify attribute to match the option number
                    clonedSubOption.find('[kilr_shopify^="sub-option-"]').attr('kilr_shopify', `sub-option-${optionNumber}_value`);
                    subOptions.push(clonedSubOption);
                    console.log('Cloned sub-option:', clonedSubOption);
                }
            });

            // If there are multiple sub-options, update the values in the matching kilr_shopify=sub-option element
            if (subOptions.length > 0) {
                // Append the cloned sub-option elements to the kilr_shopify=sub-option container
                subOptions.forEach(function(subOption) {
                    subOptionsContainer.append(subOption);
                    console.log('Appended sub-option to container:', subOption);
                });

                // Collect sub-option values
                var subOptionValues = subOptionsContainer.find('[kilr_shopify^="sub-option-"]').map(function() {
                    return $(this).val() || $(this).text();
                }).get().join(', ');

                // Store the selected option key and sub-option values
                storeSelectedOption(optionNumber, optionKey, subOptionValues);
            } else {
                console.log('No sub-options found for the selected option value.');
                // If no sub-options, ensure the selected option is still stored
                storeSelectedOption(optionNumber, optionKey, '');
            }
        }
    });

    // Handling the event when a sub-option value changes
    $(document).on('change', '[kilr_shopify^="sub-option-"]', function() {
        let optionKey = $(this).closest('[kilr_shopify_option]').attr('kilr_shopify_option');
        let subOptionValues = $(this).closest('[kilr_shopify="sub-option"]').find('[kilr_shopify^="sub-option-"]').map(function() {
            return $(this).val() || $(this).text();
        }).get().join(', ');
        // Store the selected option key and sub-option values
        let optionNumber = $(this).attr('kilr_shopify').match(/\d+/)[0]; // Extract the option number (1, 2, or 3)
        storeSelectedOption(optionNumber, optionKey, subOptionValues);
        updateSelections(optionKey, subOptionValues);
    });

    function updateSelections(optionKey, subOptionValues) {
        // Placeholder functionality for updateSelections
        // Log the received parameters to the console
        console.log('updateSelections called with optionKey:', optionKey, 'and subOptionValues:', subOptionValues);
        // TODO: Implement the actual functionality for updateSelections
    }
    // Function to update the cart with a new variant
    async function updateCart(variantObject) {
        // Find if the variant already exists in the cart
        let existingIndex = cart.findIndex(v => v.gid === variantObject.gid);

        // If the variant exists, update the quantity, price, and customAttributes
        if (existingIndex > -1) {
            cart[existingIndex].qty = variantQuantity;
            cart[existingIndex].price = parseFloat(variantObject.price);
            // If there is a limit, set it
            if ($('[kilr_shopify="limit"]').text() === 'true') {
                cart[existingIndex].limit = limitValue;
            }
            // Update customAttributes if they exist
            if (variantObject.customAttributes) {
                cart[existingIndex].customAttributes = variantObject.customAttributes.map(attr => ({
                    key: attr.key,
                    value: attr.value
                }));
            }
        } else {
            // If the variant does not exist, create a new entry with customAttributes
            let individualVariant = {
                gid: variantObject.gid,
                src: variantObject.src,
                price: parseFloat(variantObject.price),
                title: variantObject.title,
                qty: variantQuantity,
                // Add customAttributes if they exist
                customAttributes: variantObject.customAttributes ? variantObject.customAttributes.map(attr => ({
                    key: attr.key,
                    value: attr.value
                })) : []
            };
            // If there is a limit, set it
            if ($('[kilr_shopify="limit"]').text() === 'true') {
                individualVariant.limit = limitValue;
            }
            // Add the new variant to the cart
            cart.push(individualVariant);
        }

        // Save the updated cart to a cookie or local storage
        await Wized.data.setCookie("cart", JSON.stringify(cart));
        // Output the cart to the console for debugging
        console.log('Cart updated:', cart);

        // Update UI elements such as the cart counter
        $('[kilr_shopify="cart_lottie-trigger"]').trigger('click');
        setTimeout(function() {
            $('[kilr_shopify="cart_object-counter"]').text(cart.length);
        }, 500);
    }


      // Function to format all prices
      function formatAllPrices() { 
        // Select all elements with the attribute kilr_product-card="price"
        var priceElements = document.querySelectorAll('[kilr_shopify="product-card-price"]');
      
        priceElements.forEach(function(priceElement) {
            // Get the current price text, assumed to be a string of numbers
            var currentPrice = priceElement.textContent;
        
            // Check if the currentPrice is a valid number
            if (!isNaN(currentPrice) && currentPrice.length > 2) {
                // Insert a decimal point before the last two digits
                var formattedPrice = currentPrice.slice(0, -2) + "." + currentPrice.slice(-2);
        
                // Add a dollar sign at the beginning
                formattedPrice = "$" + formattedPrice;
        
                // Update the text content of the price element
                priceElement.textContent = formattedPrice;
            } else {
                console.error("Invalid price format or price too short in one of the elements");
            }
        });
    }

    // Call the function to format all prices initially
    formatAllPrices();

    // Select the element to be observed
    var listElement = document.querySelector('[fs-cmsload-element="list"]');

    // Create a MutationObserver to observe changes in the list element
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                // Call formatAllPrices when children of listElement are added or removed
                formatAllPrices();
            }
        });
    });

    // Configuration of the observer:
    var config = { childList: true }; // Monitor for additions or removals of children

    // Start observing the target element with the configured settings
    observer.observe(listElement, config);

      // Iterate through each option list
    $('[kilr_shopify^="variant_option-"]').each(function() {
        // Find the first option button within this list and simulate a click
        $(this).find('[kilr_shopify^="option-"]').first().trigger('click');
    });
});


