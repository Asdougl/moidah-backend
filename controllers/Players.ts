import { randRange } from "../util/random";
import { v4 as uuidv4 } from "uuid";

export type Role = 'innocent' | 'killer'

export interface Checklist {
    [task: string]: boolean
}

export interface Player {
    id: string
    globalid: string
    username: string
    colour: string
    role: Role
    alive: boolean
    tasks?: Checklist
    timeout?: boolean
}

interface PlayerRec {
    [playerid: string]: string
}

const playerRecs: PlayerRec = {}

const randomColour = () => {
    return `rgb(${randRange(0,255)}, ${randRange(0,255)}, ${randRange(0,255)})`
}

/**
 * Takes a username and socket id and generates a Player object.
 * If that socketid is already recorded, return the roomid
 * @param socketid socket id of the player being created
 * @param username the user defined username of the player
 * @returns player object or player's current room
 */
export const createPlayer = (socketid: string, username: string): Player => {

    return {
        id: socketid,
        globalid: uuidv4(),
        username,
        colour: randomColour(),
        role: 'innocent',
        alive: true,
    }
    
}

/**
 * Record what room a user is in
 * @param roomid the uuid of the room that this user is associated with
 * @param userid the socket id of the user
 */
export const recordPlayer = (roomid: string, user: Player) => {
    playerRecs[user.id] = roomid;

}

/**
 * Remove a user's room associated record from the PlayerRecs
 * @param userid socket id of the user being removed from the records
 */
export const removePlayerRecord = (userid: string): string | undefined => {
    const player = playerRecs[userid]

    if(player) {
        delete playerRecs[userid];
        return player;
    } else {
        return undefined;
    }
}

/**
 * Get the uuid of the room that a player is in
 * @param userid socket id of the user who is being looked up
 */
export const getPlayerRoom = (userid: string): string | undefined => playerRecs[userid]

/**
 * Scrub all user records which contain a given room uuid
 * @param roomid uuid of the room that is being scrubbed
 */
export const removeAllRoom = (roomid: string) => {

    for(const player in playerRecs) {
        if(playerRecs[player] === roomid) {
            delete playerRecs[player];
        }
    }

}

export const playerCount = (): number => Object.keys(playerRecs).length