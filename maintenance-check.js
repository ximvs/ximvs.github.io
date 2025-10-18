// Universal Maintenance Check for ALL pages
// Add this script to EVERY HTML file

function checkMaintenance() {
  console.log('Running maintenance check...');
  
  const maintenanceMode = localStorage.getItem('maintenanceMode') === 'true';
  const currentPage = window.location.pathname.split('/').pop();
  
  console.log('Maintenance mode:', maintenanceMode);
  console.log('Current page:', currentPage);
  
  // Skip check for maintenance.html itself
  if (currentPage === 'maintenance.html') {
    console.log('On maintenance page, skipping redirect');
    return;
  }
  
  if (maintenanceMode) {
    const hasMaintenanceAccess = sessionStorage.getItem('maintenanceAccess') === 'true';
    console.log('Has maintenance access:', hasMaintenanceAccess);
    
    if (!hasMaintenanceAccess) {
      console.log('No access, redirecting to maintenance page');
      // Clear any potential stale data
      sessionStorage.removeItem('maintenanceAccess');
      window.location.href = 'maintenance.html';
      return true; // Redirect happening
    }
  }
  
  console.log('Maintenance check passed');
  return false; // No redirect needed
}

// Run check when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM loaded, running maintenance check');
  setTimeout(checkMaintenance, 100);
});

// Also run check when page is fully loaded
window.addEventListener('load', function() {
  console.log('Page fully loaded, double-checking maintenance');
  setTimeout(checkMaintenance, 50);
});

// Mobile-specific: Also check on page show (for mobile browsers)
window.addEventListener('pageshow', function(event) {
  console.log('Page shown, checking maintenance');
  if (event.persisted) {
    // Page was restored from cache, re-check maintenance
    setTimeout(checkMaintenance, 100);
  }
});