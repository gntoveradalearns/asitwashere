# asitwashere

Static art portfolio for Netlify. No build step. Dark mode is the default, with a toggle in the top bar (the choice is remembered per visitor).

**To update the site with forms instead of code, follow `SETUP-EDITOR.md`.** It sets up an editor at `/admin`.

## Pages

- `index.html`: carousel mixing photographs, drawings and musings.
- `photos.html` and `drawings.html`: a gallery each, with Instagram posts below.
- `musings.html`: your own pieces plus your latest Substack posts.
- `about.html`: about text, contact form and links.
- `admin/`: the editor (not linked from the site).

## Content files

The editor changes these files. You can also edit them by hand.

- `public/data/photos.json`, `drawings.json`, `musings.json`: each is `{ "items": [ ... ] }`, first item shown first.
  - photo and drawing items: `title`, `src` (image path), `year`, `medium`, `alt`.
  - musing items: `title`, `year`, `excerpt`, `body` (blank line between paragraphs).
- `public/site.config.json`: name, tagline, about text, email, Substack and Instagram.
- `public/images/`: your images. Image sizes are measured by the site, and on Netlify resized copies are served automatically.

## Substack

Set `substack.handle` to the part before `.substack.com`. With a custom domain, set `substack.feedUrl` to your feed address instead (for example `https://yourdomain.com/feed`).

## Instagram

Instagram has no free public feed, so each page shows a follow button plus the posts you pick. Paste post links into `instagram.photoPosts` (Photographs page) and `instagram.drawingPosts` (Drawings page). Set `instagram.handle` for the follow button.

## Contact form

The form on the About page works through Netlify Forms. Messages appear in your Netlify dashboard under Forms.

## Deploy

Connect the GitHub repo to Netlify (see `SETUP-EDITOR.md`). Netlify reads `netlify.toml`: it publishes `public/` and runs the Substack function in `netlify/functions`. Preview locally with `npx netlify dev`.

## Lowercase

All text displays in lowercase through one CSS rule (`body { text-transform: lowercase; }` in `css/style.css`). Your original text is stored as you typed it. Delete that rule to switch it off.

## Protecting your work

By default the site discourages saving and copying:

- Images can't be right-click saved, dragged out, or long-press saved on phones, and "save page as" and printing are blocked.
- Text can't be selected or copied (form fields still work).
- Visitors can still **share**. The share icon in the viewer sends a link straight to that piece (on phones it opens the share sheet, elsewhere it copies the link).

This only stops casual saving. Anyone can still take a screenshot or look at what the page loads, so **upload web-size copies (about 2000px on the long edge), not full-resolution originals**, and consider a watermark on anything you really can't have copied. To turn the protection off, set `"protect": false` in `site.config.json`, or untick it under "About, contact and links" in the editor.

## link previews

when someone shares a photograph, drawing or musing, chat apps and social sites show a card (1200×630) in the same style as the viewer: photos on black, drawings matted on a gray wall, musings as a page of type.

- cards and share pages are generated automatically on every deploy (`npm run build`). nothing to do when you add work.
- each piece is shared as `/share/<kind>/<id>/`. visitors who open it land straight on the piece.
- the editor's **settings** has two options: *website address* (set it once you have your own domain; otherwise the netlify address is used) and *show the artwork in link previews* (turn off to share only the title).
- after a deploy, if an app still shows an old card, it has cached it. facebook's sharing debugger and similar tools can refresh it.
- the card shows a reduced copy of the image, so it's not a download of your full file.

## launch checklist (what's built in)

- **secrets:** none live in the site. the editor's github token stays in your own browser; the contact form and substack feed run through netlify. `.env` files are git-ignored. never paste a key into a content file.
- **https:** forced by redirect, plus strict transport security and other safety headers (`netlify.toml`). turn on https in netlify's domain settings.
- **titles, descriptions, preview image, canonical links, favicon, sitemap.xml, robots.txt:** generated on every deploy. set *website address* in settings once you have a domain.
- **alt text:** the editor requires an image description for every photograph and drawing. the build lists any that are missing.
- **image compression:** the build shrinks copies of your images (max 2400px, re-encoded) without touching the originals. the site also serves smaller sizes through netlify's image service.
- **speed:** images are lazy-loaded, the first slide loads first, files are cached. keep uploads to ~2000px.
- **contrast:** both themes checked against wcag aa (4.5:1 for text).
- **mobile:** checked at 375px and 768px, no sideways scrolling, larger tap areas on touch screens.
- **404 page:** `404.html`.
- **broken links:** `npm run build` ends with a link check and lists anything broken (missing images, bad page links). it warns but never blocks a deploy.
- **contact form:** checks name, email and message before sending, with messages next to each field.
- **spam:** a hidden trap field, a minimum time on the page, and netlify's built-in spam filtering. to add a captcha later, turn on reCAPTCHA in netlify's form settings.
- **analytics:** in settings → *visitor counting*: plausible, goatcounter (no cookies) or google analytics. off by default, and skipped for visitors with do not track.
- **one call to action:** the home page has a single "get in touch" button; the about page's send button is the only other main action.
