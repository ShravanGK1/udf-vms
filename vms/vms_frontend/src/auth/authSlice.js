import { createSlice } from "@reduxjs/toolkit";

const authSlice = createSlice({
  name: "auth",
  initialState: {
    role: sessionStorage.getItem("role") || null,
    token: sessionStorage.getItem("token") || null,
  },
  reducers: {
    loginSuccess: (state, action) => {
      state.role = action.payload.user?.role || action.payload.role;
      state.token = action.payload.token;
      sessionStorage.setItem("token", action.payload.token);
      if (state.role) sessionStorage.setItem("role", state.role);
    },
    logout: (state) => {
      state.role = null;
      state.token = null;
      sessionStorage.clear();
    },
  },
});

export const { loginSuccess, logout } = authSlice.actions;
export default authSlice.reducer;
