# LoveLock After Dark Gallery Room Design

Date: 2026-06-14

## Goal

Turn After Dark Phase 2 into an **accountless multi-seat Gallery Room** for consenting adult couples exploring NTR, hotwife, cuckold, and consensual voyeuristic dynamics.

The room replaces the After Dark question-unlock model with a creator-owned image gallery and role-specific invite links:

- **Creator link:** the woman or initiating partner who owns the vault.
- **Partner/Cuck link:** the romantic partner invited to watch, react, or participate in the scenario.
- **Third link:** the invited third participant or viewer.

This phase should make the product feel more like a private adult ritual room than a puzzle game, while keeping the app consent-first, private, and accountless.

## Non-Goals

- Do not require accounts in this phase.
- Do not build public feeds, discovery, search, creator profiles, or marketplaces.
- Do not implement real payment processing in this phase.
- Do not implement video uploads in this phase.
- Do not support hidden camera content, non-consensual voyeurism, revenge content, coercion, blackmail, or third-party media without consent.
- Do not allow the third participant to override creator control.
- Do not remove the classic LoveLock flow.

## Product Direction

The approved direction is **accountless-first**.

Accounts remain a later upgrade for usernames, saved partner relationships, recurring subscriptions, payment history, vault history, moderation, and revocation controls. Phase 2 should still shape its data and UI so an account-based model can be added later without replacing the room concept.

## Core Object: Gallery Room

A Gallery Room is an expiring After Dark space with encrypted media, role-specific links, chat lanes, and optional coin-gated interaction.

Each room includes:

- Room ID.
- Created timestamp.
- Expiration timestamp.
- Scenario type and intensity.
- Creator display label.
- Partner role label.
- Third role label.
- Up to 6 encrypted images.
- Per-image lock state.
- Optional blurred teaser state.
- Room chat lane for all three roles.
- Private chat lane for creator and third only.
- Coin interaction state.
- Consent and safety acknowledgements.

## Roles and Capabilities

### Creator

The creator controls the room.

Capabilities:

- Upload 1-6 images.
- Create the room.
- Copy the partner link.
- Copy the third link.
- Preview the vault.
- Reveal or relock images.
- Enable or disable paid unlock requests.
- See room chat.
- See private third chat.
- End the room locally.

Creator principles:

- The creator is always the gatekeeper.
- Coin mechanics can create playful pressure, but they do not remove creator control.
- Any automatic paid unlock must be explicitly enabled by the creator.

### Partner/Cuck

The partner receives a role-specific invite link.

Capabilities:

- Join the room as the partner role.
- Acknowledge adult and consent rules before entry.
- View the gallery state.
- View images the creator has revealed to the partner.
- Participate in room chat with creator and third.
- See third seat status.
- React to locked and unlocked gallery moments.

Limitations:

- Cannot access the creator-third private chat.
- Cannot unlock creator-controlled images unless the room rules allow it.
- Cannot change room settings.

### Third

The third receives a separate role-specific invite link or joins the open third seat.

Capabilities:

- Join the room as the third role.
- Acknowledge adult and consent rules before entry.
- View the gallery state.
- Participate in room chat with creator and partner.
- Participate in private chat with creator.
- Use coins to request unlocks, boost attention, or unlock images only when creator-enabled rules allow it.

Limitations:

- Cannot access creator-only controls.
- Cannot access partner-only private state if added later.
- Cannot override disabled or creator-locked images.

## Link Model

Phase 2 uses three accountless links:

- Creator management link.
- Partner invite link.
- Third invite link.

Each link should include the public room ID plus role-specific secrets in the URL fragment. Fragment secrets are not sent to the server during normal HTTP requests.

Example shape:

```text
https://example.com/#room=<room-id>&role=partner&roomKey=<...>&roleKey=<...>
```

The exact encoding can evolve, but the design goal is:

- Server/database can store encrypted room blobs.
- Browser link fragments can derive the keys needed for that role.
- Partner and third links cannot unlock creator-only capabilities.
- Partner link cannot decrypt the private creator-third chat.

