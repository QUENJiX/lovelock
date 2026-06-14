# LoveLock After Dark Hybrid Launch Design

Date: 2026-06-14

## Goal

Evolve LoveLock into a dual-surface product:

- **LoveLock** remains the default romantic, private quiz vault for general couples.
- **LoveLock After Dark** becomes an adult-only, consent-first secure media and scenario tool for couples exploring consensual NTR, hotwife, cuckold, and voyeuristic roleplay dynamics.

The launch direction is **Hybrid Launch**:

- Guest users can create fast, anonymous, expiring After Dark Scenario Vaults.
- Pro subscribers can create Couple Workspaces with saved preferences, partner invite, premium templates, history, and future video support.

This should feel like a private encrypted kink ritual tool, not a public adult content platform.

## Non-Goals

- Do not build a public feed, search, discovery surface, or creator marketplace.
- Do not support hidden camera, non-consensual voyeurism, revenge content, coercion, blackmail, or third-party uploads without consent.
- Do not implement payment processing in Phase 1.
- Do not implement video vaults in Phase 1.
- Do not require accounts for guest Scenario Vaults.
- Do not remove the existing LoveLock romantic flow.

## Product Surfaces

### LoveLock

LoveLock remains the softer default experience:

- Relationship quiz vault.
- Private photo/message sharing.
- Playful and Strict Private unlock modes.
- General romantic copy and visual style.

### LoveLock After Dark

After Dark is a clearly gated adult-only mode:

- Adult consent gate before entry.
- Consent checklist before vault creation.
- Recipient consent acknowledgement before unlock.
- Scenario-driven creator flow.
- Strong privacy defaults.
- Pro upsell surfaces for recurring subscription features.

After Dark should not be visible as the default experience for users who arrive at the main LoveLock page.

## Core Object: Scenario Vault

The main After Dark object is a **Scenario Vault**. It combines encrypted media with a roleplay frame and safety context.

Each Scenario Vault includes:

- Scenario type:
  - NTR fantasy
  - Hotwife
  - Cuckold
  - Consensual voyeur
  - Custom
- Intensity:
  - Soft
  - Spicy
  - Intense
- Recipient role label:
  - Husband
  - Wife
  - Partner
  - Watcher
  - Custom
- Consent checklist.
- Encrypted image media for Phase 1.
- Optional blurred teaser, default off.
- Unlock mode:
  - Playful
  - Strict Private
- Expiration.
- Aftercare note.
- Share link.

## Experience Design

After Dark should be more theatrical than the standard LoveLock flow while staying private and clear.

### Scenario Setup

The creator chooses the scenario type, intensity, recipient label, and boundaries before uploading media. The setup should feel like choosing a private ritual, not filling out a generic form.

### Staged Reveals

The unlock experience should create anticipation:

- Locked state.
- Optional blurred teaser.
- Prompt or consent phrase.
- Partial/progressive reveal where compatible with the selected unlock mode.
- Full unlock.
- Aftercare note.
- Reply lock call-to-action.

### Spicy Prompt Templates

Phase 1 should include safe, non-graphic prompt templates that support the dynamics without generating explicit sexual instructions:

- Confession prompt.
- Permission phrase.
- Memory check.
- Boundary check.
- Jealousy dial.
- Final consent phrase.

These templates should help couples set tone and anticipation while keeping user-generated media private.

### Reply Lock Loop

After viewing an unlocked vault, the recipient can create a response vault. This creates a repeatable private loop:

1. Creator sends Scenario Vault.
2. Recipient unlocks and views.
3. Recipient sends a reply vault.
4. The couple has a reason to return.

## Consent and Safety

After Dark must be explicit about permitted and banned use.

### Required Rules

Every After Dark flow must make these boundaries clear:

- All users and all depicted people must be 18+.
- All media must be consensually created and consensually shared.
- Consensual voyeur means invited watching, shared viewing, or roleplay only.
- Hidden camera content is banned.
- Non-consensual voyeurism is banned.
- Revenge content is banned.
- Coercion, blackmail, threats, or forced humiliation involving non-consenting people are banned.
- Third-party media is banned unless every depicted person consented to this use.

### Consent UX

Consent should be built into the product:

- Adult gate before After Dark entry.
- Vault creation consent checklist.
- Recipient acknowledgement before unlock.
- Couple Workspace consent confirmation by both partners.
- Visible Burn/Revoke affordance when supported.
- Plain safety copy that is clear without feeling clinical.

## Privacy and Security

The existing zero-knowledge architecture remains central.

### Encrypted Data

The following should be encrypted client-side:

- Uploaded media.
- Private aftercare note.
- Any personal message intended only for the recipient.

### Public or Server Metadata

The app may store limited metadata server-side:

- Vault ID.
- Created time.
- Expiration.
- Scenario type.
- Intensity.
- Unlock mode.
- Teaser enabled flag.
- Workspace ID for Pro flows.
- Subscription status for Pro flows.

Avoid storing explicit personalized notes or sensitive media details in plaintext.

### Privacy Defaults

After Dark defaults should be conservative:

