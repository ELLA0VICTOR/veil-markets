use anchor_lang::prelude::*;
use anchor_lang::system_program;
use arcium_anchor::prelude::*;
use arcium_client::idl::arcium::types::{CallbackAccount, CircuitSource, OffChainCircuitSource};
use arcium_macros::*;

declare_id!("Hq6Jyd8FjALKcdQoReCdsoyi51DW3dWHyGHVA2vWhU8z");

const CLUSTER_OFFSET: u64 = 456;

const MARKET_STATUS_INITIALIZING: u8 = 0;
const MARKET_STATUS_OPEN: u8 = 1;
const MARKET_STATUS_RESOLVING: u8 = 2;
const MARKET_STATUS_SETTLED: u8 = 3;

const POSITION_STATUS_PENDING: u8 = 0;
const POSITION_STATUS_ACTIVE: u8 = 1;
const POSITION_STATUS_CLAIMED: u8 = 2;
const POSITION_STATUS_REJECTED: u8 = 3;

const BALANCE_ACTION_NONE: u8 = 0;
const BALANCE_ACTION_INIT: u8 = 1;
const BALANCE_ACTION_DEPOSIT: u8 = 2;
const BALANCE_ACTION_WITHDRAW: u8 = 3;
const BALANCE_ACTION_BET: u8 = 4;
const BALANCE_ACTION_CLAIM: u8 = 5;

const STALE_PENDING_SLOT_TTL: u64 = 600;

const TREASURY_SEED: &[u8] = b"treasury";
const USER_BALANCE_SEED: &[u8] = b"user_balance";
const USER_BALANCE_PENDING_SEED: &[u8] = b"user_balance_pending";
const POSITION_SEED: &[u8] = b"position";

fn init_market_state_circuit_url() -> String {
    option_env!("VEIL_INIT_MARKET_STATE_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/init_market_state.arcis")
        .to_string()
}

fn init_user_balance_circuit_url() -> String {
    option_env!("VEIL_INIT_USER_BALANCE_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/init_user_balance.arcis")
        .to_string()
}

fn deposit_balance_circuit_url() -> String {
    option_env!("VEIL_DEPOSIT_BALANCE_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/deposit_balance.arcis")
        .to_string()
}

fn withdraw_balance_circuit_url() -> String {
    option_env!("VEIL_WITHDRAW_BALANCE_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/withdraw_balance.arcis")
        .to_string()
}

fn add_vote_circuit_url() -> String {
    option_env!("VEIL_ADD_VOTE_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/add_vote.arcis")
        .to_string()
}

fn resolve_market_circuit_url() -> String {
    option_env!("VEIL_RESOLVE_MARKET_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/resolve_market.arcis")
        .to_string()
}

fn claim_payout_circuit_url() -> String {
    option_env!("VEIL_CLAIM_PAYOUT_CIRCUIT_URL")
        .unwrap_or("https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/claim_payout.arcis")
        .to_string()
}

fn set_balance_pending_state(
    pending_state: &mut UserBalancePendingState,
    user_balance: Pubkey,
    action: u8,
    computation_account: Pubkey,
    started_at_slot: u64,
    bump: u8,
) {
    pending_state.user_balance = user_balance;
    pending_state.computation_account = computation_account;
    pending_state.action = action;
    pending_state.started_at_slot = started_at_slot;
    pending_state.bump = bump;
}

fn clear_balance_pending_state(pending_state: &mut UserBalancePendingState) {
    pending_state.computation_account = Pubkey::default();
    pending_state.action = BALANCE_ACTION_NONE;
    pending_state.started_at_slot = 0;
}

fn clear_balance_pending(
    user_balance: &mut UserBalance,
    pending_state: &mut UserBalancePendingState,
) {
    user_balance.pending_action = BALANCE_ACTION_NONE;
    user_balance.pending_withdraw_lamports = 0;
    clear_balance_pending_state(pending_state);
}

fn pending_callback_matches(
    pending_state: &UserBalancePendingState,
    user_balance: Pubkey,
    action: u8,
    computation_account: Pubkey,
) -> bool {
    pending_state.user_balance == user_balance
        && pending_state.action == action
        && pending_state.computation_account == computation_account
}

fn transfer_from_treasury<'info>(
    treasury: AccountInfo<'info>,
    recipient: AccountInfo<'info>,
    system_program_info: AccountInfo<'info>,
    amount: u64,
    treasury_bump: u8,
) -> Result<()> {
    let treasury_seeds: &[&[u8]] = &[TREASURY_SEED, &[treasury_bump]];
    let signer_seeds = &[treasury_seeds];
    let cpi_context = CpiContext::new_with_signer(
        system_program_info,
        system_program::Transfer {
            from: treasury,
            to: recipient,
        },
        signer_seeds,
    );
    system_program::transfer(cpi_context, amount)?;
    Ok(())
}

