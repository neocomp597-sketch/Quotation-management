import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import quotationDraftReducer from './quotationDraftSlice';
import { appApi } from './apiSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    quotationDraft: quotationDraftReducer,
    [appApi.reducerPath]: appApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(appApi.middleware),
});
