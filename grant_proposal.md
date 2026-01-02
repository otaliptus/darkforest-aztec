Request for Grant Proposals: Dark Forest on Aztec
We’re bringing the OG hidden-information game to the Aztec network

Overview
This RFPG is a call for one team to port Dark Forest v0.6 to the Aztec Network. We’re allocating up to $75,000 for a fully functional end-to-end implementation, deployed to the Aztec network, that will serve as a showcase application for Aztec’s alpha launch in March 2026.

Below, we explain why Dark Forest matters for Aztec, the technical requirements for the port, and how to submit a proposal.

Dark Forest: the original on-chain hidden information game

Dark Forest pioneered privacy-preserving gaming on-chain developed by 0xParc in 2022, using ZK-SNARKs to create an information-asymmetric MMORPG where players explored a procedurally-generated galaxy, conquered planets, collecting artefacts, all while hiding their actions and game state from observers.

The original Dark Forest was deployed to Ethereum testnets, never reaching main-net due to the great expense of verifying ZK-SNARK proofs. Its implementation complexity, given 2022-era tooling and technology, also inhibited iteration and extension of its design concepts, despite its popularity.

We built Aztec to make applications like Dark Forest easy to build and deploy. Composable privacy is the foundation of our network and unifying Dark Forest’s game logic, private state and NFT integrations into an Aztec dApp will be the perfect showcase of our network’s capabilities. We’re ready to prove it by bringing one of crypto’s most iconic games to mainnet for the first time.

Aztec Foundation is allocating up to $75,000 to support one team in porting Dark Forest v0.6 to the Aztec Network. We’re looking for experienced game developers and blockchain engineers who want to ship something legendary and stick around for what comes next.

Dark Forest as an alpha launch dApp
We want this application to be one of our showcase applications for alpha launch. It is a tangible way of interacting with the Aztec network that does not require users to deposit large amounts of capital. The game’s NFT integrations also make it an excellent showcase of the value of composable privacy. The app’s technical sophistication will also serve as a learning resource for the entire ecosystem.

Project Deliverables:
Deploy fully functioning version of the Dark Forest v0.6 game deployed to the Aztec Network (original v0.6 code: GitHub - darkforest-eth/darkforest-v0.6: Dark Forest v0.6)
Deploy a playable frontend that interacts with the Dark Forest Aztec contracts and renders a faithful rendition of the original game
A well-documented, open-source codebase that becomes a reference for future builders
Reference links:

Original Dark Forest v0.6 code: GitHub - darkforest-eth/darkforest-v0.6: Dark Forest v0.6
Dark Forest deep dive: Dark Forest: A Beacon of Light for Blockchain Games
Submit your proposal by Wednesday, January 14, 2026 for a chance to receive funding and join the first wave of gaming on Aztec.

Allocation
Total budget: Up to $75,000
Number of teams: 1
Proposal deadline: Wednesday, January 14, 2026
Team selection: Week of January 19, 2026
Delivery deadline: March 22, 2026 (hard deadline for alpha launch)
Grant Details and Submission Format
We’re excited to support a team committed to shipping world-class gaming experiences on Aztec. To ensure we can evaluate proposals fairly, please follow this format:

Title: Team/Product name
Contact Details: Signal, Telegram, email, or other preferred method
Summary: Brief description of your approach (~300 words)
Start and End Date: Recommended start date ASAP, functional version by March 22, 2026 (hard deadline)
About You: Team background, relevant gaming/blockchain experience, previous work
Technical Approach:
How you’ll port both Circom circuits and the Dark Forest contract logic to Noir-based Aztec smart contracts
Frontend architecture and integration strategy
Testing and documentation plan
Any innovations or optimizations you’re considering
Grant Milestones and Roadmap:
3-5 key milestones to MVP (functional game on Aztec)
2-3 stretch goals (e.g., new mechanics, NFT minting, performance optimizations)
Grant Amount Requested: Maximum $75,000
Grant Budget Rationale: Break down team composition, timeline, and deliverables
Questions: Anything unclear about requirements or the Aztec stack?
Submission instructions:

Create a new post on the Aztec Forum, tagged dark-forest and rfgp
Post the link to your proposal as a comment on this RFPG thread
Requirements
Must-Haves (Non-Negotiable)
Smart Contracts:

Faithfully recreate Dark Forest v0.6 smart contract functionality using Aztec smart contracts
Convert all Circom circuit logic directly into Aztec smart contract logic
Implement core game mechanics:
Planet discovery and ownership
Energy and silver resource management
Ship movement and planet capture
Artifact creation at foundries
Spacetime rip mechanics
Support for minting Aztec-native NFTs from artifacts sent through spacetime rips
Frontend:

Build a playable web client that:
Receives state from a Dark Forest contract deployed to the Aztec network
Relays player moves via transactions sent to a Dark Forest contract deployed to the Aztec network
Renders the Dark Forest galaxy and game state
Provides player controls for exploration, movement, and upgrades
Displays player resources (energy, silver, ships, artifacts)
Allows users to mint Aztec-native NFTs from artefacts sent through spacetime rips
The execution of a single player turn must take under 60 seconds (measured from the start of transaction generation to the point where a valid transaction is dispatched to the Aztec mempool)
Quality Standards:

