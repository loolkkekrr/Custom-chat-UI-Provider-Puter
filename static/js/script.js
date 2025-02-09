const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const modelSelect = document.getElementById('model-select');
let isLoading = false;
let loadingElement = null;

const sanitizeConfig = {
    ALLOWED_TAGS: ['div', 'pre', 'code', 'span', 'button', 'svg', 'path', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['class', 'onclick', 'href', 'target', 'viewbox', 'd', 'fill'],
    FORBID_TAGS: ['script', 'style', 'iframe'],
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ['class']
};

function escapeHtml(text) {
    return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
    .replace(/`(.+?)`/g, '<code class="inline-code">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
    .replace(/\n\s*-\s+/g, '\n<li>')
    .replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');

    processedMessage = processedMessage.replace(
        new RegExp(`${placeholderPrefix}(\\d+)${placeholderPrefix}`, 'g'),
                                                (_, id) => codeBlocks[id]?.html || ''
    );

    return DOMPurify.sanitize(processedMessage, sanitizeConfig);
}

function generateCodeBlockHtml(code) {
    const langMatch = code.match(/^LANG:(\w+)\n/);
    const lang = langMatch ? langMatch[1] : 'plaintext';
    const codeContent = langMatch ? code.replace(/^LANG:\w+\n/, '') : code;

    return `
    <div class="code-header">
    <span class="code-lang">${escapeHtml(lang)}</span>
    <button class="copy-button" onclick="copyCode(this)">
    <svg class="copy-icon" viewBox="0 0 24 24">
    <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
    </button>
    </div>
    <pre class="code-block"><code class="language-${escapeHtml(lang)}">${escapeHtml(codeContent)}</code></pre>
    `;
}

function addMessage(message, isUser) {
    setTimeout(() => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', isUser ? 'user-message' : 'ai-message');
        messageDiv.innerHTML = formatMessage(message);
        chatBox.appendChild(messageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
        Prism.highlightAllUnder(chatBox);
    }, 300);
}

function copyCode(button) {
    try {
        const codeBlock = button.closest('.code-container').querySelector('.code-block');
        const text = codeBlock.textContent;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(() => {
                showCopyFeedback(button);
            }).catch(() => {
                fallbackCopy(text, button);
            });
        } else {
            fallbackCopy(text, button);
        }
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
        }, 300);
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    const selectedModel = modelSelect.value;
    if (!message) return;

    addMessage(message, true);
    messageInput.value = '';
    showLoading();

    fetch('/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: message, model: selectedModel })
    })
    .then(response => response.json())
    .then(data => {
        hideLoading();
        if (data.error) {
            addMessage('Ошибка: ' + data.error, false);
        } else {
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
messageInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
});
