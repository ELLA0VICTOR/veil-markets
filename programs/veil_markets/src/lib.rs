use anchor_lang::prelude::*;
use anchor_lang::system_program;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::*;

declare_id!("6Yzx9fKe52tqhKmV81rTmDGH4hXFgiPKU9T5TgPezemR");

const COMP_DEF_OFFSET_INIT_MARKET_STATE: u32 = comp_def_offset("init_market_state");
const COMP_DEF_OFFSET_ADD_VOTE: u32 = comp_def_offset("add_vote");
const COMP_DEF_OFFSET_RESOLVE_MARKET: u32 = comp_def_offset("resolve_market");

const CLUSTER_OFFSET: u64 = 456;
const MIN_BET_LAMPORTS: u64 = 10_000_000; // 0.01 SOL

fn init_market_state_circuit_url() -> String {
    option_env!("VEIL_INIT_MARKET_STATE_CIRCUIT_URL")
        .unwrap_or("https://example.invalid/veil/init_market_state.arcis")
        .to_string()
}

fn add_vote_circuit_url() -> String {
    option_env!("VEIL_ADD_VOTE_CIRCUIT_URL")
        .unwrap_or("https://example.invalid/veil/add_vote.arcis")
        .to_string()
}

fn resolve_market_circuit_url() -> String {
    option_env!("VEIL_RESOLVE_MARKET_CIRCUIT_URL")
        .unwrap_or("https://example.invalid/veil/resolve_market.arcis")
        .to_string()
}

#[arcium_program]
pub mod veil_markets {
    use super::*;

    // ----------------------------------------------------------------
    // COMP DEF INIT INSTRUCTIONS
    // Call once each after deployment
    // ----------------------------------------------------------------