#[arcium_program]
pub mod veil_markets {
    use super::*;

    pub fn init_init_market_state_comp_def(ctx: Context<InitInitMarketStateCompDef>) -> Result<()> {
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

    pub fn init_init_user_balance_comp_def(ctx: Context<InitInitUserBalanceCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: init_user_balance_circuit_url(),
                hash: circuit_hash!("init_user_balance"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn init_deposit_balance_comp_def(ctx: Context<InitDepositBalanceCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: deposit_balance_circuit_url(),
                hash: circuit_hash!("deposit_balance"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn init_withdraw_balance_comp_def(ctx: Context<InitWithdrawBalanceCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: withdraw_balance_circuit_url(),
                hash: circuit_hash!("withdraw_balance"),
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
                hash: circuit_hash!("resolve_market_v2"),
            })),
            None,
        )?;
        Ok(())
    }

    pub fn init_claim_payout_comp_def(ctx: Context<InitClaimPayoutCompDef>) -> Result<()> {
        init_comp_def(
            ctx.accounts,
            Some(CircuitSource::OffChain(OffChainCircuitSource {
                source: claim_payout_circuit_url(),
                hash: circuit_hash!("claim_payout"),
            })),
            None,
        )?;
        Ok(())
    }

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
        require!(end_time > clock.unix_timestamp, VeilError::InvalidEndTime);
        require!(initial_pool_lamports == 0, VeilError::PublicSeedDisabled);

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.question = question;
        market.end_time = end_time;
        market.status = MARKET_STATUS_INITIALIZING;
        market.is_polymarket = is_polymarket;
        market.polymarket_condition_id = polymarket_condition_id;
        market.vote_count = 0;
        market.state_nonce = 0;
        market.state_ct_yes = [0u8; 32];
        market.state_ct_no = [0u8; 32];
        market.resolved_nonce = 0;
        market.resolved_ct_total_yes = [0u8; 32];
        market.resolved_ct_total_no = [0u8; 32];
        market.resolved_ct_yes_wins = [0u8; 32];
        market.pending_yes_wins = false;
        market.yes_wins = false;
        market.result_published = false;
        market.bump = ctx.bumps.market;

        let callback_ix = <InitMarketStateCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[CallbackAccount {
                pubkey: ctx.accounts.market.key(),
                is_writable: true,
            }],
        )?;

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
                market.status = MARKET_STATUS_OPEN;
            }
            Err(_) => return err!(VeilError::AbortedComputation),
        }
        Ok(())
    }

    pub fn init_user_balance(
        ctx: Context<InitUserBalance>,
        computation_offset: u64,
        viewer_pubkey: [u8; 32],
        viewer_nonce: u128,
    ) -> Result<()> {
        let current_slot = Clock::get()?.slot;
        let user_balance_key = ctx.accounts.user_balance.key();
        let computation_account_key = ctx.accounts.computation_account.key();

        {
            let balance = &mut ctx.accounts.user_balance;
            balance.owner = ctx.accounts.owner.key();
            balance.viewer_pubkey = viewer_pubkey;
            balance.state_nonce = 0;
            balance.state_ct = [0u8; 32];
            balance.view_encryption_key = [0u8; 32];
            balance.view_nonce = 0;
            balance.view_ct = [0u8; 32];
            balance.pending_action = BALANCE_ACTION_INIT;
            balance.pending_withdraw_lamports = 0;
            balance.bump = ctx.bumps.user_balance;
        }

        set_balance_pending_state(
            &mut ctx.accounts.pending_state,
            user_balance_key,
            BALANCE_ACTION_INIT,
            computation_account_key,
            current_slot,
            ctx.bumps.pending_state,
        );

        let callback_ix = <InitUserBalanceCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: user_balance_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.pending_state.key(),
                    is_writable: true,
                },
            ],
        )?;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .x25519_pubkey(viewer_pubkey)
                .plaintext_u128(viewer_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "init_user_balance")]
    pub fn init_user_balance_callback(
        ctx: Context<InitUserBalanceCallback>,
        output: SignedComputationOutputs<InitUserBalanceOutput>,
    ) -> Result<()> {
        if !pending_callback_matches(
            &ctx.accounts.pending_state,
            ctx.accounts.user_balance.key(),
            BALANCE_ACTION_INIT,
            ctx.accounts.computation_account.key(),
        ) {
            return Ok(());
        }

        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(InitUserBalanceOutput { field_0 }) => {
                {
                    let balance = &mut ctx.accounts.user_balance;
                    balance.state_nonce = field_0.field_0.nonce;
                    balance.state_ct = field_0.field_0.ciphertexts[0];
                    balance.view_encryption_key = field_0.field_1.encryption_key;
                    balance.view_nonce = field_0.field_1.nonce;
                    balance.view_ct = field_0.field_1.ciphertexts[0];
                }
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
            }
            Err(_) => {
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }
    pub fn deposit_balance(
        ctx: Context<DepositBalance>,
        computation_offset: u64,
        amount: u64,
        viewer_nonce: u128,
    ) -> Result<()> {
        require!(amount > 0, VeilError::InvalidAmount);
        require!(
            ctx.accounts.user_balance.pending_action == BALANCE_ACTION_NONE,
            VeilError::BalanceUpdatePending
        );

        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        );
        system_program::transfer(transfer_ctx, amount)?;

        let current_slot = Clock::get()?.slot;
        let user_balance_key = ctx.accounts.user_balance.key();
        let computation_account_key = ctx.accounts.computation_account.key();
        let pending_state_key = ctx.accounts.pending_state.key();

        let callback_ix = <DepositBalanceCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: user_balance_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: pending_state_key,
                    is_writable: true,
                },
            ],
        )?;

        let viewer_pubkey = ctx.accounts.user_balance.viewer_pubkey;
        let balance_nonce = ctx.accounts.user_balance.state_nonce;
        let balance_ct = ctx.accounts.user_balance.state_ct;

        ctx.accounts.user_balance.pending_action = BALANCE_ACTION_DEPOSIT;
        ctx.accounts.user_balance.pending_withdraw_lamports = 0;
        set_balance_pending_state(
            &mut ctx.accounts.pending_state,
            user_balance_key,
            BALANCE_ACTION_DEPOSIT,
            computation_account_key,
            current_slot,
            ctx.bumps.pending_state,
        );
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .plaintext_u64(amount)
                .plaintext_u128(balance_nonce)
                .encrypted_u64(balance_ct)
                .x25519_pubkey(viewer_pubkey)
                .plaintext_u128(viewer_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "deposit_balance")]
    pub fn deposit_balance_callback(
        ctx: Context<DepositBalanceCallback>,
        output: SignedComputationOutputs<DepositBalanceOutput>,
    ) -> Result<()> {
        if !pending_callback_matches(
            &ctx.accounts.pending_state,
            ctx.accounts.user_balance.key(),
            BALANCE_ACTION_DEPOSIT,
            ctx.accounts.computation_account.key(),
        ) {
            return Ok(());
        }

        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(DepositBalanceOutput { field_0 }) => {
                {
                    let balance = &mut ctx.accounts.user_balance;
                    balance.state_nonce = field_0.field_0.nonce;
                    balance.state_ct = field_0.field_0.ciphertexts[0];
                    balance.view_encryption_key = field_0.field_1.encryption_key;
                    balance.view_nonce = field_0.field_1.nonce;
                    balance.view_ct = field_0.field_1.ciphertexts[0];
                }
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
            }
            Err(_) => {
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }

    pub fn withdraw_balance(
        ctx: Context<WithdrawBalance>,
        computation_offset: u64,
        amount: u64,
        viewer_nonce: u128,
    ) -> Result<()> {
        require!(amount > 0, VeilError::InvalidAmount);
        require!(
            ctx.accounts.user_balance.pending_action == BALANCE_ACTION_NONE,
            VeilError::BalanceUpdatePending
        );

        let current_slot = Clock::get()?.slot;
        let user_balance_key = ctx.accounts.user_balance.key();
        let computation_account_key = ctx.accounts.computation_account.key();
        let pending_state_key = ctx.accounts.pending_state.key();

        let callback_ix = <WithdrawBalanceCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: user_balance_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: pending_state_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.owner.key(),
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.treasury.key(),
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.system_program.key(),
                    is_writable: false,
                },
            ],
        )?;

        let viewer_pubkey = ctx.accounts.user_balance.viewer_pubkey;
        let balance_nonce = ctx.accounts.user_balance.state_nonce;
        let balance_ct = ctx.accounts.user_balance.state_ct;

        ctx.accounts.user_balance.pending_action = BALANCE_ACTION_WITHDRAW;
        ctx.accounts.user_balance.pending_withdraw_lamports = amount;
        set_balance_pending_state(
            &mut ctx.accounts.pending_state,
            user_balance_key,
            BALANCE_ACTION_WITHDRAW,
            computation_account_key,
            current_slot,
            ctx.bumps.pending_state,
        );
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .plaintext_u64(amount)
                .plaintext_u128(balance_nonce)
                .encrypted_u64(balance_ct)
                .x25519_pubkey(viewer_pubkey)
                .plaintext_u128(viewer_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "withdraw_balance")]
    pub fn withdraw_balance_callback(
        ctx: Context<WithdrawBalanceCallback>,
        output: SignedComputationOutputs<WithdrawBalanceOutput>,
    ) -> Result<()> {
        if !pending_callback_matches(
            &ctx.accounts.pending_state,
            ctx.accounts.user_balance.key(),
            BALANCE_ACTION_WITHDRAW,
            ctx.accounts.computation_account.key(),
        ) {
            return Ok(());
        }

        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(WithdrawBalanceOutput { field_0 }) => {
                let withdraw_amount = ctx.accounts.user_balance.pending_withdraw_lamports;
                {
                    let balance = &mut ctx.accounts.user_balance;
                    balance.state_nonce = field_0.field_0.nonce;
                    balance.state_ct = field_0.field_0.ciphertexts[0];
                    balance.view_encryption_key = field_0.field_1.encryption_key;
                    balance.view_nonce = field_0.field_1.nonce;
                    balance.view_ct = field_0.field_1.ciphertexts[0];
                }
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );

                if field_0.field_2 && withdraw_amount > 0 {
                    transfer_from_treasury(
                        ctx.accounts.treasury.to_account_info(),
                        ctx.accounts.owner.to_account_info(),
                        ctx.accounts.system_program.to_account_info(),
                        withdraw_amount,
                        ctx.bumps.treasury,
                    )?;
                }
            }
            Err(_) => {
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }

    pub fn place_vote(
        ctx: Context<PlaceVote>,
        computation_offset: u64,
        viewer_nonce: u128,
        vote_nonce: u128,
        vote_is_yes_ct: [u8; 32],
        vote_stake_ct: [u8; 32],
        vote_pub_key: [u8; 32],
    ) -> Result<()> {
        require!(
            ctx.accounts.market.status == MARKET_STATUS_OPEN,
            VeilError::MarketNotOpen
        );
        require!(
            Clock::get()?.unix_timestamp < ctx.accounts.market.end_time,
            VeilError::MarketStillActive
        );
        require!(
            ctx.accounts.user_balance.pending_action == BALANCE_ACTION_NONE,
            VeilError::BalanceUpdatePending
        );

        if ctx.accounts.position.market != Pubkey::default()
            && ctx.accounts.position.status != POSITION_STATUS_REJECTED
            && ctx.accounts.position.status != POSITION_STATUS_CLAIMED
        {
            return err!(VeilError::PositionAlreadyExists);
        }

        let current_slot = Clock::get()?.slot;
        let computation_account_key = ctx.accounts.computation_account.key();
        let user_balance_key = ctx.accounts.user_balance.key();
        let pending_state_key = ctx.accounts.pending_state.key();

        let callback_ix = <AddVoteCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: ctx.accounts.market.key(),
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: user_balance_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: pending_state_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.position.key(),
                    is_writable: true,
                },
            ],
        )?;

        ctx.accounts.position.market = ctx.accounts.market.key();
        ctx.accounts.position.voter = ctx.accounts.voter.key();
        ctx.accounts.position.vote_pubkey = vote_pub_key;
        ctx.accounts.position.vote_nonce = vote_nonce;
        ctx.accounts.position.vote_ct_is_yes = vote_is_yes_ct;
        ctx.accounts.position.vote_ct_stake = vote_stake_ct;
        ctx.accounts.position.status = POSITION_STATUS_PENDING;
        ctx.accounts.position.bump = ctx.bumps.position;

        let market_nonce = ctx.accounts.market.state_nonce;
        let market_ct_yes = ctx.accounts.market.state_ct_yes;
        let market_ct_no = ctx.accounts.market.state_ct_no;
        let balance_nonce = ctx.accounts.user_balance.state_nonce;
        let balance_ct = ctx.accounts.user_balance.state_ct;
        let viewer_pubkey = ctx.accounts.user_balance.viewer_pubkey;

        ctx.accounts.user_balance.pending_action = BALANCE_ACTION_BET;
        ctx.accounts.user_balance.pending_withdraw_lamports = 0;
        set_balance_pending_state(
            &mut ctx.accounts.pending_state,
            user_balance_key,
            BALANCE_ACTION_BET,
            computation_account_key,
            current_slot,
            ctx.bumps.pending_state,
        );
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .x25519_pubkey(vote_pub_key)
                .plaintext_u128(vote_nonce)
                .encrypted_bool(vote_is_yes_ct)
                .encrypted_u64(vote_stake_ct)
                .plaintext_u128(market_nonce)
                .encrypted_u64(market_ct_yes)
                .encrypted_u64(market_ct_no)
                .plaintext_u128(balance_nonce)
                .encrypted_u64(balance_ct)
                .x25519_pubkey(viewer_pubkey)
                .plaintext_u128(viewer_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "add_vote")]
    pub fn add_vote_callback(
        ctx: Context<AddVoteCallback>,
        output: SignedComputationOutputs<AddVoteOutput>,
    ) -> Result<()> {
        if !pending_callback_matches(
            &ctx.accounts.pending_state,
            ctx.accounts.user_balance.key(),
            BALANCE_ACTION_BET,
            ctx.accounts.computation_account.key(),
        ) {
            return Ok(());
        }

        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(AddVoteOutput { field_0 }) => {
                let market = &mut ctx.accounts.market;
                market.state_nonce = field_0.field_0.nonce;
                market.state_ct_yes = field_0.field_0.ciphertexts[0];
                market.state_ct_no = field_0.field_0.ciphertexts[1];

                {
                    let balance = &mut ctx.accounts.user_balance;
                    balance.state_nonce = field_0.field_1.nonce;
                    balance.state_ct = field_0.field_1.ciphertexts[0];
                    balance.view_encryption_key = field_0.field_2.encryption_key;
                    balance.view_nonce = field_0.field_2.nonce;
                    balance.view_ct = field_0.field_2.ciphertexts[0];
                }
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );

                let position = &mut ctx.accounts.position;
                if field_0.field_3 {
                    position.status = POSITION_STATUS_ACTIVE;
                    market.vote_count = market.vote_count.saturating_add(1);
                } else {
                    position.status = POSITION_STATUS_REJECTED;
                }
            }
            Err(_) => {
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                ctx.accounts.position.status = POSITION_STATUS_REJECTED;
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }
    pub fn resolve_market(
        ctx: Context<ResolveMarket>,
        computation_offset: u64,
        outcome_yes: bool,
    ) -> Result<()> {
        require!(
            ctx.accounts.market.status == MARKET_STATUS_OPEN,
            VeilError::MarketNotOpen
        );
        require!(
            Clock::get()?.unix_timestamp >= ctx.accounts.market.end_time,
            VeilError::MarketStillActive
        );

        ctx.accounts.market.status = MARKET_STATUS_RESOLVING;
        ctx.accounts.market.pending_yes_wins = outcome_yes;

        let callback_ix = <ResolveMarketV2Callback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[CallbackAccount {
                pubkey: ctx.accounts.market.key(),
                is_writable: true,
            }],
        )?;

        let state_nonce = ctx.accounts.market.state_nonce;
        let state_ct_yes = ctx.accounts.market.state_ct_yes;
        let state_ct_no = ctx.accounts.market.state_ct_no;

        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .plaintext_u128(state_nonce)
                .encrypted_u64(state_ct_yes)
                .encrypted_u64(state_ct_no)
                .plaintext_u64(if outcome_yes { 1 } else { 0 })
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "resolve_market_v2")]
    pub fn resolve_market_v2_callback(
        ctx: Context<ResolveMarketV2Callback>,
        output: SignedComputationOutputs<ResolveMarketV2Output>,
    ) -> Result<()> {
        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ResolveMarketV2Output { field_0 }) => {
                let market = &mut ctx.accounts.market;
                market.resolved_nonce = field_0.nonce;
                market.resolved_ct_total_yes = field_0.ciphertexts[0];
                market.resolved_ct_total_no = field_0.ciphertexts[1];
                market.resolved_ct_yes_wins = field_0.ciphertexts[2];
                market.yes_wins = market.pending_yes_wins;
                market.result_published = true;
                market.status = MARKET_STATUS_SETTLED;
            }
            Err(_) => {
                ctx.accounts.market.status = MARKET_STATUS_OPEN;
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }

    pub fn claim_winnings(
        ctx: Context<ClaimWinnings>,
        computation_offset: u64,
        viewer_nonce: u128,
    ) -> Result<()> {
        require!(
            ctx.accounts.market.status == MARKET_STATUS_SETTLED
                && ctx.accounts.market.result_published,
            VeilError::MarketNotSettled
        );
        require!(
            ctx.accounts.position.status == POSITION_STATUS_ACTIVE,
            VeilError::PositionNotClaimable
        );
        require!(
            ctx.accounts.user_balance.pending_action == BALANCE_ACTION_NONE,
            VeilError::BalanceUpdatePending
        );

        let current_slot = Clock::get()?.slot;
        let user_balance_key = ctx.accounts.user_balance.key();
        let pending_state_key = ctx.accounts.pending_state.key();
        let computation_account_key = ctx.accounts.computation_account.key();

        let callback_ix = <ClaimPayoutCallback as CallbackCompAccs>::callback_ix(
            computation_offset,
            &ctx.accounts.mxe_account,
            &[
                CallbackAccount {
                    pubkey: user_balance_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: pending_state_key,
                    is_writable: true,
                },
                CallbackAccount {
                    pubkey: ctx.accounts.position.key(),
                    is_writable: true,
                },
            ],
        )?;

        let vote_pubkey = ctx.accounts.position.vote_pubkey;
        let vote_nonce = ctx.accounts.position.vote_nonce;
        let vote_ct_is_yes = ctx.accounts.position.vote_ct_is_yes;
        let vote_ct_stake = ctx.accounts.position.vote_ct_stake;
        let settled_nonce = ctx.accounts.market.resolved_nonce;
        let settled_ct_total_yes = ctx.accounts.market.resolved_ct_total_yes;
        let settled_ct_total_no = ctx.accounts.market.resolved_ct_total_no;
        let settled_ct_yes_wins = ctx.accounts.market.resolved_ct_yes_wins;
        let balance_nonce = ctx.accounts.user_balance.state_nonce;
        let balance_ct = ctx.accounts.user_balance.state_ct;
        let viewer_pubkey = ctx.accounts.user_balance.viewer_pubkey;

        ctx.accounts.user_balance.pending_action = BALANCE_ACTION_CLAIM;
        ctx.accounts.user_balance.pending_withdraw_lamports = 0;
        set_balance_pending_state(
            &mut ctx.accounts.pending_state,
            user_balance_key,
            BALANCE_ACTION_CLAIM,
            computation_account_key,
            current_slot,
            ctx.bumps.pending_state,
        );
        ctx.accounts.sign_pda_account.bump = ctx.bumps.sign_pda_account;
        queue_computation(
            ctx.accounts,
            computation_offset,
            ArgBuilder::new()
                .x25519_pubkey(vote_pubkey)
                .plaintext_u128(vote_nonce)
                .encrypted_bool(vote_ct_is_yes)
                .encrypted_u64(vote_ct_stake)
                .plaintext_u128(settled_nonce)
                .encrypted_u64(settled_ct_total_yes)
                .encrypted_u64(settled_ct_total_no)
                .encrypted_bool(settled_ct_yes_wins)
                .plaintext_u128(balance_nonce)
                .encrypted_u64(balance_ct)
                .x25519_pubkey(viewer_pubkey)
                .plaintext_u128(viewer_nonce)
                .build(),
            vec![callback_ix],
            1,
            CLUSTER_OFFSET,
        )?;

        Ok(())
    }

    #[arcium_callback(encrypted_ix = "claim_payout")]
    pub fn claim_payout_callback(
        ctx: Context<ClaimPayoutCallback>,
        output: SignedComputationOutputs<ClaimPayoutOutput>,
    ) -> Result<()> {
        if !pending_callback_matches(
            &ctx.accounts.pending_state,
            ctx.accounts.user_balance.key(),
            BALANCE_ACTION_CLAIM,
            ctx.accounts.computation_account.key(),
        ) {
            return Ok(());
        }

        match output.verify_output(
            &ctx.accounts.cluster_account,
            &ctx.accounts.computation_account,
        ) {
            Ok(ClaimPayoutOutput { field_0 }) => {
                {
                    let balance = &mut ctx.accounts.user_balance;
                    balance.state_nonce = field_0.field_0.nonce;
                    balance.state_ct = field_0.field_0.ciphertexts[0];
                    balance.view_encryption_key = field_0.field_1.encryption_key;
                    balance.view_nonce = field_0.field_1.nonce;
                    balance.view_ct = field_0.field_1.ciphertexts[0];
                }
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                ctx.accounts.position.status = POSITION_STATUS_CLAIMED;
            }
            Err(_) => {
                clear_balance_pending(
                    &mut ctx.accounts.user_balance,
                    &mut ctx.accounts.pending_state,
                );
                return err!(VeilError::AbortedComputation);
            }
        }
        Ok(())
    }

    pub fn recover_stale_balance_action(ctx: Context<RecoverStaleBalanceAction>) -> Result<()> {
        require!(
            ctx.accounts.user_balance.pending_action != BALANCE_ACTION_NONE,
            VeilError::NoPendingBalanceAction
        );

        if ctx.accounts.pending_state.user_balance == Pubkey::default() {
            ctx.accounts.pending_state.user_balance = ctx.accounts.user_balance.key();
            ctx.accounts.pending_state.bump = ctx.bumps.pending_state;
        }

        if ctx.accounts.pending_state.action != BALANCE_ACTION_NONE {
            require!(
                ctx.accounts.pending_state.user_balance == ctx.accounts.user_balance.key(),
                VeilError::PendingStateMismatch
            );

            let current_slot = Clock::get()?.slot;
            let elapsed = current_slot.saturating_sub(ctx.accounts.pending_state.started_at_slot);
            require!(
                elapsed >= STALE_PENDING_SLOT_TTL,
                VeilError::PendingActionStillFresh
            );
        }

        clear_balance_pending(
            &mut ctx.accounts.user_balance,
            &mut ctx.accounts.pending_state,
        );
        Ok(())
    }
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub creator: Pubkey,
    pub question: [u8; 280],
    pub end_time: i64,
    pub status: u8,
    pub is_polymarket: bool,
    pub polymarket_condition_id: [u8; 32],
    pub vote_count: u32,
    pub state_nonce: u128,
    pub state_ct_yes: [u8; 32],
    pub state_ct_no: [u8; 32],
    pub resolved_nonce: u128,
    pub resolved_ct_total_yes: [u8; 32],
    pub resolved_ct_total_no: [u8; 32],
    pub resolved_ct_yes_wins: [u8; 32],
    pub pending_yes_wins: bool,
    pub yes_wins: bool,
    pub result_published: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserBalance {
    pub owner: Pubkey,
    pub viewer_pubkey: [u8; 32],
    pub state_nonce: u128,
    pub state_ct: [u8; 32],
    pub view_encryption_key: [u8; 32],
    pub view_nonce: u128,
    pub view_ct: [u8; 32],
    pub pending_action: u8,
    pub pending_withdraw_lamports: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserBalancePendingState {
    pub user_balance: Pubkey,
    pub computation_account: Pubkey,
    pub action: u8,
    pub started_at_slot: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub market: Pubkey,
    pub voter: Pubkey,
    pub vote_pubkey: [u8; 32],
    pub vote_nonce: u128,
    pub vote_ct_is_yes: [u8; 32],
    pub vote_ct_stake: [u8; 32],
    pub status: u8,
    pub bump: u8,
}
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

#[init_computation_definition_accounts("init_user_balance", payer)]
#[derive(Accounts)]
pub struct InitInitUserBalanceCompDef<'info> {
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

#[init_computation_definition_accounts("deposit_balance", payer)]
#[derive(Accounts)]
pub struct InitDepositBalanceCompDef<'info> {
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

#[init_computation_definition_accounts("withdraw_balance", payer)]
#[derive(Accounts)]
pub struct InitWithdrawBalanceCompDef<'info> {
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

#[init_computation_definition_accounts("resolve_market_v2", payer)]
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

#[init_computation_definition_accounts("claim_payout", payer)]
#[derive(Accounts)]
pub struct InitClaimPayoutCompDef<'info> {
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
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[queue_computation_accounts("init_user_balance", owner)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct InitUserBalance<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        init,
        payer = owner,
        space = 8 + UserBalance::INIT_SPACE,
        seeds = [USER_BALANCE_SEED, owner.key().as_ref()],
        bump,
    )]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, owner.key().as_ref()],
        bump,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        init_if_needed,
        payer = owner,
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

