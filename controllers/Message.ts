import { Player } from "./Players";

interface Message {
    id: string;
    username: string;
    colour: string;
    timestamp: number;
    message: string;
    alive: boolean;
}

export const formatMessage = (player: Player, message: string): Message => {
    return {
        id: player.id,
        username: player.username,
        colour: player.colour,
        timestamp: Date.now(),
        message,
        alive: player.alive,
    }
}