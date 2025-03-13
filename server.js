const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Carregar variáveis de ambiente
dotenv.config();

// Configurar a API do Google Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Servir arquivos estáticos da pasta atual
app.use(express.static('./'));

// Função para gerar respostas usando a API do Gemini
async function generateAIResponse(question) {
    try {
        // Obter o modelo Gemini 2.0 Flash (modelo mais recente)
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.0-flash"  // Usando o modelo mais recente conforme documentação
        });
        
        // Criar o prompt com instruções específicas
        const prompt = `Você está participando de um jogo onde precisa se passar por um humano. 
        Responda à seguinte pergunta de forma natural, como se fosse uma pessoa real, 
        sem mencionar que você é uma IA. Mantenha a resposta curta (máximo 2-3 frases) e conversacional:
        
        Pergunta: ${question}`;
        
        // Gerar resposta
        const result = await model.generateContent(prompt);
        
        const response = result.response.text();
        console.log("Resposta da IA gerada com sucesso:", response.substring(0, 50) + "...");
        return response;
    } catch (error) {
        console.error("Erro ao gerar resposta da IA:", error);
        // Verificar detalhes do erro para debug
        if (error.response) {
            console.error("Detalhes da resposta:", error.response);
        }
        return generateFallbackResponse(question);
    }
}

// Função de fallback melhorada
function generateFallbackResponse(question) {
    console.log("Usando resposta de fallback para a pergunta:", question);
    
    // Respostas genéricas que podem funcionar para muitas perguntas
    const respostasGenericas = [
        "Acho que depende do contexto, mas geralmente prefiro analisar todas as opções antes de decidir.",
        "Baseado na minha experiência, diria que sim, mas com algumas ressalvas.",
        "Essa é uma pergunta interessante. Eu diria que não, mas entendo quem pensa diferente.",
        "Nunca tinha pensado nisso dessa forma. Talvez seja uma questão de perspectiva.",
        "Definitivamente! Não tenho dúvidas sobre isso.",
        "Não concordo totalmente, mas respeito sua opinião sobre o assunto."
    ];
    
    // Respostas específicas para tipos comuns de perguntas
    const respostasPorTipo = {
        preferencia: [
            "Prefiro a opção mais prática, geralmente.",
            "Depende do dia, mas normalmente escolho o que me faz sentir melhor.",
            "Gosto de variar, não tenho uma preferência fixa."
        ],
        opiniao: [
            "Tenho uma visão um pouco diferente sobre isso, mas respeito quem pensa assim.",
            "Concordo parcialmente, mas acho que há nuances importantes a considerar.",
            "Minha opinião sobre isso mudou bastante com o tempo."
        ],
        pessoal: [
            "É algo que faz parte da minha rotina há anos.",
            "Tenho uma relação complicada com isso, para ser sincero.",
            "Ainda estou formando minha opinião sobre esse assunto."
        ]
    };
    
    // Tentar identificar o tipo de pergunta
    let tipoResposta = "genérica";
    if (question.toLowerCase().includes("prefere") || question.toLowerCase().includes("gosta")) {
        tipoResposta = "preferencia";
    } else if (question.toLowerCase().includes("acha") || question.toLowerCase().includes("pensa")) {
        tipoResposta = "opiniao";
    } else if (question.toLowerCase().includes("você") || question.toLowerCase().includes("sua")) {
        tipoResposta = "pessoal";
    }
    
    // Selecionar uma resposta apropriada
    let respostas = respostasGenericas;
    if (tipoResposta !== "genérica" && respostasPorTipo[tipoResposta]) {
        respostas = respostasPorTipo[tipoResposta];
    }
    
    return respostas[Math.floor(Math.random() * respostas.length)];
}

// Endpoint para gerar resposta da IA
app.use(express.json());
app.post('/ai/generate', async (req, res) => {
    const question = req.body.question || "Sem pergunta";
    try {
        const aiResponse = await generateAIResponse(question);
        res.json({ text: aiResponse });
    } catch (error) {
        console.error("Erro na rota de geração:", error);
        res.json({ text: generateFallbackResponse(question) });
    }
});

