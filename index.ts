import express from 'express'
import cors from 'cors'
import http from 'http'
import socketio from 'socket.io'

// Controller Imports
import { 
    createPlayer,
    Checklist, playerCount
} from "./controllers/Players";
import { 
    joinRoom, 
    createRoom, 
    getOwnRoom, 
    getUserRoom, 
    removeFromRoom, 
    getUser,
    Meeting,
    createVote,
    castVote, 
    checkForVictory,
    deleteRoom, 
    restorePlayer, 
    roomCount, 
    getRoom,
    concludeVote,
} from "./controllers/Room";
import { 
    shortTasks, 
    longTasks, 
    commonTask,
    getTasks,
    TaskType
} from "./controllers/Tasks";

// Util Imports
import { randIndex } from "./util/random";
import { formatMessage } from './controllers/Message';

interface TaskReport {
    taskname: string
    taskcategory: TaskType
}

const app: express.Application = express()
app.use(cors())
const server = http.createServer(app)
const io = socketio(server)

interface ServerStatus {
    sockets: number
    players: number
    rooms: number
}

app.get('/status', (req, res) => {
    res.json({
        sockets: Object.keys(io.sockets.connected).length,
        players: playerCount(),
        rooms: roomCount()
    } as ServerStatus)
})

app.get('/status/:roomid', (req, res) => {
    const room = getRoom(req.params.roomid);
    if(room) {
        res.json(room);
    } else {
        res.status(404).json({ error: 'Room not Found'});
    }
})