## Gallery Experience

After Dark no longer uses questions for this mode.

Creator flow:

1. Enter After Dark.
2. Confirm adult and consent rules.
3. Choose Gallery Room mode.
4. Upload 1-6 images.
5. Set scenario tone and role labels.
6. Choose expiry.
7. Choose whether coin unlocks are disabled, request-only, or creator-enabled automatic unlock.
8. Seal the room.
9. Copy partner and third links.

Recipient flow:

1. Open role-specific link.
2. Confirm adult and consent rules.
3. Enter the room.
4. View locked gallery grid.
5. Participate in the available chat lanes.
6. View images as the creator reveals them or as allowed coin rules unlock them.

## Gallery States

Each image can have one of these states:

- **Hidden:** no preview visible.
- **Teased:** blurred or cropped preview visible.
- **Requested:** third has spent coins or sent an unlock request.
- **Unlocked:** visible to the allowed role or roles.
- **Relocked:** previously visible, now hidden again for future visits.

For Phase 2, the room can model visibility as:

- Visible to creator.
- Visible to partner.
- Visible to third.
- Visible to all.

This keeps the UI flexible for later role-specific reveals.

## Chat Lanes

Phase 2 introduces two chat sections.

### Room Chat

Participants:

- Creator.
- Partner.
- Third.

Purpose:

- Shared reactions.
- Scenario banter.
- Consent-safe roleplay.
- Unlock requests visible to everyone when desired.

### Private Third Chat

Participants:

- Creator.
- Third.

Purpose:

- Private coordination.
- Creator-third anticipation.
- Unlock negotiation.
- Paid request context.

The partner link must not be able to decrypt this lane.

## Coin Mechanics

Phase 2 should include coin-gated UI and state simulation, not real payments.

Coin modes:

- **Off:** no coin interactions.
- **Request-only:** third spends mock coins to request that the creator unlock an image.
- **Creator-enabled unlock:** third spends mock coins to unlock eligible images only if the creator enabled this behavior.

Recommended MVP behavior:

- Default mode is Request-only.
- Third can spend mock coins on a locked image.
- Image moves to Requested.
- Creator sees the request and can approve or ignore it.
- Approval unlocks the image for the selected audience.

This creates monetizable product behavior without wiring payment risk into the first implementation.

## Monetization Shape

Phase 2 should show how recurring money can flow without processing real payments yet.

Free guest room:

- 1 active accountless room.
- Up to 6 images.
- Short expiry.
- Mock coin interactions.
- Basic chat lanes.

Future After Dark Pro subscription:

- Longer room expiry.
- More active rooms.
- Saved role labels.
- Room history.
- Revoke/burn controls.
- More media capacity.
- Discreet mode upgrades.
- Premium scenario packs.
- Real coin wallet or paid boosts where legally and processor-compatible.

Future coin revenue:

- Coin packs for thirds.
- Creator-approved paid unlock requests.
- Boosted requests.
- Premium room effects.

Real payment processing must wait for an adult-compatible processor and updated legal pages.

## Consent and Safety

Consent remains part of the product, not a footer.

Required creator confirmations:

- Everyone is 18+.
- Every uploaded image is consensually created and shared.
- Every depicted person consented to this room use.
- The partner and third are invited participants.
- Hidden camera and non-consensual voyeur content is banned.
- Revenge content, coercion, threats, and blackmail are banned.

Required recipient confirmations:

- I am 18+.
- I am the intended recipient of this role-specific link.
- I consent to view this private adult room.
- I will not save, repost, or share media without permission.

The app should use clear adult language but avoid graphic instructions or unsafe framing.

## Privacy and Security

Phase 2 should extend the existing client-side privacy model.

Encrypted client-side:

- Original gallery images.
- Room chat messages.
- Private third chat messages.
- Sensitive room notes.

Plain or minimally sensitive metadata:

- Room ID.
- Created timestamp.
- Expiry.
- Scenario category.
- Image count.
- Role labels.
- Coin mode.
- Message counts.

