# Aid Room website

Public website for Aid Room, Inc. Hosted on GitHub Pages.

The Resource Navigator includes 13,366 public community resource listings. All resource JSON files must remain alongside index.html. Search, ZIP filters, saved resources, and direct links to an unlisted map page with automatic address pins work in the browser. Saved resources stay on the visitor’s device.

Client intake stays on the original Wix site. Donations use the existing Zeffy and PayPal pages. Do not store client submissions, passwords, private records, or service credentials in this public repository.

Keep a downloadable backup of this repository. The original Wix site remains independent. Domain renewal is separate from free hosting.


Map links render immediately from map-pins.js, loaded before app.js. No visitor-side geocoding is used for directory cards. Pins are keyed by the exact physical address, so changing an address cannot reuse a stale pin. When adding or editing addresses, refresh the saved pin dataset before publishing; unmatched addresses have no Maps link. Saved Census matches locate the street address and may be interpolated rather than a building entrance.
