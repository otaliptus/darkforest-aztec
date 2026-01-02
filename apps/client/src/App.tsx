import { type PlanetDiscovery } from "@darkforest-aztec/shared";

const sample: PlanetDiscovery = {
    id: "0x00",
    coords: { x: 0, y: 0 },
};

export default function App() {
    return (
        <div className="app">
            <header className="header">
                <h1>Dark Forest on Aztec</h1>
                <p>Client scaffold is live. Contract integration is next.</p>
            </header>
            <section className="panel">
                <h2>Sample Shared Type</h2>
                <pre>{JSON.stringify(sample, null, 2)}</pre>
            </section>
        </div>
    );
}
