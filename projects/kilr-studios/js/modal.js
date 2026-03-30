/* ────────────────────────────────────────────────────────────
   CLAIM YOUR REGION MODAL
   ──────────────────────────────────────────────────────────── */

(function () {
  const modal = document.getElementById('claimModal');
  const form  = document.getElementById('claimForm');
  if (!modal || !form) return;

  // Open
  function open() {
    modal.removeAttribute('hidden');
    document.body.style.overflow = 'hidden';
    // Focus first input after transition
    requestAnimationFrame(() => {
      const first = modal.querySelector('.modal_input');
      if (first) first.focus();
    });
  }

  // Close
  function close() {
    modal.setAttribute('hidden', '');
    document.body.style.overflow = '';
  }

  // Bind open triggers
  document.querySelectorAll('.js-open-modal').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      open();
    });
  });

  // Bind close triggers
  document.querySelectorAll('.js-close-modal').forEach(function (btn) {
    btn.addEventListener('click', close);
  });

  // Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hasAttribute('hidden')) {
      close();
    }
  });

  // Form submission
  form.addEventListener('submit', function (e) {
    e.preventDefault();

    const data = new FormData(form);
    const payload = {};
    data.forEach(function (value, key) {
      payload[key] = value;
    });

    // Disable submit while processing
    const submitBtn = form.querySelector('.modal_submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    // POST to Formspark
    fetch('https://submit-form.com/UQHFnyToK', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('Network error');
        return res.json();
      })
      .then(function () {
        // Success state
        form.innerHTML =
          '<div style="text-align:center; padding: 2rem 0;">' +
            '<p style="font-family: var(--font-display); font-size: 1.75rem; font-weight: 500; text-transform: uppercase; color: var(--color-dark); margin-bottom: 0.75rem;">Application Received</p>' +
            '<p style="font-family: var(--font-primary); font-size: 1rem; color: var(--color-dark-70); line-height: 1.5;">We\'ll be in touch within 24 hours to confirm your region availability.</p>' +
          '</div>';
      })
      .catch(function () {
        // Fallback: mailto if API isn't set up yet
        var subject = encodeURIComponent('Claim Your Region — ' + (payload.businessName || 'New Lead'));
        var body = encodeURIComponent(
          'Full Name: ' + (payload.fullName || '') + '\n' +
          'Phone: ' + (payload.phone || '') + '\n' +
          'Email: ' + (payload.email || '') + '\n' +
          'Business: ' + (payload.businessName || '') + '\n' +
          'Industry: ' + (payload.businessIndustry || '') + '\n' +
          'Location: ' + (payload.businessLocation || '') + '\n' +
          'Agency Experience: ' + (payload.agencyExperience || '') + '\n' +
          'Paid Ads: ' + (payload.paidAds || '') + '\n' +
          'Website Updated: ' + (payload.websiteUpdate || '') + '\n' +
          'Monthly Budget: ' + (payload.monthlyBudget || '') + '\n' +
          'Additional Info: ' + (payload.additionalInfo || '')
        );
        window.location.href = 'mailto:hello@kilrstudios.com.au?subject=' + subject + '&body=' + body;

        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
      });
  });
})();
