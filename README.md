# Aid Room website

Public website for Aid Room, Inc. Hosted on GitHub Pages.

The Resource Navigator includes 13,366 public community resource listings. All resource JSON files must remain alongside index.html. Search, ZIP filters, saved resources, and direct links to an unlisted map page with automatic address pins work in the browser. Saved resources stay on the visitor’s device.

The Help page embeds the Aid Room Google Apps Script intake service. Completed forms are converted to PDF and emailed only to aidroominc@gmail.com. The private service source and client submissions are not stored in this repository. Donations use the existing Zeffy page. Do not store client submissions, passwords, private records, or service credentials in this public repository.

Keep a downloadable backup of this repository. Domain renewal is separate from free hosting.


Map links render immediately from map-pins.js, loaded before app.js. No visitor-side geocoding is used for directory cards. Pins are keyed by the exact physical address, so changing an address cannot reuse a stale pin. When adding or editing addresses, refresh the saved pin dataset before publishing; unmatched addresses have no Maps link. Saved Census matches locate the street address and may be interpolated rather than a building entrance.



Full address audit (2026-10-10): all 13,366 cards checked. 10,370 contain physical street addresses, including location-list fields. 10,236 have saved map pins that render immediately. 134 cards at 80 unique addresses still need address correction or precise location confirmation; no guessed town-centre pins are used. Address parsing handles unusual street names, fractional roads, units, Unicode, and multiple-location notes. Confirm precise coordinates before adding an unmatched address to map-pins.js.

## Mission page design

About, Help, Volunteer, and Donate use mission.css and mission.js for their responsive photo layouts and optional reduced-motion-aware animation. Header/footer markup and the shared site styles are unchanged. The Resource Navigator and Maps do not load these files. Licensed illustrative stock imagery is documented in PHOTO-CREDITS.md. Page-specific titles, descriptions, canonical links, social previews, and organization/page structured data are included. robots.txt points to sitemap.xml, which lists the main public pages and omits the hidden Maps page. The Help intake service and credentialless iframe are unchanged.


## Directory performance (October 14, 2026)
The first 16 cards, categories, and search shortcuts are rendered in index.html, so they appear before downloading the complete search index. directory-worker-20261014.js downloads and decompresses directory-index-20261014.json and runs the unchanged search scoring/filter logic off the main UI thread. The full search text is retained. Details load their original resource batch on demand and reuse it for subsequent profiles. Saved resources and Maps return-state restoration remain local to the visitor.

IMPORTANT: After changing any resource batch or map-pins.js, run `node build-directory-index.cjs` and publish the regenerated directory-index-20261014.json and index.html along with the source changes. This refreshes compiled card addresses/pins and the initial cards. The original batches and map-pins.js remain the authoritative sources. The worker retains a fallback for browsers without gzip decompression. Do not manually edit the compressed index.
