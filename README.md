# Abstract Atelier
Made by Mohammad Almeqdadi, MD

Elegant single-page editor for curating PubMed abstracts with Quill, PMID helpers, and polished dark/light theming.

## Features
- Rich text editing powered by Quill with curated toolbar controls.
- Inline PMID tagging that visually distinguishes PubMed identifiers.
- Live counters for words, characters, and PMID mentions.
- Persistent light/dark mode toggle with smooth transitions.
- Glassmorphism-inspired UI accents, including floating status pill and popup viewer.

## Getting Started
1. Clone or download this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).
3. Begin editing directly in the main canvas—changes stay local to your browser.

## Usage Tips
- Use the theme button in the header to switch between light and dark appearances.
- Highlight text and click the `PMID` button to wrap identifiers in the custom tag.
- Access the floating status pill at the bottom for word, character, and PMID counts.

## Development Notes
- Tailwind CSS and Quill are loaded via CDN; no build step is required.
- The project uses localStorage to remember the chosen theme.
- To customize styling, edit `index.html` and adjust the embedded `<style>` and `<script>` blocks.
