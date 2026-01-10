-- Migration: Add bin_multiplier column to symbols table
-- Purpose: Support footprint bin size optimization feature
-- bin_multiplier is used to calculate effective_bin_size = tick_value × bin_multiplier
-- NULL means auto-calculate based on current price

ALTER TABLE symbols ADD COLUMN bin_multiplier INTEGER;
