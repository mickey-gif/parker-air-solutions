/**
 * KILR Spigot Move Animation
 * 
 * Moves an element from a source container to a target container visually on scroll.
 * Usage:
 * <div kilr-scroll-move="spigot-1" kilr-scroll-target="target-1">...</div>
 * <div id="target-1">...</div>
 */

document.addEventListener('DOMContentLoaded', () => {
  const movers = document.querySelectorAll('[kilr-scroll-move]');

  movers.forEach(mover => {
    const targetId = mover.getAttribute('kilr-scroll-target');
    const target = document.getElementById(targetId);

    if (target) {
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY;
        const windowHeight = window.innerHeight;
        
        // Calculate progress based on scroll (Example logic)
        // In a real implementation, use GSAP ScrollTrigger or IntersectionObserver
        const moveProgress = Math.min(scrollY / windowHeight, 1);
        
        const rectSource = mover.parentElement.getBoundingClientRect();
        const rectTarget = target.getBoundingClientRect();
        
        const deltaX = rectTarget.left - rectSource.left;
        const deltaY = rectTarget.top - rectSource.top;

        // Apply transform
        if (moveProgress > 0) {
           mover.style.transform = `translate(${deltaX * moveProgress}px, ${deltaY * moveProgress}px)`;
        }
      });
    }
  });
});













