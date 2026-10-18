# Set up the editor (about 15 minutes, once)

After this, you update the site at `yoursite.com/admin`: add photos, drawings and musings with forms, drag to reorder, edit your about text and links. Saving updates the live site in about a minute.

The editor saves to a GitHub repo, and Netlify rebuilds the site from it.

## 1. Put the site on GitHub

1. Make a free account at github.com, then create a new repository (private is fine), for example `asitwashere`.
2. Unzip `portfolio.zip`. On the repo page choose **uploading an existing file**, then drag in everything inside the `portfolio` folder (`public`, `netlify`, `netlify.toml`, `README.md`). Click **Commit changes**.

## 2. Tell the editor which repo to use

1. In the repo, open `public/admin/config.yml` and click the pencil icon.
2. Change `YOUR-GITHUB-USERNAME/YOUR-REPO-NAME` to your own, for example `neil/asitwashere`. Commit.

## 3. Connect Netlify to the repo

1. In Netlify choose **Add new site**, then **Import an existing project**, then GitHub, and pick your repo.
2. Leave the build settings as they are. They are read from `netlify.toml`. Click **Deploy**.
3. If you already deployed this site by dragging a folder, this replaces it. Delete the old one once the new one works.

## 4. Make a sign-in token

1. On GitHub open **Settings**, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, then **Generate new token**.
2. Under **Repository access** choose **Only select repositories** and pick your repo.
3. Under **Permissions**, **Repository permissions**, set **Contents** to **Read and write**.
4. Generate it and copy the token. GitHub shows it only once.

## 5. Sign in

1. Go to `yoursite.com/admin`.
2. Click the small arrow next to **Sign In**, choose **Use Personal Access Token**, and paste the token. It stays in your browser only.

## Using it

- Open **Site content**, then pick Photographs, Drawings, Musings, or About, contact and links.
- Add an entry, fill in the fields, drop in your image, and click **Save**.
- The first entry in each list is shown first. Drag entries to reorder.
- For musings, leave a blank line between paragraphs.
- Upload web-size copies, about 2000 pixels on the long edge, not your full-resolution originals. The image files are publicly reachable by anyone who looks hard enough, so keep your originals somewhere private. Keep each file under about 10 MB.
- Under "About, contact and links" there is a switch to turn the save and copy protection on or off.
- Your token expires on the date you chose. When it does, make a new one the same way.

## link previews
in **settings** you'll find *website address* and *show the artwork in link previews*. cards are made for you on every save; just wait for netlify to finish deploying (about a minute).
