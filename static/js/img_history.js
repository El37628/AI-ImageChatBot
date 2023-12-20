document.addEventListener('DOMContentLoaded', (event) => {
  const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  const searchInput = document.getElementById("search-input");
  const searchBar = document.querySelector(".search-bar");
  let searchHighlights = [];
  let currentHighlightIndex = 0;
  let currentPage = 1;
  let itemsPerPage = 4; // Adjust this to control the number of items per page
  let chatMessagesArray = []; // Declare chatMessagesArray here

  window.addEventListener('load', function() {
      let chatContainer = document.getElementById('chat-container');
      if (chatContainer && !chatContainer.querySelector('#chat-content')) {
          chatContainer.remove();
      }
  });

  function showFeaturesModal() {
    $('#featuresModal').modal('show');
  }
  document.getElementById("features-button").addEventListener('click', showFeaturesModal);

  document.getElementById("new-chat-button").addEventListener('click', backToChat);

  function backToChat() {
      var imageEndpoint = '/img_gen'; // Replace with the actual endpoint URL
      window.location.href = imageEndpoint;
  }

  function fetchContainerIDs(userId) {
      fetch(`/get_img_ids?user_id=${userId}`)
          .then(response => response.json())
          .then(data => {
              if (data.error) {
                  console.error('Error fetching IDs:', data.error);
                  return;
              }

              Promise.all(
                  data.map(({ container_id, conversation_id }) =>
                      fetch(`/images?user_id=${userId}&container_id=${container_id}&conversation_id=${conversation_id}`)
                          .then(response => response.json())
                          .then(images => ({
                              userId,
                              container_id,
                              conversation_id,
                              images
                          }))
                  )
              ).then(chats => {
                  chatMessagesArray = []; // Reset the array
                  chats.forEach(chat => {
                      for (let i = 0; i < chat.images.length; i += itemsPerPage) {
                          chatMessagesArray.push({
                              container_id: chat.container_id,
                              conversation_id: chat.conversation_id,
                              images: chat.images.slice(i, i + itemsPerPage)
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
    let chatContainer = document.getElementById('chat-container-' + container_id);
    if (!chatContainer) {
        chatContainer = document.createElement('div');
        chatContainer.id = 'chat-container-' + container_id;
        chatContainer.className = 'chat-container';
        document.querySelector('.main-content').appendChild(chatContainer);
    }
    let chatMessageContainer = document.createElement('div');
    chatMessageContainer.className = 'chat-message-container';
    chatContainer.appendChild(chatMessageContainer);

    chatMessages.forEach((formatted_image, index) => {
        if (!formatted_image) {
            return;
        }

        const messageDiv = document.createElement('div');
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const textWithImages = formatted_image.replace(urlRegex, (url) => {
            const imageContainer = document.createElement('div');
            imageContainer.className = 'image-container';

            const image = document.createElement('img');
            image.src = url;
            image.alt = 'Chat Image';

            imageContainer.appendChild(image);

            const downloadIcon = document.createElement('i');
            downloadIcon.className = 'fas fa-download download-icon';           
            imageContainer.appendChild(downloadIcon);


            return imageContainer.outerHTML;
        });

        messageDiv.innerHTML = textWithImages;
        chatMessageContainer.appendChild(messageDiv);
    });
  }

  document.body.addEventListener('click', function(event) {
    if (event.target.classList.contains('download-icon')) {
        event.stopPropagation();
        const imageUrl = event.target.previousElementSibling.src; // Assuming the image is just before the icon
        downloadImage(imageUrl);
    }
  }); 


  function downloadImage(url) {
    const a = document.createElement('a');
    // Update this line to point to your new download route
    a.href = `/download_image?image_url=${encodeURIComponent(url)}`;
    a.download = url.split('/').pop() || 'downloaded_image';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }






  function createPaginationControls() {
      const totalPages = Math.ceil(chatMessagesArray.length / itemsPerPage);
      const paginationContainer = document.getElementById('pagination-container');
      paginationContainer.innerHTML = '';

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
          addChatContainer(chat.container_id, chat.conversation_id, chat.images);
      }
  }

  fetchUserId()
      .then((userId) => {
          fetchContainerIDs(userId);
      })
      .catch((error) => {
          console.error('Failed to fetch user ID:', error);
      });

  sidebarToggleBtn.addEventListener('click', function() {
      document.body.classList.toggle('sidebar-open');
      const sidebarWidth = window.innerWidth <= 768 ? '200px' : '250px';
      document.getElementById('sidebar').style.width = document.body.classList.contains('sidebar-open') ? sidebarWidth : '0';
      document.getElementById('sidebarToggleBtn').style.left = document.body.classList.contains('sidebar-open') ? `calc(${sidebarWidth} + 20px)` : '1rem';
  });

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

  function updateSearchResults(query) {
    searchHighlights = [];
    let matchCount = 0;
    const chatMessageContainers = document.querySelectorAll('.chat-message-container');

    chatMessageContainers.forEach(container => {
        const messageDivs = container.querySelectorAll('div');

        messageDivs.forEach(div => {
            if (!query) {
                // No query, reset to original HTML
                div.innerHTML = div.originalHTML || div.innerHTML;
            } else {
                if (!div.originalHTML) {
                    div.originalHTML = div.innerHTML; // Store the original HTML
                }
                // Apply highlighting to the content
                div.innerHTML = highlightText(div.originalHTML, query);
                const matches = div.innerHTML.match(/<span class="highlight">/gi);
                matchCount += matches ? matches.length : 0;
                searchHighlights.push(...div.querySelectorAll('.highlight'));
            }
        });
    });

    currentHighlightIndex = -1;
    navigateToNextSearchResult();
    updateSearchResultsCountDisplay();
  }

  function highlightText(html, query) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    let modifiedHtml = '';
    const regex = new RegExp(`(${query})`, 'gi');

    tempDiv.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            // Apply highlighting to text nodes
            const highlightedText = node.textContent.replace(regex, '<span class="highlight">$1</span>');
            modifiedHtml += highlightedText;
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'IMG') {
            // Preserve image elements as is
            modifiedHtml += node.outerHTML;
        } else {
            // Preserve other types of elements
            modifiedHtml += node.outerHTML;
        }
    });

    return modifiedHtml;
  }


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

  // Restoring search bar state from localStorage
  const isSearchBarExpanded = localStorage.getItem('searchBarExpanded') === 'true';
  if (isSearchBarExpanded) {
      searchBar.classList.add('expanded');
      searchInput.style.width = '250px';
  }
});
