import randomstring from 'randomstring'
import { v4 } from 'uuid'

import { Player, recordPlayer, getPlayerRoom, removePlayerRecord, Role, removeAllRoom } from "./Players";

type RoomState = 'lobby' | 'tasks' | 'meeting'

type MeetingType = 'emergency' | 'murder'

interface Election {
    candidates: {
        [name: string]: string[]
    },
    voters: string[]
    timer?: NodeJS.Timeout
}

interface ElectionResult {
    room: Room
    election: Election
    ejected?: Player
}

interface Room {
    id: string
    roomcode: string
    players: Player[]
    state: RoomState
    owner: string
    killers: number
    vote?: Election
}

export interface PlayerRoom {
    player: Player
    room: Room
}

export interface Meeting {
    type: MeetingType
    caller: string
    victim?: string
    countdown?: number
}

let rooms: {[roomid: string]: Room} = {}

/**
 * Create a room after having create a player
 * @param user Player object of the person initialising the room
 * @param killers the number of killers in the room
 */
export const createRoom = (user: Player, killers?: number): Room => {

    const roomcode = randomstring.generate({
        length: 8,
        charset: "alphjanumeric",
        capitalization: "uppercase",
    });

    const room: Room = {
        id: v4(),
        roomcode,
        players: [user],
        state: 'lobby',
        owner: user.id,
        killers: killers === undefined || killers < 0 ? 1 : killers,
    }

    recordPlayer(room.id, user)

    rooms[room.id] = room;

    return room;

}

/**
 * Join a room using its room code
 * @param roomcode the roomcode of the room the user wishes to join
 * @param user the user object of the incoming user
 */
export const joinRoom = (roomcode: string, user: Player): Room | undefined => {

    const roomid = Object.keys(rooms).find(rid => rooms[rid].roomcode === roomcode && rooms[rid].state === 'lobby');

    if(roomid) {
        const room = rooms[roomid]
        if(!room.players.find(player => player.id === user.id)) {
            room.players = [...room.players, user]
            recordPlayer(room.id, user)
            return room;
        }
        
    }
}

/**
 * Get the room that this user owns by their userid
 * @param userid the owner's socket id
 */
export const getOwnRoom = (userid: string): Room | undefined => {
    const roomkey = Object.keys(rooms).find(rid => rooms[rid].owner === userid)
    return roomkey ? rooms[roomkey] : undefined
}

/**
 * Get a room using its uuid
 * @param roomid the uuid of the room
 */
export const getRoom = (roomid: string): Room | undefined => {
    return rooms[roomid]
}

/**
 * Get the room in which a user is in
 * @param userid the socket id of the user
 * @returns the room object
 */
export const getUserRoom = (userid: string): Room | undefined => {
    const roomid = getPlayerRoom(userid)

    return roomid ? rooms[roomid] : undefined

}

/**
 * Get the user's record within their room along with the room itself
 * @param userid the socket id of the user
 * @returns player and their room or undefined
 */
export const getUser = (userid: string): PlayerRoom | undefined => {
    const room = getUserRoom(userid)

    if(room) {

        const player = room.players.find(user => user.id === userid)

        if(player) {
            return { room, player }
        }

    }
}

/**
 * Remove a user from a room on room close or disconnect
 * @param userid the socket id of the user
 * @returns player and their room or undefined
 */
export const removeFromRoom = (userid: string): PlayerRoom | undefined => {
    const room = getUserRoom(userid)

    let user: (PlayerRoom | undefined) = undefined;
    if(room) {
        
        const userindex = room.players.findIndex(user => user.id === userid)

        if(userindex !== -1) {
            const [player] = room.players.splice(userindex, 1)
            user = { player, room }
        }

    }

    removePlayerRecord(userid);

    return user;
}

/**
 * Delete a room
 * @param roomid the uuid of the room that is being deleted
 */
export const deleteRoom = (roomid: string) => {
    if(rooms[roomid]) {
        console.log(`[ROOM] Room ${rooms[roomid].roomcode} has been deleted`)
        removeAllRoom(roomid);
        delete rooms[roomid]
    }
}

