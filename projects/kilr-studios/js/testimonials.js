/**
 * Client Stories Slider
 * Fetches testimonials from /api/testimonials (Cloudflare D1 via Pages Function).
 * Falls back to inline data if the API is unavailable (local dev without wrangler).
 */

const FALLBACK_TESTIMONIALS = [
  {
    id: 1,
    client_name: "Tomas Farr",
    business_name: "Farr Constructions",
    quote: "\u201cWe\u2019ve had so much growth we had to expand our team to handle all the work.\u201d",
    image_url: "images/client-stories-farr.avif",
    video_url: "videos/farr-testimonial.mp4",
  },
  {
    id: 2,
    client_name: "Finn Slater",
    business_name: "Shieldcoat",
    quote: "\u201cI\u2019m pretty much hands-off. Everything just happens automatically in the background.\u201d",
    image_url: "images/client-stories-shieldcoat.avif",
    video_url: "videos/shieldcoat-testimonial.mp4",
  },
];

class TestimonialSlider {
  constructor() {
    this.section     = document.querySelector(".client-stories");
    this.bgEl        = this.section?.querySelector(".client-stories_bg");
    this.quoteEl     = this.section?.querySelector(".client-stories_quote");
    this.nameEl      = this.section?.querySelector(".client-stories_attribution");
    this.dotsEl      = this.section?.querySelector(".client-stories_dots");
    this.prevBtn     = this.section?.querySelectorAll(".client-stories_arrow")[0];
    this.nextBtn     = this.section?.querySelectorAll(".client-stories_arrow")[1];
    this.playBtn     = this.section?.querySelector(".client-stories_play");

    this.testimonials = [];
    this.current      = 0;

    this.init();
  }

  async init() {
    this.testimonials = await this.fetchTestimonials();
    this.renderDots();
    this.bindEvents();
    this.show(0, false);
  }

  async fetchTestimonials() {
    try {
      const res = await fetch("/api/testimonials");
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      return data.length ? data : FALLBACK_TESTIMONIALS;
    } catch {
      return FALLBACK_TESTIMONIALS;
    }
  }

  renderDots() {
    if (!this.dotsEl) return;
    this.dotsEl.innerHTML = this.testimonials
      .map(
        (_, i) =>
          `<span class="client-stories_dot${i === 0 ? " client-stories_dot--active" : ""}" role="tab" aria-selected="${i === 0}"></span>`
      )
      .join("");
  }

  show(index, animate = true) {
    const t = this.testimonials[index];
    if (!t) return;

    const update = () => {
      // Background image
      if (this.bgEl && t.image_url) {
        this.bgEl.src = t.image_url;
        this.bgEl.alt = `${t.client_name} — ${t.business_name}`;
      }

      // Quote
      if (this.quoteEl) this.quoteEl.textContent = t.quote;

      // Attribution
      if (this.nameEl) this.nameEl.textContent = `${t.client_name} \u2014 ${t.business_name}`;

      // Dots
      this.dotsEl?.querySelectorAll(".client-stories_dot").forEach((dot, i) => {
        dot.classList.toggle("client-stories_dot--active", i === index);
        dot.setAttribute("aria-selected", i === index);
      });

      // Play button — show only if video is available
      if (this.playBtn) {
        this.playBtn.style.opacity = t.video_url ? "1" : "0.4";
        this.playBtn.disabled = !t.video_url;
        this.playBtn.dataset.videoUrl = t.video_url || "";
      }

      this.current = index;
    };

    if (!animate || !this.section) {
      update();
      return;
    }

    // Fade out → swap content → fade in
    this.section.classList.add("is-transitioning");
    setTimeout(() => {
      update();
      this.section.classList.remove("is-transitioning");
    }, 300); // matches transition duration
  }

  bindEvents() {
    this.prevBtn?.addEventListener("click", () => {
      const prev = (this.current - 1 + this.testimonials.length) % this.testimonials.length;
      this.show(prev);
    });

    this.nextBtn?.addEventListener("click", () => {
      const next = (this.current + 1) % this.testimonials.length;
      this.show(next);
    });

    this.dotsEl?.addEventListener("click", (e) => {
      const dot = e.target.closest(".client-stories_dot");
      if (!dot) return;
      const index = [...this.dotsEl.children].indexOf(dot);
      if (index !== -1) this.show(index);
    });

    this.playBtn?.addEventListener("click", () => {
      const url = this.playBtn.dataset.videoUrl;
      if (url) VideoModal.open(url);
    });
  }
}

// ─── Video Modal ───────────────────────────────────────────────────────────

const VideoModal = {
  el: null,

  open(url) {
    if (!this.el) this.create();
    this.el.querySelector("video source").src = url;
    this.el.querySelector("video").load();
    this.el.querySelector("video").play();
    this.el.hidden = false;
    document.body.style.overflow = "hidden";
  },

  close() {
    if (!this.el) return;
    this.el.querySelector("video").pause();
    this.el.querySelector("video source").src = "";
    this.el.hidden = true;
    document.body.style.overflow = "";
  },

  create() {
    this.el = document.createElement("div");
    this.el.className = "video-modal";
    this.el.hidden = true;
    this.el.innerHTML = `
      <div class="video-modal_backdrop"></div>
      <div class="video-modal_inner">
        <button class="video-modal_close" aria-label="Close video">&times;</button>
        <video class="video-modal_video" controls playsinline>
          <source src="" type="video/mp4">
        </video>
      </div>`;
    document.body.appendChild(this.el);

    this.el.querySelector(".video-modal_backdrop").addEventListener("click", () => this.close());
    this.el.querySelector(".video-modal_close").addEventListener("click", () => this.close());
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });
  },
};

// ─── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => new TestimonialSlider());