// Funções auxiliares para gerenciar jogos
function findAvailableGame() {
    // Lógica simplificada para encontrar ou criar um jogo
    let availableGame = null;
    
    for (const [id, game] of games.entries()) {
        if (game.players.length < 6 && game.status === 'waiting') {
            availableGame = game;
            break;
        }
    }
    
    if (!availableGame) {
        const gameId = 'game_' + Date.now();
        availableGame = {
            id: gameId,
            players: [],
            status: 'waiting',
            currentAnswers: [],
            phase: 'lobby',
            hostId: null, // O primeiro jogador será o anfitrião
            round: 0,
            maxRounds: 3,
            votes: [],
            aiPlayer: null, // Será definido quando o jogo começar
            playerColors: [] // Array para armazenar as cores dos jogadores
        };
        games.set(gameId, availableGame);
    }
    
    return availableGame;
}

function assignRole() {
    return 'player'; // Simplificado
}

function getGameBySocket(socket) {
    // Encontrar o jogo que contém este socket
    for (const [id, game] of games.entries()) {
        if (game.players.some(p => p.id === socket.id)) {
            return game;
        }
    }
    return null;
}

function updateGameState(game) {
    // Atualiza o estado do jogo para todos os jogadores
    const canStart = game.players.length >= 3 && game.status === 'waiting';
    
    // Dados básicos do jogo que são enviados em todas as fases
    const gameState = {
        players: game.players.map(p => ({ 
            name: p.name, 
            id: p.id,
            isHost: p.id === game.hostId,
            score: p.score || 0,
            isAnswerAuthor: p.isAnswerAuthor || false,
            isQuestionAuthor: p.id === game.currentQuestionAuthorId,
            color: p.color
        })),
        phase: game.phase,
        canStart: canStart,
        round: game.round,
        maxRounds: game.maxRounds,
        aiScore: game.aiScore || 0
    };
    
    // Adicionar dados específicos da fase atual
    if (game.phase === 'vote' && game.currentAnswers && game.currentAnswers.length > 0) {
        console.log("Adicionando dados de votação ao estado do jogo");
        
        // Criar uma cópia das respostas sem a informação de origem (IA ou humano)
        const anonymousAnswers = game.currentAnswers.map((answer, index) => ({
            question: answer.question,
            answer: answer.answer,
            index: index
        }));
        
        gameState.voteData = {
            question: game.currentQuestion,
            answers: anonymousAnswers
        };
    }
    
    // Enviar informações específicas para cada jogador
    game.players.forEach(player => {
        // Clonar o estado do jogo para este jogador
        const playerState = JSON.parse(JSON.stringify(gameState));
        
        // Adicionar informações específicas para este jogador
        playerState.isAnswerAuthor = player.isAnswerAuthor || false;
        
        console.log(`Enviando atualização de estado para o jogador ${player.id}, fase: ${game.phase}`);
        io.to(player.id).emit('game-update', playerState);
    });
}

function startGame(game) {
    if (game.players.length < 3) {
        return false; // Não pode iniciar com menos de 3 jogadores
    }
    
    game.status = 'playing';
    game.phase = 'question';
    game.round = 1;
    game.aiScore = 0;
    
    // Inicializar pontuação para todos os jogadores
    game.players.forEach(player => {
        player.score = 0;
    });
    
    // Escolher aleatoriamente um jogador para fazer a primeira pergunta
    const randomPlayerIndex = Math.floor(Math.random() * game.players.length);
    game.currentQuestionAuthorId = game.players[randomPlayerIndex].id;
    game.questionAuthorIndex = randomPlayerIndex;
    
    // Notificar cada jogador sobre o início do jogo
    game.players.forEach(player => {
        io.to(player.id).emit('game-started', {
            isQuestionAuthor: player.id === game.currentQuestionAuthorId
        });
    });
    
    updateGameState(game);
    return true;
}

