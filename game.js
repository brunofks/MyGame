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
                <button onclick="submitQuestion()" class="answer-button">Enviar Pergunta</button>
            </div>`;
            break;
        
        case 'vote':
            // A interface de votação será preenchida quando recebermos os dados de votação
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fase de Votação (Rodada ${localState.round}/${localState.maxRounds})</h3>
                <p>Aguardando dados para votação...</p>
                <div class="loading-spinner"></div>
            </div>`;
            
            // Se já temos dados de votação, mostrar as respostas
            if (localState.voteData) {
                showAnswersForVoting(localState.voteData);
            }
            break;
            
        case 'results':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Resultados (Rodada ${localState.round}/${localState.maxRounds})</h3>
                <p>Veja como os jogadores votaram:</p>
                <div id="results-container"></div>
            </div>`;
            break;
            
        case 'gameOver':
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fim de Jogo</h3>
                <div id="final-results"></div>
                <button onclick="location.reload()" class="answer-button">Jogar Novamente</button>
            </div>`;
            break;
    }
    
    // Atualizar o indicador de papel sempre que a fase mudar
    if (localState.role) {
        updateRoleIndicator();
    }
}

function updatePlayersList(players) {
    const playersList = document.getElementById('players-list');
    playersList.innerHTML = '<h3>Jogadores</h3>';
    
    players.forEach((player, index) => {
        // Verificar se este jogador é o usuário atual
        const isCurrentPlayer = player.id === socket.id;
        
        // Definir classes para o card do jogador
        let playerClass = 'player-card';
        if (player.isHost) playerClass += ' host';
        if (isCurrentPlayer) playerClass += ' current-player';
        
        // Criar o texto do jogador com indicadores visuais
        let playerText = `${index + 1}. ${player.name}`;
        if (player.isHost) playerText += ' (Anfitrião)';
        if (isCurrentPlayer) playerText += ' (Você)';
        
        playersList.innerHTML += `
            <div class="${playerClass}">
                <div class="player-number">${index + 1}</div>
                <div class="player-info">
                    ${isCurrentPlayer ? '👤 ' : ''}${playerText}
                </div>
            </div>
        `;
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
        
        // Se estamos na fase de votação e temos dados de votação, mostrar as respostas
        if (state.phase === 'vote' && state.voteData) {
            console.log("Dados de votação recebidos no game-update:", state.voteData);
            showAnswersForVoting(state.voteData);
        }
    }
});

