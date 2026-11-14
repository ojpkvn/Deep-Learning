# Noodle Log — offline web app (laksa / mee goreng / pho / ramen)

Runs your trained **Model 1** (EfficientNetB0, from your notebook) entirely in the browser with TensorFlow.js.
Photos never leave the phone. After the first visit it works with no internet.

## What is in this folder
| File | Purpose |
|---|---|
| `index.html`, `styles.css`, `app.js` | The page (`styles.css` holds all the visual design; edit colours at the top, under `:root`): take/choose a photo, show the prediction, suggest a log entry, daily log |
| `nutrition.js` | Calorie and sodium estimates per dish and portion size (edit this table to change them) |
| `log.js` | Saves the food log on the phone (localStorage), daily totals, targets, CSV export |
| `classifier.js` | Model logic (resize like the notebook, run the model, rank the 4 classes) |
| `model/` | Your Model 1 converted to TensorFlow.js (about 16 MB) |
| `tf.min.js` | TensorFlow.js library (bundled so it works offline) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline caching and "Add to Home Screen" support |
| `tools/` | The two scripts used to convert the model (for your own reference) |

## Put it online once (needs HTTPS — a service worker will not run from a plain file)
**Option A — Netlify Drop:** go to https://app.netlify.com/drop and drag this whole `noodle-classifier` folder onto the page. You get an https link. (Create a free account to keep the site permanently; check Netlify's current terms.)

**Option B — GitHub Pages:** create a **public** repository, upload all the files in this folder (keep the folder structure), then Settings → Pages → deploy from the `main` branch. Your link will look like `https://<username>.github.io/<repo>/`. Do not upload your private photos.

## Install on the iPhone
1. Open the link in **Safari** (not Chrome) while you have internet and wait until the page says **"Ready · works offline"** (first load is about 18 MB).
2. Tap **Share → Add to Home Screen → Add**.
3. Test it: turn on **Airplane mode** and open the app from the Home Screen. Take or choose a photo.

## Notes and limits
- It classifies into exactly these 4 dishes; any other food is forced into one of them, and a high % does not mean it is right.
- The app resizes photos the same way as your notebook (`tf.image.resize`, bilinear). Photos larger than 2048 px are shrunk first.
- Changing the model later (new training run): re-export and re-convert (see `tools/`), replace the `model/` folder, and change `CACHE = 'noodle-classifier-v1'` in `sw.js` to `v2` so phones fetch the new files.

## Calorie and sodium log (new)
- After a photo is classified, the app suggests a log entry: dish, portion (small / regular / large), calories, sodium and meal. Tap another dish if the model got it wrong, and edit any number before tapping **Add to today's log**.
- The **Log** tab shows each day's totals against your targets (default 2,000 kcal and 2,000 mg sodium; change them under *Daily targets*), lets you delete entries, browse previous days and **Export CSV**.
- The log is stored only in this app on this phone. Deleting the app or clearing Safari data erases it, so export now and then.
- The numbers are estimates for one typical serving, with sources listed at the top of `nutrition.js`. Sodium varies the most between bowls.

## Updating an existing GitHub Pages site
Upload the new/changed files over the old ones (`index.html`, `app.js`, `sw.js`, `manifest.webmanifest`, `README.md`, plus the new `nutrition.js` and `log.js`). `index.html` must stay at the top level of the repo. `sw.js` now uses cache name `v3` (and caches the new `styles.css`), so phones fetch the update. Open the app once online (close and reopen it if it still shows the old screen).
