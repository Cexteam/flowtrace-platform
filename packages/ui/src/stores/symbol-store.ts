import { create } from 'zustand';

interface SymbolState {
  activeSymbol: string;
  symbols: string[];
  setActiveSymbol: (symbol: string) => void;
  addSymbol: (symbol: string) => void;
  removeSymbol: (symbol: string) => void;
}

export const useSymbolStore = create<SymbolState>((set) => ({
  activeSymbol: 'BTCUSDT',
  symbols: ['BTCUSDT', 'ETHUSDT'],
  setActiveSymbol: (symbol) => set({ activeSymbol: symbol }),
  addSymbol: (symbol) =>
    set((state) => ({
      symbols: state.symbols.includes(symbol)
        ? state.symbols
        : [...state.symbols, symbol],
    })),
  removeSymbol: (symbol) =>
    set((state) => ({
      symbols: state.symbols.filter((s) => s !== symbol),
      activeSymbol:
        state.activeSymbol === symbol
          ? state.symbols[0] || 'BTCUSDT'
          : state.activeSymbol,
    })),
}));
