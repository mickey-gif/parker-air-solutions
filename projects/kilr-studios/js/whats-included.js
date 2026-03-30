/**
 * What's Included — Tab switcher + photo carousel dots
 */
document.addEventListener("DOMContentLoaded", () => {
  const section = document.querySelector(".whats-included");
  if (!section) return;

  const tabs    = section.querySelectorAll(".whats-included_tab");
  const panels  = section.querySelectorAll(".whats-included_panel");
  const gallery = section.querySelector(".whats-included_gallery");
  const dots    = section.querySelectorAll(".whats-included_dot");

  // ── Tab switching ──────────────────────────────────────────
  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t, j) => {
        const active = j === i;
        t.classList.toggle("whats-included_tab--active", active);
        t.setAttribute("aria-selected", active);
      });

      panels.forEach((p, j) => {
        const active = j === i;
        p.classList.toggle("whats-included_panel--active", active);
        if (active) p.removeAttribute("hidden");
        else        p.setAttribute("hidden", "");
      });
    });
  });

  // ── Photo carousel dots ────────────────────────────────────
  if (!gallery || !dots.length) return;

  const photos = gallery.querySelectorAll(".whats-included_photo");

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      if (photos[i]) {
        gallery.scrollTo({ left: photos[i].offsetLeft, behavior: "smooth" });
      }
    });
  });

  // Sync dots to scroll position
  gallery.addEventListener("scroll", () => {
    const galleryLeft = gallery.scrollLeft;
    let closest = 0;
    let minDist = Infinity;

    photos.forEach((photo, i) => {
      const dist = Math.abs(photo.offsetLeft - galleryLeft);
      if (dist < minDist) { minDist = dist; closest = i; }
    });

    dots.forEach((dot, i) => {
      const active = i === closest;
      dot.classList.toggle("whats-included_dot--active", active);
      dot.setAttribute("aria-selected", active);
    });
  }, { passive: true });
});
