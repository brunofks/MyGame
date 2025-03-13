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
            aiPlayer: null // Será definido quando o jogo começar
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
            isHost: p.id === game.hostId
        })),
        phase: game.phase,
        canStart: canStart,
        round: game.round,
        maxRounds: game.maxRounds
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
    
    console.log(`Enviando atualização de estado para o jogo ${game.id}, fase: ${game.phase}`);
    io.to(game.id).emit('game-update', gameState);
}

function startGame(game) {
    if (game.players.length < 3) {
        return false; // Não pode iniciar com menos de 3 jogadores
    }
    
    game.status = 'playing';
    game.phase = 'question';
    game.round = 1;
    
    // Escolher aleatoriamente um sabotador entre os jogadores
    const randomPlayerIndex = Math.floor(Math.random() * game.players.length);
    game.players[randomPlayerIndex].isSabotador = true;
    
    // Criar um jogador IA
    game.aiPlayer = {
        id: 'ai_' + Date.now(),
        name: 'Jogador ' + (game.players.length + 1),
        isAI: true
    };
    
    // Notificar cada jogador sobre seu papel
    game.players.forEach(player => {
        io.to(player.id).emit('role-assigned', {
            isSabotador: player.isSabotador || false,
            role: player.isSabotador ? 'sabotador' : 'player'
        });
    });
    
    updateGameState(game);
    return true;
}

function startVotingPhase(game) {
    console.log(`Iniciando fase de votação para o jogo ${game.id}. Rodada: ${game.round}/${game.maxRounds}`);
    console.log("Estado atual das respostas:", JSON.stringify(game.currentAnswers));
    
    // Garantir que temos respostas para votar
    if (!game.currentAnswers || game.currentAnswers.length < 1) {
        console.log("AVISO: Tentando iniciar votação sem respostas suficientes!");
        return;
    }
    
    // Verificar se temos pelo menos uma resposta da IA e uma resposta humana
    const aiAnswer = game.currentAnswers.find(a => a.source === 'ai');
    const humanAnswer = game.currentAnswers.find(a => a.source === 'human');
    
    console.log("Resposta da IA encontrada:", aiAnswer ? "Sim" : "Não");
    console.log("Resposta humana encontrada:", humanAnswer ? "Sim" : "Não");
    
    if (!aiAnswer || !humanAnswer) {
        console.log("AVISO: Faltando resposta da IA ou humana. Tentando corrigir...");
        
        // Se não temos resposta da IA, gerar uma
        if (!aiAnswer) {
            const fallbackResponse = generateFallbackResponse(game.currentQuestion);
            game.currentAnswers.push({
                question: game.currentQuestion,
                answer: fallbackResponse,
                source: 'ai'
            });
            console.log("Resposta da IA gerada como fallback");
        }
        
        // Se não temos resposta humana, gerar uma
        if (!humanAnswer) {
            const fallbackHumanResponse = "Não consegui pensar em uma resposta a tempo...";
            game.currentAnswers.push({
                question: game.currentQuestion,
                answer: fallbackHumanResponse,
                source: 'human'
            });
            console.log("Resposta humana gerada como fallback");
        }
    }
    
    // Embaralhar as respostas para não ser óbvio qual é da IA
    game.currentAnswers = shuffleArray(game.currentAnswers);
    
    // Criar uma cópia das respostas sem a informação de origem (IA ou humano)
    const anonymousAnswers = game.currentAnswers.map((answer, index) => ({
        question: answer.question,
        answer: answer.answer,
        index: index // Mantemos apenas o índice para referência na votação
    }));
    
    console.log(`Enviando ${anonymousAnswers.length} respostas para votação:`, JSON.stringify(anonymousAnswers));
    
    // Atualizar a fase do jogo
    game.phase = 'vote';
    game.votes = [];
    
    // Enviar as respostas para os jogadores votarem
    io.to(game.id).emit('show-answers', {
        question: game.currentQuestion,
        answers: anonymousAnswers
    });
    
    // Atualizar o estado do jogo para todos os jogadores
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
    
    // Adicionar informação sobre a origem das respostas (IA ou humano)
    const answersWithSources = game.currentAnswers.map((answer, index) => ({
        question: answer.question,
        answer: answer.answer,
        source: answer.source,
        index: index
    }));
    
    game.phase = 'results';
    game.voteResults = results;
    
    io.to(game.id).emit('vote-results', {
        results: results,
        answers: answersWithSources,
        question: game.currentQuestion,
        skipVotes: skipVotes,
        skipPercentage: Math.round((skipVotes / totalVotes) * 100)
    });
    
    updateGameState(game);
    
    // Preparar para a próxima rodada após 10 segundos
    setTimeout(() => {
        if (game.round < game.maxRounds) {
            game.round++;
            game.phase = 'question';
            game.currentAnswers = [];
            updateGameState(game);
        } else {
            endGame(game);
        }
    }, 10000);
}