io.on('connection', socket => {

    console.log('[SERVER] User has Connected');

    socket.on('createRoom', (username) => {

        const user = createPlayer(socket.id, username)

        const room = createRoom(user);
        console.log(`[ROOM] Room ${room.roomcode} has been created`)

        socket.join(room.id)

        socket.emit('joinedRoom', { room, user })

    })

    socket.on('joinRoom', (username, roomcode) => {
        
        console.log("[SERVER] Oh Sah Dude!");

        const user = createPlayer(socket.id, username.substr(0, 16))

        const room = joinRoom(roomcode, user)

        if(room) {
            socket.join(room.id)
            socket.broadcast.to(room.id).emit('room', room)
            socket.emit('joinedRoom', { room, user })

        } else {
            socket.emit('noRoom')
        }

    })

    socket.on('rejoinRoom', (globalid, roomid) => {
        const playeroom = restorePlayer(globalid, roomid, socket.id);
        console.log("[SERVER] Rejoin Concluded");
        if(playeroom) {
            let room;
            if(playeroom.room.vote?.timer) {
                
                const {vote, ...noVote} = playeroom.room;
                const {timer, ...noTimer} = vote;

                room = { ...noVote, noTimer }

            } else {
                room = {...playeroom.room}
            }
            socket.join(playeroom.room.id)
            socket.emit('joinedRoom', { room, user: playeroom.player })
        } else {
            socket.emit('noRoom')
        }
    })

    socket.on('leaveRoom', () => {

        const playeroom = removeFromRoom(socket.id);
        if(playeroom) {
            const { room, player } = playeroom;
            socket.leave(room.id)
            
            if(room.players.length) {

                const timedout = room.players.filter(plyr => plyr.timeout === true).length;

                if(timedout < room.players.length) {
                    if(room.owner === player.id) {
                        room.owner = room.players[0].id;
                    }
                    io.to(room.id).emit('room', room)
                } else {
                    deleteRoom(room.id)
                }
            } else {
                deleteRoom(room.id)
            }
        }

    })

    socket.on('readyRoom', () => {
        const room = getOwnRoom(socket.id)

        if(room) {

            room.state = 'tasks';

            const common = commonTask()

            const killerindex = randIndex(room.players.length);
            room.players.forEach((player, index) => {
                player.role = index === killerindex ? 'killer' : 'innocent'
                player.alive = true
                const playercommon = player.role == 'innocent' ? common : commonTask()
                const tasks: string[] = [...getTasks(2, 1), playercommon]
                const checklist: Checklist = {};
                tasks.forEach(task => checklist[task] = false)
                player.tasks = checklist
            })

            io.to(room.id).emit('roomReady', room.players)

        } else {
            socket.emit('noRoom')
        }

    })

    socket.on('taskComplete', (task: string) => {
        const user = getUser(socket.id)

        if(user) {
            const { player, room } = user;

            if(player.tasks && player.tasks[task] !== undefined) {
                player.tasks[task] = true;
                let totalTasks = 0, completed = 0;
                room.players.forEach(user => {
                    if(user.tasks && user.role != 'killer') {
                        Object.keys(user.tasks).forEach(task => {
                            totalTasks++;
                            if(user.tasks && user.tasks[task] === true) {
                                completed++;
                            }
                        })
                    }
                })

                const progress = (completed / totalTasks) * 100

                // CHECK IF INNOCENTS HAVE WON

                if(progress == 100) {
                    io.to(room.id).emit('victory', 'innocent')
                } else {
                    io.to(room.id).emit('taskCompletion', progress)
                }

                
            }

        } else {
            socket.emit('noUser')
        }

    })

    socket.on('murdered', () => {
        const user = getUser(socket.id)

        if(user) {

            const { player, room } = user;

            player.alive = false

            // CHECK IF KILLER HAS WON
            const victory = checkForVictory(room.id)
            if(victory) {
                io.to(room.id).emit('victory', victory)
            } else {
                io.to(room.id).emit('room', room);
            }

        } else {
            socket.emit('noUser')
        }
    })

    socket.on('murderUser', (targetid: string) => {
        const user = getUser(targetid)

        if(user) {

            const { player, room } = user;

            player.alive = false

            // CHECK IF KILLER HAS WON
            const victory = checkForVictory(room.id)
            if(victory) {
                io.to(room.id).emit('victory', victory)
            }

        } else {
            socket.emit('noUser')
        }
    })

    socket.on('callMeeting', (victim?: string) => {
        const user = getUser(socket.id)

        if(user) {

            const { room, player } = user;
            room.state = 'meeting'

            const countdown = 180000;

            const meeting: Meeting = {
                type: victim ? 'murder' : 'emergency',
                caller: player.id,
                countdown,
            }

            if(victim) meeting.victim = victim

            const vote = createVote(room.id)

            io.to(room.id).emit('meeting', meeting)

            if(vote) {
                vote.timer = setTimeout(() => {
                    delete vote.timer;
                    
                    const conclusion = concludeVote(room.id);

                    if(conclusion) {
                        // Check for Victory!
                        const victory = checkForVictory(room.id);
                        if(victory) {
                            room.state = 'lobby'
                            io.to(room.id).emit('victory', victory);
                        } else {
                            io.to(room.id).emit('voteEnd', conclusion);
                        }
                        
                    }

                }, countdown)
            }

        } else {
            socket.emit('noUser')
        }

    })

    socket.on('castVote', (targetid?: string) => {
        const result = castVote(socket.id, targetid)
        
        if(result !== undefined) {

            // CHECK IF KILLER HAS WON
            const victory = checkForVictory(result.room.id)
            if(victory) {
                result.room.state = 'lobby'
                io.to(result.room.id).emit('victory', victory)
            } else {
                // send out the death name
                result.room.state = 'tasks'
                io.to(result.room.id).emit('voteEnd', result)
            }
        }

    })

    socket.on('message', (msg: string) => {
        const userroom = getUser(socket.id);

        if(userroom) {
            const { room, player } = userroom

            const message = formatMessage(player, msg);

            io.to(room.id).emit('message', message);

        } else {
            socket.emit('noUser')
        }

    })

    socket.on('disconnect', () => {
        // Set the user to timeout after so long UNLESS the room is already empty
        const user = getUser(socket.id)
        if(user) {
            const { room, player } = user

            if(room.players.length <= 1) {
                // Just you, close the room
                deleteRoom(room.id)
            } else {
                // We have people, but they could all be timed out...
                const timeoutcount = room.players.filter(plyr => plyr.timeout === true).length;
                if(room.players.length <= timeoutcount) {
                    // Everyone has timed out. fuck em.
                    deleteRoom(room.id)
                } else {
                    // Players remain, set me as timed out
                    player.timeout = true
                }
            }

        }

    })



})

const PORT = process.env.PORT || 3000
server.listen(PORT, () => console.log(`[SERVER] Server running on Port ${PORT}...`))