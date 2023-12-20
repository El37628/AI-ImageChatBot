document.addEventListener('DOMContentLoaded', (event) => {
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const searchInput = document.getElementById("search-input");
  const searchBar = document.querySelector(".search-bar");
  let searchHighlights = [];
  let currentHighlightIndex = 0;
  let currentPage = 1;
  let itemsPerPage = 4;

  document.body.addEventListener('keydown', function(e) {
    if (e.key === 'Tab') {
      document.body.classList.add('user-is-tabbing');
    }
  });

  window.addEventListener('load', function() {
    let chatContainer = document.getElementById('chat-container');
    if(chatContainer && !chatContainer.querySelector('#chat-content')) {
        chatContainer.remove();
    }
  });

  document.getElementById("new-chat-button").addEventListener('click', backToChat);

  function backToChat() {
    var slyvisionEndpoint = '/slyvision';
    window.location.href = slyvisionEndpoint;
  }
  
  function fetchContainerIDs(userId) {
    fetch(`/get_ids?user_id=${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                console.error('Error fetching IDs:', data.error);
                return;
            }
            Promise.all(
                data.map(({ container_id, conversation_id }) =>
                    fetch(`/chat_messages?user_id=${userId}&container_id=${container_id}&conversation_id=${conversation_id}`)
                        .then(response => response.json())
                        .then(chatMessages => ({
                            userId,
                            container_id,
                            conversation_id,
                            chatMessages,
                        }))
                )
            ).then(chats => {
              chatMessagesArray = [];
              chats.forEach(chat => {
                  // Divide chatMessages into groups of 4 and push them as separate chat objects
                  for (let i = 0; i < chat.chatMessages.length; i += itemsPerPage) {
                      chatMessagesArray.push({
                          container_id: chat.container_id,
                          conversation_id: chat.conversation_id,
                          chatMessages: chat.chatMessages.slice(i, i + itemsPerPage)
                      });
                  }
              });
              createPaginationControls(chatMessagesArray.length);
              changePage(1);
            });
        })
        .catch(error => console.error('Error fetching IDs:', error));
  }

  function fetchUserId() {
    return new Promise((resolve, reject) => {
      fetch('/get_username')
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            console.error('Server returned an error:', data.error);
            reject(data.error);
            return;
          }
          resolve(data.user_id);
        })
        .catch((error) => {
          console.error('Error fetching user ID:', error);
          reject(error);
        });
    });
  }

  function addChatContainer(container_id, conversation_id, chatMessages) {
    let chatContainer = document.createElement('div');
    chatContainer.id = 'chat-container-' + container_id;
    chatContainer.className = 'chat-container';
    document.querySelector('.main-content').appendChild(chatContainer);

    let chatMessageContainer = document.createElement('div');
    chatMessageContainer.className = 'chat-message-container';
    chatContainer.appendChild(chatMessageContainer);

    chatMessages.forEach((message_data) => {
        if (!message_data) {
            return;
        }
        const messageDiv = document.createElement('div');
        messageDiv.textContent = message_data;
        messageDiv.className = 'large-font';
        chatMessageContainer.appendChild(messageDiv);
    });
  }


  function createPaginationControls() {
    const totalPages = Math.ceil(chatMessagesArray.length / itemsPerPage);
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = ''; // Clear existing controls

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.addEventListener('click', () => changePage(i));
        paginationContainer.appendChild(pageButton);
    }
  }

  function changePage(pageNumber) {
    currentPage = pageNumber;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, chatMessagesArray.length);

    document.querySelectorAll('.chat-container').forEach(container => container.remove());

    for (let i = startIndex; i < endIndex; i++) {
        const chat = chatMessagesArray[i];
        if (Array.isArray(chat.chatMessages)) {
            addChatContainer(chat.container_id, chat.conversation_id, chat.chatMessages);
        } else {
            console.error('chatMessages is not an array for chat:', chat);
        }
    }
  }


  let chatMessagesArray = [];
  fetchUserId()
    .then((userId) => {
      fetchContainerIDs(userId);
    })
    .catch((error) => {
      console.error('Failed to fetch user ID:', error);
  });

  sidebarToggleBtn.addEventListener('click', function() {
    toggleSidebar();
  });

  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
    const sidebarWidth = window.innerWidth <= 768 ? '200px' : '250px';
    document.getElementById('sidebar').style.width = document.body.classList.contains('sidebar-open') ? sidebarWidth : '0';
    document.getElementById('sidebarToggleBtn').style.left = document.body.classList.contains('sidebar-open') ? `calc(${sidebarWidth} + 20px)` : '1rem';
  }

    function showFeaturesModal() {
        $('#featuresModal').modal('show');
    }
    document.getElementById("features-button").addEventListener('click', showFeaturesModal);

    searchInput.addEventListener('input', function(event) {
        const searchQuery = event.target.value.trim().toLowerCase();
        updateSearchResults(searchQuery);
    });

    searchInput.addEventListener('keydown', function(event) {
      if (event.key === 'Enter') {
          event.preventDefault();
          navigateToNextSearchResult();
      }
    });

    function navigateToNextSearchResult() {
      if (searchHighlights.length === 0) return;
  
      const currentElement = searchHighlights[currentHighlightIndex];
      if (currentElement) {
          currentElement.classList.remove('current-highlight');
      }
  
      currentHighlightIndex = (currentHighlightIndex + 1) % searchHighlights.length;
      const nextElement = searchHighlights[currentHighlightIndex];
      nextElement.classList.add('current-highlight');
      nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  
      // Update the display for search results count
      updateSearchResultsCountDisplay();
    }
  

    function updateSearchResults(query) {
      searchHighlights = [];
      const chatMessageContainers = document.querySelectorAll('.chat-message-container');
      let matchCount = 0;
  
      if (query) {
          chatMessageContainers.forEach(container => {
              const messages = container.querySelectorAll('.large-font');
              messages.forEach(message => {
                  const count = highlightText(message, query);
                  matchCount += count;
                  if (count > 0) {
                      searchHighlights.push(...message.querySelectorAll('.highlight'));
                  }
              });
          });
          currentHighlightIndex = -1; // Reset the index
          navigateToNextSearchResult(); // Navigate to the first result and update display
      } else {
          // Clear highlights and count if query is empty
          chatMessageContainers.forEach(container => {
              const messages = container.querySelectorAll('.large-font');
              messages.forEach(message => {
                  message.innerHTML = message.textContent; // Remove highlights
              });
          });
          updateSearchResultsCountDisplay(0); // Update display with zero count
      }
    }
  
  

    function updateSearchResultsCountDisplay() {
      const totalResults = searchHighlights.length;
      const currentIndex = totalResults > 0 ? currentHighlightIndex + 1 : 0;
      const displayText = totalResults > 0 ? `${currentIndex}/${totalResults}` : '';
  
      const displayElement = document.getElementById('search-results-count');
      if (displayElement) {
          displayElement.textContent = displayText;
      }
    }

    function highlightText(element, query) {
      if (!query) {
          element.innerHTML = element.textContent;
          return 0;
      }
      const regex = new RegExp(`(${query})`, 'gi');
      element.innerHTML = element.textContent.replace(regex, '<span class="highlight">$1</span>');
      return (element.textContent.match(regex) || []).length;
    }

    // Restoring search bar state from localStorage
    const isSearchBarExpanded = localStorage.getItem('searchBarExpanded') === 'true';
    if (isSearchBarExpanded) {
        searchBar.classList.add('expanded');
        searchInput.style.width = '250px';
    }
});