function endGame(game) {
    game.phase = 'gameOver';
    game.status = 'finished';
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
        
        game.players.push({
            id: socket.id,
            name: playerName,
            role: assignRole(),
            isSabotador: false // Será definido quando o jogo começar
        });
        
        socket.join(game.id);
        updateGameState(game);
        console.log(`${playerName} entrou no jogo ${game.id}`);
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
                source: 'ai' // Marcamos como IA para uso interno, não será mostrado aos jogadores
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
        
        // Sortear um jogador para responder (excluindo quem enviou a pergunta)
        const availablePlayers = game.players.filter(p => p.id !== socket.id);
        
        if (availablePlayers.length > 0) {
            const randomIndex = Math.floor(Math.random() * availablePlayers.length);
            const selectedPlayer = availablePlayers[randomIndex];
            
            console.log(`Jogador sorteado para responder: ${selectedPlayer.name} (${selectedPlayer.id})`);
            
            // Enviar solicitação para o jogador sorteado responder
            console.log(`Enviando solicitação de resposta para ${selectedPlayer.name} (${selectedPlayer.id})`);
            
            // Primeiro, enviar um evento para garantir que o jogador sorteado esteja pronto
            io.to(selectedPlayer.id).emit('prepare-for-answer', {
                message: "Você foi sorteado para responder. Preparando interface..."
            });
            
            // Depois de um pequeno atraso, enviar a solicitação de resposta
            setTimeout(() => {
                io.to(selectedPlayer.id).emit('answer-request', {
                    question: data.question,
                    timeLimit: 30, // 30 segundos para responder
                    selectedPlayerId: selectedPlayer.id // Incluir o ID do jogador selecionado para verificação
                });
            }, 500);
            
            // Notificar todos os outros jogadores que estamos aguardando uma resposta
            game.players.forEach(player => {
                if (player.id !== selectedPlayer.id) {
                    io.to(player.id).emit('waiting-for-answer', {
                        message: `Aguardando resposta de um jogador...`,
                        timeLimit: 30
                    });
                }
            });
            
            // Definir um timeout para caso o jogador não responda
            game.answerTimeout = setTimeout(() => {
                // Se o jogador não respondeu, gerar uma resposta automática
                if (game.currentAnswers.length < 2) {
                    console.log(`Jogador ${selectedPlayer.id} não respondeu a tempo. Gerando resposta automática.`);
                    
                    const autoResponse = "Não consegui pensar em uma resposta a tempo...";
                    
                    game.currentAnswers.push({
                        question: data.question,
                        answer: autoResponse,
                        source: 'human' // Marcamos como humano para uso interno
                    });
                    
                    // Iniciar a fase de votação
                    startVotingPhase(game);
                }
            }, 30000); // 30 segundos
        } else {
            console.log("Não há jogadores disponíveis para sortear. Usando apenas a resposta da IA.");
            startVotingPhase(game);
        }
    });
    
    // Novo evento para receber a resposta do jogador sorteado
    socket.on('submit-answer', (data) => {
        const game = getGameBySocket(socket);
        if (!game) {
            console.log("Erro: Jogo não encontrado para o socket", socket.id);
            return;
        }
        
        console.log(`Resposta recebida de ${socket.id}: "${data.answer}"`);
        
        // Adicionar resposta do jogador
        game.currentAnswers.push({
            question: data.question,
            answer: data.answer,
            source: 'human' // Marcamos como humano para uso interno
        });
        
        // Cancelar o timeout se existir
        if (game.answerTimeout) {
            clearTimeout(game.answerTimeout);
            game.answerTimeout = null;
        }
        
        // Iniciar a fase de votação
        startVotingPhase(game);
    });
    
    // Evento para receber votos
    socket.on('vote', (data) => {
        const game = getGameBySocket(socket);
        if (!game || game.phase !== 'vote') return;
        
        console.log(`Voto recebido de ${socket.id} para a resposta ${data.answerIndex}`);
        
        // Registrar voto
        game.votes.push({
            playerId: socket.id,
            answerIndex: data.answerIndex
        });
        
        // Verificar se todos os jogadores votaram
        const allVoted = game.players.every(player => {
            return game.votes.some(vote => vote.playerId === player.id);
        });
        
        // Se todos votaram, processar os votos
        if (allVoted) {
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