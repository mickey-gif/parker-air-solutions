/**
 * Simple Toggle Attribute Script
 * 
 * Usage:
 * <button kilr-toggle-trigger="unique-id">Toggle</button>
 * <div kilr-toggle-target="unique-id" class="is-hidden">Content</div>
 */

document.addEventListener('DOMContentLoaded', () => {
  const triggers = document.querySelectorAll('[kilr-toggle-trigger]');

  triggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
      const targetId = trigger.getAttribute('kilr-toggle-trigger');
      const target = document.querySelector(`[kilr-toggle-target="${targetId}"]`);

      if (target) {
        // Toggle a visibility class (example)
        target.classList.toggle('is-hidden');
        
        // Optional: Toggle aria-expanded for accessibility
        const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', !isExpanded);
      }
    });
  });
});
