function handleLogout() {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    fetch('/logout', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      }
    })
    .then(response => response.json())
    .then(logoutData => {
      if (logoutData.success) {
        localStorage.removeItem('yourSessionTokenKey');
        sessionStorage.removeItem('yourSessionTokenKey');
        window.location.href = '/'; // Redirect to the homepage
      } else {
        alert('Logout failed');
      }
    })
    .catch(logoutError => {
      console.error('Error logging out:', logoutError);
      alert('Logout failed');
    });
  }