#[callback_accounts("init_user_balance")]
#[derive(Accounts)]
pub struct InitUserBalanceCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        mut,
        seeds = [USER_BALANCE_PENDING_SEED, user_balance.owner.as_ref()],
        bump = pending_state.bump,
        constraint = pending_state.user_balance == user_balance.key() @ VeilError::PendingStateMismatch,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
}
#[queue_computation_accounts("deposit_balance", owner)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct DepositBalance<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_BALANCE_SEED, owner.key().as_ref()],
        bump = user_balance.bump,
        constraint = user_balance.owner == owner.key() @ VeilError::Unauthorized,
    )]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, owner.key().as_ref()],
        bump,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
    /// CHECK: Shared treasury PDA used for private balance deposits and withdrawals.
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        init_if_needed,
        payer = owner,
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

#[callback_accounts("deposit_balance")]
#[derive(Accounts)]
pub struct DepositBalanceCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        mut,
        seeds = [USER_BALANCE_PENDING_SEED, user_balance.owner.as_ref()],
        bump = pending_state.bump,
        constraint = pending_state.user_balance == user_balance.key() @ VeilError::PendingStateMismatch,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
}

#[queue_computation_accounts("withdraw_balance", owner)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct WithdrawBalance<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_BALANCE_SEED, owner.key().as_ref()],
        bump = user_balance.bump,
        constraint = user_balance.owner == owner.key() @ VeilError::Unauthorized,
    )]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, owner.key().as_ref()],
        bump,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
    /// CHECK: Shared treasury PDA used for private balance deposits and withdrawals.
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        init_if_needed,
        payer = owner,
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

