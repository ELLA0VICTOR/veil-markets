#!/usr/bin/env bash
set -euo pipefail

export VEIL_ADD_VOTE_CIRCUIT_URL="https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil/add_vote.arcis"
export VEIL_INIT_MARKET_STATE_CIRCUIT_URL="https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil/init_market_state.arcis"
export VEIL_RESOLVE_MARKET_CIRCUIT_URL="https://zxfradkkhbepggmffgav.supabase.co/storage/v1/object/public/veil/resolve_market.arcis"

anchor build