    pub fn init_init_market_state_comp_def(
        ctx: Context<InitInitMarketStateCompDef>,
    ) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: init_market_state_circuit_url(),
                hash: circuit_hash!("init_market_state"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn init_add_vote_comp_def(ctx: Context<InitAddVoteCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: add_vote_circuit_url(),
                hash: circuit_hash!("add_vote"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn init_resolve_market_comp_def(ctx: Context<InitResolveMarketCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: resolve_market_circuit_url(),
                hash: circuit_hash!("resolve_market"),
            })),
            None,
        )?;
        Ok(())
    }

    // ----------------------------------------------------------------
    // CREATE MARKET
    // ----------------------------------------------------------------

    pub fn create_market(
        ctx: Context<CreateMarket>,
        computation_offset: u64,
        question: [u8; 280],
        end_time: i64,
        initial_pool_lamports: u64,
        is_polymarket: bool,
        polymarket_condition_id: [u8; 32],
    ) -> Result<()> {
        let clock = Clock::get()?;
        require!(
            end_time > clock.unix_timestamp,
            VeilError::InvalidEndTime
        );

        if initial_pool_lamports > 0 {
            require!(
                ctx.accounts.creator.lamports() >= initial_pool_lamports,
                VeilError::BelowMinimumStake
            );
        }

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question;
        market.end_time = end_time;
        market.status = 0; // initializing
        market.is_polymarket = is_polymarket;
        market.polymarket_condition_id = polymarket_condition_id;
        market.total_sol_pool = initial_pool_lamports;
        market.vote_count = 0;
        market.state_nonce = 0;
        market.state_ct_yes = [0u8; 32];
        market.state_ct_no = [0u8; 32];
        market.result_encryption_key = [0u8; 32];
        market.result_nonce = 0;
        market.result_ct_total_yes = [0u8; 32];
        market.result_ct_total_no = [0u8; 32];
        market.result_ct_yes_wins = [0u8; 32];
        market.yes_wins = false;
        market.plaintext_total_yes = 0;
        market.plaintext_total_no = 0;
        market.result_published = false;
        market.bump = ctx.bumps.market;

        if initial_pool_lamports > 0 {
            let cpi_context = CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.creator.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            );
            system_program::transfer(cpi_context, initial_pool_lamports)?;
        }

        // Queue init_market_state MPC computation (no inputs needed)
        let callback_ix = <InitMarketStateCallback as CallbackCompAccs>::callback_ix(computation_offset, &ctx.accounts.mxe_account, &[CallbackAccount { pubkey: ctx.accounts.market.key(), is_writable: true }])?;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new().build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    // ----------------------------------------------------------------
    // CREATE MARKET CALLBACK
    // ----------------------------------------------------------------

    #[arcium_callback(encrypted_ix = "init_market_state")]
    pub fn init_market_state_callback(
        ctx: Context<InitMarketStateCallback>,
        output: SignedComputationOutputs<InitMarketStateOutput>,
    ) -> Result<()> {
        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(InitMarketStateOutput { field_0 }) => {
                let market = &mut ctx.accounts.market;
                market.state_nonce = field_0.nonce;
                market.state_ct_yes = field_0.ciphertexts[0];
                market.state_ct_no = field_0.ciphertexts[1];
                market.status = 1; // open
            }
            Err(_) => return err!(VeilError::AbortedComputation),
        }
        Ok(())
    }

    // ----------------------------------------------------------------
    // PLACE VOTE
    // ----------------------------------------------------------------

    pub fn place_vote(
        ctx: Context<PlaceVote>,
        computation_offset: u64,
        vote_nonce: u128,
        vote_is_yes_ct: [u8; 32],
        vote_stake_ct: [u8; 32],
        voter_pub_key: [u8; 32],
        stake_amount: u64,
        is_yes_reveal: bool,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(market.status == 1, VeilError::MarketNotOpen);
        // Market must still be open (current time before end_time)
        require!(
            Clock::get()?.unix_timestamp < market.end_time,
            VeilError::MarketStillActive
        );
        require!(stake_amount >= MIN_BET_LAMPORTS, VeilError::BelowMinimumStake);

        // Transfer stake from voter to vault
        let cpi_context = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.voter.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
            },
        );
        system_program::transfer(cpi_context, stake_amount)?;

        market.total_sol_pool += stake_amount;
        market.vote_count += 1;

        // Initialize position
        let position = &mut ctx.accounts.position;
        position.market = market.key();
        position.voter = ctx.accounts.voter.key();
        position.stake = stake_amount;
        position.is_yes = is_yes_reveal;
        position.has_claimed = false;
        position.bump = ctx.bumps.position;

        // Capture state values for ArgBuilder before market borrow ends
        let state_nonce = market.state_nonce;
        let state_ct_yes = market.state_ct_yes;
        let state_ct_no = market.state_ct_no;

        // Queue add_vote MPC computation
        let callback_ix = <AddVoteCallback as CallbackCompAccs>::callback_ix(computation_offset, &ctx.accounts.mxe_account, &[CallbackAccount { pubkey: ctx.accounts.market.key(), is_writable: true }])?;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                // vote: Enc<Shared, VoteInput> — pubkey, nonce, then fields in order (is_yes, stake)
                .x25519_pubkey(voter_pub_key)
                .plaintext_u128(vote_nonce)
                .encrypted_bool(vote_is_yes_ct)
                .encrypted_u64(vote_stake_ct)
                // state: Enc<Mxe, MarketState> — nonce, then fields (total_yes, total_no)
                .plaintext_u128(state_nonce)
                .encrypted_u64(state_ct_yes)
                .encrypted_u64(state_ct_no)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    // ----------------------------------------------------------------
    // ADD VOTE CALLBACK
    // ----------------------------------------------------------------

    #[arcium_callback(encrypted_ix = "add_vote")]
    pub fn add_vote_callback(
        ctx: Context<AddVoteCallback>,
        output: SignedComputationOutputs<AddVoteOutput>,
    ) -> Result<()> {
        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(AddVoteOutput { field_0 }) => {
                let market = &mut ctx.accounts.market;
                market.state_nonce = field_0.nonce;
                market.state_ct_yes = field_0.ciphertexts[0];
                market.state_ct_no = field_0.ciphertexts[1];
            }
            Err(_) => return err!(VeilError::AbortedComputation),
        }
        Ok(())
    }

    // ----------------------------------------------------------------
    // RESOLVE MARKET
    // ----------------------------------------------------------------

    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        computation_offset: u64,
        resolver_pub_key: [u8; 32],
        resolver_nonce: u128,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(market.status == 1, VeilError::MarketNotOpen);
        require!(
            Clock::get()?.unix_timestamp >= market.end_time,
            VeilError::MarketStillActive
        );

        market.status = 2; // resolving

        let state_nonce = market.state_nonce;
        let state_ct_yes = market.state_ct_yes;
        let state_ct_no = market.state_ct_no;

        let callback_ix = <ResolveMarketCallback as CallbackCompAccs>::callback_ix(computation_offset, &ctx.accounts.mxe_account, &[CallbackAccount { pubkey: ctx.accounts.market.key(), is_writable: true }])?;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                // state: Enc<Mxe, MarketState>
                .plaintext_u128(state_nonce)
                .encrypted_u64(state_ct_yes)
                .encrypted_u64(state_ct_no)
                // observer: SharedEncrypted<Resolver, ResultSummary>
                .x25519_pubkey(resolver_pub_key)
                .plaintext_u128(resolver_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    // ----------------------------------------------------------------
    // RESOLVE MARKET CALLBACK
    // ----------------------------------------------------------------

    #[arcium_callback(encrypted_ix = "resolve_market")]
    pub fn resolve_market_callback(
        ctx: Context<ResolveMarketCallback>,
        output: SignedComputationOutputs<ResolveMarketOutput>,
    ) -> Result<()> {
        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ResolveMarketOutput { field_0 }) => {
                let market = &mut ctx.accounts.market;
                // field_0 is SharedEncryptedStruct<3>
                market.result_encryption_key = field_0.encryption_key;
                market.result_nonce = field_0.nonce;
                market.result_ct_total_yes = field_0.ciphertexts[0];
                market.result_ct_total_no = field_0.ciphertexts[1];
                market.result_ct_yes_wins = field_0.ciphertexts[2];
                // status stays 2 (resolving) until publish_result is called
            }
            Err(_) => return err!(VeilError::AbortedComputation),
        }
        Ok(())
    }

    // ----------------------------------------------------------------
    // PUBLISH RESULT
    // ----------------------------------------------------------------

    pub fn publish_result(
        ctx: Context<PublishResult>,
        yes_wins: bool,
        total_yes_lamports: u64,
        total_no_lamports: u64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;

        require!(market.status == 2, VeilError::MarketNotResolvable);
        require!(!market.result_published, VeilError::AlreadyClaimed);

        // For custom markets, only creator can publish
        if !market.is_polymarket {
            require!(
                ctx.accounts.authority.key() == market.creator,
                VeilError::Unauthorized
            );
        }

        market.yes_wins = yes_wins;
        market.plaintext_total_yes = total_yes_lamports;
        market.plaintext_total_no = total_no_lamports;
        market.result_published = true;
        market.status = 3; // settled

        Ok(())
    }

    // ----------------------------------------------------------------
    // CLAIM WINNINGS
    // ----------------------------------------------------------------

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;

        require!(
            market.status == 3 && market.result_published,
            VeilError::MarketNotSettled
        );
        require!(!position.has_claimed, VeilError::AlreadyClaimed);

        let voter_won = position.is_yes == market.yes_wins;
        require!(voter_won, VeilError::NotAWinner);

        let winning_pool = if market.yes_wins {
            market.plaintext_total_yes
        } else {
            market.plaintext_total_no
        };
        let total_pool = market.total_sol_pool;

        // voter_share = stake * total_pool / winning_pool
        let voter_share = (position.stake as u128)
            .checked_mul(total_pool as u128)
            .unwrap()
            .checked_div(winning_pool as u128)
            .unwrap() as u64;

        // Transfer from vault PDA to voter using invoke_signed.
        // vault seeds: [b"vault", market.key()]
        let market_key = market.key();
        let vault_bump = ctx.bumps.vault;
        let vault_seeds: &[&[u8]] = &[b"vault", market_key.as_ref(), &[vault_bump]];
        let signer_seeds = &[vault_seeds];

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.voter.to_account_info(),
            },
            signer_seeds,
        );
        system_program::transfer(cpi_context, voter_share)?;

        position.has_claimed = true;

        Ok(())
    }
}

