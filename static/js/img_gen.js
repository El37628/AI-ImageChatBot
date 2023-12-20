document.addEventListener('DOMContentLoaded', (event) => {
    const speaksButton = document.getElementById("speaks-button");
    const inputPrompt = document.getElementById("input-prompt");
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const hiddenTextarea = document.createElement("textarea");
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    hiddenTextarea.style.position = "absolute";
    hiddenTextarea.style.top = "-9999px";
    hiddenTextarea.style.left = "-9999px";
    hiddenTextarea.style.visibility = "hidden";
    let currentConversationId;
    let currentContainerId;
    var vantaWaves;
    document.body.appendChild(hiddenTextarea);
    speaksButton.addEventListener('click', toggleSpeech);
    document.getElementById("new-chat-button").addEventListener('click', startNewChat);
    const settingsLink = document.getElementById("settings");
    const logoutLink = document.getElementById("logout");
    const optionsToggle = document.getElementById("options-toggle");
    const actions = document.getElementById("actions");

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

    inputPrompt.addEventListener('focus', function() {
      fadePlaceholder(this, true);
    });

    inputPrompt.addEventListener('blur', function() {
        fadePlaceholder(this, false);
    });

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

    function showWavingAnimation(show) {
      const waving = document.getElementById('waving');
      waving.style.visibility = show ? 'visible' : 'hidden'; // Control visibility along with opacity
      waving.style.opacity = show ? '1' : '0';
      waving.style.height = show ? 'auto' : '0';
    }

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

    function showFeaturesModal() {
        $('#featuresModal').modal('show');
    }
    document.getElementById("features-button").addEventListener('click', showFeaturesModal);

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

    function getNewContainerId() {
      // Generate a random string of alphanumeric characters for the container ID
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      const charactersLength = characters.length;
      for (let i = 0; i < 10; i++) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
      }
      return result;
    }
  

    async function fetchUsername() {
      try {
          const response = await fetch('/get_username', {
              method: 'GET',
              headers: {
                  'Content-Type': 'application/json',
                  'X-CSRFToken': csrfToken
              }
          });
  
          if (!response.ok) {
              throw new Error('User not found');
          }
  
          const userData = await response.json();
  
          const profileNameDiv = document.querySelector('.profile-name');
          profileNameDiv.textContent = userData.username;
  
          const usernameField = document.getElementById('username');
          if (usernameField) {
              usernameField.value = userData.username;
          }
  
          currentConversationId = userData.user_id;
          currentContainerId = getNewContainerId(); // Assuming this function generates a new ID
      } catch (error) {
          console.error('An error occurred', error);
      }
    }
    
    fetchUsername();

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
        var numImage = 1;  // replace with the desired number of images
        var size = '256x256';  // replace with the desired image size

        fetchUserId()
            .then((userId) => {
            showWavingAnimation(true);
            fetch('/generate_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken  // include the CSRF token in the request header
                },
                body: JSON.stringify({
                    prompt: promptInput,
                    num_image: numImage,
                    size: size,
                    user_id: userId,
                    container_id: currentContainerId,
                    conversation_id: currentConversationId,
                    message: promptInput  // Add the user input as a regular message
                })
            })
            .then((response) => {
              showWavingAnimation(false);
              return response.json()
            })
            .then((data) => {
                if (data.image_url && Array.isArray(data.image_url)) {
                    var conversation = [{ role: "user", content: promptInput }];
                
                    data.image_url.forEach((imageUrl) => {
                        conversation.push({ role: "system", content: imageUrl });
                    });
                
                    updateChatContainer(conversation);
                } else {
                    console.error('Error: no images received from server');
                }
            })
            .catch((error) => {
              showWavingAnimation(false);
              console.error('Error:', error);
            });
        })
    }

    function updateChatContainer(conversation) {
        console.log('Updating chat container with conversation:', conversation);
        var chatContainer = document.getElementById("chat-border");
        var chatMessages = document.getElementById("chat-container");
        //chatMessages.innerHTML = "";
    
        // Check if conversation is defined and is an array before calling forEach
        if (!conversation || !Array.isArray(conversation)) {
            console.error('Invalid conversation data:', conversation);
            return;
        }
    
        conversation.forEach((message) => {
          var messageElement;
          if (message.role === "system") {
            // Create a wrapper for the image and icon
            var messageWrapper = document.createElement('div');
            messageWrapper.className = 'assistant-message-wrapper';

            // Create an icon element
            var icon = document.createElement('i');
            icon.className = 'fa fa-robot';

            // Create an image element
            var imgElement = document.createElement("img");
            imgElement.src = "data:image/png;base64," + message.content;
            imgElement.alt = "Generated image";
            imgElement.className = "generated-image";

            // Append the image and icon to the wrapper
            messageWrapper.appendChild(imgElement);
            messageWrapper.appendChild(icon);

            messageElement = messageWrapper;
          } else {
              messageElement = createMessageElement(message, message.role === "user");
          }
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
      messageContent.textContent = message.content;
  
      var messageWrapper = document.createElement('div');
      messageWrapper.className = fromUser ? 'user-message-wrapper' : 'assistant-message-wrapper';
  
      var icon = document.createElement('i');
      icon.className = fromUser ? 'fa fa-user' : 'fa fa-robot';
  
      if (fromUser) {
          messageWrapper.appendChild(icon); // Icon first for user messages
          messageWrapper.appendChild(messageContent);
      } else {
          messageWrapper.appendChild(messageContent);
          messageWrapper.appendChild(icon); // Icon after content for assistant messages
      }
  
      messageRow.appendChild(messageWrapper);
      return messageRow;
    }
  
  
    

    function startNewChat() {
        // Clear the chat after the new IDs have been set
        var inputPrompt = document.getElementById("input-prompt");
        inputPrompt.value = "";
    
        var chatContainer = document.getElementById("chat-container");
        chatContainer.innerHTML = "";
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

    //Logout button
    document.getElementById("logout").addEventListener("click", function(e) {
        e.preventDefault(); // Prevent the default link behavior
        handleLogout();
      });

          //Setting modal card
    $(document).ready(function () {
        $('#settings').click(function (e) {
            e.preventDefault();
            $('#settingsModal').modal('show');
        });
    
        $('#saveSettings').click(function () {
            var theme = $('#themeSelect').val();
            applyTheme(theme);
            $('#settingsModal').modal('hide');
        });
      });
      
      function applyTheme(theme) {
        var chatContainer = $('#chat-border');
        chatContainer.removeClass('bg-light bg-dark');
        
        switch (theme) {
          case 'light':
            chatContainer.addClass('bg-light');
            break;
          case 'dark':
            chatContainer.addClass('bg-dark');
            break;
        }
      }

      function setCurrentConversationId(conversationId) {
        currentConversationId = conversationId;
      }
    
    function startNewConversation() {
        fetch('/start_new_conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken   // Include the CSRF token in the request header
            },
            body: JSON.stringify({
                conversation_id: null,
                container_id: null
            })
        })
        .then((response) => response.json())
        .then((data) => {
            currentConversationId = data.conversation_id;
            currentContainerId = data.container_id;

            localStorage.setItem('currentConversationId', currentConversationId);
            localStorage.setItem('currentContainerId', currentContainerId);

        })
        .catch((error) => {
            console.error('Error:', error);
        });
    }
    
    

    window.addEventListener("DOMContentLoaded", function () {
        // Check if there is a current conversation ID in local storage
        const storedConversationId = localStorage.getItem('currentConversationId');
        const storedContainerId = localStorage.getItem('currentContainerId');

        if (storedConversationId && storedContainerId) {
            // Continue the previous conversation
            setCurrentConversationId(storedConversationId);
            currentContainerId = storedContainerId; // set the container ID from local storage
        } else {
            // Start a new conversation
            startNewConversation();
        }
    });

    startNewConversation();

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
  
      document.getElementById('feedbackForm').addEventListener('submit', function(e) {
        e.preventDefault();
    
        const formData = new FormData(this);
        const formObject = {};
        formData.forEach((value, key) => { formObject[key] = value; });
    
        const formBody = new URLSearchParams(formObject).toString();
    
        fetch('/send_feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-CSRFToken': csrfToken
            },
            body: formBody
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            alert('Feedback submitted successfully!');
            // Close the modal
            document.getElementById('feedbackModal').style.display = 'none'; // Adjust as per your modal close logic
        })
        .catch(error => {
            console.error('There was a problem with your fetch operation:', error);
            alert('An error occurred while submitting your feedback.');
        });
      });    

});