/**
 * Initialise a vote - used when a meeting is created
 * @param roomid uuid of the room where the vote is being created
 */
export const createVote = (roomid: string): Election | undefined => {
    const room = rooms[roomid]
    if(room) {
        const vote: Election = {
            candidates: {
                abstain: []
            },
            voters: []
        }
        room.players.forEach(player => {
            if(player.alive) vote.candidates[player.id] = []
        })
        room.vote = vote
        return vote;
    }
}

export const castVote = (userid: string, target?: string): ElectionResult | undefined => {
    const room = getUserRoom(userid)
    if(room && room.vote && Object.keys(room.vote.candidates).includes(userid) && !room.vote.voters.includes(userid)) {
        room.vote.voters = [...room.vote.voters, userid]
        if(target && Object.keys(room.vote.candidates).includes(target)) {
            room.vote.candidates[target].push(userid);
        } else {
            room.vote.candidates['abstain'].push(userid);
        }
        const voteDone = room.vote.voters.length === room.players.filter(player => player.alive).length;

        if(voteDone === true) {
            return concludeVote(room.id)
        }

    }
}

/**
 * Conclude a vote for a room and return the result
 * @param roomid Id of the room concluding its vote
 * @returns Election result, containing a Vote which DOES NOT have the timer attached
 */
export const concludeVote = (roomid: string): ElectionResult | undefined => {
    const room = rooms[roomid]

    if(room && room.vote) {

        const vote = room.vote;

        if(room.vote.timer) clearTimeout(room.vote.timer);

        let highest = 0, highname = 'abstain'
        for(const name in vote.candidates) {
            if(vote.candidates[name].length > highest) {
                highest = vote.candidates[name].length
                highname = name
            } else if(vote.candidates[name].length === highest) {
                // Equal, reset to abstain
                highname = 'abstain'
            }
        }

        const {timer, ...withoutTimer} = room.vote;

        const result: ElectionResult = { room, election: withoutTimer };

        if(highname != 'abstain') {
            const dead = room.players.find(player => player.id === highname);
            result.ejected = dead;
            if(dead) {
                dead.alive = false;
            }
        }

        delete room.vote;
        return result

    }
}

export const checkForVictory = (roomid: string): Role | undefined => {
    const room = rooms[roomid]

    if(room) {

        console.log("[ROOM] GAME OVER?")

        let killers = 0, innocents = 0
        room.players.forEach(player => {
            if(player.role === 'killer' && player.alive) killers++
            else if(player.alive) innocents++
        })

        if(killers == 0) {
            console.log("[ROOM] INNO WIN")
            return 'innocent'
        }
        if(killers >= innocents) {
            console.log("[ROOM] KILL WIN")
            return 'killer'
        }

        resetPlayers(room);

        console.log("[ROOM] NO WINNERS", { killers, innocents })

    }
}

export const restorePlayer = (globalid: string, roomid: string, socketid: string): PlayerRoom | undefined => {
    console.log("[ROOM] Rejoin Attempt", globalid, roomid);
    const room = getRoom(roomid);
    if(room) {
        console.log("[ROOM] Rejoin Found Room");
        const player = room.players.find(plr => plr.globalid === globalid);
        if(player) {
            console.log("[ROOM] Rejoin Found Player");
            const oldid = player.id;
            console.log("[ROOM] Rejoin get old id")
            removePlayerRecord(oldid)
            console.log("[ROOM] Rejoin remove old record")
            player.id = socketid;
            console.log("[ROOM] Rejoin assign new socketid")
            // clear any timeouts
            if(player.timeout === true) {
                delete player.timeout; 
                console.log("[ROOM] Rejoin cleared timeout")
            }
            recordPlayer(room.id, player)
            console.log("[ROOM] Rejoin record new player")
            return { room, player }
        }
    }
}

const resetPlayers = (room: Room) => {
    room.players.forEach(player => {
        player.alive = true;
        player.role = 'innocent';
        delete player.tasks;
    })
}

export const roomCount = (): number => Object.keys(rooms).length;