// ----------------------------------------------------------------
// ACCOUNT STRUCTURES
// ----------------------------------------------------------------

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    pub question: [u8; 280],
    pub end_time: i64,
    pub status: u8, // 0=initializing,1=open,2=resolving,3=settled
    pub is_polymarket: bool,
    pub polymarket_condition_id: [u8; 32],
    pub total_sol_pool: u64,
    pub vote_count: u32,
    // Encrypted MarketState from Arcium MPC
    pub state_nonce: u128,
    pub state_ct_yes: [u8; 32],
    pub state_ct_no: [u8; 32],
    // Resolver's encrypted result
    pub result_encryption_key: [u8; 32],
    pub result_nonce: u128,
    pub result_ct_total_yes: [u8; 32],
    pub result_ct_total_no: [u8; 32],
    pub result_ct_yes_wins: [u8; 32],
    // Published plaintext result
    pub yes_wins: bool,
    pub plaintext_total_yes: u64,
    pub plaintext_total_no: u64,
    pub result_published: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub voter: Pubkey,
    pub stake: u64,
    pub is_yes: bool,
    pub has_claimed: bool,
    pub bump: u8,
}

// ----------------------------------------------------------------
// CONTEXT STRUCTS
// ----------------------------------------------------------------

#[init_computation_definition_accounts("init_market_state", payer)]
#[derive(Accounts)]
pub struct InitInitMarketStateCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut)]
    /// CHECK: Computation definition PDA is created and validated by the Arcium program during init.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Lookup table account is derived and validated by the LUT program / Arcium CPI flow.
    pub address_lookup_table: UncheckedAccount<'info>,
    /// CHECK: This is the lookup table program account passed through to Arcium validation.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("add_vote", payer)]
