# Home QR Storage

A small static MVP for organizing home storage with QR-coded locations.

## What It Does

- Create storage locations like boxes, shelves, drawers, tubs, and rooms.
- Create sub-locations inside locations, like drawers inside a toolbox.
- Manage reusable place tags like Home, Work, Car, and Shed in Settings.
- Manage reusable category tags like Tools, Cables, Documents, and Kitchen in Settings.
- Share locations, items, and place tags with another app user by email.
- View shared locations and shared items in a separate Shared Locations menu.
- Save dark mode as a logged-in user preference.
- Add items with quantity, reusable category tags, notes, and photos.
- Edit locations after they are created.
- Add photos to locations for easier visual identification.
- Move items between locations with a drag and drop sorting board or the mobile move dropdown.
- Generate a QR label URL for each location.
- Create a printable container label with the QR code, parent location, place, location name, item count, and contents preview.
- Customize label size, QR size, text size, layout, and included fields before printing.
- Preview labels live before printing.
- Search and add locations/items on a dedicated Add New Item page.
- Export your saved inventory as JSON.

Data is stored in Supabase after sign-in, so it can sync across devices.

## GitHub Pages

Live site:

https://rocketrynorr.github.io/Sorting/

1. Put these files in your GitHub repository.
2. Go to repository `Settings`.
3. Open `Pages`.
4. Choose your branch and root folder.
5. Visit the published Pages URL.

The QR codes point back to `https://rocketrynorr.github.io/Sorting/` with a `#location=...` link.

## Next Upgrade Ideas

- Add import from exported JSON.
- Add printable sheets with multiple QR labels.