function startVotingPhase(game) {
    console.log(`Iniciando fase de votação para o jogo ${game.id}. Rodada: ${game.round}`);
    console.log("Estado atual das respostas:", JSON.stringify(game.currentAnswers));
    
    // Garantir que temos respostas para votar
    if (!game.currentAnswers || game.currentAnswers.length < 1) {
        console.log("AVISO: Tentando iniciar votação sem respostas suficientes!");
        return;
    }
    
    // Verificar se temos a resposta da IA
    const aiAnswer = game.currentAnswers.find(a => a.source === 'ai');
    
    console.log("Resposta da IA encontrada:", aiAnswer ? "Sim" : "Não");
    
    if (!aiAnswer) {
        console.log("AVISO: Faltando resposta da IA. Tentando corrigir...");
        
        // Se não temos resposta da IA, gerar uma
        const fallbackResponse = generateFallbackResponse(game.currentQuestion);
        game.currentAnswers.push({
            question: game.currentQuestion,
            answer: fallbackResponse,
            source: 'ai'
        });
        console.log("Resposta da IA gerada como fallback");
    }
    
    // Embaralhar as respostas para não ser óbvio qual é da IA
    game.currentAnswers = shuffleArray(game.currentAnswers);
    
    // Criar uma cópia das respostas sem a informação de origem (IA ou humano)
    const anonymousAnswers = game.currentAnswers.map((answer, index) => ({
        question: answer.question,
        answer: answer.answer,
        index: index, // Mantemos apenas o índice para referência na votação
        authorId: answer.authorId // Mantemos o ID do autor para pontuação
    }));
    
    console.log(`Enviando ${anonymousAnswers.length} respostas para votação:`, JSON.stringify(anonymousAnswers));
    
    // Atualizar a fase do jogo
    game.phase = 'vote';
    game.votes = [];
    
    // Enviar as respostas para todos os jogadores
    io.to(game.id).emit('show-answers', {
        question: game.currentQuestion,
        answers: anonymousAnswers
    });
    
    updateGameState(game);
}

