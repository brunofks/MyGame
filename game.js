let socket = io();
let localState = {
    players: [],
    phase: 'lobby',
    role: null,
    round: 0,
    score: 0,
    aiScore: 0,
    isQuestionAuthor: false
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
            // Interface diferente para o autor da pergunta e para os outros jogadores
            if (localState.isQuestionAuthor) {
                gamePhase.innerHTML = `<div class="phase-box">
                    <h3>Fase de Perguntas (Rodada ${localState.round})</h3>
                    <p>É sua vez de fazer uma pergunta! Escolha uma pergunta que ajude a identificar a resposta da IA.</p>
                    <textarea id="question-input" placeholder="Digite sua pergunta aqui..."></textarea>
                    <button onclick="submitQuestion()" class="answer-button">Enviar Pergunta</button>
                </div>`;
            } else {
                gamePhase.innerHTML = `<div class="phase-box">
                    <h3>Fase de Perguntas (Rodada ${localState.round})</h3>
                    <p>Aguardando o jogador designado fazer uma pergunta...</p>
                    <div class="loading-spinner"></div>
                </div>`;
            }
            break;
        
        case 'vote':
            // A interface de votação será preenchida quando recebermos os dados de votação
            gamePhase.innerHTML = `<div class="phase-box">
                <h3>Fase de Votação (Rodada ${localState.round})</h3>
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
                <h3>Resultados (Rodada ${localState.round})</h3>
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
    
    // Atualizar o placar sempre que a fase mudar
    updateScoreboard();
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
        if (player.isQuestionAuthor) playerClass += ' question-author';
        
        // Criar o texto do jogador com indicadores visuais
        let playerText = `${player.name}`;
        if (player.isHost) playerText += ' (Anfitrião)';
        if (isCurrentPlayer) playerText += ' (Você)';
        if (player.isQuestionAuthor) playerText += ' (Pergunta)';
        
        // Adicionar pontuação
        const playerScore = player.score || 0;
        
        // Usar a cor do jogador como estilo inline
        const playerColorStyle = player.color ? `border-left: 4px solid ${player.color}; background-color: ${player.color}20;` : '';
        
        playersList.innerHTML += `
            <div class="${playerClass}" style="${playerColorStyle}">
                <div class="player-number" style="background-color: ${player.color || '#555'};">${index + 1}</div>
                <div class="player-info">
                    ${isCurrentPlayer ? '👤 ' : ''}${playerText}
                </div>
                <div class="player-score">
                    <span class="score-value">${playerScore}</span> pts
                </div>
            </div>
        `;
    });
    
    // Adicionar pontuação da IA
    if (localState.aiScore !== undefined) {
        playersList.innerHTML += `
            <div class="player-card ai-player">
                <div class="player-number">IA</div>
                <div class="player-info">Inteligência Artificial</div>
                <div class="player-score">
                    <span class="score-value">${localState.aiScore}</span> pts
                </div>
            </div>
        `;
    }
}

// Função para atualizar o placar
function updateScoreboard() {
    const scoreboard = document.getElementById('scoreboard');
    
    // Criar o placar se não existir
    if (!scoreboard) {
        const gameContainer = document.getElementById('game-container');
        const scoreboardDiv = document.createElement('div');
        scoreboardDiv.id = 'scoreboard';
        scoreboardDiv.className = 'scoreboard';
        gameContainer.prepend(scoreboardDiv);
    }
    
    // Atualizar o conteúdo do placar
    const scoreboardContent = document.getElementById('scoreboard');
    if (scoreboardContent) {
        // Encontrar o jogador atual
        const currentPlayer = localState.players.find(p => p.id === socket.id);
        const currentPlayerScore = currentPlayer ? (currentPlayer.score || 0) : 0;
        
        scoreboardContent.innerHTML = `
            <div class="score-item player-score-item">
                <span class="score-label">Sua pontuação:</span>
                <span class="score-value">${currentPlayerScore}</span>
            </div>
            <div class="score-item ai-score-item">
                <span class="score-label">Pontuação da IA:</span>
                <span class="score-value">${localState.aiScore || 0}</span>
            </div>
        `;
    }
}

socket.on('connect', () => {
    console.log('Conectado ao servidor!');
});

socket.on('game-update', (state) => {
    console.log('Atualização do jogo:', state);
    
    // Atualizar o estado local
    if (state.players) {
        localState.players = state.players;
        
        // Verificar se o jogador atual é o autor da pergunta
        const currentPlayer = state.players.find(p => p.id === socket.id);
        if (currentPlayer) {
            localState.isQuestionAuthor = currentPlayer.isQuestionAuthor || false;
            localState.score = currentPlayer.score || 0;
        }
    }
    
    if (state.phase) {
        localState.phase = state.phase;
    }
    
    if (state.round) {
        localState.round = state.round;
    }
    
    if (state.aiScore !== undefined) {
        localState.aiScore = state.aiScore;
    }
    
    if (state.canStart !== undefined) {
        localState.canStart = state.canStart;
    }
    
    if (state.voteData) {
        localState.voteData = state.voteData;
    }
    
    // Atualizar a interface
    updatePlayersList(state.players);
    updateGamePhase(state.phase);
    updateScoreboard();
    
    // Se estamos na fase de votação e temos dados de votação, mostrar as respostas
    if (state.phase === 'vote' && state.voteData) {
        console.log("Dados de votação recebidos no game-update:", state.voteData);
        showAnswersForVoting(state.voteData);
    }
});

// Substituir o evento role-assigned por game-started
socket.on('game-started', (data) => {
    console.log('Jogo iniciado:', data);
    localState.isQuestionAuthor = data.isQuestionAuthor || false;
    
    // Mostrar notificação de início de jogo
    const notification = document.createElement('div');
    notification.className = 'role-notification';
    
    if (data.isQuestionAuthor) {
        notification.innerHTML = `<h3>Você foi escolhido!</h3>
            <p>Você deve fazer a primeira pergunta desta partida.</p>`;
    } else {
        notification.innerHTML = `<h3>Jogo Iniciado!</h3>
            <p>Aguarde enquanto o jogador designado faz a pergunta.</p>`;
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
        
        // Verificar se o jogador atual é o autor de alguma resposta
        const myAnswerIndex = data.answers.findIndex(a => a.authorId === socket.id);
        const canVote = myAnswerIndex === -1; // Pode votar se não for autor de nenhuma resposta
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Fase de Votação (Rodada ${localState.round})</h3>
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
        
        // Mostrar as respostas sem identificar qual é da IA
        data.answers.forEach((answer, index) => {
            console.log(`Renderizando resposta ${index + 1}:`, answer);
            
            // Verificar se esta é a resposta do jogador atual
            const isMyAnswer = answer.authorId === socket.id;
            
            // Encontrar a cor do autor da resposta (se for um jogador)
            let authorColor = '#555'; // Cor padrão
            if (answer.authorId) {
                const author = localState.players.find(p => p.id === answer.authorId);
                if (author && author.color) {
                    authorColor = author.color;
                }
            }
            
            // Estilo para a borda da resposta
            const answerStyle = isMyAnswer ? 
                `border-left: 4px solid ${authorColor}; background-color: ${authorColor}20;` : 
                '';
            
            answersContainer.innerHTML += `
                <div class="answer-card ${isMyAnswer ? 'my-answer' : ''}" style="${answerStyle}">
                    <div class="answer-number" style="${isMyAnswer ? `color: ${authorColor};` : ''}">
                        Resposta ${index + 1} ${isMyAnswer ? '(Sua resposta)' : ''}
                    </div>
                    <div class="answer-text">${answer.answer}</div>
                    ${!isMyAnswer && canVote ? `<button onclick="voteForAnswer(${index})" class="vote-button">Votar como IA</button>` : ''}
                    ${isMyAnswer ? `<div class="self-answer-note">Você não pode votar na sua própria resposta</div>` : ''}
                </div>
            `;
        });
        
        // Adicionar opção para pular
        if (canVote) {
            answersContainer.innerHTML += `
                <div class="skip-option">
                    <button onclick="voteForAnswer('skip')">Pular</button>
                </div>
            `;
        } else {
            // Se o jogador é autor de uma resposta, mostrar mensagem
            answersContainer.innerHTML += `
                <div class="author-message">
                    <p>Você escreveu uma das respostas, então não pode votar nesta rodada.</p>
                </div>
            `;
            
            // Enviar voto automático para pular
            socket.emit('vote', { answerIndex: 'skip' });
        }
        
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
        <h3>Resultados (Rodada ${localState.round})</h3>
        <p>Pergunta: "${data.question}"</p>
        <div id="results-container" class="results"></div>
    </div>`;
    
    const resultsContainer = document.getElementById('results-container');
    
    // Mostrar se a IA foi identificada corretamente
    if (data.aiCorrectlyIdentified) {
        resultsContainer.innerHTML += `
            <div class="ai-identified">
                <h4>A IA foi identificada corretamente!</h4>
                <p>Os jogadores que votaram na resposta da IA ganharam 3 pontos cada.</p>
            </div>
        `;
    } else {
        resultsContainer.innerHTML += `
            <div class="ai-not-identified">
                <h4>Ninguém identificou a IA!</h4>
                <p>A IA ganhou 3 pontos nesta rodada.</p>
            </div>
        `;
    }
    
    // Mostrar as respostas com a informação de origem (IA ou humano)
    data.answers.forEach((answer, index) => {
        // Encontrar os resultados da votação para esta resposta
        const voteResult = data.results.find(r => r.answerIndex === index) || { votes: 0, percentage: 0 };
        
        // Determinar a classe CSS com base na origem
        let sourceClass = 'unknown-source';
        let sourceText = 'Desconhecido';
        let authorInfo = '';
        
        // Encontrar a cor do autor da resposta (se for um jogador)
        let authorColor = '#555'; // Cor padrão
        if (answer.authorId) {
            const author = localState.players.find(p => p.id === answer.authorId);
            if (author && author.color) {
                authorColor = author.color;
            }
        }
        
        if (answer.source === 'ai') {
            sourceClass = 'ai-source';
            sourceText = 'IA';
        } else if (answer.source === 'human') {
            sourceClass = 'human-source';
            sourceText = 'Humano';
            if (answer.authorName) {
                authorInfo = `<div class="author-info" style="border-left: 2px solid ${authorColor}; color: ${authorColor};">Escrita por: ${answer.authorName}</div>`;
                
                // Adicionar informação sobre pontos ganhos
                if (answer.votesReceived > 0) {
                    authorInfo += `<div class="points-info">Ganhou ${answer.votesReceived} pontos por votos recebidos</div>`;
                }
            }
        }
        
        // Destacar se esta é a resposta da IA
        const isAiAnswer = index === data.aiAnswerIndex;
        if (isAiAnswer) {
            sourceClass += ' highlighted-ai';
        }
        
        // Estilo para a borda da resposta
        const resultStyle = answer.source === 'human' ? 
            `border-left: 4px solid ${authorColor}; background-color: ${authorColor}10;` : 
            '';
        
        resultsContainer.innerHTML += `
            <div class="result-card ${sourceClass}" style="${resultStyle}">
                <div class="result-header">
                    <div class="result-number">Resposta ${index + 1}</div>
                    <div class="result-source">${sourceText} ${isAiAnswer ? '⭐' : ''}</div>
                </div>
                <div class="result-text">${answer.answer}</div>
                ${authorInfo}
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
    
    // Mostrar placar atual
    resultsContainer.innerHTML += `
        <div class="current-scores">
            <h4>Placar Atual</h4>
            <div class="scores-list">
                ${data.playerScores.map(player => `
                    <div class="score-entry ${player.id === socket.id ? 'my-score' : ''}">
                        <span class="player-name">${player.name} ${player.id === socket.id ? '(Você)' : ''}</span>
                        <span class="player-score">${player.score} pts</span>
                    </div>
                `).join('')}
                <div class="score-entry ai-score">
                    <span class="player-name">IA</span>
                    <span class="player-score">${data.aiScore} pts</span>
                </div>
            </div>
        </div>
    `;
    
    // Adicionar mensagem sobre a próxima rodada
    resultsContainer.innerHTML += `
        <div class="next-round-info">
            <p>Próxima rodada começará em alguns segundos...</p>
        </div>
    `;
    
    // Atualizar o placar local
    localState.aiScore = data.aiScore;
    
    // Atualizar o placar
    updateScoreboard();
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
    
    // Atualizar a interface para mostrar que estamos aguardando respostas dos outros jogadores
    const gamePhase = document.getElementById('game-phase');
    gamePhase.innerHTML = `<div class="phase-box">
        <h3>Aguardando Respostas</h3>
        <p>Você enviou a pergunta: "${question}"</p>
        <p>Agora você também precisa responder à sua própria pergunta.</p>
        <div class="loading-spinner"></div>
    </div>`;
}

// Evento para quando o jogador deve responder
socket.on('answer-request', (data) => {
    console.log("Solicitação para responder à pergunta:", data.question);
    console.log("Dados recebidos:", JSON.stringify(data));
    
    try {
        // Atualizar a interface para permitir que o jogador responda
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Responda à Pergunta</h3>
            <p>Responda à pergunta de forma convincente para enganar os outros jogadores:</p>
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

// Evento para quando estamos aguardando respostas dos jogadores
socket.on('waiting-for-answers', (data) => {
    console.log("Aguardando respostas dos jogadores...");
    console.log("Dados recebidos:", JSON.stringify(data));
    
    try {
        // Atualizar a interface para mostrar que estamos aguardando
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Aguardando Respostas</h3>
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

// Evento para preparar o jogador para responder
socket.on('prepare-for-answer', (data) => {
    console.log("Preparando para responder:", data.message);
    
    // Atualizar a interface para mostrar que o jogador deve responder
    const gamePhase = document.getElementById('game-phase');
    if (gamePhase) {
        gamePhase.innerHTML = `<div class="phase-box">
            <h3>Sua vez de responder</h3>
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

// Evento para mostrar o resultado final do jogo
socket.on('game-over', (data) => {
    console.log("Jogo finalizado:", data);
    
    // Atualizar a interface para mostrar o resultado final
    const gamePhase = document.getElementById('game-phase');
    
    let resultMessage = '';
    if (data.winner.type === 'ai') {
        resultMessage = `<div class="ai-win">
            <h3>A IA Venceu!</h3>
            <p>A IA alcançou ${data.winner.score} pontos e venceu o jogo.</p>
        </div>`;
    } else {
        resultMessage = `<div class="player-win">
            <h3>${data.winner.name} Venceu!</h3>
            <p>${data.winner.name} alcançou ${data.winner.score} pontos e venceu o jogo.</p>
        </div>`;
    }
    
    gamePhase.innerHTML = `<div class="phase-box">
        <h3>Fim de Jogo</h3>
        ${resultMessage}
        <div class="final-scores">
            <h4>Pontuação Final:</h4>
            <div class="scores-list">
                ${data.players.map(p => `
                    <div class="score-entry ${p.id === socket.id ? 'my-score' : ''} ${p.id === data.winner.id ? 'winner-score' : ''}">
                        <span class="player-name">${p.name} ${p.id === socket.id ? '(Você)' : ''} ${p.id === data.winner.id ? '👑' : ''}</span>
                        <span class="player-score">${p.score} pts</span>
                    </div>
                `).join('')}
                <div class="score-entry ai-score ${data.winner.type === 'ai' ? 'winner-score' : ''}">
                    <span class="player-name">IA ${data.winner.type === 'ai' ? '👑' : ''}</span>
                    <span class="player-score">${data.aiScore} pts</span>
                </div>
            </div>
        </div>
        <button onclick="location.reload()" class="play-again-button">Jogar Novamente</button>
    </div>`;
}); 