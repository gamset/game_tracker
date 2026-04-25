# Game of Life Tracker

This is a static Firebase-backed web app that starts with a game selection page. The first supported game is *The Game of Life*.

It supports:

- Game selection page so more games can be added later
- Shared game code
- Host as a player
- Player money tracking
- Fixed denominations: 5K, 10K, 20K, 50K, 100K
- Child counter
- Bank loan paper counter: each loan paper adds 20K borrowed and 25K payback owed
- End-game loan settlement before finalized cash balance
- Finalized cash balance for Millionaire Estates ranking
- LIFE tile counters by denomination: 50K, 100K, 150K, 200K, 250K
- Host dashboard and activity log
- GitHub Pages deployment
- Installable web app behavior

## 1. Create a Firebase project

1. Go to Firebase Console.
2. Create a project.
3. Add a Web App.
4. Copy the Firebase config.

## 2. Edit `config.js`

Replace the placeholder values in `config.js` with your Firebase Web App config.

Example:

```js
export const firebaseConfig = {
  apiKey: "your-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
```

## 3. Enable Firestore

1. In Firebase Console, open Firestore Database.
2. Create database.
3. Start in test mode if you are just testing.
4. Later, paste the contents of `firestore.rules` into the Firestore Rules tab.

The included rules are simple and meant for a family game. Anyone with the game code can write to that game. For a public app, use Firebase Authentication and stricter rules.

## 4. Upload to GitHub

Create a new repository, then upload these files:

```text
index.html
style.css
app.js
config.js
manifest.json
service-worker.js
icon.svg
README.md
firestore.rules
```

## 5. Turn on GitHub Pages

1. Go to the repository on GitHub.
2. Open Settings.
3. Open Pages.
4. Under Source, select `Deploy from a branch`.
5. Select `main` and `/root`.
6. Save.

Your app will be available at:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY-NAME/
```

## 6. How to use during the game

1. Host opens the app and selects *The Game of Life*.
2. Host creates a game.
3. Host shares the game code.
4. Players open the same app link and select *The Game of Life*.
5. Players enter the game code and their name.
6. Each player updates their own money, children, loans, and LIFE tiles.
7. Host sees the full dashboard and activity log.

## End-game order

1. Pay or subtract unpaid loans.
2. Finalize cash balance.
3. Rank finalized cash to decide Millionaire Estates final LIFE tiles.
4. Add LIFE tile counts by denomination.
5. View final score.


## Default starting money

The default starting money for the host when creating a Game of Life session is 10K.


## Visual themes

The app includes light and dark mode plus five color themes:

- Classic
- Ocean
- Sunset, red theme
- Forest
- Candy

Theme and mode choices are saved on each device using local storage.

## If the button does nothing after updating files

This is usually caused by the browser loading an old cached file from the service worker.
This version uses `life-tracker-v7` and calls `skipWaiting()` and `clients.claim()` to reduce stale-cache problems.
After uploading, hard refresh the GitHub Pages link or open it in a private browser window once.


## Staged money changes

Money changes now require confirmation:

1. Select Add or Subtract.
2. Select one denomination.
3. Tap Save Change to apply it, or Cancel to discard it.

This reduces accidental money changes during play.


## Version v9 interaction update

Money, child changes, and bank loan paper changes now use staged confirmation.

Money:
1. Select Add or Subtract.
2. Choose a denomination.
3. Tap Apply or Cancel.

Children:
1. Tap + Child or - Child.
2. Tap Apply or Cancel.

Loan papers:
1. Tap +1 Loan Paper or -1 Loan Paper.
2. Tap Apply or Cancel.

The Sunset theme was changed to a red-based theme, and the service worker cache was updated to `life-tracker-v9`.


## Version v10 update

Children and loan papers now show Apply and Cancel buttons after a pending change is selected.

The Add and Subtract money buttons are both active-looking before selection. After one is selected, the selected option stays highlighted and the other option becomes grey.

The service worker is disabled during active development to prevent stale cache problems. `index.html` now loads `style.css?v=10` and `app.js?v=10` for cache busting.


## Version v11 fix

This version removes a duplicate `setMoneyMode()` function that could break the staged money UI. It also adds safe event binding and a small fallback click handler for the welcome page button. The app is loaded with `app.js?v=11` and `style.css?v=11`.


## Version v12 update

LIFE tile changes now use the same staged confirmation pattern as money, children, and loan papers.

1. Tap + or - beside a LIFE tile denomination.
2. Review the pending change.
3. Tap Apply to save it or Cancel to discard it.

The app now loads `style.css?v=12` and `app.js?v=12`.


## Version v13 update

Money changes now use denomination counters.

Example:
To add 40K, choose Add, then tap `+` twice on the 20K row. The pending total becomes +40K. Tap Apply to save or Cancel to discard.

If a wrong denomination is selected, tap `-` beside that denomination before applying.


## Version v14 update

Fixed LIFE tile counters.

When you tap + or - beside a LIFE tile denomination, the app now shows a pending change. The displayed count and row total update after tapping Apply. Cancel discards the pending change.

The row total is shown as:

`tile denomination × count`

The app now loads `style.css?v=14` and `app.js?v=14`.


## Version v15 update

Loan papers and LIFE tiles now support multiple staged changes before applying.

Loan papers:
- Tap +1 Loan Paper multiple times to stage multiple loan papers.
- Tap -1 Loan Paper to reduce the pending count or stage payments.
- Tap Apply once to save the full loan paper change.

LIFE tiles:
- Tap + multiple times on the same denomination to stage more than one tile.
- Tap - to reduce the pending count before applying.
- The row count and row total show the projected value before Apply.
- Tap Apply once to save all pending LIFE tile changes.


## Version v16 update

Loan paper pending text was adjusted so the explanatory text is normal weight, while the staged count, such as `3 loan papers`, is bold.


## Version v17 update

Loan paper pending text now shows the staged loan amount directly on the first line.

Examples:
- `Add 1 loan paper, +20K borrowed.`
- `Add 3 loan papers, +60K borrowed.`
- `Remove/pay 2 loan papers, -50K paid back.`


## Version v18 update

Loan paper pending text now uses simplified wording.

Example:
`Add 5 loan papers, borrow 100K.`

For payments:
`Remove/pay 2 loan papers, pay back 50K.`


## Version v19 update

LIFE tile tally is now hidden until the player clicks `Finalize My Cash`.

The LIFE tile counter also now shows projected counts and row totals immediately after pressing `+` or `-`. The actual Firebase value is saved only after pressing Apply.


## Version v20 update

Default color mode is now dark.

After `Finalize My Cash` is clicked:
- Money Add/Subtract is locked.
- Child changes are locked.
- Loan paper changes are locked.
- LIFE tile tally becomes available.

Before cash is finalized:
- LIFE tile tally is hidden.

LIFE tile counters were rebuilt so the count and row total update immediately as projected values when `+` or `-` is clicked. The values are saved only after Apply.


## Version v21 update

Fixed light/dark mode behavior.

- New users default to dark mode.
- The Light Mode / Dark Mode button now toggles based on the actual body class.
- The selected mode is stored in local storage.
- If a device previously stored light mode, it may remain light until the user taps Dark Mode or clears local storage.