#[callback_accounts("withdraw_balance")]
#[derive(Accounts)]
pub struct WithdrawBalanceCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        mut,
        seeds = [USER_BALANCE_PENDING_SEED, user_balance.owner.as_ref()],
        bump = pending_state.bump,
        constraint = pending_state.user_balance == user_balance.key() @ VeilError::PendingStateMismatch,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
    /// CHECK: Recipient wallet account for withdrawals.
    #[account(mut, address = user_balance.owner)]
    pub owner: UncheckedAccount<'info>,
    /// CHECK: Shared treasury PDA used for private balance deposits and withdrawals.
    #[account(
        mut,
        seeds = [TREASURY_SEED],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("add_vote", voter)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct PlaceVote<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        seeds = [USER_BALANCE_SEED, voter.key().as_ref()],
        bump = user_balance.bump,
        constraint = user_balance.owner == voter.key() @ VeilError::Unauthorized,
    )]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, voter.key().as_ref()],
        bump,
    )]
    pub pending_state: Box<Account<'info, UserBalancePendingState>>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + Position::INIT_SPACE,
        seeds = [POSITION_SEED, market.key().as_ref(), voter.key().as_ref()],
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
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Box<Account<'info, Cluster>>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,
    #[account(mut)]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        mut,
        seeds = [USER_BALANCE_PENDING_SEED, user_balance.owner.as_ref()],
        bump = pending_state.bump,
        constraint = pending_state.user_balance == user_balance.key() @ VeilError::PendingStateMismatch,
    )]
    pub pending_state: Box<Account<'info, UserBalancePendingState>>,
    #[account(mut)]
    pub position: Box<Account<'info, Position>>,
}

