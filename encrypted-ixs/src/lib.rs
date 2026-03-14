use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    // Persistent encrypted market state stored on-chain.
    // Two u64 fields → LEN = 2 → output type: MXEEncryptedStruct<2>
    #[derive(Copy, Clone)]
    pub struct MarketState {
        pub total_yes: u64,
        pub total_no: u64,
    }

    // Voter's encrypted bet. Enc<Shared, VoteInput>.
    // Two fields (bool + u64) → LEN = 2
    #[derive(Copy, Clone)]
    pub struct VoteInput {
        pub is_yes: bool,
        pub stake: u64,
    }

    // Resolved result returned to the resolver.
    // Enc<Shared, MarketResult> → SharedEncryptedStruct<3>
    #[derive(Copy, Clone)]
    pub struct MarketResult {
        pub total_yes: u64,
        pub total_no: u64,
        pub yes_wins: bool,
    }

    // ----------------------------------------------------------------
    // CIRCUIT 1: init_market_state
    // Called once per market creation. Produces MXE-encrypted zero state.
    // Generated output struct: InitMarketStateOutput { field_0: MXEEncryptedStruct<2> }
    // ----------------------------------------------------------------
    #[instruction]
    pub fn init_market_state() -> Enc<Mxe, MarketState> {
        Mxe::get().from_arcis(MarketState {
            total_yes: 0,
            total_no: 0,
        })
    }

    // ----------------------------------------------------------------
    // CIRCUIT 2: add_vote
    // Adds an encrypted vote to the encrypted running total.
    // vote: Enc<Shared, VoteInput> — voter's encrypted direction + stake
    // state: Enc<Mxe, MarketState> — current encrypted running total
    // Returns updated encrypted state.
    // Generated: AddVoteOutput { field_0: MXEEncryptedStruct<2> }
    // ----------------------------------------------------------------
    #[instruction]
    pub fn add_vote(
        vote: Enc<Shared, VoteInput>,
        state: Enc<Mxe, MarketState>,
    ) -> Enc<Mxe, MarketState> {
        let v = vote.to_arcis();
        let mut s = state.to_arcis();

        // CRITICAL ARCIS NOTE: Both branches ALWAYS execute in MPC.
        // The secret condition (v.is_yes) selects which result is kept.
        // This is correct and intentional — do NOT restructure this logic.
        if v.is_yes {
            s.total_yes += v.stake;
        } else {
            s.total_no += v.stake;
        }

        // from_arcis MUST be called outside any if/else block
        state.owner.from_arcis(s)
    }

    // ----------------------------------------------------------------
    // CIRCUIT 3: resolve_market
    // Decrypts the encrypted vote totals and returns them to the resolver.
    // state: Enc<Mxe, MarketState> — final encrypted market state
    // observer: Shared — resolver's x25519 public key
    // ----------------------------------------------------------------
    #[instruction]
    pub fn resolve_market(
        state: Enc<Mxe, MarketState>,
        observer: Shared,
    ) -> Enc<Shared, MarketResult> {
        let s = state.to_arcis();
        let yes_wins = s.total_yes > s.total_no;

        // from_arcis outside any conditional (Arcis constraint)
        observer.from_arcis(MarketResult {
            total_yes: s.total_yes,
            total_no: s.total_no,
            yes_wins,
        })
    }
}