function processVotes(game) {
    console.log("Processando votos para o jogo", game.id);
    
    // Contar votos
    const voteCount = {};
    let skipVotes = 0;
    
    game.votes.forEach(vote => {
        if (vote.answerIndex === 'skip') {
            skipVotes++;
        } else {
            if (!voteCount[vote.answerIndex]) {
                voteCount[vote.answerIndex] = 0;
            }
            voteCount[vote.answerIndex]++;
        }
    });
    
    // Calcular porcentagens
    const totalVotes = game.votes.length;
    const results = Object.keys(voteCount).map(index => ({
        answerIndex: parseInt(index),
        votes: voteCount[index],
        percentage: Math.round((voteCount[index] / totalVotes) * 100)
    }));
    
    console.log("Resultados da votação:", results);
    console.log("Votos para pular:", skipVotes);
    
    // Encontrar o índice da resposta da IA
    const aiAnswerIndex = game.currentAnswers.findIndex(a => a.source === 'ai');
    
    // Verificar se alguém acertou a resposta da IA
    let aiCorrectlyIdentified = false;
    
    // Adicionar informação sobre a origem das respostas (IA ou humano)
    const answersWithSources = game.currentAnswers.map((answer, index) => {
        // Encontrar o nome do autor da resposta humana, se disponível
        let authorName = "IA";
        let authorId = null;
        
        if (answer.source === 'human' && answer.authorId) {
            const author = game.players.find(p => p.id === answer.authorId);
            if (author) {
                authorName = author.name;
                authorId = author.id;
            }
        }
        
        // Contar votos para esta resposta
        const result = results.find(r => r.answerIndex === index);
        const votesReceived = result ? result.votes : 0;
        
        // Se esta é uma resposta humana, dar pontos ao autor por cada voto recebido
        if (answer.source === 'human' && authorId) {
            const author = game.players.find(p => p.id === authorId);
            if (author) {
                author.score = (author.score || 0) + votesReceived;
                console.log(`${author.name} ganhou ${votesReceived} pontos por votos em sua resposta`);
            }
        }
        
        // Verificar se esta é a resposta da IA e se alguém votou nela
        if (answer.source === 'ai' && votesReceived > 0) {
            aiCorrectlyIdentified = true;
            
            // Dar 3 pontos para cada jogador que votou corretamente na IA
            game.votes.forEach(vote => {
                if (vote.answerIndex === index) {
                    const voter = game.players.find(p => p.id === vote.playerId);
                    if (voter) {
                        voter.score = (voter.score || 0) + 3;
                        console.log(`${voter.name} ganhou 3 pontos por identificar corretamente a IA`);
                    }
                }
            });
        }
        
        return {
            question: answer.question,
            answer: answer.answer,
            source: answer.source,
            authorId: authorId,
            authorName: authorName,
            index: index,
            votesReceived: votesReceived
        };
    });
    
    // Se ninguém identificou a IA, ela ganha 3 pontos
    if (!aiCorrectlyIdentified) {
        game.aiScore = (game.aiScore || 0) + 3;
        console.log(`A IA ganhou 3 pontos porque ninguém a identificou`);
    }
    
    // Verificar condições de vitória
    let gameWinner = null;
    
    // Verificar se a IA ganhou (12 pontos)
    if (game.aiScore >= 12) {
        gameWinner = {
            type: 'ai',
            name: 'IA',
            score: game.aiScore
        };
    } else {
        // Verificar se algum jogador ganhou (10 pontos)
        const winningPlayer = game.players.find(p => (p.score || 0) >= 10);
        if (winningPlayer) {
            gameWinner = {
                type: 'player',
                name: winningPlayer.name,
                id: winningPlayer.id,
                score: winningPlayer.score
            };
        }
    }
    
    game.phase = 'results';
    game.voteResults = results;
    
    io.to(game.id).emit('vote-results', {
        results: results,
        answers: answersWithSources,
        question: game.currentQuestion,
        skipVotes: skipVotes,
        skipPercentage: Math.round((skipVotes / totalVotes) * 100),
        aiAnswerIndex: aiAnswerIndex,
        aiCorrectlyIdentified: aiCorrectlyIdentified,
        aiScore: game.aiScore,
        playerScores: game.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score || 0
        }))
    });
    
    updateGameState(game);
    
    // Se temos um vencedor, terminar o jogo
    if (gameWinner) {
        setTimeout(() => {
            endGame(game, gameWinner);
        }, 5000);
        return;
    }
    
    // Preparar para a próxima rodada após 10 segundos
    setTimeout(() => {
        // Limpar o estado de autor da resposta para todos os jogadores
        game.players.forEach(player => {
            player.isAnswerAuthor = false;
        });
        
        // Avançar para o próximo jogador para fazer a pergunta
        game.questionAuthorIndex = (game.questionAuthorIndex + 1) % game.players.length;
        game.currentQuestionAuthorId = game.players[game.questionAuthorIndex].id;
        
        game.round++;
        game.phase = 'question';
        game.currentAnswers = [];
        updateGameState(game);
    }, 10000);
}

function endGame(game, winner) {
    console.log(`Finalizando o jogo ${game.id}`);
    
    // Preparar o resultado final
    const finalResult = {
        winner: winner,
        players: game.players.map(p => ({
            name: p.name,
            id: p.id,
            score: p.score || 0
        })),
        aiScore: game.aiScore || 0
    };
    
    game.phase = 'gameOver';
    game.status = 'finished';
    
    // Enviar o resultado final para todos os jogadores
    io.to(game.id).emit('game-over', finalResult);
    
    updateGameState(game);
    
    // Remover o jogo após algum tempo
    setTimeout(() => {
        games.delete(game.id);
    }, 60000); // 1 minuto
}

const games = new Map();

