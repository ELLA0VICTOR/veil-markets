#!/usr/bin/env bash
set -euo pipefail

export VEIL_INIT_MARKET_STATE_CIRCUIT_URL="${VEIL_INIT_MARKET_STATE_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/init_market_state.arcis}"
export VEIL_INIT_USER_BALANCE_CIRCUIT_URL="${VEIL_INIT_USER_BALANCE_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/init_user_balance.arcis}"
export VEIL_DEPOSIT_BALANCE_CIRCUIT_URL="${VEIL_DEPOSIT_BALANCE_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/deposit_balance.arcis}"
export VEIL_WITHDRAW_BALANCE_CIRCUIT_URL="${VEIL_WITHDRAW_BALANCE_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/withdraw_balance.arcis}"
export VEIL_ADD_VOTE_CIRCUIT_URL="${VEIL_ADD_VOTE_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/add_vote.arcis}"
export VEIL_RESOLVE_MARKET_CIRCUIT_URL="${VEIL_RESOLVE_MARKET_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/resolve_market.arcis}"
export VEIL_CLAIM_PAYOUT_CIRCUIT_URL="${VEIL_CLAIM_PAYOUT_CIRCUIT_URL:-https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil-markets2/claim_payout.arcis}"

arcium deploy
