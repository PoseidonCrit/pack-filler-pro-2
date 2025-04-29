// This file provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal), which is assumed to be
// loaded via @require in the main script.
// Note: Removed dependency on 'config' for dark mode as requested.

/* --- SweetAlert2 Custom Alerts --- */
// Function to show a standard SweetAlert2 modal
function SWAL_ALERT(title, html, icon = 'info') {
    // Assumes window.Swal is available via @require in main script
    if (typeof window.Swal === 'undefined') {
        GM_log(`SweetAlert2 not available. Falling back to alert: ${title} - ${html}`); // Assumes GM_log is available
        alert(`${title}\n\n${html}`); // Fallback if Swal is missing
        return;
    }
    window.Swal.fire({
        title: title,
        html: html,
        icon: icon,
        confirmButtonText: 'OK',
        customClass: { // Apply custom classes for styling
            popup: 'pfp-swal-popup',
            title: 'pfp-swal-title',
            htmlContainer: 'pfp-swal-html',
            confirmButton: 'mini primary' // Use mini.css/custom button style
        },
        buttonsStyling: false // Required to use custom button class
        // Removed didOpen logic for dark mode
    });
}

 // Function to show a SweetAlert2 toast notification
function SWAL_TOAST(title, icon = 'info') {
    // Assumes window.Swal is available via @require in main script
    if (typeof window.Swal === 'undefined') {
         GM_log(`SweetAlert2 not available. Falling back to toast log: ${title}`); // Assumes GM_log is available
         return;
    }
    window.Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
         customClass: { // Apply custom classes for styling
             popup: 'pfp-swal-toast-popup'
         },
         didOpen: (toast) => {
             toast.addEventListener('mouseenter', window.Swal.stopTimer);
             toast.addEventListener('mouseleave', window.Swal.resumeTimer);
             // Removed didOpen logic for dark mode
         }
    }).fire({
        icon: icon,
        title: title
    });
}

// Note: No IIFE wrapper needed in this file if the main script uses one,
// as the functions defined here will be added to the main script's scope.
