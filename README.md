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
- Sunset
- Forest
- Candy

Theme and mode choices are saved on each device using local storage.

## If the button does nothing after updating files

This is usually caused by the browser loading an old cached file from the service worker.
This version uses `life-tracker-v7` and calls `skipWaiting()` and `clients.claim()` to reduce stale-cache problems.
After uploading, hard refresh the GitHub Pages link or open it in a private browser window once.
