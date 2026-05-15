import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  permissions: {},
  accessTokenReady: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload?.user || null;
      state.permissions = action.payload?.permissions || state.permissions || {};
      state.accessTokenReady = true;
    },
    setPermissions: (state, action) => {
      state.permissions = action.payload || {};
    },
    clearCredentials: (state) => {
      state.user = null;
      state.permissions = {};
      state.accessTokenReady = false;
    },
  },
});

export const { setCredentials, setPermissions, clearCredentials } = authSlice.actions;
export default authSlice.reducer;
