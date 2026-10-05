# Architecture Prototype

One self-contained HTML page, an **architecture brief**, that shows the shape of a backend or cross-module change before the code exists. The user reads it in a few minutes, locks the open decisions in rounds, and shapes the design until they accept it. The page is the prototype: it makes the architecture concrete enough to react to.

## When this is the right shape

The change is larger than one module and at least one of these is true:

- It adds, removes, or changes a contract between modules.
- It changes the data model or how data is stored.
- It adds or moves caching, or the change has a load or latency concern.
- It adds a module or a service, or moves behaviour across a seam.

A focused change inside one module needs no architecture prototype. If the question is how one state model behaves, use [LOGIC.md](LOGIC.md). If it is what a screen looks like, use [UI.md](UI.md).

## Process

### 1. State the question

Write the question and the destination in one paragraph at the top of the page. Done when a reader who opens only the page knows what change it designs and why.

### 2. Ground it in the code

Map the modules, seams, contracts, data paths, and hot paths that the change touches. Hand the deep code reading to research subagents, cast per the shared [model selection policy](../../AGENTS.md#model-selection). Use the [`codebase-design`](../codebase-design/SKILL.md) vocabulary: module, interface, seam, adapter, depth.

Done when every module and every current contract you will draw is linked to a real `path:line` that you opened and checked.

### 3. Design one architecture

Design one recommended architecture. Each place where a sound design could go two or more ways is a **decision card**:

- The fork, in one line.
- Two or three options, each with its trade-offs.
- Your recommendation and why.
- A status: **open** or **locked**.

Lock a card yourself only when the code or an earlier decision settles it, and write that reason on the card; the user can reopen it. Every other card stays open for the user. Done when every fork in the design has a card and every locked card names its reason.

### 4. Build the page

Put the page at `<name>-architecture-prototype/index.html`, next to the module the change touches most. Write one file: inline CSS, Mermaid loaded from an absolute `https://` CDN URL, and no build step. Use domain language, one accent colour, and short sections: each section is a diagram or code block plus a few lines.

Sections, top to bottom:

1. **Question**: the paragraph from step 1.
2. **Change map**: a Mermaid diagram of the involved modules, coloured **new**, **changed**, **extended**, or **untouched**, with a legend. This answers which parts of the system the change touches.
3. **Contracts**: the interface at each seam the change creates or alters, as code in the repo's language. Show each changed contract as before and after. Under each one, list its invariants, error modes, and performance characteristics.
4. **Flows**: a Mermaid sequence diagram for each key path: the main read path, the main write path, and the most important failure path.
5. **Data**: schema and storage changes, and the shape of the migration.
6. **Caching and performance**: what is cached and where, cache keys, invalidation, hot paths, and the expected load.
7. **Decision cards**: open cards first, then locked cards.
8. **Blast radius**: what can break, who notices, and what is out of scope.

Leave out a section that does not apply, and say so in one line. Done when the page renders every diagram without a Mermaid error.

### 5. Publish it

On a devbox, publish the page's directory with [`share-preview`](../share-preview/SKILL.md), so the user can open it on any tailnet device and a reload shows each update. Elsewhere, give the file path. Done when the user has a link or path that opens the page.

### 6. Shape it in rounds

Work the open cards in rounds, the way [`/batch-grill-me`](../batch-grill-me/SKILL.md) works its frontier. Ask every open card that does not depend on another open card in one round, numbered, each with your recommendation. Then end your turn.

Each reply is feedback. Lock the answered cards, apply any other change the user asks for, redraw the affected diagrams and contracts, and ask the next round. A locked card can open new cards; add them.

Done when no card is open and the user has explicitly accepted the page.

### 7. Capture the answer and the prototype

Capture both the way the [SKILL](SKILL.md) describes. The page and its directory go to the throwaway branch. The answer records every locked card and links the page on that branch. The locked contracts become the interface section of the spec or implementation ticket that follows. Remove the preview with `share-preview` when the ticket closes.
