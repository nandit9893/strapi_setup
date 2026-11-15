# Strapi auto-translate

Seed ke baad ye script English entries ko target locale (jaise `es`) me translate karke publish karti hai.
Collection types aur single types dono chalte hain. Field names dene ki zaroorat nahi.
Spanish pehle se hai ya nahi, ye check nahi karti: hamesha overwrite karti hai.

## Zaroorat
1. Node.js 18+ (`node -v`). `npm install` nahi chahiye.
2. Strapi API Token: Settings -> API Tokens. Token ko in content types par find + update (aur create) permission chahiye. Full access sabse aasan.
3. Anthropic API key (console.anthropic.com).
4. Strapi admin me locale add ho: Settings -> Internationalization -> `es`.
5. Content types me i18n (localization) enabled ho.

## Setup
1. `.env.example` ko `.env` naam se copy karo aur keys bharo.
2. `translate.config.json` me URL, locales, `collections` (plural API ID, jaise `products`) aur `singles` (singular API ID, jaise `homepage`) likho.

## Run
```bash
node translate.js --test 3     # pehle 3 entries par test
node translate.js              # sab
node translate.js products     # sirf ek content type
```

Seed ke baad har baar bas `node translate.js`.

## Pehle test me ye check karo
- Admin me Spanish entry ban kar **Published** hui ya nahi (script end me count bhi print karti hai).
- **English text badla to nahi.** Agar koi field localized nahi hai, to uski value Spanish se overwrite ho sakti hai. Aisa ho to us field ka naam `skipKeys` me daalo.
- Koi enum/technical field translate ho gaya aur error aaya (`must be one of...`), to uska key `skipKeys` me daalo.

## Kya translate nahi hota
`slug, uid, url, email, id, date`, enum jaisi values (`primary`, `LEFT_ALIGN`), media aur relations. Relations skip hoti hain, media id se link hota hai.
