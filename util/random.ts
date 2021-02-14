export const randIndex = (length: number): number => {
    return Math.floor(Math.random() * length)
}

export const randSubArray = (arr: any[], length: number): any[] => {
    if(length >= arr.length - 1 || length < 0) {
        return arr;
    } else if(length == 0) {
        return []
    } else {
        let copy = [...arr]
        let items: any[] = [];
        
        for(let i = 0; i < length; i++) {
            const item = copy.splice(randIndex(copy.length), 1);
            items = [...items, ...item]
        }

        return items

    }
}

/**
 * Generate random number within a given range, inclusive of both
 * @param min Minimum value (inclusive)
 * @param max Maximum value (inclusive)
 */
export const randRange = (min: number, max: number): number => {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min + 1)) + min
}

export const randArrayItem = (arr: any[]): any => {
    return arr[randIndex(arr.length)]
}