const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Servir arquivos estáticos da pasta atual
app.use(express.static('./'));

// Função simples para gerar respostas de IA sem API externa
function generateAIResponse(question) {
    const respostas = [
        "Acho que depende do contexto, mas geralmente prefiro analisar todas as opções antes de decidir.",
        "Baseado na minha experiência, diria que sim, mas com algumas ressalvas.",
        "Essa é uma pergunta interessante. Eu diria que não, mas entendo quem pensa diferente.",
        "Nunca tinha pensado nisso dessa forma. Talvez seja uma questão de perspectiva.",
        "Definitivamente! Não tenho dúvidas sobre isso.",
        "Não concordo totalmente, mas respeito sua opinião sobre o assunto."
    ];
    
    return respostas[Math.floor(Math.random() * respostas.length)];
}

// Endpoint para gerar resposta da IA
app.use(express.json());
app.post('/ai/generate', (req, res) => {
    const question = req.body.question || "Sem pergunta";
    const aiResponse = generateAIResponse(question);
    res.json({ text: aiResponse });
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
    
    io.to(game.id).emit('game-update', {
        players: game.players.map(p => ({ 
            name: p.name, 
            id: p.id,
            isHost: p.id === game.hostId
        })),
        phase: game.phase,
        canStart: canStart,
        round: game.round,
        maxRounds: game.maxRounds
    });
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
    game.phase = 'vote';
    game.votes = [];
    updateGameState(game);
}

function processVotes(game) {
    // Contar votos
    const voteCount = {};
    game.votes.forEach(vote => {
        if (!voteCount[vote.answerIndex]) {
            voteCount[vote.answerIndex] = 0;
        }
        voteCount[vote.answerIndex]++;
    });
    
    // Calcular porcentagens
    const totalVotes = game.votes.length;
    const results = Object.keys(voteCount).map(index => ({
        answerIndex: parseInt(index),
        votes: voteCount[index],
        percentage: Math.round((voteCount[index] / totalVotes) * 100)
    }));
    
    game.phase = 'results';
    game.voteResults = results;
    
    io.to(game.id).emit('vote-results', {
        results: results,
        answers: game.currentAnswers
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

    socket.on('submit-answer', async (data) => {
        const game = getGameBySocket(socket);
        if (!game) return;
        
        game.currentAnswers.push({
            ...data,
            playerId: socket.id
        });
        console.log(`Resposta recebida de ${socket.id}`);
        
        // Adicionar resposta da IA
        if (game.currentAnswers.length === 1) {
            const aiResponse = generateAIResponse(data.question);
            game.currentAnswers.push({
                question: data.question,
                aiAnswer: aiResponse,
                playerId: game.aiPlayer.id
            });
        }
        
        // Se todos os jogadores responderam, iniciar votação
        if (game.currentAnswers.length >= 2) {
            io.to(game.id).emit('show-answers', game.currentAnswers);
            startVotingPhase(game);
        }
    });
    
    socket.on('vote', (data) => {
        const game = getGameBySocket(socket);
        if (!game || game.phase !== 'vote') return;
        
        // Registrar voto
        game.votes.push({
            playerId: socket.id,
            answerIndex: data.answerIndex
        });
        
        // Se todos votaram, processar os votos
        if (game.votes.length === game.players.length) {
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

http.listen(3000, () => console.log('Servidor rodando na porta 3000')); 