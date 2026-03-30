/**
 * FAQ — Accordion toggle
 */
document.addEventListener("DOMContentLoaded", () => {
  const items = document.querySelectorAll(".faq_item");
  if (!items.length) return;

  items.forEach(item => {
    const trigger = item.querySelector(".faq_trigger");
    trigger.addEventListener("click", () => {
      const isOpen = item.classList.contains("faq_item--open");

      // Close all
      items.forEach(i => {
        i.classList.remove("faq_item--open");
        i.querySelector(".faq_trigger").setAttribute("aria-expanded", "false");
      });

      // Open clicked item (unless it was already open)
      if (!isOpen) {
        item.classList.add("faq_item--open");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });
});
