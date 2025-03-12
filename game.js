let socket = io();
let localState = {
    players: [],
    phase: 'lobby',
    role: null,
    isSabotador: false,
    round: 0,
    maxRounds: 3
};

// Controles de voz
let isMicActive = false;
let mediaRecorder;

// Função para entrar no jogo
function joinGame() {
    const playerName = document.getElementById('playerName').value;
    if (!playerName) {
        alert('Por favor, digite seu nome para entrar');
        return;
    }
    
    socket.emit('join-game', playerName);
    
    // Esconder tela de login e mostrar o jogo
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
}

// Função para iniciar o jogo
function startGame() {
    socket.emit('start-game');
}

async function toggleMic() {
    if (!isMicActive) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            // Implementar envio de áudio via WebRTC/Socket
            document.getElementById('mic-button').textContent = '🔴 Gravando';
        } catch (err) {
            console.error('Erro ao acessar microfone:', err);
            alert('Não foi possível acessar o microfone');
        }
    } else {
        document.getElementById('mic-button').textContent = '🎤';
        // Parar gravação se estiver ativa
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
    }
    isMicActive = !isMicActive;
}

function updateGamePhase(phase) {
    const gamePhase = document.getElementById('game-phase');
    gamePhase.innerHTML = '';

    switch(phase) {
        case 'lobby':
            let lobbyContent = `<div class="phase-box">
                <h3>Aguardando Jogadores</h3>
                <p>Esperando mais jogadores entrarem...</p>`;
            
            // Mostrar botão de iniciar jogo apenas para o anfitrião e se tiver jogadores suficientes
            if (localState.canStart) {
                const isHost = localState.players.some(p => p.id === socket.id && p.isHost);
                if (isHost) {
                    lobbyContent += `<button onclick="startGame()" class="start-button">Iniciar Jogo</button>`;
                } else {
                    lobbyContent += `<p>O anfitrião pode iniciar o jogo quando estiver pronto.</p>`;
                }
            } else {
                lobbyContent += `<p>São necessários pelo menos 3 jogadores para iniciar.</p>`;
            }
            
            lobbyContent += `</div>`;
            gamePhase.innerHTML = lobbyContent;
            break;
            
        case 'question':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fase de Perguntas (Rodada ${localState.round}/${localState.maxRounds})</h3>
                <p>Discuta com os outros jogadores e decida qual pergunta fazer para identificar a IA.</p>
                <textarea id="question-input" placeholder="Digite sua pergunta aqui..."></textarea>
                <button onclick="submitQuestion()">Enviar Pergunta</button>
            </div>`;
            break;
        
        case 'vote':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fase de Votação (Rodada ${localState.round}/${localState.maxRounds})</h3>
                <p>Vote em qual resposta você acha que foi dada pela IA:</p>
                <div id="answers-container" class="answers"></div>
                <div id="voting-buttons"></div>
            </div>`;
            break;
            
        case 'results':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Resultados (Rodada ${localState.round}/${localState.maxRounds})</h3>
                <p>Veja como os jogadores votaram:</p>
                <div id="results-container"></div>
                <p>Próxima rodada começará em alguns segundos...</p>
            </div>`;
            break;
            
        case 'gameOver':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fim de Jogo</h3>
                <div id="final-results"></div>
                <button onclick="location.reload()">Jogar Novamente</button>
            </div>`;
            break;
    }
    
    // Mostrar informações do papel do jogador se estiver jogando
    if (phase !== 'lobby' && localState.role) {
        const roleInfo = document.createElement('div');
        roleInfo.className = 'role-info';
        
        if (localState.isSabotador) {
            roleInfo.innerHTML = `<p><strong>Seu papel:</strong> Sabotador</p>
                <p>Tente identificar a identidade real de um jogador ou ajude a IA a não ser descoberta.</p>`;
        } else {
            roleInfo.innerHTML = `<p><strong>Seu papel:</strong> Jogador</p>
                <p>Tente identificar qual resposta é da IA.</p>`;
        }
        
        gamePhase.appendChild(roleInfo);
    }
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '<h3>Jogadores</h3>';
    
    players.forEach(player => {
        let playerClass = player.isHost ? 'player-card host' : 'player-card';
        playersList.innerHTML += `<div class="${playerClass}">
            ${player.name} ${player.isHost ? '(Anfitrião)' : ''}
        </div>`;
    });
}

