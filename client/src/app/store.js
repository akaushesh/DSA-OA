import { configureStore } from '@reduxjs/toolkit';
import authSlice from './authslice';
import roleSlice from './roleslice';

export const store = configureStore({
    reducer: {
        auth: authSlice,
        role: roleSlice
    }
})