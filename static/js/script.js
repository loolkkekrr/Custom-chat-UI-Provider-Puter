const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const modelSelect = document.getElementById('model-select');
let isLoading = false;
let loadingElement = null;


// Initialize Prism plugins
Prism.plugins.lineNumbers.assumeViewportIndependence = false;
document.addEventListener('DOMContentLoaded', () => {
    loadModels();
    const textarea = document.getElementById('message-input');
    
    // Function to automatically resize textarea based on content
    function autoResizeTextarea() {
        textarea.style.height = 'auto'; // Reset height
        const newHeight = Math.min(150, Math.max(24, textarea.scrollHeight - 64));
        textarea.style.height = newHeight + 'px';
    }
    
    // Add event listeners for input changes
    textarea.addEventListener('input', autoResizeTextarea);
    
    // Initial resize
    autoResizeTextarea();
    
    // Allow Enter to submit, but Shift+Enter for new line
    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // Prevent default behavior (new line)
            document.getElementById('send-button').click(); // Simulate button click
            autoResizeTextarea()
        }
    });
});
function loadModels() {
    fetch('/models')
        .then(response => response.json())
        .then(models => {
            const modelSelect = document.getElementById('model-select');
            modelSelect.innerHTML = ''; // Clear existing options
            
            // Flatten the array of objects structure from models.json
            models.forEach(modelGroup => {
                Object.entries(modelGroup).forEach(([name, config]) => {
                    const option = document.createElement('option');
                    option.textContent = name;
                    option.value = JSON.stringify({
                        provider: config.provider,
                        model: config.model
                    });
                    modelSelect.appendChild(option);
                });
            });
        })
        .catch(error => {
            console.error('Error loading models:', error);
            // Add a default option in case models fail to load
            const option = document.createElement('option');
            option.textContent = 'Claude 3.7 Thinking (Default)';
            option.value = JSON.stringify({
                provider: "openrouter",
                model: "openrouter:anthropic/claude-3.7-sonnet:thinking"
            });
            modelSelect.appendChild(option);
        });
}
const sanitizeConfig = {
    ALLOWED_TAGS: ['div', 'pre', 'code', 'span', 'button', 'svg', 'path', 'strong', 'em', 'a', 'img'],
    ALLOWED_ATTR: ['class', 'onclick', 'href', 'target', 'viewbox', 'd', 'fill', 'src', 'alt'],
    FORBID_TAGS: ['script', 'style', 'iframe'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['class'],
    SANITIZE_DOM: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^#/\\?]*?#?)/i
};

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function disableSendButton() {
    sendButton.disabled = true;
    sendButton.classList.add('disabled');
}

function enableSendButton() {
    sendButton.disabled = false;
    sendButton.classList.remove('disabled');
}
function formatMessage(message) {
    const codeBlocks = [];
    const placeholderPrefix = '🄲🄱🄻🄾🄲🄺';

    let processedMessage = message.replace(/```([\s\S]*?)```/g, (match, code) => {
        const blockId = codeBlocks.length;
        code = code.replace(/^(\w+)\n/, (_, lang) => `LANG:${lang}\n`);
        codeBlocks.push({
            html: `<div class="code-container">${generateCodeBlockHtml(code)}</div>`,
                        raw: code
        });
        return `${placeholderPrefix}${blockId}${placeholderPrefix}`;
    });

    processedMessage = processedMessage
    .replace(/###\s+(.+)/g, '<h3 class="heading">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, (_, code) => `<code class="inline-code">${escapeHtml(code)}</code>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => {
        return DOMPurify.sanitize(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(text)}</a>`, sanitizeConfig);
    });

    processedMessage = processedMessage.replace(
        new RegExp(`${placeholderPrefix}(\\d+)${placeholderPrefix}`, 'g'),
                                                (_, id) => codeBlocks[id]?.html || ''
    );

    return DOMPurify.sanitize(processedMessage, sanitizeConfig);
}

function generateCodeBlockHtml(code) {
    const langMatch = code.match(/^LANG:(\w+)\n/);
    const lang = langMatch ? langMatch[1].toLowerCase() : 'plaintext';
    const codeContent = langMatch ? code.replace(/^LANG:\w+\n/, '') : code;

    return `
    <div class="code-header">
    <span class="code-lang">${escapeHtml(lang)}</span>
    <button class="copy-button" onclick="copyCode(this)" aria-label="Copy code">
    <svg class="copy-icon" viewBox="0 0 24 24" width="18" height="18">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
    </button>
    </div>
    <pre class="code-block line-numbers"><code class="language-${escapeHtml(lang)}">${escapeHtml(codeContent)}</code></pre>`;
}
// script.js
let currentRegeneration = false;

function regenerateLastResponse() {
    if (currentRegeneration) return;
    currentRegeneration = true;

    // Удаляем последний ответ ИИ из истории
    const lastAssistantIndex = chatHistory.findLastIndex(msg => msg.role === "assistant");
    if (lastAssistantIndex !== -1) {
        chatHistory.splice(lastAssistantIndex, 1);
    }

    // Удаляем последнее сообщение ИИ из DOM
    const aiMessages = document.querySelectorAll('.ai-message');
    if (aiMessages.length > 0) {
        aiMessages[aiMessages.length - 1].remove();
    }

    updateRegenerateButtons(); // Обновляем кнопки после удаления

    // Находим последнее сообщение пользователя
    const lastUserMessage = chatHistory[chatHistory.length - 1];
    if (!lastUserMessage || lastUserMessage.role !== "user") {
        currentRegeneration = false;
        return;
    }

    // Отправляем запрос с текущей историей
    showLoading();

    const selectedOption = JSON.parse(modelSelect.value);
    const provider = selectedOption.provider;
    const model = selectedOption.model;

    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: chatHistory,
            provider: provider, // Добавляем провайдера
            model: model 
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        currentRegeneration = false;
        if (data.error) {
            addMessage('Ошибка: ' + data.error, false);
        } else {
            chatHistory.push({ role: "assistant", content: data.response });
            addMessage(data.response, false);
        }
    })
    .catch(error => {
        hideLoading();
        currentRegeneration = false;
        console.error('Error:', error);
        addMessage('Произошла ошибка при отправке сообщения.', false);
    });
}
function updateRegenerateButtons() {
    const aiMessages = document.querySelectorAll('.ai-message');
    aiMessages.forEach((msg, index) => {
        const btnContainer = msg.querySelector('.regenerate-container');
        if (btnContainer) {
            btnContainer.style.display = index === aiMessages.length - 1 ? 'flex' : 'none';
        }
    });
}
function addMessage(message, isUser) {
    setTimeout(() => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isUser ? 'user-message' : 'ai-message');
        
        let buttons = '';
        if (!isUser) {
            buttons = `
                <div class="regenerate-container" style="display: none">
                    <button class="regenerate-button" onclick="regenerateLastResponse()">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="white">
                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                        </svg>
                    </button>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="message-content">${formatMessage(message)}</div>
            ${buttons}
        `;

        chatBox.appendChild(messageDiv);
        
        if (!isUser) {
            updateRegenerateButtons();
        }
        setTimeout(() => {
            Prism.highlightAll();
            Prism.plugins.lineNumbers.resize();
        }, 50);

        chatBox.scrollTop = chatBox.scrollHeight;
    }, 300);
}

function copyCode(button) {
    try {
        const allowedContainers = ['code-container'];
        if (!allowedContainers.some(c => button.closest(`.${c}`))) {
            throw new Error('Untrusted copy source');
        }

        const codeBlock = button.closest('.code-container').querySelector('.code-block');
        const text = codeBlock.textContent;

        navigator.clipboard.writeText(text).then(() => {
            showCopyFeedback(button);
        }).catch(() => {
            fallbackCopy(text, button);
        });
    } catch (error) {
        console.error('Copy failed:', error);
        button.classList.add('copy-error');
        setTimeout(() => button.classList.remove('copy-error'), 2000);
    }
}

function fallbackCopy(text, button) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showCopyFeedback(button);
}

function showCopyFeedback(button) {
    button.innerHTML = '<svg class="check-icon" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>';
    button.classList.add('copied');
    setTimeout(() => {
        button.innerHTML = '<svg class="copy-icon" viewBox="0 0 24 24"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/></svg>';
        button.classList.remove('copied');
    }, 2000);
}

function showLoading() {
    if (isLoading) return;
    
    isLoading = true;
    disableSendButton(); // Отключаем кнопку отправки
    
    setTimeout(() => {
        loadingElement = document.createElement('div');
        loadingElement.className = 'message ai-message loading-message';
        loadingElement.innerHTML = `
        <div class="loading-dots">
        <div></div>
        <div></div>
        <div></div>
        </div>
        <span>Генерируем ответ...</span>
        `;
        chatBox.appendChild(loadingElement);
        chatBox.scrollTop = chatBox.scrollHeight;
    }, 600);
}

function hideLoading() {
    if (loadingElement && isLoading) {
        loadingElement.classList.add('loading-message-remove');
        setTimeout(() => {
            loadingElement.remove();
            isLoading = false;
            loadingElement = null;
            enableSendButton(); // Включаем кнопку отправки
        }, 300);
    }
}

let chatHistory = [];

function sendMessage() {
    // Проверяем, идет ли уже генерация ответа
    if (isLoading) {
        // Если идет генерация, не позволяем отправить новое сообщение
        return;
    }
    
    const message = messageInput.value.trim();
    const selectedOption = JSON.parse(modelSelect.value);
    const provider = selectedOption.provider;
    const model = selectedOption.model;
    
    if (!message) return;
    
    chatHistory.push({ role: "user", content: message });
    addMessage(message, true);
    messageInput.value = '';
    showLoading();
    
    fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            messages: chatHistory,
            provider: provider,
            model: model 
        })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            addMessage('Ошибка: ' + data.error, false);
        } else {
            // Добавляем ответ AI в историю
            chatHistory.push({ role: "assistant", content: data.response });
            addMessage(data.response, false);
        }
    })
    .catch(error => {
        hideLoading();
        console.error('Error:', error);
        addMessage('Произошла ошибка при отправке сообщения.', false);
    });
}


sendButton.addEventListener('click', sendMessage);
