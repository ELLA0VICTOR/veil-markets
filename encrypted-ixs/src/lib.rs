use arcis::*;

#[encrypted]
mod circuits {
    use arcis::*;

    #[derive(Copy, Clone)]
    pub struct MarketState {
        pub total_yes: u64,
        pub total_no: u64,
    }

    #[derive(Copy, Clone)]
    pub struct VoteInput {
        pub is_yes: bool,
        pub stake: u64,
    }

    #[derive(Copy, Clone)]
    pub struct ResolvedState {
        pub total_yes: u64,
        pub total_no: u64,
        pub yes_wins: bool,
    }

    #[instruction]
    pub fn init_market_state() -> Enc<Mxe, MarketState> {
        Mxe::get().from_arcis(MarketState {
            total_yes: 0,
            total_no: 0,
        })
    }

    #[instruction]
    pub fn init_user_balance(observer: Shared) -> (Enc<Mxe, u64>, Enc<Shared, u64>) {
        (Mxe::get().from_arcis(0u64), observer.from_arcis(0u64))
    }

    #[instruction]
    pub fn deposit_balance(
        amount: u64,
        balance: Enc<Mxe, u64>,
        observer: Shared,
    ) -> (Enc<Mxe, u64>, Enc<Shared, u64>) {
        let current = balance.to_arcis();
        let next_balance = current + amount;

        (
            balance.owner.from_arcis(next_balance),
            observer.from_arcis(next_balance),
        )
    }

    #[instruction]
    pub fn withdraw_balance(
        amount: u64,
        balance: Enc<Mxe, u64>,
        observer: Shared,
    ) -> (Enc<Mxe, u64>, Enc<Shared, u64>, bool) {
        let current = balance.to_arcis();
        let approved = current >= amount;
        let next_balance = if approved { current - amount } else { current };

        (
            balance.owner.from_arcis(next_balance),
            observer.from_arcis(next_balance),
            approved.reveal(),
        )
    }

    #[instruction]
    pub fn add_vote(
        vote: Enc<Shared, VoteInput>,
        state: Enc<Mxe, MarketState>,
        balance: Enc<Mxe, u64>,
        observer: Shared,
    ) -> (Enc<Mxe, MarketState>, Enc<Mxe, u64>, Enc<Shared, u64>, bool) {
        let v = vote.to_arcis();
        let mut s = state.to_arcis();
        let current_balance = balance.to_arcis();
        let accepted = current_balance >= v.stake && v.stake >= 10_000_000u64;
        let next_balance = if accepted {
            current_balance - v.stake
        } else {
            current_balance
        };

        if accepted {
            if v.is_yes {
                s.total_yes += v.stake;
            } else {
                s.total_no += v.stake;
            }
        }

        (
            state.owner.from_arcis(s),
            balance.owner.from_arcis(next_balance),
            observer.from_arcis(next_balance),
            accepted.reveal(),
        )
    }

    #[instruction]
    pub fn resolve_market_v2(
        state: Enc<Mxe, MarketState>,
        outcome_yes: u64,
    ) -> Enc<Mxe, ResolvedState> {
        let s = state.to_arcis();
        let yes_wins = outcome_yes > 0;

        Mxe::get().from_arcis(ResolvedState {
            total_yes: s.total_yes,
            total_no: s.total_no,
            yes_wins,
        })
    }

    #[instruction]
    pub fn claim_payout(
        vote: Enc<Shared, VoteInput>,
        settled: Enc<Mxe, ResolvedState>,
        balance: Enc<Mxe, u64>,
        observer: Shared,
    ) -> (Enc<Mxe, u64>, Enc<Shared, u64>) {
        let v = vote.to_arcis();
        let s = settled.to_arcis();
        let current_balance = balance.to_arcis();
        let winning_pool = if s.yes_wins { s.total_yes } else { s.total_no };
        let total_pool = s.total_yes + s.total_no;
        let won = v.is_yes == s.yes_wins;

        let payout = if won && winning_pool > 0 {
            ((v.stake as u128) * (total_pool as u128) / (winning_pool as u128)) as u64
        } else {
            0u64
        };

        let next_balance = current_balance + payout;

        (
            balance.owner.from_arcis(next_balance),
            observer.from_arcis(next_balance),
        )
    }
}
