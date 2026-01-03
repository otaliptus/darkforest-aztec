import { useMemo, useState } from "react";
import type { DarkForestClient, ClientLogFn } from "./scripts/darkforest";
import { connectDarkForest } from "./scripts/darkforest";
import { CLIENT_CONFIG, DEFAULT_INIT, DEFAULT_REVEAL } from "./config";

const toBigInt = (value: string, label: string) => {
    try {
        return BigInt(value);
    } catch {
        throw new Error(`Invalid ${label}: ${value}`);
    }
};

export default function App() {
    const [client, setClient] = useState<DarkForestClient | null>(null);
    const [status, setStatus] = useState<string>("Disconnected");
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [logs, setLogs] = useState<Array<{ ts: string; message: string }>>([]);

    const [initX, setInitX] = useState(DEFAULT_INIT.x);
    const [initY, setInitY] = useState(DEFAULT_INIT.y);
    const [initRadius, setInitRadius] = useState(DEFAULT_INIT.radius);
    const [revealX, setRevealX] = useState(DEFAULT_REVEAL.x);
    const [revealY, setRevealY] = useState(DEFAULT_REVEAL.y);

    const missingAddress = useMemo(
        () => !CLIENT_CONFIG.darkforestAddress,
        []
    );

    const pushLog = (message: string) => {
        const ts = new Date().toLocaleTimeString();
        setLogs((prev) => {
            const next = [...prev, { ts, message }];
            return next.length > 200 ? next.slice(next.length - 200) : next;
        });
    };

    const makeLogger = (): ClientLogFn => (message, data) => {
        const formatted = data ? `${message} ${JSON.stringify(data)}` : message;
        console.log(formatted);
        pushLog(formatted);
    };

    const clearLogs = () => setLogs([]);

    const connect = async () => {
        setError(null);
        setBusy(true);
        setStatus("Connecting to Aztec node...");
        pushLog("Connecting to Aztec node...");
        try {
            const nextClient = await connectDarkForest(CLIENT_CONFIG, makeLogger());
            setClient(nextClient);
            setStatus(`Connected: ${nextClient.account.address.toString()}`);
            pushLog(`Connected: ${nextClient.account.address.toString()}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus("Connection failed");
            pushLog(`Connection failed: ${message}`);
        } finally {
            setBusy(false);
        }
    };

    const runTx = async (
        label: string,
        fn: () => ReturnType<DarkForestClient["initPlayer"]>
    ) => {
        if (!client) return;
        setError(null);
        setBusy(true);
        setStatus(`${label}: proving...`);
        pushLog(`${label}: proving...`);
        try {
            const tx = await fn();
            const hash = await tx.getTxHash();
            setStatus(`${label}: sent ${hash.toString()}`);
            pushLog(`${label}: sent ${hash.toString()}`);
            await tx.wait();
            setStatus(`${label}: confirmed ${hash.toString()}`);
            pushLog(`${label}: confirmed ${hash.toString()}`);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            setStatus(`${label}: failed`);
            pushLog(`${label}: failed ${message}`);
        } finally {
            setBusy(false);
        }
    };

    const initPlayer = async () => {
        await runTx("Init player", () =>
            client!.initPlayer(
                toBigInt(initX, "init x"),
                toBigInt(initY, "init y"),
                toBigInt(initRadius, "init radius")
            )
        );
    };

    const revealLocation = async () => {
        await runTx("Reveal", () =>
            client!.revealLocation(
                toBigInt(revealX, "reveal x"),
                toBigInt(revealY, "reveal y")
            )
        );
    };

    return (
        <div className="app">
            <header className="header">
                <h1>Dark Forest on Aztec</h1>
                <p>Client onboarding wired to Aztec local network.</p>
            </header>

            <section className="panel">
                <h2>Connection</h2>
                <div className="stack">
                    <div className="row">
                        <span className="label">Node URL</span>
                        <span className="value">{CLIENT_CONFIG.nodeUrl}</span>
                    </div>
                    <div className="row">
                        <span className="label">DarkForest</span>
                        <span className="value">
                            {CLIENT_CONFIG.darkforestAddress || "(set VITE_DARKFOREST_ADDRESS)"}
                        </span>
                    </div>
                    <div className="row">
                        <span className="label">NFT</span>
                        <span className="value">
                            {CLIENT_CONFIG.nftAddress || "(optional)"}
                        </span>
                    </div>
                    <div className="row">
                        <span className="label">Sponsored FPC</span>
                        <span className="value">
                            {CLIENT_CONFIG.sponsoredFpcAddress ?? "(default salt=0)"}
                        </span>
                    </div>
                </div>

                <button
                    className="primary"
                    onClick={connect}
                    disabled={busy || missingAddress}
                >
                    {client ? "Reconnect" : "Connect wallet"}
                </button>
                {missingAddress && (
                    <p className="hint">Set VITE_DARKFOREST_ADDRESS in apps/client/.env.local.</p>
                )}
            </section>

            <section className="panel">
                <h2>Init Player</h2>
                <div className="grid">
                    <label>
                        <span>Init X</span>
                        <input value={initX} onChange={(e) => setInitX(e.target.value)} />
                    </label>
                    <label>
                        <span>Init Y</span>
                        <input value={initY} onChange={(e) => setInitY(e.target.value)} />
                    </label>
                    <label>
                        <span>Init Radius</span>
                        <input
                            value={initRadius}
                            onChange={(e) => setInitRadius(e.target.value)}
                        />
                    </label>
                </div>
                <button className="primary" onClick={initPlayer} disabled={!client || busy}>
                    Send init_player
                </button>
            </section>

            <section className="panel">
                <h2>Reveal Location</h2>
                <div className="grid">
                    <label>
                        <span>Reveal X</span>
                        <input value={revealX} onChange={(e) => setRevealX(e.target.value)} />
                    </label>
                    <label>
                        <span>Reveal Y</span>
                        <input value={revealY} onChange={(e) => setRevealY(e.target.value)} />
                    </label>
                </div>
                <button className="primary" onClick={revealLocation} disabled={!client || busy}>
                    Send reveal_location
                </button>
            </section>

            <section className="panel">
                <h2>Status</h2>
                <p className="status">{status}</p>
                {error && <p className="error">{error}</p>}
            </section>

            <section className="panel">
                <h2>Logs</h2>
                <div className="logs">
                    {logs.length === 0 && <p className="hint">No logs yet.</p>}
                    {logs.map((entry, index) => (
                        <div key={`${entry.ts}-${index}`} className="log-row">
                            <span className="log-ts">{entry.ts}</span>
                            <span className="log-msg">{entry.message}</span>
                        </div>
                    ))}
                </div>
                {logs.length > 0 && (
                    <button className="primary" onClick={clearLogs} disabled={busy}>
                        Clear logs
                    </button>
                )}
            </section>
        </div>
    );
}
