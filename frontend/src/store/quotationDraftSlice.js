import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  current: null,
  autosaveStatus: 'idle',
  lastSavedAt: null,
};

const quotationDraftSlice = createSlice({
  name: 'quotationDraft',
  initialState,
  reducers: {
    setQuotationDraft: (state, action) => {
      state.current = action.payload;
    },
    setAutosaveStatus: (state, action) => {
      state.autosaveStatus = action.payload;
      if (action.payload === 'saved') {
        state.lastSavedAt = new Date().toISOString();
      }
    },
    clearQuotationDraft: (state) => {
      state.current = null;
      state.autosaveStatus = 'idle';
      state.lastSavedAt = null;
    },
  },
});

export const { setQuotationDraft, setAutosaveStatus, clearQuotationDraft } = quotationDraftSlice.actions;
export default quotationDraftSlice.reducer;
