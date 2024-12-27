
let currentQuestion = 0;
let totalPoints = 0;
let currentQuestionText = "";
let currentQuestionRange = "";
let waitingForAnswer = true;
let isIntroQuestion = true;

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const userName = urlParams.get('name') || 'Candidate';
const numQuestions = parseInt(urlParams.get('questions'), 10) || 5;
const totalQuestions = numQuestions + 1;
const jobRole = urlParams.get('job_role') || 'Software Developer';

// DOM Elements
const chatContainer = document.getElementById('chat-container');
const typingIndicator = document.getElementById('typing-indicator');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const progressFill = document.getElementById('progress-fill');
const pointsDisplay = document.getElementById('points');
const progressDisplay = document.getElementById('progress');
const resultModal = document.getElementById('result-modal');
const successAnimation = document.getElementById('success-animation');
const tryAgainAnimation = document.getElementById('try-again-animation');

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function updateProgress() {
    const progressPercentage = (currentQuestion / totalQuestions) * 100;
    progressFill.style.width = `${progressPercentage}%`;
    progressDisplay.textContent = `Progress: ${Math.round(progressPercentage)}%`;
}

async function typeText(element, text) {
    const words = text.split(' ');
    element.textContent = '';
    for (let i = 0; i < words.length; i++) {
        element.textContent += words[i] + ' ';
        await sleep(50);
    }
}
function closeModal() {
    resultModal.classList.remove('show');
}

function showTypingIndicator() {
    typingIndicator.style.display = 'flex';
}

function hideTypingIndicator() {
    typingIndicator.style.display = 'none';
}

function showResult(isSelected) {
    resultModal.classList.add('show');
    if (isSelected) {
        successAnimation.classList.remove('hidden');
        tryAgainAnimation.classList.add('hidden');
    } else {
        successAnimation.classList.add('hidden');
        tryAgainAnimation.classList.remove('hidden');
    }
}

// Message handling
async function appendMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    
    if (type === 'bot' || type === 'feedback') {
        showTypingIndicator();
        await sleep(1000);
        
        if (type === 'feedback') {
            messageDiv.innerHTML = text
                .replace(/\n/g, '<br>')
                .replace(/Score: (\d+\/10)/, '<strong>Score: $1</strong>')
                .replace(/Grammar: (.*?)(<br>|$)/, '<strong>Grammar:</strong> $1$2')
                .replace(/Assessment: (.*?)(<br>|$)/, '<strong>Assessment:</strong> $1$2')
                .replace(/To improve: (.*?)(<br>|$)/, '<strong>To improve:</strong> $1$2');
        } else {
            const textSpan = document.createElement('span');
            messageDiv.appendChild(textSpan);
            await typeText(textSpan, text);
        }
        
        hideTypingIndicator();
    } else {
        messageDiv.textContent = text;
    }
    
    chatContainer.insertBefore(messageDiv, typingIndicator);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
    
    // Trigger animation after insert
    requestAnimationFrame(() => {
        messageDiv.classList.add('show');
    });
}

// API interaction
async function fetchNextQuestion() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const resumeText = urlParams.get('resume') || '';
        
        currentQuestionRange = currentQuestion <= numQuestions * 0.5
            ? 'core_skills'
            : currentQuestion <= numQuestions * 0.8
            ? 'resume_based'
            : 'general';

        const response = await fetch('/generate_question', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                job_role: jobRole,
                resume: resumeText,
                question_range: currentQuestionRange
            })
        });

        const data = await response.json();
        if (data.question) {
            currentQuestionText = data.question;
            await appendMessage(
                `Question ${currentQuestion}/${totalQuestions} (${currentQuestionRange}):\n${data.question}`,
                'bot'
            );
        }
    } catch (error) {
        console.error('Error:', error);
        await appendMessage('Error generating question. Please refresh the page.', 'bot');
    }
}

// Input handling
async function handleUserInput() {
    if (!waitingForAnswer) return;
    
    const input = userInput.value.trim();
    if (!input) return;

    waitingForAnswer = false;
    userInput.value = '';
    userInput.disabled = true;
    sendButton.disabled = true;
    
    await appendMessage(input, 'user');
    currentQuestion++;
    updateProgress();

    try {
        const endpoint = isIntroQuestion ? '/ask_personal_question' : '/evaluate_response';
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestionText,
                user_response: input
            })
        });

        const data = await response.json();
        totalPoints += parseInt(data.Score);
        pointsDisplay.textContent = `Points: ${totalPoints}`;
        
        await appendMessage(
            `Score: ${data.Score}/10\nAssessment: ${data.Overall_assessment}\nTo improve: ${data.To_improve_answer}\nGrammar: ${data.grammar_suggestion}`,
            'feedback'
        );

        if (isIntroQuestion) {
            isIntroQuestion = false;
            await fetchNextQuestion();
        } else if (currentQuestion < totalQuestions) {
            await fetchNextQuestion();
        } else {
            const finalScore = (totalPoints / (totalQuestions * 10)) * 100;
            const isSelected = finalScore >= 60;
            
            await appendMessage(
                `Interview Complete!\nFinal Score: ${finalScore.toFixed(2)}%\nStatus: ${isSelected ? 'Selected' : 'Not Selected'}\n\nThank you for participating in this interview process.`,
                'bot'
            );
            
            showResult(isSelected);
            return;
        }
    } catch (error) {
        await appendMessage('Error processing response. Please try again.', 'bot');
        console.error('Error:', error);
    }
    
    userInput.disabled = false;
    sendButton.disabled = false;
    waitingForAnswer = true;
}

// Event listeners
sendButton.addEventListener('click', handleUserInput);
userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleUserInput();
});

// Initialize chat
async function initializeChat() {
    await sleep(1000);
    await appendMessage(
        `Welcome ${userName}! Let's begin your interview for the position of ${jobRole}.`,
        'bot'
    );
    await sleep(1000);
    
    currentQuestion = 0;
    updateProgress();
    currentQuestionText = "Tell me about yourself.";
    currentQuestionRange = "Introduction";
    
    await appendMessage(
        `Question ${currentQuestion + 1}/${totalQuestions} (${currentQuestionRange}):\nPlease tell me about yourself.`,
        'bot'
    );
    
    userInput.disabled = false;
    sendButton.disabled = false;
}

// Start the chat
initializeChat();