socket.on('role-assigned', (roleData) => {
    console.log('Papel atribuído:', roleData);
    localState.role = roleData.role;
    localState.isSabotador = roleData.isSabotador;
    
    // Atualizar o indicador de papel no topo da tela
    updateRoleIndicator();
    
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

// Função para atualizar o indicador de papel
function updateRoleIndicator() {
    // Verificar se o indicador já existe
    let roleIndicator = document.getElementById('role-indicator');
    
    // Se não existir, criar um novo
    if (!roleIndicator) {
        roleIndicator = document.createElement('div');
        roleIndicator.id = 'role-indicator';
        document.getElementById('game-container').prepend(roleIndicator);
    }
    
    // Atualizar o conteúdo do indicador
    if (localState.role) {
        const roleName = localState.isSabotador ? 'Sabotador' : 'Jogador';
        const roleIcon = localState.isSabotador ? '🕵️' : '👥';
        
        roleIndicator.className = localState.isSabotador ? 'sabotador-role' : 'player-role';
        roleIndicator.innerHTML = `
            <div class="role-icon">${roleIcon}</div>
            <div class="role-text">
                <span>Seu papel:</span>
                <strong>${roleName}</strong>
            </div>
        `;
    } else {
        roleIndicator.innerHTML = '';
    }
}

socket.on('new-message', (msg) => {
    const chat = document.getElementById('chat-messages');
    chat.innerHTML += `<div class="message">${msg}</div>`;
    chat.scrollTop = chat.scrollHeight; // Auto-scroll para a mensagem mais recente
});

// Função para mostrar as respostas para votação
function showAnswersForVoting(data) {
    console.log("Mostrando respostas para votação:", data);
    
    try {
        // Atualizar a interface para mostrar as respostas
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Fase de Votação (Rodada ${localState.round}/${localState.maxRounds})</h3>
            <p>Vote em qual resposta você acha que foi dada pela IA:</p>
            <div class="question-box">"${data.question}"</div>
            <div id="answers-container" class="answers"></div>
        </div>`;
        
        const answersContainer = document.getElementById('answers-container');
        if (!answersContainer) {
            console.error("Elemento answers-container não encontrado!");
            return;
        }
        
        // Verificar se temos respostas para mostrar
        if (!data.answers || data.answers.length === 0) {
            console.error("Nenhuma resposta recebida para votação!");
            answersContainer.innerHTML = `<div class="error-message">Nenhuma resposta disponível para votação.</div>`;
            return;
        }
        
        // Mostrar as respostas sem identificar qual é da IA e qual é do humano
        data.answers.forEach((answer, index) => {
            console.log(`Renderizando resposta ${index + 1}:`, answer);
            
            answersContainer.innerHTML += `
                <div class="answer-card">
                    <div class="answer-number">Resposta ${index + 1}</div>
                    <div class="answer-text">${answer.answer}</div>
                    <button onclick="voteForAnswer(${index})" class="vote-button">Votar</button>
                </div>
            `;
        });
        
        // Adicionar opção para pular
        answersContainer.innerHTML += `
            <div class="skip-option">
                <button onclick="voteForAnswer('skip')">Pular</button>
            </div>
        `;
        
        console.log("Interface de votação renderizada com sucesso");
    } catch (error) {
        console.error("Erro ao processar respostas para votação:", error);
    }
}

// Evento para mostrar os resultados da votação
socket.on('vote-results', (data) => {
    console.log("Recebendo resultados da votação:", data);
    
    // Atualizar a interface para mostrar os resultados
    const gamePhase = document.getElementById('game-phase');
    gamePhase.innerHTML = `<div class="phase-box">
        <h3>Resultados (Rodada ${localState.round}/${localState.maxRounds})</h3>
        <p>Pergunta: "${data.question}"</p>
        <div id="results-container" class="results"></div>
    </div>`;
    
    const resultsContainer = document.getElementById('results-container');
    
    // Mostrar as respostas com a informação de origem (IA ou humano)
    data.answers.forEach((answer, index) => {
        // Encontrar os resultados da votação para esta resposta
        const voteResult = data.results.find(r => r.answerIndex === index) || { votes: 0, percentage: 0 };
        
        // Determinar a classe CSS com base na origem
        let sourceClass = 'unknown-source';
        let sourceText = 'Desconhecido';
        
        if (answer.source === 'ai') {
            sourceClass = 'ai-source';
            sourceText = 'IA';
        } else if (answer.source === 'human') {
            sourceClass = 'human-source';
            sourceText = 'Humano';
        }
        
        resultsContainer.innerHTML += `
            <div class="result-card ${sourceClass}">
                <div class="result-header">
                    <div class="result-number">Resposta ${index + 1}</div>
                    <div class="result-source">${sourceText}</div>
                </div>
                <div class="result-text">${answer.answer}</div>
                <div class="result-votes">
                    <div class="vote-bar" style="width: ${voteResult.percentage}%"></div>
                    <div class="vote-text">${voteResult.votes} votos (${voteResult.percentage}%)</div>
                </div>
            </div>
        `;
    });
    
    // Mostrar os votos para pular, se houver
    if (data.skipVotes > 0) {
        resultsContainer.innerHTML += `
            <div class="result-card skip-result">
                <div class="result-header">
                    <div class="result-number">Pular</div>
                </div>
                <div class="result-text">Jogadores que optaram por pular esta rodada</div>
                <div class="result-votes">
                    <div class="vote-bar skip-bar" style="width: ${data.skipPercentage}%"></div>
                    <div class="vote-text">${data.skipVotes} votos (${data.skipPercentage}%)</div>
                </div>
            </div>
        `;
    }
    
    // Adicionar mensagem sobre a próxima rodada
    resultsContainer.innerHTML += `
        <div class="next-round-info">
            <p>Próxima rodada começará em alguns segundos...</p>
        </div>
    `;
});

socket.on('game-error', (error) => {
    alert(error.message);
});

socket.on('connect_error', (error) => {
    console.error('Erro de conexão:', error);
    alert('Erro ao conectar ao servidor. Verifique se o servidor está rodando.');
});

// Função para enviar a pergunta
function submitQuestion() {
    const questionInput = document.getElementById('question-input');
    const question = questionInput.value.trim();
    
    if (!question) {
        alert('Por favor, digite uma pergunta');
        return;
    }
    
    // Enviar a pergunta para o servidor
    socket.emit('submit-question', { question });
    
    // Limpar campo de pergunta
    questionInput.value = '';
    
    // Atualizar a interface para mostrar que estamos aguardando respostas
    const gamePhase = document.getElementById('game-phase');
    gamePhase.innerHTML = `<div class="phase-box">
        <h3>Aguardando Respostas</h3>
        <p>Aguardando respostas para a pergunta: "${question}"</p>
        <div class="loading-spinner"></div>
    </div>`;
}

// Evento para quando o jogador é sorteado para responder
socket.on('answer-request', (data) => {
    console.log("Você foi sorteado para responder a pergunta:", data.question);
    console.log("Dados recebidos:", JSON.stringify(data));
    
    // Verificar se este jogador é realmente o jogador sorteado
    if (data.selectedPlayerId && data.selectedPlayerId !== socket.id) {
        console.error("Erro: Este jogador não é o jogador sorteado!");
        return;
    }
    
    try {
        // Atualizar a interface para permitir que o jogador responda
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Responda à Pergunta</h3>
            <p>Você foi sorteado para responder à pergunta:</p>
            <div class="question-box">"${data.question}"</div>
            <div class="answer-timer">
                Tempo restante: <span id="answer-timer">${data.timeLimit}</span> segundos
            </div>
            <textarea id="answer-input" placeholder="Digite sua resposta aqui..."></textarea>
            <button onclick="submitPlayerAnswer('${data.question}')" class="answer-button">Enviar Resposta</button>
        </div>`;
        
        // Focar no campo de resposta
        setTimeout(() => {
            const answerInput = document.getElementById('answer-input');
            if (answerInput) {
                answerInput.focus();
            }
        }, 100);
        
        // Iniciar o contador regressivo
        let timeLeft = data.timeLimit;
        const timerElement = document.getElementById('answer-timer');
        
        const timer = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
                // Enviar uma resposta automática se o tempo acabar
                submitPlayerAnswer(data.question, true);
            }
        }, 1000);
        
        // Salvar o timer na variável global para poder cancelá-lo se necessário
        localState.answerTimer = timer;
    } catch (error) {
        console.error("Erro ao processar solicitação de resposta:", error);
    }
});

