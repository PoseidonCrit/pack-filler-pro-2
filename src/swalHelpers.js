// This file provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal), which is assumed to be
// loaded via @require in the main script.
// Note: This module now accepts the 'config' object to apply dark mode if needed.

// Assumes window.Swal and GM_log are available in the main script's scope.

/* --- SweetAlert2 Custom Alerts --- */
/**
 * Shows a standard SweetAlert2 modal.
 * Provides a fallback to native alert if SweetAlert2 is not available.
 * Assumes window.Swal and GM_log are available.
 * @param {string} title - The title of the modal.
 * @param {string} html - The HTML content of the modal body.
 * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
 * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
 */
function SWAL_ALERT(title, html, icon = 'info', config = null) {
    // Assumes window.Swal is available via @require in main script
    if (typeof window.Swal === 'undefined') {
        GM_log(`SweetAlert2 not available. Falling back to alert: ${title} - ${html}`); // Assumes GM_log is available
        alert(`${title}\n\n${html}`); // Fallback if Swal is missing
        return;
    }

    const customClasses = {
        popup: 'pfp-swal-popup',
        title: 'pfp-swal-title',
        htmlContainer: 'pfp-swal-html',
        confirmButton: 'mini primary' // Use mini.css/custom button style
    };

    // Apply dark mode class if enabled in config.
    // The MutationObserver in uiManager.js also handles this dynamically for new popups.
    // Applying it here ensures it's set on the initial creation options.
    if (config && config.isDarkMode) {
        // Ensure classes are added correctly without duplicating or causing issues
        customClasses.popup = (customClasses.popup + ' dark-mode').trim();
        customClasses.title = (customClasses.title + ' dark-mode').trim();
        customClasses.htmlContainer = (customClasses.htmlContainer + ' dark-mode').trim();
    }

    try {
        window.Swal.fire({
            title: title,
            html: html,
            icon: icon,
            confirmButtonText: 'OK',
            customClass: customClasses,
            buttonsStyling: false // Required to use custom button class
            // The didOpen logic for dark mode is handled in uiManager.js now via MutationObserver
            // to handle subsequent modals.
        });
    } catch (e) {
        GM_log("Pack Filler Pro: Error displaying SweetAlert2 modal.", e);
        // Fallback to native alert if Swal.fire throws an error
        alert(`${title}\n\n${html}`);
    }
}

 /**
  * Shows a SweetAlert2 toast notification.
  * Provides a fallback log if SweetAlert2 is not available.
  * Assumes window.Swal and GM_log are available.
  * @param {string} title - The title/text of the toast.
  * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
  * @param {object} [config=null] - The script's configuration object (needed for dark mode). Can be null.
  */
function SWAL_TOAST(title, icon = 'info', config = null) {
    // Assumes window.Swal is available via @require in main script
    if (typeof window.Swal === 'undefined') {
         GM_log(`SweetAlert2 not available. Falling back to toast log: ${title}`); // Assumes GM_log is available
         return;
    }

    const customClasses = {
        popup: 'pfp-swal-toast-popup'
    };

    // Apply dark mode class if enabled in config.
    // The MutationObserver in uiManager.js also handles this dynamically for new popups.
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
                 if (toast) {
                      toast.addEventListener('mouseenter', window.Swal.stopTimer);
                      toast.addEventListener('mouseleave', window.Swal.resumeTimer);
                 }
             }
            // The didOpen logic for dark mode is handled in uiManager.js now via MutationObserver
            // to handle subsequent toasts.
        }).fire({
            icon: icon,
            title: title
        });
    } catch (e) {
        GM_log("Pack Filler Pro: Error displaying SweetAlert2 toast.", e);
        // No suitable fallback for toast, just log the error.
    }
}

// The functions SWAL_ALERT and SWAL_TOAST are made available to the main script's scope via @require.
