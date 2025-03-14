let socket = io();
let localState = {
    players: [],
    phase: 'lobby',
    role: null,
    round: 0,
    score: 0,
    aiScore: 0,
    isQuestionAuthor: false,
    isAnswering: false
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

// Adicionar evento de tecla para o campo de nome
document.addEventListener('DOMContentLoaded', function() {
    const playerNameInput = document.getElementById('playerName');
    if (playerNameInput) {
        playerNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinGame();
            }
        });
    }
});

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

function updateGamePhase(phase, data) {
    console.log("Atualizando fase do jogo para:", phase, data);
    
    const gamePhase = document.getElementById('game-phase');
    if (!gamePhase) {
        console.error("Elemento game-phase não encontrado!");
        return;
    }
    
    // Atualizar a fase local
    localState.phase = phase;
    
    // Limpar qualquer conteúdo anterior
    gamePhase.innerHTML = '';
    
    // Criar o contêiner da fase
    const phaseBox = document.createElement('div');
    phaseBox.className = 'phase-box';
    
    switch (phase) {
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
            phaseBox.innerHTML = lobbyContent;
            break;
            
        case 'question':
            // Interface diferente para o autor da pergunta e para os outros jogadores
            if (localState.isQuestionAuthor) {
                phaseBox.innerHTML = `<div class="phase-box">
                    <h3>Fase de Perguntas</h3>
                    <p>É sua vez de fazer uma pergunta! Escolha uma pergunta que ajude a identificar a resposta da IA.</p>
                    <textarea id="question-input" placeholder="Digite sua pergunta aqui..."></textarea>
                    <button onclick="submitQuestion()" class="answer-button">Enviar Pergunta</button>
                </div>`;
                
                // Configurar evento de tecla para o campo de pergunta
                setTimeout(setupQuestionInputKeyEvent, 100);
            } else {
                phaseBox.innerHTML = `<div class="phase-box">
                    <h3>Fase de Perguntas</h3>
                    <p>Aguardando o jogador designado fazer uma pergunta...</p>
                    <div class="loading-spinner"></div>
                </div>`;
            }
            break;
        
        case 'answer':
            // ... existing code ...
            break;
            
        case 'vote':
            // Fase de votação
            const voteTitle = document.createElement('h3');
            voteTitle.textContent = `Fase de Votação`;
            
            const voteInstructions = document.createElement('p');
            voteInstructions.textContent = 'Vote em qual resposta você acha que foi dada pela IA:';
            
            const questionBox = document.createElement('div');
            questionBox.className = 'question-box';
            questionBox.textContent = data.question;
            
            const answersContainer = document.createElement('div');
            answersContainer.id = 'answers-container';
            answersContainer.className = 'answers';
            
            phaseBox.appendChild(voteTitle);
            phaseBox.appendChild(voteInstructions);
            phaseBox.appendChild(questionBox);
            phaseBox.appendChild(answersContainer);
            
            // Mostrar as respostas para votação se disponíveis
            if (data.answers && data.answers.length > 0) {
                showAnswersForVoting(data);
            }
            break;
            
        case 'results':
            phaseBox.innerHTML = `<div class="phase-box">
                <h3>Resultados</h3>
                <div class="authors-voters-summary" id="authors-voters-summary" style="margin: 20px 0; display: block !important; border: 2px solid rgba(255, 255, 255, 0.3); padding: 15px; border-radius: 8px; background-color: rgba(0, 0, 0, 0.2);">
                    <h4 style="text-align: center; font-size: 1.3em; margin-bottom: 15px;">Veja como os jogadores votaram:</h4>
                    <p style="text-align: center; margin-bottom: 15px;">Abaixo você pode ver quem escreveu cada resposta e quem votou em cada uma:</p>
                    <div id="voters-list-container" style="max-height: 300px; overflow-y: auto; border: 1px solid rgba(255, 255, 255, 0.2); padding: 10px; background-color: rgba(0, 0, 0, 0.1); border-radius: 4px;">
                        <div style="text-align: center; padding: 20px;">
                            <div class="loading-spinner"></div>
                            <p>Carregando informações de votação...</p>
                        </div>
                    </div>
                </div>
                <div id="results-container"></div>
                <div id="ready-players-container" class="ready-players-container">
                    <p>Jogadores prontos para continuar: <span id="ready-count">0</span>/<span id="total-players">${localState.players.length}</span></p>
                    <div id="ready-players-list" class="ready-players-list"></div>
                </div>
                <button id="next-round-button" onclick="readyForNextRound()" class="next-round-button">Estou pronto para continuar</button>
            </div>`;
            
            // Iniciar um temporizador para garantir que o conteúdo seja preenchido mesmo que o evento vote-results não seja processado
            setTimeout(() => {
                const votersListContainer = document.getElementById('voters-list-container');
                if (votersListContainer && votersListContainer.innerHTML.includes('Carregando informações')) {
                    console.log("Forçando exibição de conteúdo simples no container de votantes após timeout");
                    
                    // Criar conteúdo simples
                    let simpleContent = '<div style="padding: 15px; background-color: rgba(0, 0, 0, 0.2); border-radius: 6px;">';
                    simpleContent += '<h4 style="margin-bottom: 15px; text-align: center;">Resumo da Rodada</h4>';
                    
                    // Adicionar informações dos jogadores
                    simpleContent += '<div style="margin-top: 15px;">';
                    simpleContent += '<table style="width: 100%; border-collapse: collapse;">';
                    simpleContent += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">';
                    simpleContent += '<th style="text-align: left; padding: 8px;">Jogador</th>';
                    simpleContent += '<th style="text-align: right; padding: 8px;">Pontuação</th>';
                    simpleContent += '</tr>';
                    
                    // Adicionar uma linha para cada jogador
                    localState.players.forEach(player => {
                        simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                        simpleContent += `<td style="padding: 8px; color: ${player.color};">${player.name} ${player.id === socket.id ? '(Você)' : ''}</td>`;
                        simpleContent += `<td style="padding: 8px; text-align: right;">${player.score || 0} pts</td>`;
                        simpleContent += `</tr>`;
                    });
                    
                    // Adicionar linha para a IA
                    simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                    simpleContent += `<td style="padding: 8px; color: #e74c3c;">IA</td>`;
                    simpleContent += `<td style="padding: 8px; text-align: right;">${localState.aiScore || 0} pts</td>`;
                    simpleContent += `</tr>`;
                    
                    simpleContent += '</table>';
                    simpleContent += '</div>';
                    
                    // Adicionar informações sobre o objetivo do jogo
                    simpleContent += '<div style="margin-top: 20px; padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center;">';
                    simpleContent += '<p>Objetivo: Primeiro a atingir 20 pontos vence!</p>';
                    simpleContent += '</div>';
                    
                    simpleContent += '</div>';
                    
                    votersListContainer.innerHTML = simpleContent;
                }
            }, 2000); // Espera 2 segundos antes de verificar
            
            break;
            
        case 'game-over':
            phaseBox.innerHTML = `<div class="phase-box">
                <h3>Fim de Jogo</h3>
                <div id="final-results"></div>
                <button onclick="location.reload()" class="answer-button">Jogar Novamente</button>
            </div>`;
            break;
        
        default:
            phaseBox.innerHTML = `<h3>Fase desconhecida: ${phase}</h3>`;
    }
    
    gamePhase.appendChild(phaseBox);
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
    updateGamePhase(state.phase, state.voteData);
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
            <p>Você deve fazer a primeira pergunta desta partida.</p>
            <p class="game-goal">O objetivo é acumular 20 pontos. Boa sorte!</p>`;
    } else {
        notification.innerHTML = `<h3>Jogo Iniciado!</h3>
            <p>Aguarde enquanto o jogador designado faz a pergunta.</p>
            <p class="game-goal">O objetivo é acumular 20 pontos. Boa sorte!</p>`;
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
    
    if (!data || !data.answers || data.answers.length === 0) {
        console.error("Dados de votação inválidos ou vazios:", data);
        return;
    }
    
    const answersContainer = document.getElementById('answers-container');
    if (!answersContainer) {
        console.error("Contêiner de respostas não encontrado!");
        return;
    }
    
    // Limpar o contêiner
    answersContainer.innerHTML = '';
    
    // Adicionar contador de votos
    const voteCounter = document.createElement('div');
    voteCounter.id = 'vote-counter';
    voteCounter.className = 'vote-counter';
    voteCounter.innerHTML = 'Escolha uma resposta para votar';
    answersContainer.appendChild(voteCounter);
    
    // Adicionar respostas para votação
    data.answers.forEach((answer, index) => {
        const answerCard = document.createElement('div');
        answerCard.className = 'answer-card';
        
        // Verificar se esta resposta é do jogador atual
        const isPlayerAnswer = answer.authorId === socket.id;
        
        // Adicionar conteúdo da resposta
        const answerContent = document.createElement('div');
        answerContent.className = 'answer-content';
        answerContent.textContent = answer.answer;
        answerCard.appendChild(answerContent);
        
        // Adicionar botão de voto (exceto para a própria resposta do jogador)
        if (!isPlayerAnswer) {
            const voteButton = document.createElement('button');
            voteButton.className = 'vote-button';
            voteButton.textContent = 'Votar';
            voteButton.dataset.index = index;
            
            voteButton.addEventListener('click', function() {
                // Desabilitar todos os botões de voto após o jogador votar
                document.querySelectorAll('.vote-button').forEach(btn => {
                    btn.disabled = true;
                    btn.classList.add('voted');
                });
                
                // Destacar o botão selecionado
                this.classList.add('selected');
                
                // Enviar voto para o servidor
                socket.emit('vote', { answerIndex: index });
                
                // Atualizar mensagem
                document.getElementById('vote-counter').innerHTML = 'Seu voto foi registrado. Aguardando outros jogadores...';
            });
            
            answerCard.appendChild(voteButton);
        } else {
            // Se for a resposta do próprio jogador, mostrar uma indicação
            const ownAnswerLabel = document.createElement('div');
            ownAnswerLabel.className = 'own-answer-label';
            ownAnswerLabel.textContent = 'Sua resposta';
            answerCard.appendChild(ownAnswerLabel);
            
            // Adicionar uma mensagem explicativa
            const infoMessage = document.createElement('div');
            infoMessage.className = 'info-message';
            infoMessage.textContent = 'Você não pode votar na sua própria resposta';
            answerCard.appendChild(infoMessage);
        }
        
        answersContainer.appendChild(answerCard);
    });
    
    // Adicionar instruções claras
    const votingInstructions = document.createElement('div');
    votingInstructions.className = 'voting-instructions';
    votingInstructions.innerHTML = '<p>Escolha qual resposta você acredita que foi gerada pela IA. Você ganhará 3 pontos se acertar!</p>';
    answersContainer.insertBefore(votingInstructions, answersContainer.firstChild);
}

// Adicionar evento para atualização de votos
socket.on('vote-update', function(data) {
    console.log('Atualização de votos:', data);
    const voteCounter = document.getElementById('vote-counter');
    if (voteCounter) {
        voteCounter.innerHTML = `Votos recebidos: ${data.votesReceived} de ${data.totalExpected}`;
    }
});

// Evento para mostrar os resultados da votação
socket.on('vote-results', (data) => {
    console.log("Recebendo resultados da votação:", data);
    
    // Verificar se temos dados de respostas e votos
    if (!data.answers || data.answers.length === 0) {
        console.error("Dados de respostas inválidos ou vazios:", data);
    } else {
        console.log("Número de respostas recebidas:", data.answers.length);
        data.answers.forEach((answer, index) => {
            console.log(`Resposta ${index}: Autor=${answer.authorName}, Votos=${answer.voters ? answer.voters.length : 0}`);
            if (answer.voters && answer.voters.length > 0) {
                console.log("Votantes na resposta:", answer.voters.map(v => v.name).join(", "));
            }
        });
    }
    
    // Certificar-se de que todas as respostas tenham um array voters
    data.answers.forEach(answer => {
        if (!answer.voters) {
            console.warn(`Resposta sem propriedade 'voters', inicializando como array vazio`);
            answer.voters = [];
        }
    });
    
    // Criar o conteúdo HTML para os resultados das respostas
    let resultsHTML = '';
    
    // Mostrar se a IA foi identificada corretamente
    if (data.aiCorrectlyIdentified) {
        resultsHTML += `
            <div class="ai-identified">
                <h4>A IA foi identificada corretamente!</h4>
                <p>Os jogadores que votaram na resposta da IA ganharam 3 pontos cada.</p>
            </div>
        `;
    } else {
        resultsHTML += `
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
        
        // Encontrar a cor do autor da resposta (se for um jogador)
        let authorColor = '#555'; // Cor padrão
        let authorName = '';
        
        if (answer.source === 'ai') {
            sourceClass = 'ai-source';
            sourceText = 'IA';
            authorColor = '#e74c3c'; // Vermelho para a IA
            authorName = 'Inteligência Artificial';
        } else if (answer.source === 'human') {
            sourceClass = 'human-source';
            sourceText = 'Humano';
            if (answer.authorId) {
                const author = localState.players.find(p => p.id === answer.authorId);
                if (author) {
                    authorColor = author.color;
                    authorName = author.name;
                }
            }
        }
        
        // Destacar se esta é a resposta da IA
        const isAiAnswer = answer.source === 'ai';
        if (isAiAnswer) {
            sourceClass += ' highlighted-ai';
        }
        
        // Criar a lista de jogadores que votaram nesta resposta
        let votersList = '';
        if (answer.voters && answer.voters.length > 0) {
            votersList = `
                <div class="voters-list">
                    <h5>Jogadores que votaram nesta resposta:</h5>
                    <ul class="voters">
                        ${answer.voters.map(voter => `
                            <li class="voter" style="border-left: 4px solid ${voter.color}; background-color: ${voter.color}15;">
                                <span class="voter-name" style="color: ${voter.color};">${voter.name} ${voter.id === socket.id ? '(Você)' : ''}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            `;
        } else {
            votersList = `<div class="no-voters">Ninguém votou nesta resposta</div>`;
        }
        
        // Calcular pontos ganhos pelo autor (1 ponto por voto)
        let pointsInfo = '';
        if (answer.source === 'human' && voteResult.votes > 0) {
            pointsInfo = `<div class="points-info">Ganhou ${voteResult.votes} ${voteResult.votes === 1 ? 'ponto' : 'pontos'} por votos recebidos</div>`;
        }
        
        // Calcular pontos ganhos pelos votantes (3 pontos se acertou a IA)
        let votersPointsInfo = '';
        if (answer.source === 'ai' && answer.voters && answer.voters.length > 0) {
            votersPointsInfo = `<div class="voters-points">Cada votante ganhou 3 pontos por identificar a IA</div>`;
        }
        
        resultsHTML += `
            <div class="result-card ${sourceClass}" style="border-left: 6px solid ${authorColor}; background-color: ${authorColor}10;">
                <div class="result-header" style="border-bottom: 1px solid ${authorColor}30;">
                    <div class="author-info" style="color: ${authorColor};">
                        <span class="author-name">${authorName}</span>
                        <span class="author-type">${sourceText} ${isAiAnswer ? '⭐' : ''}</span>
                    </div>
                </div>
                <div class="result-text">${answer.answer}</div>
                <div class="result-votes">
                    <div class="vote-bar" style="width: ${voteResult.percentage}%; background-color: ${authorColor}80;"></div>
                    <div class="vote-text">${voteResult.votes} ${voteResult.votes === 1 ? 'voto' : 'votos'} (${voteResult.percentage}%)</div>
                </div>
                ${pointsInfo}
                ${votersPointsInfo}
                ${votersList}
            </div>
        `;
    });
    
    // Mostrar placar atual
    resultsHTML += `
        <div class="current-scores">
            <h4>Placar Atual</h4>
            <div class="scores-list">
                ${data.playerScores.map(player => {
                    const playerColor = localState.players.find(p => p.id === player.id)?.color || '#555';
                    return `
                        <div class="score-entry ${player.id === socket.id ? 'my-score' : ''}" style="border-left: 4px solid ${playerColor}; background-color: ${playerColor}15;">
                            <span class="player-name" style="color: ${playerColor};">${player.name} ${player.id === socket.id ? '(Você)' : ''}</span>
                            <span class="player-score">${player.score} pts</span>
                        </div>
                    `;
                }).join('')}
                <div class="score-entry ai-score">
                    <span class="player-name">IA</span>
                    <span class="player-score">${data.aiScore} pts</span>
                </div>
            </div>
        </div>
    `;
    
    // Preparar o conteúdo detalhado das respostas e quem votou em cada uma
    let votersDetailHTML = '';
    
    data.answers.forEach((answer, index) => {
        const authorColor = answer.source === 'ai' ? '#e74c3c' : 
            (localState.players.find(p => p.id === answer.authorId)?.color || '#555');
        
        const authorName = answer.source === 'ai' ? 'Inteligência Artificial' : answer.authorName;
        
        // Lista de votantes formatada
        let votersHTML = '';
        if (answer.voters && answer.voters.length > 0) {
            votersHTML = answer.voters.map(voter => 
                `<span style="display: inline-block; padding: 3px 8px; margin: 2px; border-radius: 4px; color: ${voter.color}; border: 1px solid ${voter.color}; background-color: ${voter.color}15;">
                    ${voter.name} ${voter.id === socket.id ? '(Você)' : ''}
                </span>`
            ).join(' ');
        } else {
            votersHTML = '<span style="color: #777; font-style: italic;">Nenhum voto</span>';
        }
        
        votersDetailHTML += `
            <div style="background-color: rgba(255, 255, 255, 0.05); border-radius: 6px; margin-bottom: 15px; padding: 12px; border: 1px solid rgba(255, 255, 255, 0.1);">
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; align-items: center; padding: 8px 12px; border-radius: 4px; background-color: rgba(255, 255, 255, 0.03); color: ${authorColor}; border-left: 4px solid ${authorColor};">
                        <span style="font-weight: bold; margin-right: 8px;">Autor:</span>
                        <strong>${authorName}</strong>
                    </div>
                    <div style="padding: 8px 12px; background-color: rgba(255, 255, 255, 0.03); border-radius: 4px;">
                        <span style="font-weight: bold; color: #bbb; margin-right: 8px;">Resposta:</span>
                        <span>"${answer.answer.substring(0, 80)}${answer.answer.length > 80 ? '...' : ''}"</span>
                    </div>
                    <div style="padding: 8px 12px; background-color: rgba(255, 255, 255, 0.03); border-radius: 4px;">
                        <span style="font-weight: bold; color: #bbb; margin-right: 8px;">Quem votou:</span>
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px;">
                            ${votersHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;
    });
    
    // Preparar as linhas da tabela de votação
    let votingTableRowsHTML = '';
    data.playerScores.forEach(player => {
        const playerColor = localState.players.find(p => p.id === player.id)?.color || '#555';
        
        // Encontrar em quem este jogador votou
        let votedFor = "Ninguém";
        let votedForColor = "#555";
        let pointsGained = 0;
        
        // Procurar o voto deste jogador
        for (const answer of data.answers) {
            const voter = answer.voters.find(v => v.id === player.id);
            if (voter) {
                if (answer.source === 'ai') {
                    votedFor = "IA";
                    votedForColor = "#e74c3c";
                    pointsGained = 3; // 3 pontos por acertar a IA
                } else {
                    votedFor = answer.authorName;
                    const authorPlayer = localState.players.find(p => p.id === answer.authorId);
                    votedForColor = authorPlayer?.color || "#555";
                    pointsGained = 0; // Não ganha pontos por votar em humano
                }
                break;
            }
        }
        
        // Verificar se este jogador é autor de alguma resposta e quantos votos recebeu
        for (const answer of data.answers) {
            if (answer.source === 'human' && answer.authorId === player.id) {
                const votesReceived = answer.voters.length;
                if (votesReceived > 0) {
                    pointsGained += votesReceived; // 1 ponto por cada voto recebido
                }
                break;
            }
        }
        
        votingTableRowsHTML += `
            <div class="voting-table-row">
                <div class="voting-table-cell player-cell" style="color: ${playerColor}; border-left: 4px solid ${playerColor};">
                    ${player.name} ${player.id === socket.id ? '(Você)' : ''}
                </div>
                <div class="voting-table-cell voted-cell" style="color: ${votedForColor};">
                    ${votedFor}
                </div>
                <div class="voting-table-cell points-cell">
                    ${pointsGained} ${pointsGained === 1 ? 'ponto' : 'pontos'}
                </div>
            </div>
        `;
    });
    
    // Criar o HTML da tabela de votação
    const votingTableHTML = `
        <div class="voting-summary" style="margin-top: 20px;">
            <h4 style="margin-bottom: 10px;">Resumo da votação:</h4>
            <div class="voting-table">
                <div class="voting-table-header">
                    <div class="voting-table-cell header-cell">Jogador</div>
                    <div class="voting-table-cell header-cell">Votou em</div>
                    <div class="voting-table-cell header-cell">Pontos ganhos</div>
                </div>
                ${votingTableRowsHTML}
            </div>
        </div>
    `;
    
    // Atualizar o conteúdo da interface
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
        resultsContainer.innerHTML = resultsHTML;
    }
    
    // Atualizar a tabela detalhada de votos
    const votersListContainer = document.getElementById('voters-list-container');
    if (votersListContainer) {
        console.log("Preenchendo container de votantes com conteúdo:", votersDetailHTML.length, "caracteres +", votingTableHTML.length, "caracteres");
        
        // Verificar se temos conteúdo para exibir
        if (votersDetailHTML.length === 0 && votingTableHTML.length === 0) {
            console.log("Gerando conteúdo simplificado para o container de votantes");
            // Criar uma tabela simplificada com os resultados da votação
            let simpleContent = '<div style="padding: 15px; background-color: rgba(0, 0, 0, 0.2); border-radius: 6px;">';
            simpleContent += '<h4 style="margin-bottom: 15px; text-align: center;">Resumo de Votação</h4>';
            
            // Tabela de respostas
            simpleContent += '<div style="margin-bottom: 20px;">';
            simpleContent += '<h5 style="margin-bottom: 10px;">Respostas:</h5>';
            simpleContent += '<table style="width: 100%; border-collapse: collapse;">';
            simpleContent += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">';
            simpleContent += '<th style="text-align: left; padding: 8px;">Autor</th>';
            simpleContent += '<th style="text-align: left; padding: 8px;">Resposta</th>';
            simpleContent += '<th style="text-align: right; padding: 8px;">Votos</th>';
            simpleContent += '</tr>';
            
            // Adicionar uma linha para cada resposta
            data.answers.forEach((answer, index) => {
                const voteResult = data.results.find(r => r.answerIndex === index) || { votes: 0, percentage: 0 };
                const authorName = answer.source === 'ai' ? 'IA' : answer.authorName;
                const authorColor = answer.source === 'ai' ? '#e74c3c' : 
                    (localState.players.find(p => p.id === answer.authorId)?.color || '#3498db');
                
                simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                simpleContent += `<td style="padding: 8px; color: ${authorColor};">${authorName}</td>`;
                simpleContent += `<td style="padding: 8px;">${answer.answer.substring(0, 50)}${answer.answer.length > 50 ? '...' : ''}</td>`;
                simpleContent += `<td style="padding: 8px; text-align: right;">${voteResult.votes} voto(s)</td>`;
                simpleContent += `</tr>`;
            });
            
            simpleContent += '</table>';
            simpleContent += '</div>';
            
            // Tabela de votos
            simpleContent += '<div style="margin-top: 20px;">';
            simpleContent += '<h5 style="margin-bottom: 10px;">Quem votou em quem:</h5>';
            simpleContent += '<table style="width: 100%; border-collapse: collapse;">';
            simpleContent += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">';
            simpleContent += '<th style="text-align: left; padding: 8px;">Jogador</th>';
            simpleContent += '<th style="text-align: left; padding: 8px;">Votou em</th>';
            simpleContent += '</tr>';
            
            // Adicionar uma linha para cada jogador
            localState.players.forEach(player => {
                let votedFor = "Ninguém";
                let votedForColor = "#999";
                
                // Procurar o voto deste jogador
                for (const answer of data.answers) {
                    const voter = answer.voters && answer.voters.find(v => v.id === player.id);
                    if (voter) {
                        if (answer.source === 'ai') {
                            votedFor = "IA";
                            votedForColor = "#e74c3c";
                        } else {
                            votedFor = answer.authorName || "Jogador";
                            votedForColor = "#3498db";
                        }
                        break;
                    }
                }
                
                simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                simpleContent += `<td style="padding: 8px; color: ${player.color};">${player.name} ${player.id === socket.id ? '(Você)' : ''}</td>`;
                simpleContent += `<td style="padding: 8px; color: ${votedForColor};">${votedFor}</td>`;
                simpleContent += `</tr>`;
            });
            
            simpleContent += '</table>';
            simpleContent += '</div>';
            
            // Adicionar informações sobre a IA
            if (data.aiCorrectlyIdentified) {
                simpleContent += '<div style="margin-top: 20px; padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; color: #2ecc71;">';
                simpleContent += '<p>A IA foi identificada corretamente! Os jogadores que votaram na IA ganharam 3 pontos cada.</p>';
                simpleContent += '</div>';
            } else {
                simpleContent += '<div style="margin-top: 20px; padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; color: #e74c3c;">';
                simpleContent += '<p>Ninguém identificou a IA! A IA ganhou 3 pontos nesta rodada.</p>';
                simpleContent += '</div>';
            }
            
            simpleContent += '</div>';
            
            votersListContainer.innerHTML = simpleContent;
        } else {
            votersListContainer.innerHTML = votersDetailHTML + votingTableHTML;
        }
        
        // Garantir que o container seja visível
        votersListContainer.style.display = "block";
        votersListContainer.style.border = "1px solid #fff";
        votersListContainer.style.padding = "10px";
        votersListContainer.style.margin = "10px 0";
        votersListContainer.style.background = "rgba(0, 0, 0, 0.2)";
    } else {
        console.error("Container de lista de votantes não encontrado!");
        
        // Tentar recriar o container se ele não foi encontrado
        const authorsVotersSummary = document.getElementById('authors-voters-summary');
        if (authorsVotersSummary) {
            console.log("Recriando o container de votantes");
            const newContainer = document.createElement('div');
            newContainer.id = 'voters-list-container';
            newContainer.style.maxHeight = "300px";
            newContainer.style.overflowY = "auto";
            newContainer.style.display = "block";
            newContainer.style.border = "1px solid #fff";
            newContainer.style.padding = "10px";
            newContainer.style.margin = "10px 0";
            newContainer.style.background = "rgba(0, 0, 0, 0.2)";
            
            // Verificar se temos conteúdo para exibir
            if (votersDetailHTML.length === 0 && votingTableHTML.length === 0) {
                console.log("Gerando conteúdo simplificado para o container de votantes");
                // Criar uma tabela simplificada com os resultados da votação
                let simpleContent = '<div style="padding: 15px; background-color: rgba(0, 0, 0, 0.2); border-radius: 6px;">';
                simpleContent += '<h4 style="margin-bottom: 15px; text-align: center;">Resumo de Votação</h4>';
                
                // Tabela de respostas
                simpleContent += '<div style="margin-bottom: 20px;">';
                simpleContent += '<h5 style="margin-bottom: 10px;">Respostas:</h5>';
                simpleContent += '<table style="width: 100%; border-collapse: collapse;">';
                simpleContent += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">';
                simpleContent += '<th style="text-align: left; padding: 8px;">Autor</th>';
                simpleContent += '<th style="text-align: left; padding: 8px;">Resposta</th>';
                simpleContent += '<th style="text-align: right; padding: 8px;">Votos</th>';
                simpleContent += '</tr>';
                
                // Adicionar uma linha para cada resposta
                data.answers.forEach((answer, index) => {
                    const voteResult = data.results.find(r => r.answerIndex === index) || { votes: 0, percentage: 0 };
                    const authorName = answer.source === 'ai' ? 'IA' : answer.authorName;
                    const authorColor = answer.source === 'ai' ? '#e74c3c' : 
                        (localState.players.find(p => p.id === answer.authorId)?.color || '#3498db');
                    
                    simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                    simpleContent += `<td style="padding: 8px; color: ${authorColor};">${authorName}</td>`;
                    simpleContent += `<td style="padding: 8px;">${answer.answer.substring(0, 50)}${answer.answer.length > 50 ? '...' : ''}</td>`;
                    simpleContent += `<td style="padding: 8px; text-align: right;">${voteResult.votes} voto(s)</td>`;
                    simpleContent += `</tr>`;
                });
                
                simpleContent += '</table>';
                simpleContent += '</div>';
                
                // Tabela de votos
                simpleContent += '<div style="margin-top: 20px;">';
                simpleContent += '<h5 style="margin-bottom: 10px;">Quem votou em quem:</h5>';
                simpleContent += '<table style="width: 100%; border-collapse: collapse;">';
                simpleContent += '<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.2);">';
                simpleContent += '<th style="text-align: left; padding: 8px;">Jogador</th>';
                simpleContent += '<th style="text-align: left; padding: 8px;">Votou em</th>';
                simpleContent += '</tr>';
                
                // Adicionar uma linha para cada jogador
                localState.players.forEach(player => {
                    let votedFor = "Ninguém";
                    let votedForColor = "#999";
                    
                    // Procurar o voto deste jogador
                    for (const answer of data.answers) {
                        const voter = answer.voters && answer.voters.find(v => v.id === player.id);
                        if (voter) {
                            if (answer.source === 'ai') {
                                votedFor = "IA";
                                votedForColor = "#e74c3c";
                            } else {
                                votedFor = answer.authorName || "Jogador";
                                votedForColor = "#3498db";
                            }
                            break;
                        }
                    }
                    
                    simpleContent += `<tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">`;
                    simpleContent += `<td style="padding: 8px; color: ${player.color};">${player.name} ${player.id === socket.id ? '(Você)' : ''}</td>`;
                    simpleContent += `<td style="padding: 8px; color: ${votedForColor};">${votedFor}</td>`;
                    simpleContent += `</tr>`;
                });
                
                simpleContent += '</table>';
                simpleContent += '</div>';
                
                // Adicionar informações sobre a IA
                if (data.aiCorrectlyIdentified) {
                    simpleContent += '<div style="margin-top: 20px; padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; color: #2ecc71;">';
                    simpleContent += '<p>A IA foi identificada corretamente! Os jogadores que votaram na IA ganharam 3 pontos cada.</p>';
                    simpleContent += '</div>';
                } else {
                    simpleContent += '<div style="margin-top: 20px; padding: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); text-align: center; color: #e74c3c;">';
                    simpleContent += '<p>Ninguém identificou a IA! A IA ganhou 3 pontos nesta rodada.</p>';
                    simpleContent += '</div>';
                }
                
                simpleContent += '</div>';
                
                newContainer.innerHTML = simpleContent;
            } else {
                newContainer.innerHTML = votersDetailHTML + votingTableHTML;
            }
            
            authorsVotersSummary.appendChild(newContainer);
        }
    }
    
    // Atualizar o placar local
    localState.aiScore = data.aiScore;
    
    // Atualizar o placar
    updateScoreboard();
    
    // Atualizar o contador de jogadores prontos
    document.getElementById('total-players').textContent = localState.players.length;
});