io.on('connection', (socket) => {
    console.log('Um usuário conectou:', socket.id);
    
    socket.on('join-game', (playerName) => {
        // Lógica de criação/entrada na sala
        const game = findAvailableGame();
        
        // Se for o primeiro jogador, definir como anfitrião
        if (game.players.length === 0) {
            game.hostId = socket.id;
        }
        
        // Gerar uma cor única para o jogador
        let playerColor;
        do {
            playerColor = generatePlayerColor();
            // Garantir que a cor não está sendo usada por outro jogador
        } while (game.players.some(p => p.color === playerColor));
        
        game.players.push({
            id: socket.id,
            name: playerName,
            role: assignRole(),
            color: playerColor,
            score: 0
        });
        
        socket.join(game.id);
        updateGameState(game);
        console.log(`${playerName} entrou no jogo ${game.id} com a cor ${playerColor}`);
    });

    socket.on('start-game', () => {
        const game = getGameBySocket(socket);
        if (!game) return;
        
        // Apenas o anfitrião pode iniciar o jogo
        if (game.hostId === socket.id) {
            const started = startGame(game);
            if (!started) {
                socket.emit('game-error', { message: 'Não foi possível iniciar o jogo. São necessários pelo menos 3 jogadores.' });
            }
        }
    });

    socket.on('submit-question', async (data) => {
        const game = getGameBySocket(socket);
        if (!game) {
            console.log("Erro: Jogo não encontrado para o socket", socket.id);
            return;
        }
        
        // Verificar se este jogador é o autor da pergunta atual
        if (game.currentQuestionAuthorId !== socket.id) {
            console.log(`Erro: Jogador ${socket.id} não é o autor da pergunta atual`);
            socket.emit('game-error', { message: 'Você não é o jogador designado para fazer a pergunta nesta rodada.' });
            return;
        }
        
        console.log(`Pergunta recebida de ${socket.id}: "${data.question}"`);
        
        // Limpar respostas anteriores
        game.currentAnswers = [];
        game.currentQuestion = data.question;
        
        // Gerar resposta da IA
        console.log("Gerando resposta da IA...");
        try {
            const aiResponse = await generateAIResponse(data.question);
            console.log("Resposta da IA gerada:", aiResponse);
            
            // Adicionar resposta da IA
            game.currentAnswers.push({
                question: data.question,
                answer: aiResponse,
                source: 'ai' // Marcamos como IA para uso interno
            });
        } catch (error) {
            console.error("Erro ao gerar resposta da IA:", error);
            const fallbackResponse = generateFallbackResponse(data.question);
            game.currentAnswers.push({
                question: data.question,
                answer: fallbackResponse,
                source: 'ai'
            });
        }
        
        // Solicitar respostas de todos os jogadores (incluindo o autor da pergunta)
        game.players.forEach(player => {
            console.log(`Solicitando resposta do jogador ${player.name} (${player.id})`);
            
            // Primeiro, enviar um evento para garantir que o jogador esteja pronto
            io.to(player.id).emit('prepare-for-answer', {
                message: "É sua vez de responder. Preparando interface..."
            });
            
            // Depois de um pequeno atraso, enviar a solicitação de resposta
            setTimeout(() => {
                io.to(player.id).emit('answer-request', {
                    question: data.question,
                    timeLimit: 30 // 30 segundos para responder
                });
            }, 500);
        });
        
        // Definir um timeout para caso algum jogador não responda
        game.answerTimeout = setTimeout(() => {
            // Verificar quais jogadores não responderam
            const respondedPlayerIds = game.currentAnswers
                .filter(a => a.source === 'human')
                .map(a => a.authorId);
            
            const nonRespondingPlayers = game.players.filter(p => 
                !respondedPlayerIds.includes(p.id)
            );
            
            // Gerar respostas automáticas para jogadores que não responderam
            nonRespondingPlayers.forEach(player => {
                console.log(`Jogador ${player.name} (${player.id}) não respondeu a tempo. Gerando resposta automática.`);
                
                const autoResponse = "Não consegui pensar em uma resposta a tempo...";
                
                game.currentAnswers.push({
                    question: data.question,
                    answer: autoResponse,
                    source: 'human',
                    authorId: player.id
                });
            });
            
            // Iniciar a fase de votação se temos pelo menos uma resposta
            if (game.currentAnswers.length > 0) {
                startVotingPhase(game);
            }
        }, 30000); // 30 segundos
    });
    
    // Evento para receber a resposta do jogador
    socket.on('submit-answer', (data) => {
        const game = getGameBySocket(socket);
        if (!game) {
            console.log("Erro: Jogo não encontrado para o socket", socket.id);
            return;
        }
        
        console.log(`Resposta recebida de ${socket.id}: "${data.answer}"`);
        
        // Verificar se este jogador já enviou uma resposta
        const existingAnswer = game.currentAnswers.find(a => 
            a.source === 'human' && a.authorId === socket.id
        );
        
        if (existingAnswer) {
            console.log(`Jogador ${socket.id} já enviou uma resposta. Ignorando.`);
            return;
        }
        
        // Adicionar resposta do jogador
        game.currentAnswers.push({
            question: data.question,
            answer: data.answer,
            source: 'human',
            authorId: socket.id
        });
        
        // Verificar se todos os jogadores (exceto o autor da pergunta) responderam
        const expectedResponses = game.players.length - 1; // Todos menos o autor da pergunta
        const receivedResponses = game.currentAnswers.filter(a => a.source === 'human').length;
        
        console.log(`Recebidas ${receivedResponses} de ${expectedResponses} respostas esperadas`);
        
        if (receivedResponses >= expectedResponses) {
            // Cancelar o timeout se existir
            if (game.answerTimeout) {
                clearTimeout(game.answerTimeout);
                game.answerTimeout = null;
            }
            
            // Iniciar a fase de votação
            startVotingPhase(game);
        }
    });
    
    // Evento para receber votos
    socket.on('vote', (data) => {
        const game = getGameBySocket(socket);
        if (!game || game.phase !== 'vote') return;
        
        console.log(`Voto recebido de ${socket.id} para a resposta ${data.answerIndex}`);
        
        // Verificar se o jogador está tentando votar na própria resposta
        const votedAnswer = game.currentAnswers[data.answerIndex];
        if (votedAnswer && votedAnswer.authorId === socket.id) {
            console.log(`Jogador ${socket.id} tentou votar na própria resposta. Ignorando.`);
            socket.emit('game-error', { message: 'Você não pode votar na sua própria resposta.' });
            return;
        }
        
        // Verificar se o jogador já votou
        const existingVote = game.votes.find(v => v.playerId === socket.id);
        if (existingVote) {
            console.log(`Jogador ${socket.id} já votou. Atualizando voto.`);
            existingVote.answerIndex = data.answerIndex;
        } else {
            // Registrar novo voto
            game.votes.push({
                playerId: socket.id,
                answerIndex: data.answerIndex
            });
        }
        
        // Verificar se todos os jogadores votaram
        const expectedVotes = game.players.length;
        
        // O autor da pergunta também vota
        if (game.votes.length >= expectedVotes) {
            processVotes(game);
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Usuário desconectou:', socket.id);
        
        // Remover jogador de qualquer jogo em que esteja
        for (const [id, game] of games.entries()) {
            const playerIndex = game.players.findIndex(p => p.id === socket.id);
            
            if (playerIndex !== -1) {
                game.players.splice(playerIndex, 1);
                
                // Se era o anfitrião, passar para o próximo jogador
                if (game.hostId === socket.id && game.players.length > 0) {
                    game.hostId = game.players[0].id;
                }
                
                // Se não houver mais jogadores, remover o jogo
                if (game.players.length === 0) {
                    games.delete(id);
                } else {
                    updateGameState(game);
                }
                
                break;
            }
        }
    });
});

// Verificar se a API está configurada corretamente
console.log("API do Google Gemini configurada. Modelo a ser usado: gemini-2.0-flash");

http.listen(3000, () => console.log('Servidor rodando na porta 3000'));

// Função para embaralhar array
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Função para gerar uma cor aleatória para o jogador
function generatePlayerColor() {
    // Lista de cores predefinidas para garantir boa visibilidade e contraste
    const colors = [
        '#e74c3c', // Vermelho
        '#3498db', // Azul
        '#2ecc71', // Verde
        '#f39c12', // Laranja
        '#9b59b6', // Roxo
        '#1abc9c', // Turquesa
        '#d35400', // Laranja escuro
        '#c0392b', // Vermelho escuro
        '#8e44ad', // Roxo escuro
        '#27ae60', // Verde escuro
        '#2980b9', // Azul escuro
        '#f1c40f'  // Amarelo
    ];
    
    // Retornar uma cor aleatória da lista
    return colors[Math.floor(Math.random() * colors.length)];
} 