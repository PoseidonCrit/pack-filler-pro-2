// This file provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal).

// It assumes window.Swal and sanitize (from domUtils) are available.
// GM_log is used for logging errors.

/* --- SweetAlert2 Custom Alerts --- */
/**
 * Shows a standard SweetAlert2 modal.
 * Provides a fallback to native alert if SweetAlert2 is not available.
 * Assumes window.Swal, GM_log, and sanitize are available.
 * @param {string} title - The title of the modal.
 * @param {string} html - The HTML content of the modal body.
 * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
 * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
 */
function SWAL_ALERT(title, html, icon = 'info', config = null) {
    // Check critical dependencies
    if (typeof window.Swal === 'undefined') {
        // Fallback to native alert if Swal is missing. Sanitize might also be missing.
        const fallbackHtml = typeof sanitize === 'function' ? sanitize(html) : html;
        // GM_log(`Pack Filler Pro SWAL_ALERT Error: SweetAlert2 not available. Falling back to alert: ${title} - ${fallbackHtml}`); // Minimal logging
        alert(`${title}\n\n${fallbackHtml}`);
        return;
    }
    // Sanitize inputs for safety before using in HTML
    const sanitizedTitle = typeof sanitize === 'function' ? sanitize(title) : title;
    const sanitizedHtml = typeof sanitize === 'function' ? sanitize(html) : html;


    const customClasses = {
        popup: 'pfp-swal-popup',
        title: 'pfp-swal-title',
        htmlContainer: 'pfp-swal-html',
        confirmButton: 'mini primary' // Use mini.css/custom button style (assuming basic mini.css is added)
    };

    // Apply dark mode class if enabled in config.
    // The MutationObserver in uiManager.js will handle this dynamically for new popups.
    // Applying it here ensures it's set on the initial creation options.
    if (config && config.isDarkMode) {
        // Ensure classes are added correctly without duplicating or causing issues
        customClasses.popup = (customClasses.popup + ' dark-mode').trim();
        customClasses.title = (customClasses.title + ' dark-mode').trim();
        customClasses.htmlContainer = (customClasses.htmlContainer + ' dark-mode').trim();
    }

    try {
        window.Swal.fire({
            title: sanitizedTitle, // Use sanitized title
            html: sanitizedHtml, // Use sanitized html
            icon: icon,
            confirmButtonText: 'OK',
            customClass: customClasses,
            buttonsStyling: false // Required to use custom button class
        });
    } catch (e) {
        // GM_log("Pack Filler Pro: Error displaying SweetAlert2 modal.", e); // Minimal logging
        // Fallback to native alert if Swal.fire throws an error
         // GM_log(`Pack Filler Pro SWAL_ALERT Error: SweetAlert2 threw error. Falling back to alert: ${title} - ${sanitizedHtml}`, e); // Minimal logging
        alert(`${title}\n\n${sanitizedHtml}`);
    }
}

 /**
  * Shows a SweetAlert2 toast notification.
  * Provides a fallback log if SweetAlert2 is not available.
  * Assumes window.Swal, GM_log, and sanitize from domUtils.js are available.
  * @param {string} title - The title/text of the toast.
  * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
  * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
  */
function SWAL_TOAST(title, icon = 'info', config = null) {
    // Check critical dependencies
    if (typeof window.Swal === 'undefined') {
         // GM_log(`Pack Filler Pro SWAL_TOAST Error: SweetAlert2 not available. Skipping toast: ${title}`); // Minimal logging
         return;
    }
    // Sanitize title for safety (though less critical for toasts usually)
    const sanitizedTitle = typeof sanitize === 'function' ? sanitize(title) : title;


    const customClasses = {
        popup: 'pfp-swal-toast-popup'
    };

    // Apply dark mode class if enabled in config.
    // The MutationObserver in uiManager.js will handle this dynamically for new popups.
    // Applying it here ensures it's set on the initial creation options.
    if (config && config.isDarkMode) {
        customClasses.popup = (customClasses.popup + ' dark-mode').trim();
    }

    try {
        window.Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            customClass: customClasses,
             didOpen: (toast) => {
                 // Add event listeners to pause/resume timer on hover
                 if (toast instanceof HTMLElement) { // Check if valid element
                      toast.addEventListener('mouseenter', window.Swal.stopTimer);
                      toast.addEventListener('mouseleave', window.Swal.resumeTimer);
                 } else {
                     // GM_log("Pack Filler Pro: SWAL_TOAST didOpen: toast element not valid."); // Minimal logging
                 }
             }
        }).fire({
            icon: icon,
            title: sanitizedTitle // Use sanitized title
        });
    } catch (e) {
        // GM_log("Pack Filler Pro: Error displaying SweetAlert2 toast.", e); // Minimal logging
        // No suitable fallback for toast, just log the error.
    }
}

// The functions SWAL_ALERT and SWAL_TOAST are made available to the main script's scope via @require.
