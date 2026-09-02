
import { createSlice } from '@reduxjs/toolkit';
import storage from './storage'; 

const initialState = {
    role: localStorage.getItem("role") || null,
};

const roleSlice = createSlice({
  name: 'role',
  initialState,
  reducers: {
    setRole: (state, action) => {
      state.role = action.payload;
      storage.set("role", action.payload);
    },
    clearRole: (state) => {
      state.role = null;
      storage.remove("role");
    },
  },
});

export const { setRole, clearRole } = roleSlice.actions;
export default roleSlice.reducer;