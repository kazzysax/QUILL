/** Sample articles written by the Quill team so a fresh install has something to read. Accurate to the best of our knowledge; not financial or legal advice. */
export interface SeedArticle { title: string; summary: string; tags: string; priceUsdc: number; body: string }

export const SEED_ARTICLES: SeedArticle[] = [
  {
    title: 'Why your Solana transaction expired, and how to stop it',
    summary: 'Every transaction carries a recent blockhash that is only valid for about 150 blocks. Here is how expiry works and how to handle it.',
    tags: 'transactions,blockhash,reliability',
    priceUsdc: 0.02,
    body: `A Solana transaction names a recent blockhash. The network only accepts the transaction while that blockhash is still recent, which is roughly 150 blocks, about 60 to 90 seconds in practice. After that the transaction can never land, no matter how many validators you send it to.

This is a feature. The blockhash acts as a time-limited replay guard: a signed transaction cannot be replayed forever, and the network does not have to remember every signature for all time.

How to handle it. Fetch the blockhash together with its lastValidBlockHeight, using getLatestBlockhash. Build, sign and send the transaction. Then poll the block height. Once the current block height passes lastValidBlockHeight and the signature has not been confirmed, the transaction is dead and you can safely build a new one with a fresh blockhash.

Do not rebuild and resend too early. If you create a second transaction with a new blockhash while the first is still valid, both can land, and the user pays twice.

Use the commitment level you actually need. Fetching the blockhash at confirmed commitment and confirming at confirmed is usually the right balance for wallets and apps. Setting skipPreflight to true does not extend the lifetime; it only skips the simulation.

For flows that need more time, such as multisig approvals or offline signing, use a durable nonce. A durable nonce account stores a nonce value that replaces the recent blockhash, so the transaction stays valid until the nonce is advanced. The first instruction of such a transaction must be AdvanceNonceAccount.

Typical symptoms of expiry are the errors "Blockhash not found" or "block height exceeded". Retrying the same signed bytes will not help after expiry; sign again with a new blockhash.`,
  },
  {
    title: 'Priority fees and compute units: getting transactions landed',
    summary: 'How the base fee, compute unit limit and compute unit price combine, and how to set them without overpaying.',
    tags: 'fees,compute-budget,transactions',
    priceUsdc: 0.02,
    body: `Every Solana transaction pays a base fee of 5,000 lamports per signature. On top of that you can pay a priority fee to be scheduled ahead of other transactions when blocks are busy.

The priority fee is not a flat number. It is the compute unit price, set in micro-lamports per compute unit, multiplied by the compute unit limit your transaction requests. Both are set with instructions from the Compute Budget program: SetComputeUnitLimit and SetComputeUnitPrice. They should be the first instructions in the transaction.

The default limit is 200,000 compute units per instruction, with a hard maximum of 1,400,000 per transaction. A simple transfer uses only a few thousand units. If you leave the default limit in place you are asking for, and paying a priority fee on, far more compute than you use.

The practical recipe: simulate the transaction first and read the units consumed. Set the limit to that number plus a margin, around 10 percent. Then choose the price from recent data, for example the getRecentPrioritizationFees RPC method or your RPC provider's fee estimate, aimed at the accounts your transaction writes to. Fees are local to contended accounts, so a busy token pool needs a higher price than a quiet wallet transfer.

Two common mistakes. First, setting the limit too low: the transaction fails with a compute budget exceeded error and the fee is still charged. Second, setting a very high price in micro-lamports without doing the multiplication: price times limit divided by one million gives the lamports you will pay on top of the base fee.

Priority fees improve the chance of landing but do not guarantee it. A transaction with an expired blockhash will still fail whatever you pay.`,
  },
  {
    title: 'Program Derived Addresses in five minutes',
    summary: 'What a PDA is, why it has no private key, and how programs use them to own accounts and sign.',
    tags: 'pda,programs,anchor',
    priceUsdc: 0.02,
    body: `A Program Derived Address, or PDA, is an address that belongs to a program instead of a keypair. You compute it from a set of seeds, a program ID, and a bump value. Anyone can recompute the same address from the same inputs, so PDAs work like a deterministic lookup table: the seeds are the key, the account is the value.

A PDA is deliberately chosen to fall off the ed25519 curve. Ordinary addresses are public keys with a matching private key. A point that is not on the curve has no private key at all, so no one can sign for it with a wallet. That is the security property: only the program that derived it can authorise actions for it.

The derivation tries a bump value, starting at 255 and counting down, until the result is off the curve. The first bump that works is the canonical bump. Store it, or recompute it, and always use the canonical one so there is exactly one valid address for a given set of seeds.

Programs use PDAs in two ways. As account addresses, for example one account per user per pool, found by seeds like the string "vault" plus the user's wallet. And as signers: when a program calls another program, it can sign for its PDA by supplying the seeds, using invoke_signed. This is how a program can own and move tokens held in a vault without any private key existing.

Practical tips. Keep seeds short and unambiguous, because a poorly separated seed layout can let two different inputs derive the same address. Validate the PDA inside the program rather than trusting an address passed by the client. And remember that deriving an address does not create it; the account still has to be initialised and funded for rent.`,
  },
  {
    title: 'Why your first USDC transfer to a new wallet fails',
    summary: 'Token balances live in token accounts, not in the wallet. Associated Token Accounts explain the extra account, the rent and the fix.',
    tags: 'tokens,usdc,ata',
    priceUsdc: 0.03,
    body: `A Solana wallet does not hold tokens directly. Each token balance lives in a separate token account that records the mint, the owner and the amount. To receive USDC, a wallet needs a USDC token account.

The Associated Token Account, or ATA, is the standard one. Its address is derived from three things: the wallet address, the token program, and the mint. Given a wallet and a mint, everyone computes the same address, which is why senders can find where to send without asking.

The catch is that the ATA must exist before tokens can arrive. If the recipient has never held that token, the account does not exist yet, and a plain transfer to that address fails. The fix is to create it first, using the Associated Token Account program's create instruction, in the same transaction as the transfer.

The create_idempotent variant is the safest choice: it creates the account if it is missing and succeeds quietly if it already exists, so you do not need to check first. Someone has to pay for the account. A token account is 165 bytes and needs about 0.00203928 SOL as a rent-exempt deposit, usually paid by the sender or by the app.

Things to remember. Token-2022 mints use a different token program, so the ATA address differs for the same wallet and mint; always pass the right token program when deriving. And in payment flows that restrict what a payment transaction may contain, the recipient's ATA may need to exist already, because the transaction cannot include an account-creation instruction. That is why a merchant or a writer should receive a small first deposit before accepting payments.`,
  },
  {
    title: 'Versioned transactions and address lookup tables',
    summary: 'Why transactions hit a 1,232 byte ceiling and how lookup tables let you reference many accounts cheaply.',
    tags: 'transactions,alt,performance',
    priceUsdc: 0.02,
    body: `A Solana transaction must fit in a single network packet, which limits its serialized size to 1,232 bytes. Every account a transaction touches is listed with its 32-byte address, so complex operations, such as a swap routed through several pools, can run out of space before they run out of compute.

Address lookup tables, or ALTs, solve this. An ALT is an on-chain account that stores a list of addresses. A transaction can then refer to an address by its 1-byte index into the table instead of including all 32 bytes. A table can hold up to 256 addresses.

Using them requires the newer transaction format, called a versioned transaction, version 0. Legacy transactions cannot reference lookup tables. When you read transactions from an RPC, pass maxSupportedTransactionVersion set to 0, otherwise requests for version 0 transactions fail.

How to use an ALT in practice. Create the table with the Address Lookup Table program, extend it with the addresses you reuse, wait a slot or two for the new addresses to become usable, then compile your message as a v0 message that lists the table. Wallets must support v0 to sign it.

Limits worth knowing. Accounts that sign the transaction must be included directly in the message, because signer accounts cannot come from a lookup table. Tables are not free to create, since the table account needs rent, though it can be closed again when you no longer need it.

If you are building a router, a bot or any multi-step instruction, ALTs are usually the first optimisation to reach for when the transaction is too large.`,
  },
  {
    title: 'x402 on Solana: how an agent pays for one HTTP request',
    summary: 'The HTTP 402 payment flow, what a facilitator does, and why it suits software that buys data per call.',
    tags: 'x402,agents,payments',
    priceUsdc: 0.03,
    body: `x402 turns the old HTTP status code 402, Payment Required, into a working payment protocol. A client asks for a resource. If it costs money, the server answers with 402 and a payment requirement: the price, the asset, the network, and the address to pay.

On Solana the asset is usually USDC. The client builds a transaction that transfers exactly the requested amount of USDC to the seller's token account and signs it as the token owner. It does not submit the transaction itself. It attaches the partially signed transaction to a retry of the same request in a payment header.

A facilitator then does the heavy lifting. The seller sends the payment to the facilitator to verify, which checks the transaction layout, the mint, the amount, the destination and the fee payer. Once the seller is satisfied, the facilitator settles it: it adds its own signature as the fee payer, submits the transaction to the network, and reports the result. Because the facilitator pays the network fee, the buyer only needs USDC, not SOL.

The exact scheme is strict on purpose. It expects specific instructions, compute budget settings followed by one token transfer, and rejects transactions with more than one matching transfer, which prevents ambiguous or double payments.

Why it suits AI agents. An agent cannot fill in a checkout form or hold an account with every data provider. With x402 it needs only a wallet and a spending limit. It can pay a fraction of a cent for a single answer, and the seller gets paid per use with no signup, no API key and no invoicing. Settlement on Solana takes a second or two and costs a tiny fee, so very small prices are practical.

Good client practice: set a per-payment cap and a daily budget, never let an agent hold more than it can afford to lose, and log every payment with its transaction signature so spending can be audited.`,
  },
  {
    title: 'Token-2022: the extensions that change how your app behaves',
    summary: 'Token-2022 adds optional features to tokens. Know which ones affect transfers, balances and integrations before you accept a mint.',
    tags: 'tokens,token-2022,security',
    priceUsdc: 0.03,
    body: `Token-2022, also called Token Extensions, is a second token program with the same core idea as the original SPL Token program, plus optional extensions chosen when the mint is created. Its program ID is TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb, different from the original TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA.

For an app developer the important point is that extensions can change what a transfer does. A few that matter.

Transfer fee. A fee, in basis points up to a cap, is withheld on each transfer. The recipient receives less than the sender sent, so never assume received equals sent.

Non-transferable. The token cannot be moved once issued, which is useful for credentials, but it breaks any flow that expects to transfer it.

Permanent delegate. The issuer can move or burn tokens from any holder. Treat such tokens as higher risk.

Transfer hook. A custom program runs on every transfer, so a transfer needs extra accounts and can fail for reasons your code did not expect.

Interest-bearing. The displayed balance can differ from the raw amount, so convert with the mint's configuration rather than only decimals.

Memo required. Incoming transfers must include a memo.

How to integrate safely. Detect which program owns the mint and use the matching program ID when deriving associated token accounts, since the address differs between the two programs. Read the mint's extensions before accepting a token. Use TransferChecked, which verifies the mint and decimals, instead of the older plain transfer. And in tests, include at least one token with a transfer fee, because it exposes assumptions that plain tokens hide.

Most stablecoins such as USDC on Solana use the original token program, but your code should not assume that for every token.`,
  },
  {
    title: 'Reading wallet history from Solana without getting rate limited',
    summary: 'A practical recipe for pulling transaction history: signatures first, then batched parsed transactions, with backoff and cursors.',
    tags: 'rpc,indexing,rate-limits',
    priceUsdc: 0.03,
    body: `Solana RPC has no single call that returns a wallet's full transaction history with details. The usual recipe has two stages.

First, list signatures with getSignaturesForAddress. It returns up to 1,000 per call, newest first, and supports before and until to page backwards or to stop at a known point. Each entry has the signature, slot, block time, and an error field that is null for successful transactions. Skip failed transactions early if you only care about transfers.

Second, fetch the transactions you actually need with getTransaction. Request jsonParsed encoding so transfers come back as readable instructions, and set maxSupportedTransactionVersion to 0 so versioned transactions are not rejected. Look in inner instructions too, because many transfers happen inside other programs.

Staying within limits. Public endpoints rate limit aggressively, so use a dedicated provider for anything real. Fetch transactions with a small concurrency, for example 4 to 8 at a time, rather than all at once. When you receive a 429 or a timeout, back off exponentially with jitter and retry. Cache results by signature: a confirmed transaction never changes, so it should be fetched once.

For ongoing monitoring use a subscription rather than polling. A logs subscription filtered by an address notifies you when a transaction mentions it. Remember that a token transfer into an existing token account may not mention the owner's wallet address, so subscribe to the token accounts as well. Keep a cursor, the last signature you processed, so after a dropped connection you can call getSignaturesForAddress with until set to the cursor and catch up on anything you missed.

Finally, decide what block time means for your logic. Block time can be null for old data, and confirmed data can be less final than finalized. Pick the commitment level on purpose.`,
  },
];