#[derive(Accounts)]
pub struct InitAddVoteCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut)]
    /// CHECK: Computation definition PDA is created and validated by the Arcium program during init.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Lookup table account is derived and validated by the LUT program / Arcium CPI flow.
    pub address_lookup_table: UncheckedAccount<'info>,
    /// CHECK: This is the lookup table program account passed through to Arcium validation.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[init_computation_definition_accounts("resolve_market", payer)]
#[derive(Accounts)]
pub struct InitResolveMarketCompDef<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut)]
    /// CHECK: Computation definition PDA is created and validated by the Arcium program during init.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Lookup table account is derived and validated by the LUT program / Arcium CPI flow.
    pub address_lookup_table: UncheckedAccount<'info>,
    /// CHECK: This is the lookup table program account passed through to Arcium validation.
    pub lut_program: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("init_market_state", creator)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", creator.key().as_ref(), &computation_offset.to_le_bytes()],
        bump,
    )]
    pub market: Account<'info, Market>,
    /// CHECK: vault PDA for holding SOL
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        init_if_needed,
        payer = creator,
        space = 8 + 1,
        seeds = [SIGN_PDA_SEED],
        bump,
    )]
    pub sign_pda_account: Account<'info, ArciumSignerAccount>,
    #[account(mut)]
    /// CHECK: Mempool PDA is owned and validated by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Executing pool PDA is owned and validated by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut)]
    /// CHECK: Computation PDA is derived and validated by the Arcium program for this offset.
    pub computation_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[callback_accounts("init_market_state")]
#[derive(Accounts)]
pub struct InitMarketStateCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: instructions sysvar
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[queue_computation_accounts("add_vote", voter)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct PlaceVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,
    /// CHECK: vault PDA verified by seeds
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(
        init,
        payer = voter,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", market.key().as_ref(), voter.key().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, Position>>,
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + 1,
        seeds = [SIGN_PDA_SEED],
        bump,
    )]
    pub sign_pda_account: Box<Account<'info, ArciumSignerAccount>>,
    #[account(mut)]
    /// CHECK: Mempool PDA is owned and validated by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Executing pool PDA is owned and validated by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut)]
    /// CHECK: Computation PDA is derived and validated by the Arcium program for this offset.
    pub computation_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub cluster_account: Box<Account<'info, Cluster>>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Box<Account<'info, FeePool>>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Box<Account<'info, ClockAccount>>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[callback_accounts("add_vote")]
#[derive(Accounts)]
pub struct AddVoteCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: instructions sysvar
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[queue_computation_accounts("resolve_market", resolver)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(
        init_if_needed,
        payer = resolver,
        space = 8 + 1,
        seeds = [SIGN_PDA_SEED],
        bump,
    )]
    pub sign_pda_account: Box<Account<'info, ArciumSignerAccount>>,
    #[account(mut)]
    /// CHECK: Mempool PDA is owned and validated by the Arcium program.
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Executing pool PDA is owned and validated by the Arcium program.
    pub executing_pool: UncheckedAccount<'info>,
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    #[account(mut)]
    /// CHECK: Computation PDA is derived and validated by the Arcium program for this offset.
    pub computation_account: UncheckedAccount<'info>,
    #[account(mut)]
    pub cluster_account: Box<Account<'info, Cluster>>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Box<Account<'info, FeePool>>,
    #[account(mut, address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Box<Account<'info, ClockAccount>>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[callback_accounts("resolve_market")]
#[derive(Accounts)]
pub struct ResolveMarketCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: instructions sysvar
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct PublishResult<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    // Market is looked up by pubkey supplied by client.
    #[account(mut)]
    pub market: Account<'info, Market>,
    /// CHECK: vault PDA — CPI signed with seeds [b"vault", market.key()]
    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), voter.key().as_ref()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,
    pub system_program: Program<'info, System>,
}

// ----------------------------------------------------------------
// ERROR CODES
// ----------------------------------------------------------------

#[error_code]
pub enum ErrorCode {
    #[msg("Cluster not set in MXE account")]
    ClusterNotSet,
}

#[error_code]
pub enum VeilError {
    #[msg("Computation was aborted by the MPC cluster")]
    AbortedComputation,
    #[msg("Market is not open for betting")]
    MarketNotOpen,
    #[msg("Market is not ready for resolution")]
    MarketNotResolvable,
    #[msg("Market has not been settled yet")]
    MarketNotSettled,
    #[msg("Position has already been claimed")]
    AlreadyClaimed,
    #[msg("This position is on the losing side")]
    NotAWinner,
    #[msg("Stake amount is below the minimum")]
    BelowMinimumStake,
    #[msg("Market is still active — end time has not passed")]
    MarketStillActive,
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    #[msg("Invalid end time — must be in the future")]
    InvalidEndTime,
}


