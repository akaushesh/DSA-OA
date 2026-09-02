import { createSlice } from '@reduxjs/toolkit';
import storage from './storage';

const initialState = storage.get("auth", {
  status: false,
  userData: null,
  accessToken: null,
  refreshToken: null,
});

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
        state.status = true;
        state.userData = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;

        storage.set("auth", {
            status: true,
            userData: action.payload.user,
            accessToken: action.payload.accessToken,
            refreshToken: action.payload.refreshToken,
        });
    },

    logout: (state) => {
      state.status = false;
      state.userData = null;
      state.token = null;
      storage.remove('auth');
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;