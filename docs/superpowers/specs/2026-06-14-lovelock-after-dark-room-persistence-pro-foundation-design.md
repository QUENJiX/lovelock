# LoveLock After Dark Room Persistence and Pro Foundation Design

Date: 2026-06-14

## Goal

Finish the remaining shippable foundations after the accountless Gallery Room prototype:

- **Phase 2B:** persist encrypted Gallery Room state across creator, partner, and third links.
- **Phase 2C:** add the Pro/payments foundation UI and policy groundwork without real accounts, real charges, or video.

This keeps LoveLock web-only and accountless-first while making rooms feel alive across role links.

## Explicit Scope

This pass includes:

- Persisted encrypted room chat.
- Persisted encrypted creator-third private chat.
- Persisted encrypted image reveal/relock/request state.
- Creator burn/revoke controls.
- Basic polling/refresh for room updates.
- Pro plan/gate surfaces.
- Mock coin wallet and paid-unlock readiness copy.
- Adult content policy updates in legal pages.

This pass does not include:

- Real account creation or login.
- Real subscriptions.
- Real payment processing.
- Real coin purchases.
- Video upload.
- Public discovery, profiles, feed, search, or marketplace.

## Persistence Model

The existing `locks` table remains the storage surface. Gallery Room state is stored by updating the same row's JSON `payload`.

Public metadata can remain readable:

- `surface`
- `title`
- `createdAt`
- `expiresInHours`
- `mediaCount`
- `coinMode`
- `scenario`
- `roles`
- `roomStatus`
- `revision`
- `updatedAt`

Sensitive state stays encrypted in `payload.encData`:

- Gallery media data.
- Room chat messages.
- Private third chat messages.
- Unlock requests.
- Per-image `state`.
- Per-image `visibleTo`.
- Creator note/settings.

The browser decrypts with the `roomKey` from the URL fragment, mutates local room state, re-encrypts the blob, and writes the updated `payload` back to Supabase.

## Conflict Behavior

This is a static-app prototype, so conflict handling is intentionally simple:

- Each persisted write increments `revision`.
- Polling fetches the latest payload and replaces local state when the remote revision is newer.
- If two people write at the same time, last write wins.
- The UI should phrase this as a lightweight guest room, not a guaranteed collaborative database.

## Polling

Gallery Room viewers should poll for updates on a short interval while a room is open.

Recommended behavior:

- Poll every 7 seconds.
- Do not poll after expiry or burn.
- Do not poll if the page is not on a Gallery Room link.
- If decrypting an update fails, keep the current local state and show a discreet sync warning.

## Role Writes

Allowed persisted writes:

- **Creator:** append room chat, append private third chat, approve requests, reveal images, relock images, burn/revoke the room.
- **Partner:** append room chat only.
- **Third:** append room chat, append private third chat, request unlocks, auto-unlock only when creator-enabled `coinMode` allows it.

Disallowed persisted writes:

- Partner cannot write private third chat.
- Partner cannot mutate gallery state.
- Third cannot approve, reveal, relock, or burn.
- Burned rooms cannot accept new chat or gallery writes.

## Burn/Revoke

Burn/revoke is a creator-only control.

Behavior:

- Set public `roomStatus` to `burned`.
- Replace encrypted room state with a minimal burned payload.
- Stop polling.
- Future visitors see a burned-room state.

Copy must say "disable access" or "burn room" rather than promising perfect deletion from every cache.

## Pro Foundation

The Pro foundation is UI and product scaffolding only.

Add:

- Pro plan cards for monthly and annual recurring plans.
- Feature gates beside premium controls.
- Coin wallet explanation.
- Disabled checkout buttons with adult-processor readiness copy.
- Pro value points:
  - Longer expiry.
  - More active rooms.
  - Burn/revoke history.
  - Saved role labels.
  - Larger media limits.
  - Future video vaults.
  - Premium scenario drops.

Do not imply that checkout is live.

## Legal and Policy Pages

Update legal pages enough for the current product direction:

- Adult-only use.
- All depicted people must be 18+.
- All media must be consensually created and shared.
- Hidden camera content is banned.
- Non-consensual voyeurism is banned.
- Revenge content is banned.
- Coercion, blackmail, threats, and forced sharing are banned.
- Third-party media requires every depicted person's consent.
- Mock coins and Pro plans are not live charges yet.

## UI Changes

Gallery Room viewer:

- Add a sync status line.
- Add creator-only burn/revoke card.
- Disable controls when room is burned or expired.
- Show a burned-room card instead of gallery/chat controls when burned.

After Dark creator/share:

- Add Pro foundation panel.
- Make the current coin controls clear as mock/payment-ready only.
- Keep all payment buttons disabled until real processing exists.

Legal pages:

- Add concise adult content and subscription-readiness sections.

## Testing Strategy

Automated helper tests should cover:

- Room messages append only to allowed lanes.
- Partner cannot append private third chat.
- Third can request unlock only in eligible coin modes.
- Creator can approve, reveal, relock, and burn.
- Burned rooms reject future state mutations.
- Persist metadata increments revision.
- Pro plan metadata is recurring and has no lifetime option.

Browser QA should cover:

- Gallery Room viewer still opens for creator, partner, and third.
- Room chat write updates the UI.
- Third private chat is hidden from partner.
- Third request persists in local state.
- Creator burn state hides gallery/chat controls.
- Pro plan cards render on desktop and mobile.
- No horizontal overflow.
- No console errors.

## Open Decisions Resolved

- Continue accountless-first.
- Use the existing `locks.payload` JSON row for persisted room state.
- Store sensitive room state encrypted in `encData`.
- Use last-write-wins conflict behavior for this phase.
- Build payment/Pro UI foundation only; no real money movement in this pass.
- Add policy/legal copy now before payment integration.
