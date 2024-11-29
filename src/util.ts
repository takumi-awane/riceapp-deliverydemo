export function timeout(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

export function roundToDecimalPlaces(number: number, decimalPlace: number) {
    return Math.round(number * 10 ** decimalPlace) / 10 ** decimalPlace;
}