- Teaser preview off by default.
- Short expiration for guest vaults.
- No public gallery.
- No social discovery.
- No indexing of vault contents.

## Guest Path

Guest After Dark vaults are the fastest path to product magic.

Guest users can:

- Pass the adult gate.
- Create one expiring Scenario Vault.
- Use image media.
- Choose scenario type, intensity, role label, and expiration.
- Choose Playful or Strict Private unlock.
- Add an aftercare note.
- Share a private link.

Guest users cannot:

- Save vault history.
- Save templates or role labels.
- Create a Couple Workspace.
- Use video.
- Use premium scenario packs.
- Use long-term storage.

## Pro Couple Workspace

After Dark Pro is the recurring subscription product.

Each Pro Couple Workspace includes:

- Account owner.
- Partner invite.
- Both-partner consent confirmation.
- Subscription status.
- Saved role labels.
- Saved boundaries/preferences.
- Vault history.
- Template favorites.
- Pro feature gates.

Saved couple features require both partners to join and confirm consent. Guest vaults remain available for fast sharing without a workspace.

## Monetization

The monetization model is **After Dark Pro subscription**. No lifetime deal.

### Free / Guest

- Limited guest vaults.
- Image only.
- Short expiration.
- Basic scenario types.
- Basic Playful and Strict Private modes.
- No saved history.
- No Couple Workspace.

### After Dark Pro Monthly

Recurring monthly subscription unlocks:

- Couple Workspace.
- Partner invite.
- More active vaults.
- Saved roles and preferences.
- Premium scenario templates.
- Custom expiration.
- Discreet mode.
- Burn/Revoke controls.
- Larger encrypted media limit.
- Vault history.
- Future video vaults.

### After Dark Pro Annual

Recurring annual subscription with the same feature set at a discounted annual rate. It remains recurring.

### Premium Template Drops

Pro should deliver recurring value through template drops:

- Monthly scenario packs.
- Date-night scripts.
- Hotwife/cuckold/NTR/voyeur roleplay prompt sets.
- Aftercare packs.
- Weekend scenario packs.

Payment integration should use an adult-compatible processor. Do not assume mainstream processors will support this category.

## Discreet Mode

Discreet Mode is a Pro-oriented privacy feature.

It should support:

- Neutral page title.
- Neutral app copy where practical.
- Optional neutral favicon/theme.
- Blur app when tab loses focus.
- Quick close or panic navigation.

Discreet Mode should not weaken consent or legal disclosures during creation/unlock.

## Burn and Revoke

Burn/Revoke controls should be first-class Pro features.

Where technically possible, the app should support:

- Delete encrypted payload.
- Disable link access.
- Show a burned/expired state to future visitors.

If physical deletion is not guaranteed because of backend or cache limits, the UI must use accurate language such as "disable access" rather than overpromising.

## Legal Pages

Before charging or marketing After Dark broadly, update:

- Terms and Conditions.
- Privacy Policy.
- Adult content policy.
- Subscription/payment terms.

Legal pages must clearly prohibit minors, non-consensual content, hidden capture, revenge content, coercion, and non-consensual third-party media.

## Implementation Phases

### Phase 1: After Dark Guest MVP

Build the adult product loop without accounts or payments:

- Adult mode entry/gate.
- Scenario Vault creator.
- Consent checklist.
- Scenario type, intensity, recipient role.
- Image vaults only.
- Playful and Strict Private unlock modes.
- Teaser toggle default off.
- Expiring share links.
- Recipient consent acknowledgement.
- Aftercare note.
- Discreet mode UI toggle.
- Pro upsell surfaces, not payment yet.

### Phase 2: Pro Couple Workspace

Add the subscription product foundation:

- Account system.
- Couple Workspace.
- Partner invite.
- Both-partner consent confirmation.
- Subscription status model.
- Pro feature gates.
- Saved roles/preferences.
- Vault history.
- Burn/Revoke controls.

### Phase 3: Recurring Revenue Expansion

Add recurring paid value:

- Adult-friendly payment processor integration.
- Monthly and annual Pro plans.
- Premium scenario/template packs.
- Video vaults.
- Larger encrypted media limits.
- Recurring template drops.

## Testing Strategy

Phase 1 testing should cover:

- LoveLock default flow still works.
- After Dark gate blocks entry until adult consent is confirmed.
- Consent checklist is required before generating an After Dark vault.
- Scenario metadata appears in creator, share, and recipient views.
- Private media and aftercare note remain encrypted.
- Teaser is off by default.
- Recipient acknowledgement is required before unlock.
- Playful and Strict Private modes still behave correctly.
- Discreet mode changes visible title/copy without breaking flow.
- Guest limitations and Pro upsell states render correctly.
- Mobile view has no overflow or overlapping controls.

## Open Decisions Resolved

- Product direction: Hybrid Launch.
- Brand structure: LoveLock plus LoveLock After Dark.
- Monetization: After Dark Pro subscription first, no lifetime deal.
- Account path: guest vaults plus Pro Couple Workspaces.
- Couple consent: saved couple features require both partners; guest vaults remain solo-fast.
- Phase 1 scope: After Dark Guest MVP before accounts/payments.

