document.addEventListener('DOMContentLoaded', (event) => {
    const speaksButton = document.getElementById("speaks-button");
    const inputPrompt = document.getElementById("input-prompt");
    const originalPlaceholder = inputPrompt.placeholder;
    let recognition;
    let currentContainerId;
    let currentConversationId;
    var vantaWaves;
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const hiddenTextarea = document.createElement("textarea");
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    hiddenTextarea.style.position = "absolute";
    hiddenTextarea.style.top = "-9999px";
    hiddenTextarea.style.left = "-9999px";
    hiddenTextarea.style.visibility = "hidden";
    document.body.appendChild(hiddenTextarea);
    const settingsLink = document.getElementById("settings");
    const feedbackLink = document.getElementById("feedback");
    const logoutLink = document.getElementById("logout");
    const optionsToggle = document.getElementById("options-toggle");
    const actions = document.getElementById("actions");
    
    function fadePlaceholder(element, isFadingOut) {
      let steps = 10; // Number of steps for the fade effect
      let interval = 50; // Time (ms) between steps
      let currentStep = 0;
  
      let fadeEffect = setInterval(function() {
          currentStep++;
          if (currentStep > steps) {
              clearInterval(fadeEffect);
          } else {
              let opacity = isFadingOut ? (1 - currentStep / steps) : (currentStep / steps);
              let color = `rgba(0, 0, 0, ${opacity})`; // Change color here to match your placeholder color
              element.style.setProperty('--placeholder-color', color);
          }
      }, interval);
    }

    inputPrompt.addEventListener('focus', function() {
        fadePlaceholder(this, true);
    });

    inputPrompt.addEventListener('blur', function() {
        fadePlaceholder(this, false);
    });

    function showWavingAnimation(show) {
      const waving = document.getElementById('waving');
      waving.style.visibility = show ? 'visible' : 'hidden'; // Control visibility along with opacity
      waving.style.opacity = show ? '1' : '0';
      waving.style.height = show ? 'auto' : '0';
    }
  

    function showFeaturesModal() {
      $('#featuresModal').modal('show');
    }
    document.getElementById("features-button").addEventListener('click', showFeaturesModal);
  
  
    function toggleSpeech() {
      var isSpeaking = speaksButton.dataset.isSpeaking;
  
      if (isSpeaking === "true") {
          speaksButton.dataset.isSpeaking = "false";
          speaksButton.innerText = "Activate speech";
          if (recognition) {
              recognition.stop();
          }
      } else {
          speaksButton.dataset.isSpeaking = "true";
          speaksButton.innerText = "Deactivate speech";
          startSpeechRecognition();
      }
  }
  
  
    var form = document.getElementById('chat-form');
    form.addEventListener("submit", function(event) {
        event.preventDefault();
        const message = inputPrompt.value.trim();
        if (message !== "") {
            // Process the message
            chat();
            inputPrompt.value = ""; // Clear the input prompt
        }
    });

    function updateTextareaHeight() {
      hiddenTextarea.value = inputPrompt.value;
      const contentHeight = hiddenTextarea.scrollHeight;
      inputPrompt.style.height = contentHeight + "px";
    }

    inputPrompt.addEventListener("input", updateTextareaHeight);
    inputPrompt.addEventListener("keydown", function(event) {
      if (event.key === "Enter") {
        if (!event.shiftKey) {
          event.preventDefault();
    
          // Check if the input prompt is empty
          if (inputPrompt.value.trim() !== "") {
            // Submit the form
            form.dispatchEvent(new Event("submit"));
          }
        } else {
          // Shift+Enter is pressed
          event.preventDefault();
    
          // Insert a newline character at the cursor position
          const { selectionStart, selectionEnd } = inputPrompt;
          const currentValue = inputPrompt.value;
          const updatedValue = currentValue.slice(0, selectionStart) + "\n" + currentValue.slice(selectionEnd);
          inputPrompt.value = updatedValue;
    
          // Set the cursor position to the initial line
          setTimeout(function() {
            inputPrompt.selectionStart = inputPrompt.selectionEnd = selectionStart + 1;
          }, 0);
          updateTextareaHeight();
        }
      }
    });
     
    
  
    sidebarToggleBtn.addEventListener('click', function() {
        document.body.classList.toggle('sidebar-open');
        if (document.body.classList.contains('active')) {
            // Trigger animations when opening the sidebar
            document.getElementById('sidebar').classList.add('animate__animated', 'animate__fadeInLeft');
            sidebarToggleBtn.classList.add('animate__animated', 'animate__rotateIn');
            document.getElementById('content').classList.add('animate__animated', 'animate__fadeInRight');
            document.getElementById('chat-container').classList.add('animate__animated', 'animate__fadeInRight');
            document.querySelectorAll('.btn').forEach(btn => btn.classList.add('animate__animated', 'animate__pulse'));
            document.querySelector('.profile-name').classList.add('animate__animated', 'animate__pulse');
        } else {
            // Trigger animations when closing the sidebar
            document.getElementById('sidebar').classList.remove('animate__animated', 'animate__fadeInLeft');
            document.getElementById('sidebar').classList.add('animate__animated', 'animate__fadeOutLeft');
            sidebarToggleBtn.classList.remove('animate__animated', 'animate__rotateIn');
            sidebarToggleBtn.classList.add('animate__animated', 'animate__rotateOut');
            document.getElementById('content').classList.remove('animate__animated', 'animate__fadeInRight');
            document.getElementById('content').classList.add('animate__animated', 'animate__fadeInLeft');
            document.getElementById('chat-container').classList.remove('animate__animated', 'animate__fadeInRight');
            document.getElementById('chat-container').classList.add('animate__animated', 'animate__fadeInLeft');
            document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('animate__animated', 'animate__pulse'));
            document.querySelector('.profile-name').classList.remove('animate__animated', 'animate__pulse');
        }

        // Remove the animation classes after the animation ends to prepare for the next toggle
        setTimeout(function() {
            document.getElementById('sidebar').classList.remove('animate__animated', 'animate__fadeInLeft', 'animate__fadeOutLeft');
            sidebarToggleBtn.classList.remove('animate__animated', 'animate__rotateIn', 'animate__rotateOut');
            document.getElementById('content').classList.remove('animate__animated', 'animate__fadeInRight', 'animate__fadeInLeft');
            document.getElementById('chat-container').classList.remove('animate__animated', 'animate__fadeInRight', 'animate__fadeInLeft');
            document.querySelectorAll('.btn').forEach(btn => btn.classList.remove('animate__animated', 'animate__pulse'));
        }, 1000);
    });

    settingsLink.addEventListener("click", function (event) {
      event.preventDefault();
      console.log("Settings link clicked");
    });

    logoutLink.addEventListener("click", function (event) {
        event.preventDefault();
        console.log("Logout link clicked");
    });

    optionsToggle.addEventListener("click", function (event) {
        event.preventDefault();
        actions.style.display = actions.style.display === 'block' ? 'none' : 'block';
        optionsToggle.classList.toggle("expanded");
    });

    async function fetchUsername() {
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
  
          // Update the content of the profile-name div with the fetched username
          const profileNameDiv = document.querySelector('.profile-name');
          profileNameDiv.textContent = userData.username;
  
          // Populate the username field in the feedback modal
          const usernameField = document.getElementById('username');
          usernameField.value = userData.username;
  
          // Extract the user_id from the response data
          const user_id = userData.user_id;
          console.log('Fetched user_id:', user_id);
      } catch (error) {
          console.error('An error occurred', error);
      }
  }
  
  fetchUsername();
  
  
    function setCurrentConversationId(conversationId) {
      currentConversationId = conversationId;
    }
  
    function startNewConversation() {
      fetchUserId()
        .then((userId) => {
          fetch('/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
              prompt: 'new_conversation',
              conversation_id: null,
              user_id: userId // Include the user_id here
            })
          })
          .then((response) => response.json())
          .then((data) => {
            currentConversationId = data.conversation_id;
            currentContainerId = data.container_id;
          })
          .catch((error) => {
            console.error('Error:', error);
          });
        })
    }
  
    async function startSpeechRecognition() {
      if (!('SpeechRecognition' in window) && !('webkitSpeechRecognition' in window)) {
        alert('Your browser does not support the Speech Recognition API.');
        return;
      }
    
      // Use standard SpeechRecognition if available, otherwise fall back to webkitSpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
    
      // Optional: Set up some recognition parameters
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
    
      recognition.onstart = () => {
        console.log("Speech recognition started");
      };
    
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        // Assume 'inputPrompt' is the ID of your input element
        inputPrompt.value = transcript;
        console.log(`Recognized text: ${transcript}`);
      };
    
      recognition.onerror = (event) => {
        console.error(`Error occurred in recognition: ${event.error}`);
      };
    
      recognition.onend = () => {
        console.log("Speech recognition ended");
      };
    
      recognition.start();
    }
    
    
    // Function to get the user_id from the server
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
            // Resolve the promise with the user_id retrieved from the server
            resolve(data.user_id);
          })
          .catch((error) => {
            console.error('Error fetching user ID:', error);
            reject(error);
          });
      });
    }    
  
    function chat() {
      var promptInput = document.getElementById("input-prompt").value;
    
      var data = {
        prompt: promptInput,
        conversation_id: currentConversationId,
        csrf_token: csrfToken
      };
    
      sendChatRequest(data);
    }
    
  
    function sendChatRequest() {
      // First, fetch the user ID
      const message = inputPrompt.value.trim();
      fetchUserId()
        .then((userId) => {
          // userId is now available and can be used in the chat request
          console.log('Fetched user ID:', userId);
          console.log('User message:', message); // Log user message

          // Check if the message is empty
          if (message === "") {
            console.log('Message is empty; returning early'); // Log if message is empty
            return;
          }

          showWavingAnimation(true);

          fetch('/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-CSRFToken': csrfToken
            },
            body: JSON.stringify({
              conversation_id: currentConversationId,
              container_id: currentContainerId,
              user_id: userId, // Include the user_id here
              message: message
            }),
          })
            .then((response) => {
              if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
              }
              showWavingAnimation(false);
              return response.json();
            })
            .then((responseData) => {
              console.log('responseData:', responseData); // Log the entire responseData object
              if (responseData.error) {
                // If the server returned an error, log it and exit the function
                console.error('Server returned an error:', responseData.error);
                return;
              }
    
              const conversation = responseData.conversation;
              const newConversationId = responseData.conversation_id;
              const newContainerId = responseData.container_id; // retrieve the new container_id
    
              // Update the current conversation ID
              currentConversationId = newConversationId;
              // Update the current container ID
              currentContainerId = newContainerId; // update the container_id
    
              updateChatContainer(conversation);
            })
            .catch((error) => {
              console.error('Error:', error);
            });
        })
        .catch((error) => {
          showWavingAnimation(false);
          console.error('Failed to fetch user ID:', error);
          console.error('Error in sendChatRequest:', error); 
        });
    }
    
    
    
    
    function updateChatContainer(conversation) {
      console.log('Updating chat container with conversation:', conversation);
      var chatContainer = document.getElementById("chat-border");
      var chatMessages = document.getElementById("chat-container");
      chatMessages.innerHTML = "";
  
      // Check if conversation is defined and is an array before calling forEach
      if (!conversation || !Array.isArray(conversation)) {
          console.error('Invalid conversation data:', conversation);
          return;
      }
  
      conversation.forEach((message) => {
          var messageElement = createMessageElement(message, message.role === "user");
          chatMessages.appendChild(messageElement);
      });
  
      // Scroll to the bottom of the chat container
      chatContainer.scrollTop = chatContainer.scrollHeight;
  }
   

  function createMessageElement(message, fromUser) {
    var messageRow = document.createElement('div');
    messageRow.className = 'message-row';

    var messageContent = document.createElement('div');
    messageContent.className = 'content';

    var messageWrapper = document.createElement('div');
    messageWrapper.className = fromUser ? 'user-message-wrapper' : 'assistant-message-wrapper';

    var icon = document.createElement('i');
    icon.className = fromUser ? 'fa fa-user' : 'fa fa-robot';

    if (fromUser) {
        messageContent.textContent = message.content;
        messageWrapper.appendChild(icon);
        messageWrapper.appendChild(messageContent);
    } else {
        var speakButton = document.createElement('button');
        speakButton.className = 'speak-btn';
        speakButton.textContent = 'Speak';
        speakButton.onclick = function() {
            playSpeech(message.content);
        };

        // Adjust the order of appending for speakButton and icon
        messageWrapper.appendChild(speakButton);
        messageWrapper.appendChild(messageContent);
        messageWrapper.appendChild(icon);

        // Apply typing effect for assistant's message
        typeMessage(message.content, messageContent);
    }

    messageRow.appendChild(messageWrapper);
    return messageRow;
  }


  function typeMessage(text, element, speed = 50) {
    let i = 0;
    element.innerHTML = "";

    function typing() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(typing, speed);
        }
    }
    typing();
  }
 
    

  // Add this function to handle playing the speech
  // function playSpeech(text) {
  //   fetch('/synthesize', {
  //       method: 'POST',
  //       headers: {
  //           'Content-Type': 'application/x-www-form-urlencoded',
  //           'X-CSRFToken': csrfToken  // Ensure you have the CSRF token if needed
  //       },
  //       body: `text=${encodeURIComponent(text)}`
  //   })
  //   .then(response => response.json())
  //   .then(data => {
  //       if (data.audio_url) {
  //           var audio = new Audio(data.audio_url);
  //           audio.play().catch(e => console.error('Playback failed:', e));
  //       } else {
  //           console.error('Failed to get audio URL:', data.error);
  //       }
  //   })
  //   .catch(error => {
  //       console.error('Error fetching TTS audio:', error);
  //   });
  // }
  
  function playSpeech(text) {
    if (responsiveVoice.voiceSupport()) {
        responsiveVoice.speak(text, "US English Female", {
            pitch: 1, // Range from 0 to 2
            rate: 0.8,  // Range from 0.1 to 10
            volume: 1 // Range from 0 to 1
            // You can add additional options here
        });
    } else {
        console.error("ResponsiveVoice.js is not supported in this browser.");
    }
  }

      
  
    function getNewContainerId() {
      // Generate a random string of 10 alphanumeric characters
      const lettersAndDigits = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let containerId = '';
      for (let i = 0; i < 10; i++) {
        containerId += lettersAndDigits.charAt(Math.floor(Math.random() * lettersAndDigits.length));
      }
      return containerId;
    }
    
    function getNewConversationId() {
      // Generate a random string of 10 alphanumeric characters
      const lettersAndDigits = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let conversationId = '';
      for (let i = 0; i < 10; i++) {
        conversationId += lettersAndDigits.charAt(Math.floor(Math.random() * lettersAndDigits.length));
      }
      return conversationId;
    }
    
  
    function startNewChat() {
      // Generate a new container ID and store it in the Firebase Realtime Database
      fetch('/new_chat', {
        method: 'POST'
      })
      .then((response) => response.json())
      .then((data) => {
        // Set the current container ID and conversation ID to the new IDs
        currentContainerId = data.container_id;
        currentConversationId = data.conversation_id;
    
        // Clear the chat after the new IDs have been set
        var inputPrompt = document.getElementById("input-prompt");
        inputPrompt.value = "";
    
        var chatContainer = document.getElementById("chat-container");
        chatContainer.innerHTML = "";
    
        // Update the chat container with the new conversation data
        updateChatContainer([]);
      })
      .catch((error) => {
        console.error('Error:', error);
      });
    }
    
    
    

    document.getElementById("new-chat-button").addEventListener('click', startNewChat);
  
    window.addEventListener("DOMContentLoaded", function () {
      // Check if there is a current conversation ID in local storage
      const storedConversationId = localStorage.getItem('currentConversationId');
    
      if (storedConversationId) {
        // Continue the previous conversation
        setCurrentConversationId(storedConversationId);
      } else {
        // Start a new conversation
        startNewConversation();
      }
    });

    // Start a new conversation when the page is loaded
    startNewConversation();

    speaksButton.addEventListener('click', toggleSpeech);

    //Logout button
    document.getElementById("logout").addEventListener("click", function(e) {
      e.preventDefault(); // Prevent the default link behavior
      handleLogout();
    });

    $(document).ready(function () {
      // Retrieve the saved theme and image settings from localStorage
      var savedTheme = localStorage.getItem('theme');
      var savedImage = localStorage.getItem('image');
    
      // Apply the saved theme and image settings
      if (savedTheme) applyTheme(savedTheme);
      if (savedImage) applyChatContainerImage(savedImage);
    
      $('#settings').click(function (e) {
        e.preventDefault();
        $('#settingsModal').modal('show');
        actions.style.display = 'none';
      });
    
      $('#saveSettings').click(function () {
        // Check if the theme section is active
        if ($('#themeSettingsButton').hasClass('active')) {
          var theme = $('#themeSelect').val();
          applyTheme(theme);
          localStorage.setItem('theme', theme); // Save the theme to localStorage
        }
    
        // Check if the image section is active
        if ($('#imageSettingsButton').hasClass('active')) {
          var image = $('#imageSelect').val();
          applyChatContainerImage(image); // Implement this function to handle image change
          localStorage.setItem('image', image); // Save the image to localStorage
        }
    
        $('#settingsModal').modal('hide');
      });
    
      $('#themeSettingsButton').click(function () {
        $('#themeSection').show();
        $('#imageSection').hide();
        $('.settings-nav-btn').removeClass('active');
        $(this).addClass('active');
      });
    
      $('#imageSettingsButton').click(function () {
        $('#themeSection').hide();
        $('#imageSection').show();
        $('.settings-nav-btn').removeClass('active');
        $(this).addClass('active');
      });
    });
    
    
    function applyChatContainerImage(imageName) {
      // Define the image paths (You can modify these paths to your actual image locations)
      var images = {
        none: null,
        image1: '../static/background/image1.jpeg',
        image2: '../static/background/image2.jpeg',
        image3: '../static/background/image3.jpeg'
      };
    
      // Apply the selected image as the background of the chat container
      $('#chat-border').css({
        'background-image': 'url(' + images[imageName] + ')',
        'background-repeat': 'no-repeat', // Prevents the image from repeating
        'background-size': 'cover' // Adjusts the size of the background to cover the container
      });
    }
    

    function initializeVanta(color) {
      if (vantaWaves) {
        vantaWaves.destroy();
      }
      
      vantaWaves = VANTA.WAVES({
        el: "body",
        mouseControls: true,
        touchControls: true,
        gyroControls: false,
        minHeight: 200.00,
        minWidth: 200.00,
        scale: 1.00,
        scaleMobile: 1.00,
        color: color,
        shininess: 50.00,
        waveHeight: 20.00,
        waveSpeed: 1.00,
        zoom: 0.83
      });
    }

    function applyTheme(theme) {
      switch (theme) {
        case 'red':
          initializeVanta(0xA70D2A);
          break;
        case 'green':
          initializeVanta(0x93FFE8);
          break;
        case 'blue':
          initializeVanta(0x87CEFA);
          break;
        case 'purple':
          initializeVanta(0x7E354D);
          break;
        case 'lavender':
          initializeVanta(0xDFC5FE);
          break;
      }
    }

    initializeVanta(0xDFC5FE);

    $('#feedbackModal').on('show.bs.modal', function() {
      actions.style.display = "none";
    });

    $('#feedbackForm').submit(function(e) {
      e.preventDefault();

      const username = $('#username').val();
      const feedback = $('#feedback').val();

      // Send the feedback to the server
      $.ajax({
          url: '/send_feedback',
          method: 'POST',
          headers: {
              'X-CSRFToken': csrfToken
          },
          contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
          data: $('#feedbackForm').serialize(),
          success: function(response) {
              alert('Feedback submitted successfully!');
              // Close the modal
              $('#feedbackModal').modal('hide');
          },
          error: function(error) {
              alert('An error occurred while submitting your feedback.');
          }
      });
      console.log("Username:", username); // Check the username value
      console.log("Feedback:", feedback); // Check the feedback value
    });
  
});