#[queue_computation_accounts("resolve_market_v2", resolver)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ResolveMarket<'info> {
    #[account(mut)]
    pub resolver: Signer<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(
        init_if_needed,
        payer = resolver,
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

#[callback_accounts("resolve_market_v2")]
#[derive(Accounts)]
pub struct ResolveMarketV2Callback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    pub mxe_account: Account<'info, MXEAccount>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Account<'info, Cluster>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub market: Account<'info, Market>,
}

#[queue_computation_accounts("claim_payout", voter)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ClaimWinnings<'info> {
    #[account(mut)]
    pub voter: Signer<'info>,
    #[account(mut)]
    pub market: Box<Account<'info, Market>>,
    #[account(
        mut,
        seeds = [USER_BALANCE_SEED, voter.key().as_ref()],
        bump = user_balance.bump,
        constraint = user_balance.owner == voter.key() @ VeilError::Unauthorized,
    )]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        init_if_needed,
        payer = voter,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, voter.key().as_ref()],
        bump,
    )]
    pub pending_state: Box<Account<'info, UserBalancePendingState>>,
    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), voter.key().as_ref()],
        bump = position.bump,
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

#[callback_accounts("claim_payout")]
#[derive(Accounts)]
pub struct ClaimPayoutCallback<'info> {
    pub arcium_program: Program<'info, Arcium>,
    pub comp_def_account: Box<Account<'info, ComputationDefinitionAccount>>,
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    /// CHECK: Computation PDA is verified by Arcium callback validation before output decoding.
    pub computation_account: UncheckedAccount<'info>,
    pub cluster_account: Box<Account<'info, Cluster>>,
    /// CHECK: Instructions sysvar is validated by the callback macro helper before use.
    pub instructions_sysvar: UncheckedAccount<'info>,
    #[account(mut)]
    pub user_balance: Box<Account<'info, UserBalance>>,
    #[account(
        mut,
        seeds = [USER_BALANCE_PENDING_SEED, user_balance.owner.as_ref()],
        bump = pending_state.bump,
        constraint = pending_state.user_balance == user_balance.key() @ VeilError::PendingStateMismatch,
    )]
    pub pending_state: Box<Account<'info, UserBalancePendingState>>,
    #[account(mut)]
    pub position: Box<Account<'info, Position>>,
}

