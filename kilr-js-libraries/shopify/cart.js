/* 1.1.6 */
$(document).ready(() => {

    const $cartList = $('[kilr_shopify="cart_list"]');
    const $cartVariantTemplate = $cartList.find('[kilr_shopify="cart_variant"]').first().clone();
    let cartContents = [];

    async function loadCartContents() {
        const cookieValue = await Wized.data.get("c.cart");
        if (cookieValue === undefined) {
            cartContents = [];
        } else {
            try {
                cartContents = JSON.parse(cookieValue);
                updateCartQuantitiesWithLimit(); // Check and update quantities with limit
            } catch (e) {
                
                cartContents = [];
            }
        }
        $('[kilr_shopify="cart_object-counter"]').text(cartContents.length);

        // Show/hide cart_clear element based on cart contents
        if (cartContents.length > 0) {
            $('[kilr_shopify="cart_clear"]').show();
        } else {
            $('[kilr_shopify="cart_clear"]').hide();
        }
    }

    $('[kilr_shopify="cart_close"]').click(function() {
        $('[kilr_shopify="cart_object-counter"]').text(cartContents.length);
    });

    $('[kilr_shopify="cart_open"]').on('click', async () => {
        await loadCartContents();
        $cartList.empty();
        renderCartVariants();
    });

    async function renderCartVariants() {
        $cartList.empty();

        cartContents.forEach(() => {
            $cartList.append($cartVariantTemplate.clone());
        });

        const $cartVariants = $cartList.find('[kilr_shopify="cart_variant"]');

        $cartVariants.each((index, cartVariant) => {
            const variant = cartContents[index];

            if (variant) {
                $(cartVariant).find('[kilr_shopify="cart_variant_image"]').attr('src', variant.src);
                // Update the srcset attribute along with the src attribute
                $(cartVariant).find('[kilr_shopify="cart_variant_image"]').attr('srcset', variant.srcset || variant.src); // Fallback to src if srcset is not available
                $(cartVariant).find('[kilr_shopify="cart_variant_title"]').text(variant.title);
                $(cartVariant).find('[kilr_shopify="cart_variant_qty"]').text(variant.qty);
                $(cartVariant).find('[kilr_shopify="cart_variant_price"]').text("$" + variant.price * variant.qty);
                $(cartVariant).find('[kilr_shopify="cart_variant_gid"]').text(variant.gid);

                const limit = variant.limit || null;
                // Check if the quantity has reached the limit and hide the increment button
                if (limit && variant.qty >= limit) {
                    $(cartVariant).find('[kilr_shopify="cart_quantity-inc"]').hide();
                } else {
                    $(cartVariant).find('[kilr_shopify="cart_quantity-inc"]').show();
                }
            }
        });

        let totalPrice = 0;
        cartContents.forEach(variant => {
            totalPrice += variant.price * variant.qty;
        });
        $('[kilr_shopify="cart_total-price"]').text("$" + totalPrice);

        $cartVariants.each((index, cartVariant) => {
            $(cartVariant).find('[kilr_shopify="cart_quantity-inc"]').click(async () => {
                const variant = cartContents[index];
                const limit = variant.limit || null;

                if (!limit || variant.qty < limit) {
                    variant.qty++;
                    await Wized.data.setCookie("cart", JSON.stringify(cartContents));
                    renderCartVariants();
                    await updateWizedCheckoutVariable();
                }
            });

            $(cartVariant).find('[kilr_shopify="cart_quantity-dec"]').click(async () => {
                if (cartContents[index].qty > 1) {
                    cartContents[index].qty--;
                    await Wized.data.setCookie("cart", JSON.stringify(cartContents));
                    renderCartVariants();
                    await updateWizedCheckoutVariable();
                } else if (cartContents[index].qty === 1) {
                    
                    $(cartVariant).find('[kilr_shopify="cart_variant_delete-alert"]').css('display', 'flex');
                    
                }
            });

            $(cartVariant).find('[kilr_shopify="cart_variant_delete-confirm"]').click(async () => {
                cartContents.splice(index, 1);
                await Wized.data.setCookie("cart", JSON.stringify(cartContents));
                renderCartVariants();
                await updateWizedCheckoutVariable();
            });

            $(cartVariant).find('[kilr_shopify="cart_variant_delete-cancel"]').click(function() {
                $(this).parent('[kilr_shopify="cart_variant_delete-alert"]').css('display', 'none');
            });
        });

        const currentCartContents = await Wized.data.get("c.cart");
        

        await updateWizedCheckoutVariable();
    }

    
    async function updateWizedCheckoutVariable() {
        // We will build the string manually to avoid escape characters
        let gqlFormattedString = '[';

        cartContents.forEach((item, index) => {
            // Add each item with just merchandiseId and quantity
            gqlFormattedString += `{merchandiseId:"${item.gid}",quantity:${item.qty}}`;
            
            // If not the last item, add a comma
            if (index < cartContents.length - 1) {
                gqlFormattedString += ',';
            }
        });

        // End of the array
        gqlFormattedString += ']';

        await Wized.data.setVariable("checkout", gqlFormattedString);
    }


    function updateCartQuantitiesWithLimit() {
        cartContents.forEach(variant => {
            if (variant.limit && variant.qty > variant.limit) {
                variant.qty = variant.limit;
            }
        });
    }

    $('[kilr_shopify="cart_clear"]').click(async () => {
        cartContents = [];
        await Wized.data.setCookie("cart", JSON.stringify(cartContents));
        renderCartVariants();
        await updateWizedCheckoutVariable();

        $('[kilr_shopify="cart_clear"]').hide();
    });

    loadCartContents().then(() => {
        
    });
});