Well-documented codebase with clear setup instructions
Thoroughly tested (unit tests for contracts, integration tests for game flows)
Open-sourced under MIT or similarly permissive license. It is acceptable to re-use original dark forest code (which must be licensed under LGPL) if all other project requirements are satisfied.
Must be completed by March 22, 2026 (hard deadline for alpha launch)
Nice-to-Haves (Bonus Points)
Plugin support: Enable community-created plugins for enhanced gameplay
Enhanced UI/UX: Improvements over original Dark Forest interface
Extended Documentation: Tutorial content or developer guides for building games on Aztec
What’s NOT in Scope:
We’re not asking you to reinvent Dark Forest. Focus on a faithful port of v0.6 that demonstrates Aztec’s capabilities.

Technical Context
Dark Forest is a blockchain-based MMORPG set in a procedurally-generated galaxy. Each instance of a Dark Forest game takes place over a fixed period of time.

The Dark Forest galaxy consists of planets, quasars, asteroid fields, foundries and spacetime rips. The two main game resources are energy and silver. The player begins with a single planet and 5 spaceships.

All objects must be ‘captured’ by a player in order for them to be utilised. Planets produce energy - the commodity required to move player ships and capture planets. Planets can be upgraded with silver - mined from asteroid fields.

Foundries can be used by the player to create artifacts. When an artifact is sent through a spacetime rip, an artifact-specific NFT is minted for the player. Artifacts can provide powerful gameplay boons for the player.

By default the game map is not visible to the player. A proof-of-work algorithm that utilises perlin noise is required to compute galactic objects and their location. Players ‘mine’ the map using this PoW algorithm.

The v0.6 Dark Forest smart contract records claims that players have made. At a high level, the smart contracts store:

On-chain state (public, minimal)
A mapping of discovered planet IDs → planet state
owner
energy
silver
upgrades
artifacts stored
A record of moves (energy transfers, artifact moves)
Global parameters (universe seed, world radius, rules)
Not stored on-chain
The full universe
Planet coordinates
Undiscovered planets
Player exploration paths
Player private maps
In the original Dark Forest, a player generates a zk proof that a given claim is valid - this is checked by an Ethereum smart contract, which then updates its public set of claims, with key information hashed and obfuscated.

An Aztec version is simpler conceptually - the claims are directly checked in private functions (where the claim data is presented un-hashed), which call public functions that update hashed, obfuscated game state.

For more information please see Dark Forest: A Beacon of Light for Blockchain Games

Resources:

Aztec Docs: https://docs.aztec.network
Noir Language: https://noir-lang.org
Dark Forest v0.6 repo: GitHub - darkforest-eth/darkforest-v0.6: Dark Forest v0.6
FAQs
Q: Is Aztec EVM compatible?
A: No. Aztec uses Noir for smart contracts. You’ll need to rewrite the Solidity contracts and Circom circuits in Noir.

Q: Where do I build and test before alpha launch?
A: You’ll develop against a local Aztec sandbox or Devnet.

Q: Do I need ALL requirements done by March 22, 2026?
A: You need a functional MVP (playable game with core mechanics) by the deadline. Nice-to-haves can be roadmapped for future milestones.

Q: Can I get additional funding after the grant?
A: Possibly, but not guaranteed. If the game performs well and you want to add features, we can discuss follow-on funding.

Q: What if I’m a solo developer?
A: Solo applications are welcome, but be realistic about scope. This is a substantial project that took the original team significant resources.

Q: Is the original Dark Forest team involved?
A: This is an independent port. We encourage you to study their code and design, but you’re building the Aztec version from scratch.

Q: What about the map mining weakness (players running remote servers)?
A: Out of scope for the initial port. Stick with the v0.6 mechanics. Future versions could explore improvements with Taceo’s shared state.

Evaluation Criteria
Proposals will be scored on:

Team Quality (40%)
Relevant experience in game development and/or blockchain
Track record of shipping complex projects
Understanding of Aztec and Noir
Technical Approach (30%)
Clear strategy for porting contracts and circuits
Realistic architecture for frontend integration
Thoughtful testing and documentation plan
Feasibility (20%)
Realistic timeline and milestones
Reasonable budget for scope
Clear risk mitigation
Vision (10%)
Interest in long-term ecosystem building on Aztec
Ideas for future enhancements
Commitment to open-source contribution
Disclaimer
The information set out herein is for discussion purposes only and does not represent any binding indication or commitment by Aztec Foundation and/or affiliates and their employees/consultants to take any action whatsoever, including relating to the structure and/or any potential operation of the Aztec protocol or the protocol roadmap. In particular: (i) nothing in this post (and any response to this post) is intended to create any contractual or other form of legal, investment, financial, tax or advisory relationship between Aztec Foundation or third parties who engage with such posts (including, without limitation, by submitting comments, a proposal and/or responding to posts including any medium such as X, Discord, etc), (ii) by engaging with any post, the relevant persons are consenting to Aztec Foundation’s use and publication of such engagement and related information on an open-source basis (and agree that Aztec Foundation will not treat such engagement and related information as confidential), and (iii) Aztec Foundation is not under any duty to consider any or all engagements, and that consideration of such engagements and any decision to award grants or other rewards for any such engagement is entirely at Aztec Foundation’s sole discretion. Please do not rely on any information on this forum for any purpose - the development, release, and timing of any products, features or functionality remains subject to change and is currently entirely hypothetical. Nothing on this forum post should be treated as an offer to sell any security or any other asset by Aztec Foundation or its affiliates, and you should not rely on any forum posts or content for advice of any kind, including legal, investment, financial, tax or other professional advice.

Questions? Drop them in the comments and we’ll update the FAQ.

Ready to build? Submit your proposal on the forum and let’s bring Dark Forest home.
