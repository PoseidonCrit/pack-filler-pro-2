// This file provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal), which is assumed to be
// loaded via @require in the main script.
// Note: This module now accepts the 'config' object to apply dark mode if needed.

/* --- SweetAlert2 Custom Alerts --- */
/**
 * Shows a standard SweetAlert2 modal.
 * @param {string} title - The title of the modal.
 * @param {string} html - The HTML content of the modal body.
 * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
 * @param {object} [config=null] - The script's configuration object (needed for dark mode).
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

    // Apply dark mode class if enabled in config
    if (config && config.isDarkMode) {
        customClasses.popup += ' dark-mode';
    }

    window.Swal.fire({
        title: title,
        html: html,
        icon: icon,
        confirmButtonText: 'OK',
        customClass: customClasses,
        buttonsStyling: false // Required to use custom button class
    });
}

 /**
  * Shows a SweetAlert2 toast notification.
  * @param {string} title - The title/text of the toast.
  * @param {string} [icon='info'] - The icon type ('success', 'error', 'warning', 'info', 'question').
  * @param {object} [config=null] - The script's configuration object (needed for dark mode).
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

    // Apply dark mode class if enabled in config
    if (config && config.isDarkMode) {
        customClasses.popup += ' dark-mode';
    }

    window.Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
         customClass: customClasses,
         didOpen: (toast) => {
             toast.addEventListener('mouseenter', window.Swal.stopTimer);
             toast.addEventListener('mouseleave', window.Swal.resumeTimer);
         }
    }).fire({
        icon: icon,
        title: title
    });
}

// The functions SWAL_ALERT and SWAL_TOAST are made available
// to the main script's scope via @require.
