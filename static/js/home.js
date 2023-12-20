document.addEventListener('DOMContentLoaded', (event) => {
  // DOM is fully loaded, but maybe waiting on CSS/JS/images

  // Feature buttons functionality
  const featureButtons = document.querySelectorAll('.feature-btn');
  const featureContents = document.querySelectorAll('.feature-content');
  const body = document.querySelector('body');
  const imageUrl = '../static/src/home.png'; 

  const img = new Image();

  img.onload = function() {
    body.style.backgroundImage = `url('${imageUrl}')`;
  };

  img.onerror = function() {
    console.error('Failed to load the image at ' + imageUrl);
  };

  img.src = imageUrl;

  featureButtons.forEach(btn => {
    btn.addEventListener('click', function() {
      featureButtons.forEach(button => button.classList.remove('active'));
      this.classList.add('active');

      // Hide all feature contents
      featureContents.forEach(content => {
        content.classList.add('hidden');
      });

      // Show the target feature content
      const target = document.getElementById(this.getAttribute('data-target'));
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('fade-in');
      } else {
        console.log('No element found with ID:', this.getAttribute('data-target'));
      }
    });
  });

  // Event listeners for login and signup buttons
  document.querySelector('.btn-login').addEventListener('click', function() {
    window.location.href = "login_page"; // This should be replaced with the actual URL
  });

  document.querySelector('.btn-signup').addEventListener('click', function() {
    window.location.href = "register_page"; // This should be replaced with the actual URL
  });

  // Event listener for logout functionality
  document.getElementById("logout").addEventListener("click", async function(e) {
    e.preventDefault(); // Prevent the default link behavior
    handleLogout();
  });

  // Fetch username and update UI
  fetchUsername();

  // Event listener for the FAB
  document.getElementById('fab').addEventListener('click', function() {
    const featuresContainer = document.querySelector('.features-container');
    
    // Check if features-container is already visible
    if (featuresContainer.style.display === 'block') {
      // Hide the features-container
      featuresContainer.style.opacity = 0;
      featuresContainer.style.transform = 'translateY(-100px)'; // Move up while fading out
      // Set a timeout to hide the container after the transition ends
      setTimeout(() => {
        featuresContainer.style.display = 'none';
      }, 500); // This timeout should match the transition duration
    } else {
      // Show the features-container
      featuresContainer.style.display = 'block';
      // Use setTimeout to apply the opacity transition after the element is displayed
      setTimeout(() => {
        featuresContainer.style.opacity = 1;
        featuresContainer.style.transform = 'translateY(0)';
      }, 10); // Small timeout to ensure the display property is applied first
    }
  });

  const baffleTitle = baffle('#slyvision-title', {
    characters: '█▓▒░█▓▒░█▓▒░█▓▒░',
    speed: 120
  });

  const baffleSubtitle = baffle('#slyvision-subtitle', {
      characters: '█▓▒░█▓▒░█▓▒░█▓▒░',
      speed: 100
  });

  const baffleSubtitle2 = baffle('#slyvision-subtitle2', {
    characters: '█▓▒░█▓▒░█▓▒░█▓▒░',
    speed: 100
});

  baffleTitle.start();
  baffleSubtitle.start();
  baffleSubtitle2.start();

  setTimeout(() => {
    baffleTitle.reveal(1500);
    baffleSubtitle.reveal(2000);
    baffleSubtitle2.reveal(2000);
  }, 2000);
});

async function fetchUsername() {
  const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
  try {
    const response = await fetch('/get_username', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
    });

    if (!response.ok) {
      throw new Error('User not found');
    }

    const userData = await response.json();
    updateUserInterface(userData);
  } catch (error) {
    console.error('An error occurred', error);
  }
}

function updateUserInterface(userData) {
  if (userData.username) {
    document.querySelector('.btn-login').style.display = 'none';
    document.querySelector('.btn-signup').style.display = 'none';

    const userDropdown = document.getElementById('userDropdown');
    const usernameDisplay = document.querySelector('.username-display');
    usernameDisplay.textContent = userData.username;
    userDropdown.style.display = 'block';
  }
}
