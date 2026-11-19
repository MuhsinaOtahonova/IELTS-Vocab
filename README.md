# Word a Day: IELTS vocabulary

A calm website for learning IELTS words, 10 a day. Built with the components from [my-design-template](https://github.com/MuhsinaOtahonova/my-design-template) (navy and white, day and night modes).

- **Today**: add 10 words a day, typed yourself or picked from a built-in list of about 150 IELTS words. Each word has a meaning, an example and an optional picture or video link.
- **End-of-day review**: round 1 on today's words, round 2 on all your words so far (weakest first).
- **Games**: flashcards, multiple choice, picture quiz, matching, spelling and a mixed quiz.
- **Friday check**: one pass over the whole week's words (70 at 10 a day) with a saved score.
- **Progress**: day streak, a 12-week activity grid and badges.

Everything is saved in your browser (localStorage). Download a backup on the Progress page to move your words to another device.

```
pnpm install
pnpm dev        # local site
pnpm build      # builds apps/ielts/dist
```

`packages/tokens` and `packages/ui-web` are copied from the template. To change the brand color, edit `BRAND` in `packages/tokens/src/index.ts`.

Pushing to `main` publishes the site with GitHub Pages (`.github/workflows/pages.yml`).
