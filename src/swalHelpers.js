// This file provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal) and sanitize from domUtils.js.
// Wrapped in an IIFE and attaches functions to window.pfpMinimal.

(function() {
    'use strict';

    // Ensure the global namespace object exists and get references to shared dependencies
    window.pfpMinimal = window.pfpMinimal || {};
    const Swal = window.Swal; // Get SweetAlert2 from window
    const sanitize = window.pfpMinimal.sanitize; // Get sanitize from namespace (defined in domUtils.js)
    const GM_log = window.GM_log; // Get GM_log from window (granted in main script)


    /* --- SweetAlert2 Custom Alerts --- */
    /**
     * Shows a standard SweetAlert2 modal.
     * Provides a fallback to native alert if SweetAlert2 is not available.
     * Assumes window.Swal, GM_log, and sanitize are available via window or window.pfpMinimal.
     * @param {string} title - The title of the modal.
     * @param {string} html - The HTML content of the modal body.
     * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
     * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
     */
    function SWAL_ALERT(title, html, icon = 'info', config = null) {
        // Check critical dependencies
        if (typeof Swal === 'undefined') {
            const fallbackHtml = typeof sanitize === 'function' ? sanitize(html) : html;
            if (typeof GM_log === 'function') GM_log(`Pack Filler Pro SWAL_ALERT Error: SweetAlert2 not available. Falling back to alert: ${title} - ${fallbackHtml}`);
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
            customClasses.popup = (customClasses.popup + ' dark-mode').trim();
            customClasses.title = (customClasses.title + ' dark-mode').trim();
            customClasses.htmlContainer = (customClasses.htmlContainer + ' dark-mode').trim();
        }

        try {
            Swal.fire({
                title: sanitizedTitle,
                html: sanitizedHtml,
                icon: icon,
                confirmButtonText: 'OK',
                customClass: customClasses,
                buttonsStyling: false
            });
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error displaying SweetAlert2 modal.", e);
            if (typeof GM_log === 'function') GM_log(`Pack Filler Pro SWAL_ALERT Error: SweetAlert2 threw error. Falling back to alert: ${title} - ${sanitizedHtml}`, e);
            alert(`${title}\n\n${sanitizedHtml}`);
        }
    }

     /**
      * Shows a SweetAlert2 toast notification.
      * Provides a fallback log if SweetAlert2 is not available.
      * Assumes window.Swal, GM_log, and sanitize are available via window or window.pfpMinimal.
      * @param {string} title - The title/text of the toast.
      * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
      * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
      */
    function SWAL_TOAST(title, icon = 'info', config = null) {
        // Check critical dependencies
        if (typeof Swal === 'undefined') {
             if (typeof GM_log === 'function') GM_log(`Pack Filler Pro SWAL_TOAST Error: SweetAlert2 not available. Skipping toast: ${title}`);
             return;
        }
        // Sanitize title for safety
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
            Swal.mixin({
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                customClass: customClasses,
                 didOpen: (toast) => {
                     if (toast instanceof HTMLElement) {
                          toast.addEventListener('mouseenter', Swal.stopTimer);
                          toast.addEventListener('mouseleave', Swal.resumeTimer);
                     } else {
                         // GM_log("Pack Filler Pro: SWAL_TOAST didOpen: toast element not valid."); // Minimal logging
                     }
                 }
            }).fire({
                icon: icon,
                title: sanitizedTitle
            });
        } catch (e) {
            if (typeof GM_log === 'function') GM_log("Pack Filler Pro: Error displaying SweetAlert2 toast.", e);
        }
    }

    // Attach functions to the global namespace object
    window.pfpMinimal.SWAL_ALERT = SWAL_ALERT;
    window.pfpMinimal.SWAL_TOAST = SWAL_TOAST;

})(); // End of IIFE
