# Unslop: prompt and client workflow

How to use the other three files with Claude (or any AI chat) on any project.

## Step 1: setup message (paste once per new chat)

```
You are an editor who removes AI tells from website copy and UI code for small businesses.

Rules:
1. Apply the rules below.
2. Do not invent facts, numbers, testimonials or features. If something needs a number, flag it.
3. Leave claims you can't verify (customer counts, testimonials, awards, test results) unchanged and list them under "Needs your confirmation."
4. If a rule doesn't apply to what I paste, skip it.
5. Keep the original meaning and the brand's facts.
6. Quotes from customers stay word for word. Only fix the surrounding labels.

Output format every time:
- Rewritten version
- Changed: short list of what you changed and why
- Needs your confirmation: claims I should verify

COPY RULES:
[paste unslop-copy-rules.md]

SURFACE RULES (only for CSS/HTML/Tailwind code):
[paste unslop-surface-rules.md]

EXAMPLES OF GOOD EDITS (use as the standard):
[paste unslop-examples.md]

Reply "ready" when you have this.
```

If it's too long for one message, send the rules first, then the examples, then ask "ready?".

## Step 2: the job message

```
Type: copy only   (or: HTML/CSS/React code)
Fix only: copy   (or: surface rules U17-U20   or: both)
Page text/code:
[paste the client's content]
```

One page or file per chat. New client means new chat.

## Optional: add the full UI rules
The examples cite U1 to U16 (eyebrows, numbering, badges, charts, KPI tiles, forms). For the full text, open github.com/felipebasurto/unslop-ui, find the main skill file (likely `SKILL.md`) and paste it into the setup message too. You can also install it where an agent runs: `npx skills add felipebasurto/unslop-ui -g`.

## Extra checks I use on every job
These come from real edits, not from the original rules.

- **Claims register.** List every checkable claim: customer counts, percentages, test results, "5x" results, testimonials, awards, named partners or marketplaces.
- **Numbers that disagree.** Compare prices and figures across the whole page. Example: "KES 33 per photo" vs "KES 100 for 3 sets", or a shoot costing KES 15,000 in one place and KES 20,000 in another.
- **Borrowed names.** Another company's name used as a quality stamp ("Jumia Editorial Standard") can be a trademark or truth problem.
- **Promises with no source.** "Approved instantly", "sell out before you post", "end the negotiation". Cut or ask for evidence.
- **Fake-feeling UI.** Decorative icons, always-on badges, status dots with no real state, auto-rotating carousels, infinite marquees.
- **Readability.** Very small text (under 12px), low-contrast grey on dark, all-caps with wide letter spacing.
- **Accessibility.** Icon-only buttons need an `aria-label`. Form fields need a visible label.
- **Unused imports** after deleting icons, motion or components.

## Client report template

```
# Review of [client / page]
Date: [date]

## What I changed
- [change] — [reason in one line]

## What I kept on purpose
- [item] — [reason]

## Needs your confirmation
- [ ] "[claim]" ([where]) — confirm it is true and provable, or remove
- [ ] [testimonial name] — confirm it is a real quote and you have permission

## Not covered
- [files or pages I didn't see]

## Optional next step
- [one suggestion]
```

## Quality check before you send
1. Read the output yourself. Did it keep every real fact?
2. Search the output for any number you didn't get from the client.
3. Read the new copy aloud. If it could sit on another company's page, it is still generic.
4. Make sure the code builds, or tell the client you haven't run it.
5. Keep the credit to the MIT-licensed sources if you share the rules themselves.

## Pricing guide (starting points)
- Copy review for one page, list of fixes only: $50 to $150
- Copy review plus rewritten text: $100 to $250
- Copy plus CSS/React cleanup for one page: $200 to $500
Raise prices after 3 to 5 happy clients and a couple of testimonials.
