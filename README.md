
# Abstract Atelier

Elegant single page editor for curating PubMed abstracts with Quill, PMID helpers, and polished dark and light theming.

## Overview
Abstract Atelier is a lightweight client side app. It helps you draft and annotate text while keeping PubMed citations at hand. No build step and no server.

## Key features
- Clean Quill editor with a focused toolbar
- Inline PMID tokens that you can click
- Citation sidebar that lists unique PMIDs as cards
  - Hovering a card highlights the matching inline PMIDs in the editor
  - Clicking a card cycles through each mention with smooth scrolling and centers the match
  - Cards show title, abbreviated journal name, year, and a one line article type with an abbreviated fallback when needed
- Popover abstract viewer on hover of inline PMIDs with title, citation line, authors, abstract, and a PubMed link
- Live status pill with counts for words, characters, and PMIDs
  - When text is selected the pill shows selection over total
- Copy as HTML button that copies both plain text and HTML when supported
- Print friendly export that opens a new window. Use your browser to save as PDF
- Light and dark themes with a persistent toggle. Choice is stored in localStorage
- Editor content is stored in localStorage so your work survives a refresh
- Responsive layout
  - On mobile the citations panel becomes a slide over that can cover the text and scroll with it
  - The toggle button stays accessible and the panel animates open and closed

## Quick start
1. Download or clone this repository
2. Open `index.html` in a modern browser
3. Start writing
4. Type a PubMed id like `PMID 17038878` to see it recognized

## How citations work
- The editor extracts 7 to 9 digit PMIDs that appear in your text
- Metadata is fetched from NCBI E-utilities efetch in XML
- Cards and popovers display title, journal abbreviation, year, authors, and abstract when available
- Clicking a card or an inline token scrolls to the next mention and cycles through all mentions

## Keyboard and mouse
- Use the sidebar button to show or hide the citations panel
- Focus a card then press Enter or Space to cycle matches
- The toolbar snaps back to the start when the editor is focused

## Privacy
- All editing happens in your browser
- Text and theme are saved to localStorage only
- The app requests metadata from NCBI and opens PubMed when you follow links

## Development notes
- Quill 2 and Tailwind CSS load from public CDNs
- All logic and styles live in `index.html`
- No build tooling required

## Known limits
- The export button opens a print view rather than creating a file directly
- If PubMed is unreachable the citation card shows an error. Try again later
- No server features such as sharing or multiuser editing

## Project structure
- `index.html` contains the app UI, styles, and scripts
- `README.md` is this guide

## License
No license file is present in the repository yet
