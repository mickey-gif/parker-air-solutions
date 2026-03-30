/* version 1.2.0 */

$(document).ready(function() {
    // Set the hero-image to the first gallery-image by default

    $('[kilr_shopify="object_information"]').css('display', 'none');
    $('[kilr_shopify="add-to-cart"]').css('display', 'none');
    
    var firstGalleryImage = $('[kilr_shopify="gallery-item"]:first [kilr_shopify="gallery-image"]');
    $('[kilr_shopify="hero-image"]').attr('src', firstGalleryImage.attr('src'));
    $('[kilr_shopify="hero-image"]').attr('srcset', firstGalleryImage.attr('srcset'));
  
    // Set the first gallery-item to have the active state
    $('[kilr_shopify="gallery-item"]:first').addClass('image-is-active');
  
    // When a gallery-item is clicked
    $('[kilr_shopify="gallery-item"]').on('click', function() {
      // Get the src of the clicked gallery-image
      var galleryImageSrc = $(this).find('[kilr_shopify="gallery-image"]').attr('src');
      var galleryImageSrcset = $(this).find('[kilr_shopify="gallery-image"]').attr('srcset');
      
      // Update the hero-image attributes with a fade effect
      var heroImage = $('[kilr_shopify="hero-image"]');
      heroImage.fadeOut(400, function() {
        heroImage.attr('src', galleryImageSrc);
        heroImage.attr('srcset', galleryImageSrcset);
        heroImage.fadeIn(400);
      });
      
      // Remove the 'image-is-active' class from all gallery-items
      $('[kilr_shopify="gallery-item"]').removeClass('image-is-active');
      
      // Add the 'image-is-active' class to the clicked gallery-item
      $(this).addClass('image-is-active');
    });
  
    // When the mouse is over a gallery-item
    $('[kilr_shopify="gallery-item"]').on('mouseover', function() {
      // Add the 'mouse-is-over' class
      $(this).addClass('mouse-is-over');
    });
  
    // When the mouse is out of a gallery-item
    $('[kilr_shopify="gallery-item"]').on('mouseout', function() {
      // Remove the 'mouse-is-over' class
      $(this).removeClass('mouse-is-over');
    });
  
    // Hide the comma in the last item of the applications list
    $('[kilr_shopify="applications"] [kilr_shopify="application"]:last-child [kilr_shopify="comma"]').css('display', 'none');
  });

$(document).ready(async function()  {
    let colorData = [];
    try {
        const response = await fetch("https://get-product-color.kilr.workers.dev/");
        const jsonData = await response.json();
        colorData = jsonData.items.map(item => ({
            name: item.fieldData.name,
            color: item.fieldData.color
        }));
    } catch (err) {
        console.error("Error fetching color data:", err);
    }
    
    let option1SelectedValue = '';
    let option2SelectedValue = '';
    let option3SelectedValue = '';
    let variantQuantity = 1;
    let currentVariant = null;
    let cart = [];

    $('[kilr_shopify="cart_object-counter"]').text(cart.length);
    
    let limitValue = parseInt($('[kilr_shopify-limit]').attr('kilr_shopify-limit'));

    async function loadCart() {
        let cartData = await Wized.data.get("c.cart");
        if (!cartData) {
            cart = [];
        } else {
            cart = JSON.parse(cartData);
        }
    }

   
    function populateOptionList(i, colorData) {
        let values = $(`[kilr_shopify='product_option-${i}-values']`).text().split(', ');
        let parent = $(`[kilr_shopify='variant_option-${i}_list']`);
        let template = $(`[kilr_shopify='option-${i}-template']`).clone().removeAttr('kilr_shopify').show();
        
        
        values.forEach((value) => {
            let newElement = template.clone();
            newElement.find(`[kilr_shopify='option-${i}_value']`).text(value);

            newElement.css('display', 'flex');
            
            const colorInfo = colorData.find(item => item.name === value);
            if (colorInfo) {
                newElement.find('[kilr_shopify="option-color"]').css('background-color', colorInfo.color);
            }

            newElement.click(function() {
                $(this).addClass('is-active').siblings().removeClass('is-active');
                let selectedValue = $(this).find(`[kilr_shopify='option-${i}_value']`).text();
                
                switch (i) {
                    case 1:
                        option1SelectedValue = selectedValue;
                        break;
                    case 2:
                        option2SelectedValue = selectedValue;
                        break;
                    case 3:
                        option3SelectedValue = selectedValue;
                        break;
                }

                $(`[kilr_shopify='option-${i}_title-element']`).text(selectedValue);

                $('[kilr_shopify="variant_data"]').each(function() {
                    let option1Value = $(this).find('[kilr_shopify="variant_option-1-value"]').text();
                    let option2Value = $(this).find('[kilr_shopify="variant_option-2-value"]').text();
                    let option3Value = $(this).find('[kilr_shopify="variant_option-3-value"]').text();

                    if (option1Value === option1SelectedValue && option2Value === option2SelectedValue && option3Value === option3SelectedValue) {
                        let variantObject = {
                            gid: $(this).find('[kilr_shopify="variant_gid"]').text(),
                            src: $(this).find('[kilr_shopify="variant_image"]').attr('src'),
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
                    }
                });
            });

            parent.append(newElement);
        });

        $(`[kilr_shopify='option-${i}-template']`).remove();

        if (i === 1) {
            let firstVariantPrice = $('[kilr_shopify="variant_data"]').first().find('[kilr_shopify="variant_price"]').text();
            $('[kilr_shopify="product_price"]').text(`$${firstVariantPrice}`);
        }
    }

    for (let i = 1; i <= 3; i++) {
        populateOptionList(i, colorData);
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
        
        if (currentVariant) {
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

    $("[kilr_shopify^='option-']").click(function() {
        $('[kilr_shopify="add-to-cart"]').text("Add to Cart");
    });

    async function updateCart(variantObject) {
        let existingIndex = cart.findIndex(v => v.gid === variantObject.gid);
        if (existingIndex > -1) {
            cart[existingIndex].qty = variantQuantity;
            cart[existingIndex].price = parseFloat(variantObject.price);
            if ($('[kilr_shopify="limit"]').text() === 'true') {
                cart[existingIndex].limit = limitValue;
            }
        } else {
            let individualVariant = {
                gid: variantObject.gid,
                src: variantObject.src,
                price: parseFloat(variantObject.price),
                title: variantObject.title,
                qty: variantQuantity
            };
            if ($('[kilr_shopify="limit"]').text() === 'true') {
                individualVariant.limit = limitValue;
            }
            cart.push(individualVariant);
        }
        
        await Wized.data.setCookie("cart", JSON.stringify(cart));
        console.log(cart);

        $('[kilr_shopify="cart_lottie-trigger"]').trigger('click');

        setTimeout(function() {
            $('[kilr_shopify="cart_object-counter"]').text(cart.length);
        }, 500);
    }
});


