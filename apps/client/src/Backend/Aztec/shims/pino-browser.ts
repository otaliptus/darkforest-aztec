type PinoLevels = {
    labels: Record<string, string>;
    values: Record<string, number>;
};

type PinoLike = ((...args: unknown[]) => void) & {
    child: () => PinoLike;
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    fatal: (...args: unknown[]) => void;
    trace: (...args: unknown[]) => void;
    verbose: (...args: unknown[]) => void;
    level: string;
    levels: PinoLevels;
    isLevelEnabled?: (level: string) => boolean;
};

type PinoFactory = ((opts?: { level?: string }) => PinoLike) & {
    levels: PinoLevels;
    destination: () => unknown;
    transport: () => unknown;
    multistream: () => unknown;
};

const noop = () => {};

const baseLevels: PinoLevels = {
    labels: {
        fatal: "fatal",
        error: "error",
        warn: "warn",
        info: "info",
        verbose: "verbose",
        debug: "debug",
        trace: "trace",
    },
    values: {
        fatal: 60,
        error: 50,
        warn: 40,
        info: 30,
        verbose: 25,
        debug: 20,
        trace: 10,
    },
};

const makeLogger = (level = "info"): PinoLike => {
    const logger = ((..._args: unknown[]) => {}) as PinoLike;
    logger.child = () => logger;
    logger.debug = noop;
    logger.info = noop;
    logger.warn = noop;
    logger.error = noop;
    logger.fatal = noop;
    logger.trace = noop;
    logger.verbose = noop;
    logger.level = level;
    logger.levels = baseLevels;
    logger.isLevelEnabled = (lvl: string) => {
        const current = baseLevels.values[logger.level] ?? 0;
        const check = baseLevels.values[lvl] ?? 0;
        return check >= current;
    };
    return logger;
};

const pinoBrowser = ((opts?: { level?: string }) => makeLogger(opts?.level)) as PinoFactory;
pinoBrowser.levels = baseLevels;
pinoBrowser.destination = () => ({});
pinoBrowser.transport = () => ({});
pinoBrowser.multistream = () => ({});

export const pino = pinoBrowser;
export const symbols = {
    streamSym: Symbol("pino.stream"),
};

export default pinoBrowser;
