# Home QR Storage

A small static MVP for organizing home storage with QR-coded locations.

## What It Does

- Create storage locations like boxes, shelves, drawers, tubs, and rooms.
- Add items with quantity, category, and notes.
- Edit locations after they are created.
- Move items between locations with a drag and drop sorting board.
- Generate a QR label URL for each location.
- Create a printable container label with the QR code, place, location name, item count, and contents preview.
- Customize label size, QR size, text size, layout, and included fields before printing.
- Search locations and items.
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
- Add item photos.
- Add printable sheets with multiple QR labels.
- Add location editing.
- Add shared household access.