Avoid storing explicit personal chat text, original media, or private lane content in plaintext.

## Data Model Draft

Public room metadata:

```js
{
  surface: 'after-dark-room',
  roomId,
  createdAt,
  expiresAt,
  scenario: {
    type,
    intensity,
    creatorLabel,
    partnerLabel,
    thirdLabel
  },
  mediaCount,
  coinMode,
  roles: {
    partnerSeat: 'invited',
    thirdSeat: 'open'
  }
}
```

Encrypted room payload:

```js
{
  media: [
    {
      id,
      encryptedImage,
      preview,
      state,
      visibleTo
    }
  ],
  roomChat,
  privateThirdChat,
  unlockRequests,
  creatorSettings
}
```

Link-derived local state:

```js
{
  role: 'creator' | 'partner' | 'third',
  roomKey,
  roleKey,
  privateThirdKey
}
```

## UI Architecture

Add a new After Dark mode inside the existing static app:

- `Gallery Room Creator`
- `Gallery Room Share`
- `Gallery Room Viewer`

The existing After Dark Scenario Vault can remain as the lighter Phase 1 flow, but Phase 2 should make Gallery Room the primary After Dark path.

Recommended creator layout:

- Adult/consent gate.
- Mode selector: Gallery Room.
- Image uploader with 6-slot grid.
- Scenario and role setup.
- Coin mode selector.
- Expiry selector.
- Seal Room button.

Recommended share layout:

- Creator link warning.
- Partner link copy button.
- Third link copy button.
- Role explanation cards.
- Safety reminder.

Recommended viewer layout:

- Role badge.
- Expiry timer.
- Gallery grid.
- Unlock/request controls.
- Room chat.
- Private third chat if role is creator or third.

## Error Handling

Expected states:

- Expired room.
- Invalid or missing role key.
- Wrong role link.
- No media uploaded.
- Too many images.
- Oversized image.
- Failed encryption.
- Failed room save.
- Failed chat save.
- Private chat unavailable for partner.

Each error should be plain and discreet. Avoid exposing technical key details.

## Implementation Phases

### Phase 2A: Accountless Gallery Room Prototype

Build the room UI and local/payload model:

- Gallery Room creator.
- 1-6 image upload.
- Role-specific link generation.
- Role-specific viewer.
- Gallery locked/unlocked states.
- Mock room chat and private chat panels.
- Mock coin request states.
- Tests for pure room helpers.

### Phase 2B: Persisted Room and Chat

Store encrypted room and chat state:

- Encrypted media payload.
- Encrypted room chat lane.
- Encrypted private third chat lane.
- Role-specific chat visibility.
- Basic polling or refresh behavior.

### Phase 2C: Pro and Payments Foundation

Prepare recurring revenue:

- Subscription gates.
- Real coin wallet design.
- Adult-compatible processor evaluation.
- Legal page updates.
- Burn/revoke controls.

## Testing Strategy

Automated tests should cover:

- Gallery room accepts 1-6 valid images.
- Gallery room rejects zero images.
- Gallery room rejects more than 6 images.
- Role links contain the correct role labels and permissions.
- Partner cannot access private third chat.
- Third can request unlock when coin mode is request-only.
- Third cannot auto-unlock when creator-enabled unlock is off.
- Expiry is enforced.
- Classic LoveLock still renders.
- Phase 1 After Dark links still render or fail gracefully if superseded.

Browser QA should cover:

- Desktop creator flow.
- Mobile creator flow.
- Share view with multiple links.
- Partner viewer.
- Third viewer.
- Creator viewer.
- Chat panel layout on mobile.
- No horizontal overflow.
- No console errors.

## Open Decisions Resolved

- Phase 2 is accountless-first.
- After Dark Gallery Room replaces questions for this mode.
- Max image upload count is 6.
- There are at least two intended recipients: partner/cuck and third.
- The third seat can be open via link.
- Two chat lanes are required: all-room chat and creator-third private chat.
- Coin mechanics start as mock/request-first behavior.
- Creator remains the final gatekeeper.