// Evento para atualizar a lista de jogadores prontos para continuar
socket.on('players-ready-update', (data) => {
    console.log("Atualização de jogadores prontos:", data);
    
    const readyCount = document.getElementById('ready-count');
    const readyPlayersList = document.getElementById('ready-players-list');
    const nextRoundButton = document.getElementById('next-round-button');
    
    if (readyCount && readyPlayersList && nextRoundButton) {
        readyCount.textContent = data.readyPlayers.length;
        
        // Atualizar a lista de jogadores prontos
        readyPlayersList.innerHTML = '';
        data.readyPlayers.forEach(playerId => {
            const player = localState.players.find(p => p.id === playerId);
            if (player) {
                readyPlayersList.innerHTML += `
                    <div class="ready-player" style="border-left: 2px solid ${player.color}; color: ${player.color};">
                        ${player.name} ${player.id === socket.id ? '(Você)' : ''} ✓
                    </div>
                `;
            }
        });
        
        // Desabilitar o botão se o jogador atual já está pronto
        if (data.readyPlayers.includes(socket.id)) {
            nextRoundButton.disabled = true;
            nextRoundButton.textContent = 'Você está pronto';
        }
    }
});

// Função para indicar que o jogador está pronto para a próxima rodada
function readyForNextRound() {
    console.log("Enviando sinal de pronto para continuar");
    socket.emit('ready-for-next-round');
    
    const nextRoundButton = document.getElementById('next-round-button');
    if (nextRoundButton) {
        nextRoundButton.disabled = true;
        nextRoundButton.textContent = 'Você está pronto';
    }
}

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

