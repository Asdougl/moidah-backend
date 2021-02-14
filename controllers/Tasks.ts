import { randSubArray, randArrayItem } from "../util/random";

export type TaskType = 'short' | 'long' | 'common'

export interface TasksList {
    short: string[]
    long: string[]
    common: string
}

interface AllTasks {
    short: string[],
    long: string[],
    common: string[]
}

const tasks: AllTasks = {
    short: [
        "hash passwords", 
        "exchange keys", 
        "refresh tokens", 
        "mask subnet",
        "open podbay doors",
        "generate indexes",
        "read docs",
    ],
    long: [
        "hack mainframe", 
        "brute force",
        "upload data",
        "restart the modem",
        "wait kettle"
    ],
    common: [
        "decrypt keys",
        "clear console",
        "compare hash",
        "enter code",
        "download",
    ],
};

/**
 * Get an array of random short and random long tasks
 * @param short number of short tasks needed
 * @param long number of long tasks needed
 */
export const getTasks = (short: number, long: number): string[] => {
    return [...randSubArray(tasks.short, short), ...randSubArray(tasks.long, long)]
}

/**
 * Get a specific count of short tasks
 * @param count the number of short tasks requested
 */
export const shortTasks = (count: number): string[] => {
    return randSubArray(tasks.short, count)
}

/**
 * Get a specified count of long tasks
 * @param count the number of long tasks requested
 */
export const longTasks = (count: number): string[] => {
    return randSubArray(tasks.long, count)
}

/**
 * Get a random Common Task
 */
export const commonTask = (): string => {
    return randArrayItem(tasks.common)
}