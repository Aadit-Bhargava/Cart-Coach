# Cart Coach

**A normal-looking online food store whose cart helps you reach your goal. Always with your consent, and it never checks out.**

Built for the **Google Cloud AI Builder Cup 2026 (JAPAC)**, theme **Retail & Commerce**.

### 👉 Deployed link: https://cart-coach-926097823266.asia-south1.run.app/

Team: **Steins Gate** (leader: Aadit Bhargava)

> All products, nutrition values and prices are generated demo data. Brands are fictional.

## What it is

People who shop for food with a goal ("vegetarian, 50 g protein a day, on a budget") have to read labels and do the maths themselves. Cart Coach does it for them.

It looks and works like any online food store. The difference is in the cart: when you add items, Coach suggests a few more that help you reach your goal, each one labelled with a reason. You decide what stays.

## How it works

1. **Tell it your goal in your own words.** For example: *"I'm vegetarian and active, 50 g protein a day. I avoid dairy and like peanuts."* Gemini turns this into a small profile (protein target, diet, allergies, likes, budget). You see it and can edit it before saving.
2. **Shop as usual.** Browse, search and add items. The shelves show only ordinary product information.
3. **Coach adds suggestions to your cart.** Up to three at a time, marked **Suggested by Coach**, each with a short reason such as "+37 g protein, ₹57 more". A protein meter at the top of the cart shows how close you are to your goal.
4. **You stay in control.** Keep or remove each suggestion, undo them all in one tap, or press **Not this** and say what you want instead. If Coach can't add it (for example paneer for someone who avoids dairy), it tells you why. Nothing is ever bought. There is no checkout.
5. **See the reasons.** The decision log shows what Coach changed, why, and where each number came from.

Suggestions always respect your diet, allergies and budget. Auto-add only runs if you switch it on.

## Good to know

- Your protein target comes from a simple, fixed rule based on age, weight, height and activity, and you can change it. It is general guidance, **not medical or dietary advice**. The app is for people aged 18 and over.
- Age, weight and height are used only to work out the target. They are never sent to Gemini.
- If someone's goal text suggests distress, Coach replies kindly and points to professional help instead of giving targets.

## Built with Google Cloud

Gemini (understanding your goal and choosing suggestions), Cloud Run (hosting) and Secret Manager (keys).
