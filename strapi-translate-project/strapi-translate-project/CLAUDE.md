# Strapi auto-translate project

Pehle `CONTEXT.txt` poora padho. Usme user ki problem, faisle, script ka flow aur khule risks hain.

- User Hinglish (Roman script) me baat karta hai, usi me reply do.
- Main file: `translate.js` (Node 18+, koi npm dependency nahi). Config: `translate.config.json`. Keys: `.env`.
- Script abhi tak kisi real Strapi par test nahi hui. Pehle `node translate.js --test 3` chalwao.
- Sabse bada unverified hissa: REST PUT me `status=published` se locale publish hota hai ya nahi.
