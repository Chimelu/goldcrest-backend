# Wallet, holdings, and trading (backend model)

This matches the **Goldcrest mobile** screens: Home “total balance”, Wallet “USD cash + crypto balances”, Trade “available USD / you hold”, and a future **history** list.

## Concepts

| UI idea | Backend |
|--------|---------|
| **USD cash** (available for buys) | `user_wallets.available_usd` |
| **Crypto you own** (BTC, ETH, …) | One row per user + symbol in `crypto_holdings` |
| **Buy / Sell** | Atomic updates to wallet + holding + append-only `account_transactions` row |
| **Deposit / Withdraw** | Same `account_transactions` kinds; later wire to payments / chain |
| **History** | Query `account_transactions` ordered by `created_at` |

**Prices** (CoinGecko, etc.) stay **outside** the ledger: the API stores **executed** `unit_price_usd` on each trade row for history and P&amp;L later. **Live** portfolio USD value can be computed on the server or client using current quotes × `crypto_holdings.quantity`.

## Tables (ER overview)

```
users
  └── user_wallets (1:1)     — fiat balance only
  └── crypto_holdings (1:N)  — quantity per symbol
  └── account_transactions (1:N) — immutable audit trail

tradable_assets (catalog, no user FK)
```

### `user_wallets`
| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| user_id | FK users, UNIQUE | One wallet row per user |
| available_usd | DECIMAL(18,2) | “USD cash” in the app |

### `crypto_holdings`
| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| user_id | FK users | |
| symbol | VARCHAR(20) | e.g. `BTC` — UNIQUE with user_id |
| quantity | DECIMAL(36,18) | Amount owned |

### `account_transactions`
| Column | Type | Notes |
|--------|------|--------|
| id | PK | |
| user_id | FK users | |
| kind | VARCHAR | `BUY` \| `SELL` \| `DEPOSIT` \| `WITHDRAW` |
| status | VARCHAR | `PENDING` \| `COMPLETED` \| `FAILED` |
| crypto_symbol | nullable | |
| crypto_amount | nullable | Filled qty for trades |
| unit_price_usd | nullable | Snapshot at execution |
| gross_usd | DECIMAL | Notional / deposit amount |
| fee_usd | DECIMAL | |
| idempotency_key | nullable, UNIQUE | For safe retries |

### `tradable_assets`
| Column | Type | Notes |
|--------|------|--------|
| symbol | UNIQUE | Validates server-side trades |
| name | | |
| coingecko_id | nullable | For server price checks later |
| is_active | bool | |

## API (implemented)

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/portfolio/summary` | Bearer JWT | `availableUsd` + `holdings[]` |
| POST | `/portfolio/buy` | Bearer JWT | Body `{ "symbol": "BTC", "spendUsd": 100 }` — server fetches CoinGecko USD price, debits wallet, credits `crypto_holdings` |
| POST | `/portfolio/sell` | Bearer JWT | Body `{ "symbol": "BTC", "cryptoAmount": 0.01 }` — credits USD, debits holding |
| GET | `/portfolio/transactions?limit=` | Bearer JWT | History rows |

**Tradable symbols** are inserted on API startup (`ensureTradableAssetsSeeded`) so `BTC`, `ETH`, etc. exist without manual steps. You can also run `npm run seed:tradable`. Buy/sell use the **CoinGecko** `simple/price` API (no key for light use).

**Wallet row is not created at sign-up.** It is created lazily on the first authenticated `GET /portfolio/summary` (e.g. when the user opens Trade, Home, or Wallet and the app calls the API). Older users without a row get one via the same `findOrCreate`.

Seed catalog: set `SEED_TRADABLE_ASSETS=true` once on server start, or run `npm run seed:tradable`.

Buy/sell execution: implement in `src/services/trade/marketOrder.ts` (stub) using a DB transaction.

## Why not one “wallet” table for everything?

You *can* model USD and BTC as rows in a single `balances (user_id, asset, amount)` table (exchange-style). The split here (`user_wallets` + `crypto_holdings`) mirrors your UI copy (“USD cash” vs “crypto balances”) and keeps fiat precision separate from large-decimal crypto amounts.

## Trade flow (server-side, later)

1. Validate symbol (optional: against `tradable_assets`).
2. Fetch or accept **snapshot price** for the request (client shows quote; server re-validates band or uses same oracle).
3. **`sequelize.transaction()`**:
   - **Buy**: decrease `available_usd` by `cost + fee`; upsert `crypto_holdings`; insert `account_transactions` (`BUY`).
   - **Sell**: decrease holding; increase `available_usd` by `proceeds - fee`; insert `account_transactions` (`SELL`).
4. Never mutate balances without a matching transaction row (audit).

## Mobile `assetId` vs API

The app currently uses UUID `assetId` from `tradingAssets.ts`. The API uses **`symbol`** (`BTC`, `ETH`, …) as the stable key. Map UUID → symbol in the client when calling the API, or add `client_asset_id` to `tradable_assets` later.
