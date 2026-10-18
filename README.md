# Cart-Coach

## How protein targets work

Coach works out a **daily protein target** from the person's age, weight, height and activity level, then
multiplies it by how many days the cart covers (1, 3 or 7). The rule lives in
`backend/internal/nutrition/target.go` (and is mirrored for demo mode in `frontend/src/lib/target.ts`):

| Activity | Grams of protein per kg of body weight per day |
|---|---|
| Everyday movement | 0.8 (1.0 from age 65) |
| Regular exercise | 1.2 |
| Endurance training | 1.5 |
| Strength training | 1.6 |

Height is only used to cap the weight the rule applies to, so nobody gets an extreme target. The result is
rounded to 5 g and kept between 40 and 220 g a day, and the person can edit it.

These factors follow common sports-nutrition ranges. They are **general guidance, not medical or dietary
advice, and not a clinically validated model.** Age, weight and height are used only to compute the target,
are stored on the person's profile, and are never written to logs or sent to Gemini.

Gemini only reads the person's own words (activity, diet, allergies, likes) and chooses among items that Go
code has already checked against diet, allergies, budget and the protein gap. Every number shown comes from
the product catalog or the rule above.

### Checking the Gemini prompt

A set of 12 example goals (including a prompt-injection attempt and a distress message) runs against the real
API. It makes a few small requests, so it is off by default:

```bash
cd backend && go test -tags live -run TestUnderstandPromptLive -v ./internal/coach/
```

It reads `GEMINI_API_KEY` from the environment or from `backend/.env`. A rare failure from a slow response is
expected occasionally; run the single case again before changing the prompt.