// Evento para quando estamos aguardando a resposta de um jogador
socket.on('waiting-for-answer', (data) => {
    console.log("Aguardando resposta de um jogador...");
    console.log("Dados recebidos:", JSON.stringify(data));
    
    try {
        // Atualizar a interface para mostrar que estamos aguardando
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Aguardando Resposta</h3>
            <p>${data.message}</p>
            <p>Tempo restante: <span id="waiting-timer">${data.timeLimit}</span> segundos</p>
            <div class="loading-spinner"></div>
        </div>`;
        
        // Iniciar o contador regressivo
        let timeLeft = data.timeLimit;
        const timerElement = document.getElementById('waiting-timer');
        
        const timer = setInterval(() => {
            timeLeft--;
            if (timerElement) {
                timerElement.textContent = timeLeft;
            }
            
            if (timeLeft <= 0) {
                clearInterval(timer);
            }
        }, 1000);
    } catch (error) {
        console.error("Erro ao processar evento de espera:", error);
    }
});

// Função para enviar a resposta do jogador
function submitPlayerAnswer(question, timeout = false) {
    // Cancelar o timer se existir
    if (localState.answerTimer) {
        clearInterval(localState.answerTimer);
        localState.answerTimer = null;
    }
    
    let answer;
    
    if (timeout) {
        answer = "Não consegui pensar em uma resposta a tempo...";
        console.log("Enviando resposta automática por timeout");
    } else {
        const answerInput = document.getElementById('answer-input');
        answer = answerInput.value.trim();
        
        if (!answer) {
            alert('Por favor, digite uma resposta');
            return;
        }
        console.log("Enviando resposta do jogador:", answer);
    }
    
    // Enviar a resposta para o servidor
    socket.emit('submit-answer', {
        question: question,
        answer: answer
    });
    
    console.log("Resposta enviada para o servidor");
    
    // Atualizar a interface para mostrar que estamos aguardando a votação
    const gamePhase = document.getElementById('game-phase');
    gamePhase.innerHTML = `<div class="phase-box">
        <h3>Resposta Enviada</h3>
        <p>Sua resposta foi enviada. Aguardando a fase de votação...</p>
        <div class="loading-spinner"></div>
    </div>`;
}

// Função para votar em uma resposta
function voteForAnswer(answerIndex) {
    console.log(`Enviando voto para a resposta de índice ${answerIndex}`);
    
    if (answerIndex === 'skip') {
        // Enviar voto para pular
        socket.emit('vote', { answerIndex: 'skip' });
        console.log("Voto para pular enviado com sucesso");
    } else if (answerIndex === undefined || answerIndex === null) {
        console.error("Erro: Índice de resposta inválido");
        alert("Erro ao enviar voto: índice de resposta inválido");
        return;
    } else {
        // Enviar voto para uma resposta específica
        socket.emit('vote', { answerIndex });
        console.log("Voto enviado com sucesso");
    }
    
    // Desabilitar todos os botões de voto após votar
    const votingButtons = document.querySelectorAll('.answer-card button, .skip-option button');
    votingButtons.forEach(button => {
        button.disabled = true;
        button.textContent = 'Votado';
    });
    
    // Adicionar mensagem de confirmação
    const answersContainer = document.getElementById('answers-container');
    if (answersContainer) {
        const confirmationMsg = document.createElement('div');
        confirmationMsg.className = 'vote-confirmation';
        confirmationMsg.textContent = 'Seu voto foi registrado! Aguardando os outros jogadores...';
        answersContainer.appendChild(confirmationMsg);
    }
}

// Evento para preparar o jogador para responder
socket.on('prepare-for-answer', (data) => {
    console.log("Preparando para responder:", data.message);
    
    // Atualizar a interface para mostrar que o jogador foi sorteado
    const gamePhase = document.getElementById('game-phase');
    if (gamePhase) {
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Você foi sorteado!</h3>
            <p>${data.message}</p>
            <div class="loading-spinner"></div>
        </div>`;
    }
});

// Evento para mostrar as respostas para votação (para compatibilidade)
socket.on('show-answers', (data) => {
    console.log("Recebendo respostas via evento show-answers:", data);
    showAnswersForVoting(data);
}); 