socket.on('connect', () => {
    console.log('Conectado ao servidor!');
});

socket.on('game-update', (state) => {
    console.log('Atualização do jogo:', state);
    localState = {...localState, ...state};
    
    if (state.players) {
        updatePlayersList(state.players);
    }
    
    if (state.phase) {
        updateGamePhase(state.phase);
    }
});

socket.on('role-assigned', (roleData) => {
    console.log('Papel atribuído:', roleData);
    localState.role = roleData.role;
    localState.isSabotador = roleData.isSabotador;
    
    // Mostrar notificação do papel
    const notification = document.createElement('div');
    notification.className = 'role-notification';
    
    if (roleData.isSabotador) {
        notification.innerHTML = `<h3>Você é o Sabotador!</h3>
            <p>Sua missão é identificar a identidade real de um jogador ou ajudar a IA a não ser descoberta.</p>`;
    } else {
        notification.innerHTML = `<h3>Você é um Jogador!</h3>
            <p>Sua missão é identificar qual resposta é da IA.</p>`;
    }
    
    document.body.appendChild(notification);
    
    // Remover notificação após alguns segundos
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 1000);
    }, 5000);
});

socket.on('new-message', (msg) => {
    const chat = document.getElementById('chat-messages');
    chat.innerHTML += `<div class="message">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight; // Auto-scroll para a mensagem mais recente
});

socket.on('show-answers', (answers) => {
    const answersContainer = document.getElementById('answers-container');
    if (!answersContainer) return;
    
    answersContainer.innerHTML = '<h4>Respostas:</h4>';
    
    answers.forEach((answer, index) => {
        answersContainer.innerHTML += `
            <div class="answer-card">
                <p><strong>Resposta ${index + 1}:</strong> ${answer.humanAnswer || answer.aiAnswer}</p>
                <button onclick="voteForAnswer(${index})">Votar</button>
            </div>
        `;
    });
});

socket.on('vote-results', (data) => {
    const resultsContainer = document.getElementById('results-container');
    if (!resultsContainer) return;
    
    resultsContainer.innerHTML = '<h4>Resultados da Votação:</h4>';
    
    data.results.forEach(result => {
        const answer = data.answers[result.answerIndex];
        resultsContainer.innerHTML += `
            <div class="result-card">
                <p><strong>Resposta ${result.answerIndex + 1}:</strong> ${answer.humanAnswer || answer.aiAnswer}</p>
                <div class="vote-bar">
                    <div class="vote-fill" style="width: ${result.percentage}%"></div>
                    <span>${result.percentage}% (${result.votes} votos)</span>
                </div>
            </div>
        `;
    });
});

socket.on('game-error', (error) => {
    alert(error.message);
});

socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error);
    alert('Erro ao conectar ao servidor. Verifique se o servidor está rodando.');
});

async function submitQuestion() {
    const questionInput = document.getElementById('question-input');
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('Por favor, digite uma pergunta');
        return;
    }
    
    try {
        const response = await fetch('/ai/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question })
        });
        
        if (!response.ok) {
            throw new Error('Erro ao obter resposta da IA');
        }
        
        const aiResponse = await response.json();
        
        // Enviar resposta do jogador e da IA para o servidor
        socket.emit('submit-answer', {
            question,
            humanAnswer: "Minha resposta: " + question,
            aiAnswer: aiResponse.text
        });
        
        // Limpar campo de pergunta
        questionInput.value = '';
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Ocorreu um erro ao processar sua pergunta. Tente novamente.');
    }
}

function voteForAnswer(answerIndex) {
    socket.emit('vote', { answerIndex });
    
    // Desabilitar todos os botões de voto após votar
    const votingButtons = document.querySelectorAll('.answer-card button');
    votingButtons.forEach(button => {
        button.disabled = true;
        button.textContent = 'Votado';
    });
} 