#[derive(Accounts)]
pub struct RecoverStaleBalanceAction<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_BALANCE_SEED, owner.key().as_ref()],
        bump = user_balance.bump,
        constraint = user_balance.owner == owner.key() @ VeilError::Unauthorized,
    )]
    pub user_balance: Account<'info, UserBalance>,
    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserBalancePendingState::INIT_SPACE,
        seeds = [USER_BALANCE_PENDING_SEED, owner.key().as_ref()],
        bump,
    )]
    pub pending_state: Account<'info, UserBalancePendingState>,
    pub system_program: Program<'info, System>,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Cluster not set in MXE account")]
    ClusterNotSet,
}

#[error_code]
pub enum VeilError {
    #[msg("Computation was aborted by the MPC cluster")]
    AbortedComputation,
    #[msg("End time must be in the future")]
    InvalidEndTime,
    #[msg("This market is not open")]
    MarketNotOpen,
    #[msg("This action is not available yet")]
    MarketStillActive,
    #[msg("This market is not settled yet")]
    MarketNotSettled,
    #[msg("Creator seed deposits are disabled in private mode")]
    PublicSeedDisabled,
    #[msg("Another private balance update is already pending")]
    BalanceUpdatePending,
    #[msg("Private balance amount must be greater than zero")]
    InvalidAmount,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("You already have an active private position for this market")]
    PositionAlreadyExists,
    #[msg("This position cannot be claimed")]
    PositionNotClaimable,
    #[msg("There is no pending private balance action to recover")]
    NoPendingBalanceAction,
    #[msg("This pending balance action is still within the callback wait window")]
    PendingActionStillFresh,
    #[msg("The pending balance state does not match this private balance account")]
    PendingStateMismatch,
}