// Adicionar evento de tecla para o campo de pergunta quando for criado
function setupQuestionInputKeyEvent() {
    const questionInput = document.getElementById('question-input');
    if (questionInput) {
        questionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuestion();
            }
        });
    }
}

// Evento para quando o jogador deve responder
socket.on('answer-request', (data) => {
    console.log("Solicitação para responder à pergunta:", data.question);
    console.log("Dados recebidos:", JSON.stringify(data));
    
    try {
        // Marcar que este jogador está na fase de resposta
        localState.isAnswering = true;
        
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
                
                // Adicionar evento de tecla para o campo de resposta
                answerInput.addEventListener('keypress', function(e) {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        submitPlayerAnswer(data.question);
                    }
                });
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
        // Se o jogador está na fase de resposta, não atualizar a interface
        if (localState.isAnswering) {
            console.log("Jogador está respondendo, ignorando evento waiting-for-answers");
            
            // Apenas atualizar a lista de status se já existir
            const playersResponseContainer = document.getElementById('players-response-status');
            if (playersResponseContainer) {
                updateResponseStatusList(data.players);
            }
            
            return;
        }
        
        // Atualizar a interface para mostrar que estamos aguardando
        const gamePhase = document.getElementById('game-phase');
        if (!gamePhase) {
            console.error("Elemento game-phase não encontrado!");
            return;
        }
        
        // Criar o contêiner da fase
        const phaseBox = document.createElement('div');
        phaseBox.className = 'phase-box';
        
        // Título e mensagem principal
        const title = document.createElement('h3');
        title.textContent = 'Aguardando Respostas';
        
        const message = document.createElement('p');
        message.textContent = data.message;
        
        // Contêiner para o timer
        const timerContainer = document.createElement('div');
        timerContainer.className = 'answer-timer';
        timerContainer.innerHTML = `Tempo restante: <span id="waiting-timer">${data.timeLimit}</span> segundos`;
        
        // Contêiner para a lista de jogadores
        const playersResponseContainer = document.createElement('div');
        playersResponseContainer.className = 'players-response-status';
        playersResponseContainer.id = 'players-response-status';
        
        const responseStatusTitle = document.createElement('h4');
        responseStatusTitle.textContent = 'Status das Respostas:';
        playersResponseContainer.appendChild(responseStatusTitle);
        
        // Adicionar status para cada jogador
        if (data.players && data.players.length > 0) {
            data.players.forEach(player => {
                const playerStatus = document.createElement('div');
                playerStatus.className = `player-status ${player.responded ? 'responded' : 'waiting'}`;
                playerStatus.id = `player-status-${player.id}`;
                
                // Usar a cor do jogador se disponível
                const playerColor = player.color || '#555';
                playerStatus.style.borderLeft = `4px solid ${playerColor}`;
                playerStatus.style.backgroundColor = `${playerColor}10`;
                
                const statusIcon = document.createElement('span');
                statusIcon.className = 'status-icon';
                statusIcon.textContent = player.responded ? '✓' : '⏳';
                
                const playerName = document.createElement('span');
                playerName.className = 'player-name';
                playerName.textContent = `${player.name} ${player.id === socket.id ? '(Você)' : ''}`;
                
                const statusText = document.createElement('span');
                statusText.className = 'status-text';
                statusText.textContent = player.responded ? 'Respondeu' : 'Aguardando...';
                
                playerStatus.appendChild(statusIcon);
                playerStatus.appendChild(playerName);
                playerStatus.appendChild(statusText);
                
                playersResponseContainer.appendChild(playerStatus);
            });
        } else {
            const noPlayersMessage = document.createElement('p');
            noPlayersMessage.textContent = 'Aguardando informações dos jogadores...';
            playersResponseContainer.appendChild(noPlayersMessage);
        }
        
        // Adicionar spinner de carregamento
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner';
        
        // Montar a interface
        phaseBox.appendChild(title);
        phaseBox.appendChild(message);
        phaseBox.appendChild(timerContainer);
        phaseBox.appendChild(playersResponseContainer);
        phaseBox.appendChild(loadingSpinner);
        
        // Limpar e adicionar o novo conteúdo
        gamePhase.innerHTML = '';
        gamePhase.appendChild(phaseBox);
        
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

// Função para atualizar a lista de status de resposta
function updateResponseStatusList(players) {
    if (!players || players.length === 0) return;
    
    const playersResponseContainer = document.getElementById('players-response-status');
    if (!playersResponseContainer) return;
    
    // Limpar conteúdo existente, exceto o título
    const responseStatusTitle = playersResponseContainer.querySelector('h4');
    playersResponseContainer.innerHTML = '';
    if (responseStatusTitle) {
        playersResponseContainer.appendChild(responseStatusTitle);
    } else {
        const newTitle = document.createElement('h4');
        newTitle.textContent = 'Status das Respostas:';
        playersResponseContainer.appendChild(newTitle);
    }
    
    // Adicionar status para cada jogador
    players.forEach(player => {
        const playerStatus = document.createElement('div');
        playerStatus.className = `player-status ${player.responded ? 'responded' : 'waiting'}`;
        playerStatus.id = `player-status-${player.id}`;
        
        // Usar a cor do jogador se disponível
        const playerColor = player.color || '#555';
        playerStatus.style.borderLeft = `4px solid ${playerColor}`;
        playerStatus.style.backgroundColor = `${playerColor}10`;
        
        const statusIcon = document.createElement('span');
        statusIcon.className = 'status-icon';
        statusIcon.textContent = player.responded ? '✓' : '⏳';
        
        const playerName = document.createElement('span');
        playerName.className = 'player-name';
        playerName.textContent = `${player.name} ${player.id === socket.id ? '(Você)' : ''}`;
        
        const statusText = document.createElement('span');
        statusText.className = 'status-text';
        statusText.textContent = player.responded ? 'Respondeu' : 'Aguardando...';
        
        playerStatus.appendChild(statusIcon);
        playerStatus.appendChild(playerName);
        playerStatus.appendChild(statusText);
        
        playersResponseContainer.appendChild(playerStatus);
    });
}

// Evento para atualizar o status das respostas dos jogadores
socket.on('response-status-update', (data) => {
    console.log("Atualização do status de respostas:", data);
    
    // Se o jogador está na fase de resposta, não atualizar a interface completa
    if (localState.isAnswering) {
        // Apenas atualizar a lista de status se já existir
        updateResponseStatusList(data.players);
        return;
    }
    
    const playersResponseContainer = document.getElementById('players-response-status');
    if (!playersResponseContainer) return;
    
    // Atualizar o status de cada jogador
    data.players.forEach(player => {
        const playerStatus = document.getElementById(`player-status-${player.id}`);
        
        if (playerStatus) {
            // Atualizar classes e ícones
            if (player.responded) {
                playerStatus.classList.remove('waiting');
                playerStatus.classList.add('responded');
                
                const statusIcon = playerStatus.querySelector('.status-icon');
                if (statusIcon) statusIcon.textContent = '✓';
                
                const statusText = playerStatus.querySelector('.status-text');
                if (statusText) statusText.textContent = 'Respondeu';
            }
        } else {
            // Se o elemento não existir, criar um novo
            const newPlayerStatus = document.createElement('div');
            newPlayerStatus.className = `player-status ${player.responded ? 'responded' : 'waiting'}`;
            newPlayerStatus.id = `player-status-${player.id}`;
            
            // Usar a cor do jogador se disponível
            const playerColor = player.color || '#555';
            newPlayerStatus.style.borderLeft = `4px solid ${playerColor}`;
            newPlayerStatus.style.backgroundColor = `${playerColor}10`;
            
            const statusIcon = document.createElement('span');
            statusIcon.className = 'status-icon';
            statusIcon.textContent = player.responded ? '✓' : '⏳';
            
            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = `${player.name} ${player.id === socket.id ? '(Você)' : ''}`;
            
            const statusText = document.createElement('span');
            statusText.className = 'status-text';
            statusText.textContent = player.responded ? 'Respondeu' : 'Aguardando...';
            
            newPlayerStatus.appendChild(statusIcon);
            newPlayerStatus.appendChild(playerName);
            newPlayerStatus.appendChild(statusText);
            
            playersResponseContainer.appendChild(newPlayerStatus);
        }
    });
});

// Evento para preparar o jogador para responder
socket.on('prepare-for-answer', (data) => {
    console.log("Preparando para responder:", data.message);
    
    // Atualizar a interface para mostrar que o jogador deve responder
    const gamePhase = document.getElementById('game-phase');
    if (gamePhase) {
        const phaseBox = document.createElement('div');
        phaseBox.className = 'phase-box';
        
        const title = document.createElement('h3');
        title.textContent = 'Sua vez de responder';
        
        const message = document.createElement('p');
        message.textContent = data.message;
        
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner';
        
        phaseBox.appendChild(title);
        phaseBox.appendChild(message);
        phaseBox.appendChild(loadingSpinner);
        
        gamePhase.innerHTML = '';
        gamePhase.appendChild(phaseBox);
    }
});

// Evento para mostrar as respostas para votação
socket.on('show-answers', function(data) {
    console.log('Recebido evento show-answers:', data);
    
    // Resetar o estado de resposta
    localState.isAnswering = false;
    
    // Armazenar os dados de votação
    localState.voteData = data;
    
    // Atualizar a fase do jogo
    localState.phase = 'vote';
    
    // Limpar o conteúdo anterior
    const gamePhaseElement = document.getElementById('game-phase');
    if (!gamePhaseElement) {
        console.error("Elemento game-phase não encontrado!");
        return;
    }
    gamePhaseElement.innerHTML = '';
    
    // Criar a interface de votação
    const votingInterface = document.createElement('div');
    votingInterface.className = 'voting-interface';
    
    // Adicionar título com a pergunta
    const questionTitle = document.createElement('h2');
    questionTitle.className = 'question-title';
    questionTitle.textContent = data.question;
    votingInterface.appendChild(questionTitle);
    
    // Adicionar instruções
    const instructions = document.createElement('p');
    instructions.className = 'voting-phase-instructions';
    instructions.textContent = 'Vote na resposta que você acha que foi gerada pela IA!';
    votingInterface.appendChild(instructions);
    
    // Adicionar temporizador
    const timer = document.createElement('div');
    timer.id = 'voting-timer';
    timer.className = 'timer';
    timer.textContent = 'Tempo restante: 45s';
    votingInterface.appendChild(timer);
    
    // Adicionar contêiner para as respostas
    const answersContainer = document.createElement('div');
    answersContainer.id = 'answers-container';
    answersContainer.className = 'answers-container';
    votingInterface.appendChild(answersContainer);
    
    // Adicionar a interface ao elemento de fase do jogo
    gamePhaseElement.appendChild(votingInterface);
    
    // Mostrar as respostas para votação
    showAnswersForVoting(data);
});

// Função para enviar a resposta do jogador
function submitPlayerAnswer(question, timeout = false) {
    // Cancelar o timer se existir
    if (localState.answerTimer) {
        clearInterval(localState.answerTimer);
        localState.answerTimer = null;
    }
    
    // Marcar que o jogador não está mais na fase de resposta
    localState.isAnswering = false;
    
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
        <p>Sua resposta foi enviada. Aguardando as respostas dos outros jogadores...</p>
        <div class="loading-spinner"></div>
    </div>`;
}

// Função para votar em uma resposta
function voteForAnswer(answerIndex) {
    console.log(`Enviando voto para a resposta de índice ${answerIndex}`);
    
    if (answerIndex === undefined || answerIndex === null) {
        console.error("Erro: Índice de resposta inválido");
        alert("Erro ao enviar voto: índice de resposta inválido");
        return;
    }
    
    // Enviar voto para uma resposta específica
    socket.emit('vote', { answerIndex });
    console.log("Voto enviado com sucesso");
    
    // Desabilitar todos os botões de voto após votar
    const votingButtons = document.querySelectorAll('.answer-card button');
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
            <p>A IA alcançou ${data.winner.score} pontos e venceu o jogo. O objetivo era chegar a 20 pontos.</p>
        </div>`;
    } else {
        resultMessage = `<div class="player-win">
            <h3>${data.winner.name} Venceu!</h3>
            <p>${data.winner.name} alcançou ${data.winner.score} pontos e venceu o jogo. O objetivo era chegar a 20 pontos.</p>
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