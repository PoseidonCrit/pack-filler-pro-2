// This block provides helper functions for displaying SweetAlert2 modals and toasts.
// It relies on the SweetAlert2 library (window.Swal).
// In a modular setup, this could be a 'swalHelpers.js' module.

// Assumes 'config' (specifically config.isDarkMode) and GM_log are accessible.
// Assumes window.Swal is available (loaded via @require).

/* --- SweetAlert2 Custom Alerts --- */
// Function to show a standard SweetAlert2 modal
function SWAL_ALERT(title, html, icon = 'info') {
    if (!window.Swal) {
        GM_log(`SweetAlert2 not available. Falling back to alert: ${title} - ${html}`);
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
        buttonsStyling: false, // Required to use custom button class
        didOpen: (popup) => {
            // Apply dark mode class to the Swal popup if the panel is in dark mode
            if (config.isDarkMode) {
                popup.classList.add('dark-mode');
            } else {
                 popup.classList.remove('dark-mode');
            }
        }
    });
}

 // Function to show a SweetAlert2 toast notification
function SWAL_TOAST(title, icon = 'info') {
    if (!window.Swal) {
         GM_log(`SweetAlert2 not available. Falling back to toast log: ${title}`);
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
             // Apply dark mode class to the Swal toast if the panel is in dark mode
             if (config.isDarkMode) {
                 toast.classList.add('dark-mode');
             } else {
                  toast.classList.remove('dark-mode');
             }
         }
    }).fire({
        icon: icon,
        title: title
    });
}

// Assumes other modules will call these functions to display messages.
