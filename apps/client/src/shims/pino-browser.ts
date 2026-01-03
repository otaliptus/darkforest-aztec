import pinoBrowser from "pino/browser";

const fallbackSymbols = {
    streamSym: Symbol("pino.stream"),
};

export const pino = pinoBrowser as typeof pinoBrowser;
export const symbols = (pinoBrowser as any).symbols ?? fallbackSymbols;

export default pinoBrowser;
